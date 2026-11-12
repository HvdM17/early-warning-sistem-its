"""
03b_ablasi_tren.py

Dua hal dalam satu skrip:
  1. Memeriksa apakah kekosongan tren_nilai terkonsentrasi (per modul, per presentasi,
     dan apakah berkaitan dengan label).
  2. Uji banding: model dengan 7 fitur vs 6 fitur (tanpa tren_nilai).

ATURAN KEPUTUSAN (ditetapkan sebelum hasil dilihat, tidak boleh diubah setelah uji):
  - Keputusan dibuat dari validasi silang 5-fold pada DATA LATIH saja.
  - Kedua versi memakai fold yang sama, sehingga selisih dihitung berpasangan per fold:
        d_i = recall_dengan_tren_i - recall_tanpa_tren_i
  - Untuk setiap model (KNN dan MLP):
        dbar = rata-rata d_i
        SE   = std(d_i, ddof=1) / sqrt(jumlah fold)
  - tren_nilai DIBUANG hanya jika |dbar| <= 2 * SE untuk KUEDUA model.
    Selain itu, tren_nilai DIPERTAHANKAN.
    Jika d_i semuanya nol (tidak ada beda sama sekali), kondisi ini terpenuhi dan fitur dibuang.
  - Data uji dievaluasi untuk KEDUA versi dan dilaporkan, tetapi tidak dipakai
    untuk keputusan.

Output (models/):
  ablation.json           seluruh hasil: pola kekosongan, CV, keputusan, dan data uji
  feature_selection.json  daftar fitur final yang dipakai 03_train_knn_mlp.py

Cara menjalankan (dari folder root, venv aktif):
    python training\\03b_ablasi_tren.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_val_score, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

SEED = 42
TEST_SIZE = 0.2
N_SPLITS = 5
K_CANDIDATES = [3, 5, 7, 9, 11, 15]
THRESHOLD = 0.5
MLP_HIDDEN = (32, 16)
MLP_MAX_ITER = 200

ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"

ALL_FEATURES = [
    "aktivitas_7h",
    "aktivitas_14h",
    "hari_sejak_aktif",
    "rata_nilai_tugas",
    "tren_nilai",
    "jumlah_tugas_dikumpulkan",
    "rasio_tugas_selesai",
]
ABLATION_FEATURE = "tren_nilai"
FEATURES_WITHOUT = [f for f in ALL_FEATURES if f != ABLATION_FEATURE]


def make_pipeline(model) -> Pipeline:
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("clf", model),
        ]
    )


def knn_pipeline(k: int) -> Pipeline:
    return make_pipeline(KNeighborsClassifier(n_neighbors=k))


def mlp_pipeline() -> Pipeline:
    # Adam dengan early stopping. Data latih OULAD sekitar 24.000 baris, sehingga
    # validation split (10%) cukup besar. Pada data sebesar ini lbfgs tidak konvergen
    # dalam 2000 iterasi dan jauh lebih lambat.
    return make_pipeline(
        MLPClassifier(
            hidden_layer_sizes=MLP_HIDDEN,
            activation="relu",
            solver="adam",
            early_stopping=True,
            validation_fraction=0.1,
            n_iter_no_change=10,
            max_iter=MLP_MAX_ITER,
            random_state=SEED,
        )
    )


# ---------------------------------------------------------------------------
# 1. Pola kekosongan tren_nilai
# ---------------------------------------------------------------------------
def missingness_report(df: pd.DataFrame) -> dict:
    missing = df[ABLATION_FEATURE].isna()
    report = {
        "kosong_keseluruhan": round(float(missing.mean()), 4),
        "label_rate_saat_kosong": round(float(df.loc[missing, "at_risk"].mean()), 4),
        "label_rate_saat_ada_nilai": round(float(df.loc[~missing, "at_risk"].mean()), 4),
        "per_code_module": {},
        "per_code_presentation": {},
    }
    for col, key in [("code_module", "per_code_module"), ("code_presentation", "per_code_presentation")]:
        report[key] = {
            str(k): round(float(v), 4)
            for k, v in df.groupby(col)[ABLATION_FEATURE].agg(lambda s: s.isna().mean()).items()
        }
    return report


# ---------------------------------------------------------------------------
# 2. Validasi silang pada data latih
# ---------------------------------------------------------------------------
def cv_for_features(X_tr: pd.DataFrame, y_tr: pd.Series, feats: list[str], cv) -> dict:
    search = GridSearchCV(
        knn_pipeline(5),
        param_grid={"clf__n_neighbors": K_CANDIDATES},
        cv=cv,
        scoring="recall",
    )
    search.fit(X_tr[feats], y_tr)
    best_k = int(search.best_params_["clf__n_neighbors"])

    knn_scores = cross_val_score(knn_pipeline(best_k), X_tr[feats], y_tr, cv=cv, scoring="recall")
    mlp_scores = cross_val_score(mlp_pipeline(), X_tr[feats], y_tr, cv=cv, scoring="recall")
    return {
        "knn_best_k": best_k,
        "knn_cv_scores": knn_scores,
        "mlp_cv_scores": mlp_scores,
    }


def decide(with_tren: dict, without_tren: dict) -> tuple[bool, dict]:
    per_model = {}
    for name in ["knn", "mlp"]:
        a = np.asarray(with_tren[f"{name}_cv_scores"], dtype=float)
        b = np.asarray(without_tren[f"{name}_cv_scores"], dtype=float)
        d = a - b                                   # selisih berpasangan per fold
        dbar = float(d.mean())
        se = float(d.std(ddof=1) / np.sqrt(len(d)))
        batas = 2.0 * se
        per_model[name] = {
            "cv_recall_dengan_tren": round(float(a.mean()), 4),
            "cv_recall_tanpa_tren": round(float(b.mean()), 4),
            "selisih_rata_per_fold": round(dbar, 4),
            "galat_standar": round(se, 4),
            "batas_2_galat_standar": round(batas, 4),
            "dalam_batas": bool(abs(dbar) <= batas),
        }
    drop = all(v["dalam_batas"] for v in per_model.values())
    return drop, per_model


# ---------------------------------------------------------------------------
# 3. Evaluasi pada data uji (hanya untuk laporan)
# ---------------------------------------------------------------------------
def evaluate(name: str, pipe, X: pd.DataFrame, y: pd.Series) -> dict:
    proba = pipe.predict_proba(X)[:, 1]
    pred = (proba >= THRESHOLD).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {
        "model": name,
        "accuracy": float(accuracy_score(y, pred)),
        "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred, zero_division=0)),
        "f1": float(f1_score(y, pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, proba)),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def test_both(X_tr, y_tr, X_te, y_te, feats: list[str], best_k: int) -> list[dict]:
    knn = knn_pipeline(best_k).fit(X_tr[feats], y_tr)
    mlp = mlp_pipeline().fit(X_tr[feats], y_tr)
    return [
        evaluate("KNN", knn, X_te[feats], y_te),
        evaluate("MLP", mlp, X_te[feats], y_te),
    ]


def main() -> None:
    df = pd.read_csv(PROCESSED_DIR / "dataset.csv")
    missing_cols = set(ALL_FEATURES + ["at_risk", "code_module", "code_presentation"]) - set(df.columns)
    if missing_cols:
        raise ValueError(f"Kolom tidak ditemukan di dataset.csv: {sorted(missing_cols)}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Pola kekosongan (seluruh data, sebelum split, hanya untuk pemeriksaan)
    pola = missingness_report(df)

    X = df[ALL_FEATURES]
    y = df["at_risk"].astype(int)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=SEED
    )
    cv = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=SEED)

    res_with = cv_for_features(X_tr, y_tr, ALL_FEATURES, cv)
    res_without = cv_for_features(X_tr, y_tr, FEATURES_WITHOUT, cv)

    drop, per_model = decide(res_with, res_without)
    final_features = FEATURES_WITHOUT if drop else ALL_FEATURES

    # Data uji: dievaluasi untuk kedua versi, dilaporkan apa adanya
    test_with = test_both(X_tr, y_tr, X_te, y_te, ALL_FEATURES, res_with["knn_best_k"])
    test_without = test_both(X_tr, y_tr, X_te, y_te, FEATURES_WITHOUT, res_without["knn_best_k"])

    ablation = {
        "seed": SEED,
        "aturan": (
            "Selisih recall CV berpasangan per fold. tren_nilai dibuang jika |dbar| <= 2*SE "
            "untuk KEDUA model. Keputusan dari CV data latih saja."
        ),
        "pola_kekosongan_tren_nilai": pola,
        "cv_data_latih": {
            "dengan_tren": {
                "knn_best_k": res_with["knn_best_k"],
                "knn_cv_recall_mean": round(float(res_with["knn_cv_scores"].mean()), 4),
                "mlp_cv_recall_mean": round(float(res_with["mlp_cv_scores"].mean()), 4),
            },
            "tanpa_tren": {
                "knn_best_k": res_without["knn_best_k"],
                "knn_cv_recall_mean": round(float(res_without["knn_cv_scores"].mean()), 4),
                "mlp_cv_recall_mean": round(float(res_without["mlp_cv_scores"].mean()), 4),
            },
            "per_model": per_model,
        },
        "keputusan": {
            "buang_tren_nilai": bool(drop),
            "fitur_final": final_features,
        },
        "data_uji_untuk_laporan": {
            "n_test": int(len(X_te)),
            "dengan_tren": test_with,
            "tanpa_tren": test_without,
        },
    }

    (MODELS_DIR / "ablation.json").write_text(
        json.dumps(ablation, indent=2, ensure_ascii=False, default=float), encoding="utf-8"
    )
    (MODELS_DIR / "feature_selection.json").write_text(
        json.dumps(
            {"features": final_features, "buang_tren_nilai": bool(drop), "sumber": "03b_ablasi_tren.py"},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    # Ringkasan
    print("Pemeriksaan kekosongan tren_nilai")
    print(f"  Kosong keseluruhan        : {pola['kosong_keseluruhan']:.1%}")
    print(f"  Label berisiko saat kosong : {pola['label_rate_saat_kosong']:.1%}")
    print(f"  Label berisiko saat ada    : {pola['label_rate_saat_ada_nilai']:.1%}")
    print()
    print("Uji banding (CV recall, data latih)")
    for name in ["knn", "mlp"]:
        r = per_model[name]
        print(
            f"  {name.upper():<4} dengan={r['cv_recall_dengan_tren']:.3f} "
            f"tanpa={r['cv_recall_tanpa_tren']:.3f} "
            f"dbar={r['selisih_rata_per_fold']:+.4f} "
            f"batas(2SE)={r['batas_2_galat_standar']:.4f} "
            f"dalam_batas={'ya' if r['dalam_batas'] else 'tidak'}"
        )
    print()
    print(f"KEPUTUSAN: {'BUANG tren_nilai' if drop else 'PERTAHANKAN tren_nilai'}")
    print(f"Fitur final: {len(final_features)} fitur")
    print()
    print("Data uji (hanya untuk laporan, bukan keputusan):")
    for label, res in [("dengan tren", test_with), ("tanpa tren", test_without)]:
        for r in res:
            print(
                f"  {label:<11} {r['model']:<4} recall={r['recall']:.3f} "
                f"f1={r['f1']:.3f} auc={r['roc_auc']:.3f}"
            )
    print()
    print(f"Hasil disimpan di {MODELS_DIR.relative_to(ROOT)}\\ablation.json")


if __name__ == "__main__":
    main()
