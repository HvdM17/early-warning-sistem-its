"""
03_train_knn_mlp.py

Melatih KNN dan MLP (JST) untuk klasifikasi biner risiko (at_risk), membandingkan
keduanya, lalu menyimpan artefak ke models/.

Alur:
  1. Baca data/processed/dataset.csv (hasil 02_preprocessing.py).
  2. Split 80:20 stratified berdasarkan label.
  3. Setiap model dibungkus Pipeline: SimpleImputer (median) -> StandardScaler -> model.
     Dengan pipeline, imputasi dan scaling hanya di-fit pada data latih di setiap fold
     validasi silang, sehingga tidak ada kebocoran dari data validasi maupun data uji.
  4. KNN: GridSearchCV untuk n_neighbors, dengan 5-fold stratified CV pada data latih.
  5. MLP: validasi silang 5-fold pada data latih (tanpa pencarian parameter).
  6. Model utama dipilih dari rata-rata recall validasi silang pada DATA LATIH.
     Data uji tidak dipakai untuk memilih model.
  7. Evaluasi kedua model pada data uji, lalu simpan artefak.

Output (models/):
  knn_model.joblib     pipeline KNN (sudah termasuk imputasi dan scaling)
  mlp_model.joblib     pipeline MLP (sudah termasuk imputasi dan scaling)
  feature_columns.json urutan fitur, model utama, dan ambang keputusan
  metrics.json         hasil CV dan evaluasi uji, dipakai endpoint /api/metrics

Cara menjalankan (dari folder root, venv aktif):
    python training\\03_train_knn_mlp.py
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
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

# ---------------------------------------------------------------------------
# Parameter
# ---------------------------------------------------------------------------
SEED = 42
TEST_SIZE = 0.2
N_SPLITS = 5
K_CANDIDATES = [3, 5, 7, 9, 11, 15]
THRESHOLD = 0.5               # probabilitas minimum untuk label "berisiko"
MLP_HIDDEN = (32, 16)
MLP_MAX_ITER = 2000
# Catatan: early_stopping tidak dipakai. Dengan data latih sekitar 400 baris, validation split
# (10% dari data latih) hanya sekitar 40 baris, dan training berhenti terlalu dini (sekitar 12 iterasi)
# sehingga model hanya menebak kelas mayoritas. Solver lbfgs dipakai karena dianjurkan untuk dataset kecil.

ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"

# Harus sama dengan FEATURE_COLUMNS di 02_preprocessing.py dan urutan di predictor.py
FEATURE_COLUMNS = [
    "aktivitas_7h",
    "aktivitas_14h",
    "hari_sejak_aktif",
    "rata_nilai_kuis",
    "tren_nilai",
    "jumlah_percobaan_kuis",
    "rasio_kuis_selesai",
    "rata_durasi_menit",
]


def load_dataset() -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(PROCESSED_DIR / "dataset.csv", index_col="userid")
    missing_cols = set(FEATURE_COLUMNS + ["at_risk"]) - set(df.columns)
    if missing_cols:
        raise ValueError(f"Kolom tidak ditemukan di dataset.csv: {sorted(missing_cols)}")
    X = df[FEATURE_COLUMNS]
    y = df["at_risk"].astype(int)
    return X, y


def make_pipeline(model) -> Pipeline:
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("clf", model),
        ]
    )


def evaluate(name: str, pipe: Pipeline, X: pd.DataFrame, y: pd.Series) -> dict:
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


def main() -> None:
    X, y = load_dataset()
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=SEED
    )
    cv = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=SEED)

    # --- KNN: cari k terbaik dengan CV pada data latih ---
    knn_search = GridSearchCV(
        make_pipeline(KNeighborsClassifier()),
        param_grid={"clf__n_neighbors": K_CANDIDATES},
        cv=cv,
        scoring="recall",
    )
    knn_search.fit(X_train, y_train)
    knn_model = knn_search.best_estimator_
    best_k = int(knn_search.best_params_["clf__n_neighbors"])
    knn_cv_recall = float(knn_search.best_score_)

    # --- MLP: validasi silang pada data latih, lalu latih pada seluruh data latih ---
    mlp_model = make_pipeline(
        MLPClassifier(
            hidden_layer_sizes=MLP_HIDDEN,
            activation="relu",
            solver="lbfgs",
            max_iter=MLP_MAX_ITER,
            random_state=SEED,
        )
    )
    mlp_cv_scores = cross_val_score(mlp_model, X_train, y_train, cv=cv, scoring="recall")
    mlp_model.fit(X_train, y_train)

    # --- Pilih model utama dari CV data latih (bukan data uji) ---
    primary = "knn" if knn_cv_recall >= float(mlp_cv_scores.mean()) else "mlp"

    # --- Evaluasi pada data uji (hanya untuk laporan) ---
    knn_test = evaluate("KNN", knn_model, X_test, y_test)
    mlp_test = evaluate("MLP", mlp_model, X_test, y_test)

    # --- Simpan artefak ---
    joblib.dump(knn_model, MODELS_DIR / "knn_model.joblib")
    joblib.dump(mlp_model, MODELS_DIR / "mlp_model.joblib")

    feature_config = {
        "features": FEATURE_COLUMNS,
        "primary_model": primary,
        "threshold": THRESHOLD,
        "risk_level": {"tinggi_min": 0.70, "sedang_min": 0.40},
    }
    (MODELS_DIR / "feature_columns.json").write_text(
        json.dumps(feature_config, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    metrics = {
        "seed": SEED,
        "test_size": TEST_SIZE,
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "positive_rate_train": float(y_train.mean()),
        "positive_rate_test": float(y_test.mean()),
        "primary_model": primary,
        "knn": {
            "best_k": best_k,
            "k_candidates": K_CANDIDATES,
            "cv_recall": knn_cv_recall,
            "test": knn_test,
        },
        "mlp": {
            "hidden_layers": list(MLP_HIDDEN),
            "cv_recall_mean": float(mlp_cv_scores.mean()),
            "cv_recall_std": float(mlp_cv_scores.std()),
            "test": mlp_test,
        },
    }
    (MODELS_DIR / "metrics.json").write_text(
        json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # --- Ringkasan ---
    print("Training selesai.")
    print(f"  Data latih: {len(X_train)} | data uji: {len(X_test)}")
    print(f"  KNN: best k = {best_k}, CV recall = {knn_cv_recall:.3f}")
    print(f"  MLP: CV recall = {mlp_cv_scores.mean():.3f} (+/- {mlp_cv_scores.std():.3f})")
    print(f"  Model utama (dipilih dari CV data latih): {primary.upper()}")
    print()
    print(f"{'Model':<6}{'Acc':>7}{'Prec':>7}{'Recall':>8}{'F1':>7}{'AUC':>7}")
    for r in (knn_test, mlp_test):
        print(
            f"{r['model']:<6}{r['accuracy']:>7.3f}{r['precision']:>7.3f}"
            f"{r['recall']:>8.3f}{r['f1']:>7.3f}{r['roc_auc']:>7.3f}"
        )
    print()
    print(f"Artefak disimpan di {MODELS_DIR.relative_to(ROOT)}\\")


if __name__ == "__main__":
    main()
