"""
02_preprocessing.py

Membangun dataset fitur dan label dari tabel log dan percobaan kuis di data/raw/.

Pemisahan waktu (anti-leakage):
  - Jendela fitur  : minggu 1 sampai 6 (42 hari pertama).
  - Jendela label  : minggu 7 sampai 14.
  Fitur tidak pernah menyentuh data dari jendela label.

Label (at_risk = 1 jika salah satu terpenuhi, pada jendela label):
  - Tidak ada aktivitas log sama sekali, atau
  - Rata-rata nilai kuis yang selesai < 60.
  Mahasiswa tanpa nilai selesai di jendela label tidak dinilai dari nilai.

Missing value TIDAK diisi di tahap ini. Imputasi dengan median data latih
dilakukan di 03_train_knn_mlp.py agar data uji tidak ikut memengaruhi nilai pengisi.

Output:
  data/processed/dataset.csv     -> userid, fitur, at_risk (dipakai untuk training)
  data/processed/label_audit.csv -> userid, rata-rata nilai jendela label, inaktif, at_risk
                                    (hanya untuk pemeriksaan, jangan dijadikan fitur)

Cara menjalankan (dari folder root, venv aktif):
    python training\\02_preprocessing.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"

DAY = 86400
WINDOW_WEEKS = 6          # jendela fitur
OUTCOME_WEEKS = 8         # jendela label (minggu 7-14)
FEATURE_WINDOW_DAYS = WINDOW_WEEKS * 7
PASS_THRESHOLD = 60.0

# Urutan kolom fitur. Harus sama dengan feature_columns.json yang dibuat di 03 dan dipakai predictor.py.
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


def load_inputs() -> tuple[pd.DataFrame, pd.DataFrame, pd.Timestamp, int]:
    info = json.loads((RAW_DIR / "generator_info.json").read_text(encoding="utf-8"))
    logs = pd.read_csv(RAW_DIR / "mdl_logstore_standard_log.csv")
    attempts = pd.read_csv(RAW_DIR / "mdl_quiz_attempts.csv")
    course_start = pd.Timestamp(info["course_start_utc"])
    return logs, attempts, course_start, int(info["n_students"])


def mean_tren(graded: pd.DataFrame) -> pd.Series:
    """Selisih rata-rata sisi akhir dan sisi awal (maksimal 3 kuis per sisi, minimal 2 nilai)."""
    out = {}
    for uid, g in graded.groupby("userid"):
        vals = g.sort_values("timestart")["sumgrades"].to_numpy()
        n = len(vals)
        if n < 2:
            out[uid] = np.nan
            continue
        k = min(3, n // 2)
        out[uid] = vals[-k:].mean() - vals[:k].mean()
    return pd.Series(out, dtype=float)


def build_features(
    logs: pd.DataFrame, attempts: pd.DataFrame, win_start: int, win_end: int, all_ids: pd.Index
) -> pd.DataFrame:
    lw = logs[(logs["timecreated"] >= win_start) & (logs["timecreated"] < win_end)]
    aw = attempts[(attempts["timestart"] >= win_start) & (attempts["timestart"] < win_end)]

    feat = pd.DataFrame(index=all_ids)

    # Aktivitas dihitung mundur dari akhir jendela fitur
    feat["aktivitas_7h"] = (
        lw[lw["timecreated"] >= win_end - 7 * DAY].groupby("userid").size()
    ).reindex(all_ids).fillna(0).astype(int)

    feat["aktivitas_14h"] = (
        lw[lw["timecreated"] >= win_end - 14 * DAY].groupby("userid").size()
    ).reindex(all_ids).fillna(0).astype(int)

    # Hari sejak aktivitas terakhir sampai akhir jendela. Tanpa aktivitas = panjang jendela.
    last_seen = lw.groupby("userid")["timecreated"].max().reindex(all_ids)
    feat["hari_sejak_aktif"] = ((win_end - last_seen) / DAY).fillna(FEATURE_WINDOW_DAYS).clip(0, FEATURE_WINDOW_DAYS)

    # Nilai kuis: hanya percobaan yang selesai dan punya nilai
    finished = aw[aw["state"] == "finished"]
    graded = finished[finished["sumgrades"].notna()]

    feat["rata_nilai_kuis"] = graded.groupby("userid")["sumgrades"].mean().reindex(all_ids)
    feat["tren_nilai"] = mean_tren(graded).reindex(all_ids)

    feat["jumlah_percobaan_kuis"] = aw.groupby("userid").size().reindex(all_ids).fillna(0).astype(int)

    # Berapa kuis berbeda yang diselesaikan dibanding jumlah kuis yang diwajibkan di jendela
    done_quizzes = finished.groupby("userid")["quiz"].nunique().reindex(all_ids).fillna(0)
    feat["rasio_kuis_selesai"] = (done_quizzes / WINDOW_WEEKS).clip(0, 1)

    dur = finished[finished["timefinish"] > 0].copy()
    dur["menit"] = (dur["timefinish"] - dur["timestart"]) / 60.0
    feat["rata_durasi_menit"] = dur.groupby("userid")["menit"].mean().reindex(all_ids)

    return feat[FEATURE_COLUMNS]


def build_labels(
    logs: pd.DataFrame, attempts: pd.DataFrame, out_start: int, out_end: int, all_ids: pd.Index
) -> pd.DataFrame:
    lo = logs[(logs["timecreated"] >= out_start) & (logs["timecreated"] < out_end)]
    active_ids = set(lo["userid"].unique())

    ao = attempts[
        (attempts["timestart"] >= out_start)
        & (attempts["timestart"] < out_end)
        & (attempts["state"] == "finished")
        & (attempts["sumgrades"].notna())
    ]
    grade_out = ao.groupby("userid")["sumgrades"].mean().reindex(all_ids)

    inactive = pd.Series([uid not in active_ids for uid in all_ids], index=all_ids)
    grade_fail = (grade_out < PASS_THRESHOLD).fillna(False)

    audit = pd.DataFrame(
        {
            "rata_nilai_jendela_label": grade_out,
            "inaktif_jendela_label": inactive,
            "at_risk": (inactive | grade_fail).astype(int),
        }
    )
    return audit


def main() -> None:
    logs, attempts, course_start, n_students = load_inputs()
    all_ids = pd.Index(range(1, n_students + 1), name="userid")

    start_epoch = int(course_start.timestamp())
    feat_start = start_epoch
    feat_end = start_epoch + FEATURE_WINDOW_DAYS * DAY
    out_start = feat_end
    out_end = start_epoch + (WINDOW_WEEKS + OUTCOME_WEEKS) * 7 * DAY

    features = build_features(logs, attempts, feat_start, feat_end, all_ids)
    audit = build_labels(logs, attempts, out_start, out_end, all_ids)

    dataset = features.join(audit[["at_risk"]])
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(PROCESSED_DIR / "dataset.csv")
    audit.to_csv(PROCESSED_DIR / "label_audit.csv")

    print("Preprocessing selesai.")
    print(f"  Mahasiswa              : {len(dataset)}")
    print(f"  Label at_risk=1        : {int(dataset['at_risk'].sum())} ({dataset['at_risk'].mean():.1%})")
    print("  Missing per fitur (NaN, akan diisi di 03 dengan median data latih):")
    for col in FEATURE_COLUMNS:
        n_nan = int(dataset[col].isna().sum())
        if n_nan:
            print(f"    {col:24s} {n_nan}")
    print(f"  Disimpan: {(PROCESSED_DIR / 'dataset.csv').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
