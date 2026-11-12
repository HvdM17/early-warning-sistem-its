"""
00_extract_oulad.py

Membangun dataset EWS dari Open University Learning Analytics Dataset (OULAD).
Spesifikasi lengkap ada di DATASET_OULAD.md. Skrip ini mengikuti spesifikasi tersebut.

Input  (data/raw_oulad/, atau lokasi lain lewat variabel OULAD_RAW):
  studentInfo.csv, studentRegistration.csv, studentVle.csv,
  studentAssessment.csv, assessments.csv

Output (data/processed/):
  dataset.csv        kunci pendaftaran, 7 fitur, at_risk  -> dipakai training
  label_audit.csv    kunci pendaftaran, final_result, at_risk -> hanya pemeriksaan
  extract_info.json  jumlah baris, pengecualian, proporsi label

Cara menjalankan (dari folder root, venv aktif):
    python training\\00_extract_oulad.py

Catatan teknis:
  - studentVle.csv berukuran sekitar 430 MB. File dibaca per potongan (chunk)
    dan hanya baris di jendela fitur yang diagregasi.
  - Nilai '?' dibaca sebagai NaN.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(os.environ.get("OULAD_RAW", ROOT / "data" / "raw_oulad"))
PROCESSED = ROOT / "data" / "processed"

KEYS = ["code_module", "code_presentation", "id_student"]
WINDOW_START = 0
WINDOW_END = 41            # hari ke-41 = akhir minggu ke-6
WINDOW_DAYS = 42
CHUNK_ROWS = 1_000_000
PASS_LABELS = {"Pass", "Distinction"}
FAIL_LABELS = {"Fail", "Withdrawn"}

FEATURE_COLUMNS = [
    "aktivitas_7h",
    "aktivitas_14h",
    "hari_sejak_aktif",
    "rata_nilai_tugas",
    "tren_nilai",
    "jumlah_tugas_dikumpulkan",
    "rasio_tugas_selesai",
]


def read_csv(name: str, **kwargs) -> pd.DataFrame:
    return pd.read_csv(RAW / name, na_values=["?"], **kwargs)


# ---------------------------------------------------------------------------
# 1. Pendaftaran dan label
# ---------------------------------------------------------------------------
def load_registrations() -> tuple[pd.DataFrame, dict]:
    info = read_csv("studentInfo.csv", usecols=KEYS + ["final_result"])
    reg = read_csv(
        "studentRegistration.csv",
        usecols=KEYS + ["date_registration", "date_unregistration"],
    )
    df = info.merge(reg, on=KEYS, how="left", validate="one_to_one")
    counts = {"pendaftaran_awal": int(len(df))}

    early = df["date_unregistration"] < WINDOW_START
    counts["excluded_early_unregistration"] = int(early.sum())
    df = df[~early]

    known = df["final_result"].isin(PASS_LABELS | FAIL_LABELS)
    counts["excluded_unknown_label"] = int((~known).sum())
    df = df[known].copy()

    df["at_risk"] = df["final_result"].isin(FAIL_LABELS).astype(int)
    counts["pendaftaran_akhir"] = int(len(df))
    return df.set_index(KEYS), counts


# ---------------------------------------------------------------------------
# 2. Aktivitas klik VLE (studentVle.csv, dibaca per potongan)
# ---------------------------------------------------------------------------
def aggregate_vle() -> pd.DataFrame:
    parts = []
    reader = pd.read_csv(
        RAW / "studentVle.csv",
        usecols=KEYS + ["date", "sum_click"],
        na_values=["?"],
        chunksize=CHUNK_ROWS,
    )
    for chunk in reader:
        w = chunk[(chunk["date"] >= WINDOW_START) & (chunk["date"] <= WINDOW_END)]
        if w.empty:
            continue
        total = w.groupby(KEYS).agg(last_day=("date", "max"))
        clicks_7h = (
            w[w["date"] >= WINDOW_END - 6].groupby(KEYS)["sum_click"].sum().rename("clicks_7h")
        )
        clicks_14h = (
            w[w["date"] >= WINDOW_END - 13].groupby(KEYS)["sum_click"].sum().rename("clicks_14h")
        )
        parts.append(pd.concat([clicks_7h, clicks_14h, total[["last_day"]]], axis=1))

    if not parts:
        return pd.DataFrame(columns=["clicks_7h", "clicks_14h", "last_day"])

    combined = pd.concat(parts)
    return combined.groupby(level=KEYS).agg(
        clicks_7h=("clicks_7h", "sum"),
        clicks_14h=("clicks_14h", "sum"),
        last_day=("last_day", "max"),
    )


# ---------------------------------------------------------------------------
# 3. Tugas (studentAssessment.csv + assessments.csv)
# ---------------------------------------------------------------------------
def tren(graded: pd.DataFrame) -> pd.Series:
    out = {}
    for key, g in graded.groupby(level=KEYS):
        vals = g.sort_values("date_submitted")["score"].to_numpy()
        n = len(vals)
        if n < 2:
            out[key] = float("nan")
            continue
        k = min(3, n // 2)
        out[key] = vals[-k:].mean() - vals[:k].mean()
    if not out:
        return pd.Series(dtype=float, index=pd.MultiIndex.from_arrays([[], [], []], names=KEYS))
    index = pd.MultiIndex.from_tuples(list(out.keys()), names=KEYS)
    return pd.Series(list(out.values()), index=index, dtype=float)


def build_assessment_features(counts: dict, registrations: pd.Index) -> pd.DataFrame:
    asmt = read_csv(
        "assessments.csv",
        usecols=["code_module", "code_presentation", "id_assessment", "date"],
    ).rename(columns={"date": "due_day"})

    sa = read_csv(
        "studentAssessment.csv",
        usecols=["id_assessment", "id_student", "date_submitted", "is_banked", "score"],
    )

    counts["tugas_banked_dikeluarkan"] = int((sa["is_banked"] == 1).sum())
    sa = sa[sa["is_banked"] != 1]

    tanpa_info = ~sa["id_assessment"].isin(asmt["id_assessment"])
    counts["tugas_tanpa_info_modul_dikeluarkan"] = int(tanpa_info.sum())
    sa = sa.merge(asmt, on="id_assessment", how="inner")

    w = sa[(sa["date_submitted"] >= WINDOW_START) & (sa["date_submitted"] <= WINDOW_END)].copy()
    w = w.set_index(KEYS)

    graded = w[w["score"].notna()]
    rata = graded.groupby(level=KEYS)["score"].mean().rename("rata_nilai_tugas")
    tren_series = tren(graded).rename("tren_nilai")
    jumlah = w.groupby(level=KEYS).size().rename("jumlah_tugas_dikumpulkan")

    # Rasio: tugas jatuh tempo di jendela yang dikumpulkan / semua tugas jatuh tempo di jendela
    due = asmt[(asmt["due_day"] >= WINDOW_START) & (asmt["due_day"] <= WINDOW_END)]
    due_per_presentasi = (
        due.groupby(["code_module", "code_presentation"])["id_assessment"].nunique().to_dict()
    )
    w_due = w[(w["due_day"] >= WINDOW_START) & (w["due_day"] <= WINDOW_END)]
    submitted_due = (
        w_due.reset_index().groupby(KEYS)["id_assessment"].nunique().rename("tugas_dikumpulkan")
    )

    feats = pd.concat([rata, tren_series, jumlah, submitted_due], axis=1)
    feats = feats.reindex(registrations)
    feats["jumlah_tugas_dikumpulkan"] = feats["jumlah_tugas_dikumpulkan"].fillna(0)

    jatuh_tempo = [
        due_per_presentasi.get((mod, pres), float("nan"))
        for mod, pres in zip(
            feats.index.get_level_values("code_module"),
            feats.index.get_level_values("code_presentation"),
        )
    ]
    feats["tugas_jatuh_tempo"] = jatuh_tempo
    dikumpulkan = feats["tugas_dikumpulkan"].fillna(0)
    feats["rasio_tugas_selesai"] = (dikumpulkan / feats["tugas_jatuh_tempo"]).clip(0, 1)
    return feats[["rata_nilai_tugas", "tren_nilai", "jumlah_tugas_dikumpulkan", "rasio_tugas_selesai"]]


# ---------------------------------------------------------------------------
# 4. Gabungkan dan simpan
# ---------------------------------------------------------------------------
def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    counts: dict = {}

    reg, reg_counts = load_registrations()
    counts.update(reg_counts)

    vle = aggregate_vle()
    assess = build_assessment_features(counts, reg.index)

    df = reg.join(vle, how="left").join(assess, how="left")

    df["aktivitas_7h"] = df["clicks_7h"].fillna(0)
    df["aktivitas_14h"] = df["clicks_14h"].fillna(0)
    df["hari_sejak_aktif"] = (WINDOW_END - df["last_day"]).fillna(WINDOW_DAYS).clip(0, WINDOW_DAYS)
    df["jumlah_tugas_dikumpulkan"] = df["jumlah_tugas_dikumpulkan"].fillna(0).astype(int)

    dataset = df[FEATURE_COLUMNS + ["at_risk"]].reset_index()
    audit = df[["final_result", "at_risk"]].reset_index()

    dataset.to_csv(PROCESSED / "dataset.csv", index=False)
    audit.to_csv(PROCESSED / "label_audit.csv", index=False)

    info = {
        "unit": "pendaftaran (code_module, code_presentation, id_student)",
        "window_days": [WINDOW_START, WINDOW_END],
        "outcome": "at_risk=1 jika final_result Fail atau Withdrawn",
        **counts,
        "n_dataset": int(len(dataset)),
        "label_positif": int(dataset["at_risk"].sum()),
        "label_positif_rate": round(float(dataset["at_risk"].mean()), 4),
        "missing_per_fitur": {c: int(dataset[c].isna().sum()) for c in FEATURE_COLUMNS},
    }
    (PROCESSED / "extract_info.json").write_text(
        json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print("Ekstraksi OULAD selesai.")
    print(f"  Pendaftaran akhir    : {info['n_dataset']}")
    print(f"  Dikeluarkan (mundur sebelum mulai): {info['excluded_early_unregistration']}")
    print(f"  Dikeluarkan (label tidak jelas)   : {info['excluded_unknown_label']}")
    print(f"  Label at_risk=1      : {info['label_positif']} ({info['label_positif_rate']:.1%})")
    print("  NaN per fitur:")
    for c, n in info["missing_per_fitur"].items():
        print(f"    {c:28s} {n}")
    print(f"  Disimpan di {PROCESSED.relative_to(ROOT)}\\")


if __name__ == "__main__":
    main()
