"""
00_generate_dataset.py

Membangkitkan data sintetis yang meniru dua tabel Moodle:
  - mdl_logstore_standard_log  -> data/raw/mdl_logstore_standard_log.csv
  - mdl_quiz_attempts          -> data/raw/mdl_quiz_attempts.csv
Metadata pembangkitan (seed, parameter, jumlah baris) -> data/raw/generator_info.json

Cara menjalankan (dari folder root project, dengan venv aktif):
    python training\\00_generate_dataset.py

Skrip ini sengaja tidak menghitung fitur atau label. Keduanya dihitung di
02_preprocessing.py, agar sumber data bisa diganti dengan ekspor Moodle asli
tanpa mengubah tahap berikutnya.

Catatan metodologi (untuk Bab II laporan):
  - Setiap mahasiswa punya kemampuan laten (ability) dan kecenderungan tren nilai (trend).
  - Keaktifan mingguan mengikuti distribusi Poisson dengan laju yang bergantung pada keterlibatan.
  - Sebagian mahasiswa berhenti aktif pada minggu tertentu (proksi drop-out).
  - Nilai kuis dibangkitkan dari kemampuan, tren, dan noise normal, lalu dibatasi 0 sampai 100.
  - Sekitar 2% percobaan dibuat "inprogress" dan 2% nilai dihapus acak, untuk
    menguji penanganan missing value.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Parameter (ubah di sini, lalu catat di laporan)
# ---------------------------------------------------------------------------
SEED = 42
N_STUDENTS = 500
N_WEEKS = 14                 # minggu 1-6 untuk fitur, minggu 7-14 untuk label
COURSE_ID = 101
COURSE_START = pd.Timestamp("2026-08-17", tz="UTC")  # Senin
QUIZ_BASE_ID = 1000          # satu kuis per minggu: id 1001..1014
P_ATTEMPT_IF_ACTIVE = 0.90   # peluang mengerjakan kuis pada minggu aktif
P_INPROGRESS = 0.02          # percobaan yang tidak pernah diselesaikan
P_MISSING_GRADE = 0.02       # nilai hilang secara acak (simulasi data kotor)

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"

# Jenis event log: (eventname, component, action, target, crud, bobot)
EVENTS = [
    ("\\core\\event\\course_viewed", "core", "viewed", "course", "r", 0.35),
    ("\\mod_resource\\event\\course_module_viewed", "mod_resource", "viewed", "course_module", "r", 0.25),
    ("\\mod_quiz\\event\\attempt_viewed", "mod_quiz", "viewed", "attempt", "r", 0.15),
    ("\\mod_quiz\\event\\attempt_started", "mod_quiz", "started", "attempt", "c", 0.10),
    ("\\mod_quiz\\event\\attempt_submitted", "mod_quiz", "submitted", "attempt", "c", 0.15),
]


# ---------------------------------------------------------------------------
# Kemampuan dan kecenderungan tiap mahasiswa
# ---------------------------------------------------------------------------
def build_students(rng: np.random.Generator) -> pd.DataFrame:
    ability = rng.normal(0.0, 1.0, N_STUDENTS)
    engagement = 0.7 * ability + rng.normal(0.0, 0.5, N_STUDENTS)
    trend = rng.normal(0.0, 0.6, N_STUDENTS)

    # Peluang berhenti aktif lebih besar untuk kemampuan rendah
    p_dropout = 1.0 / (1.0 + np.exp(-(-1.2 - 0.9 * ability)))
    dropped = rng.random(N_STUDENTS) < p_dropout
    # Minggu terakhir aktif: 3 sampai 11 untuk yang berhenti, tanpa batas untuk yang bertahan
    last_active_week = np.where(dropped, rng.integers(3, 12, N_STUDENTS), N_WEEKS)

    return pd.DataFrame(
        {
            "userid": np.arange(1, N_STUDENTS + 1),
            "ability": ability,
            "engagement": engagement,
            "trend": trend,
            "dropped": dropped,
            "last_active_week": last_active_week,
        }
    )


def week_start(week: int) -> pd.Timestamp:
    return COURSE_START + pd.Timedelta(days=7 * (week - 1))


def to_epoch(ts: pd.Timestamp) -> int:
    return int(ts.timestamp())


# ---------------------------------------------------------------------------
# Log aktivitas
# ---------------------------------------------------------------------------
def build_logs(rng: np.random.Generator, students: pd.DataFrame) -> pd.DataFrame:
    probs = np.array([e[5] for e in EVENTS])
    probs = probs / probs.sum()

    rows = []
    log_id = 1
    for _, s in students.iterrows():
        for week in range(1, int(s["last_active_week"]) + 1):
            if week > N_WEEKS:
                break
            lam = np.exp(1.8 + 0.45 * s["engagement"] + 0.05 * s["trend"] * week)
            n_actions = rng.poisson(lam)
            for _ in range(n_actions):
                ev = EVENTS[rng.choice(len(EVENTS), p=probs)]
                day = int(rng.integers(0, 7))
                sec = int(rng.integers(0, 86400))
                ts = week_start(week) + pd.Timedelta(days=day, seconds=sec)
                rows.append(
                    {
                        "id": log_id,
                        "eventname": ev[0],
                        "component": ev[1],
                        "action": ev[2],
                        "target": ev[3],
                        "crud": ev[4],
                        "edulevel": 2,
                        "userid": int(s["userid"]),
                        "courseid": COURSE_ID,
                        "timecreated": to_epoch(ts),
                    }
                )
                log_id += 1

    df = pd.DataFrame(rows)
    return df.sort_values(["userid", "timecreated"]).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Percobaan kuis (satu kuis per minggu)
# ---------------------------------------------------------------------------
def build_quiz_attempts(rng: np.random.Generator, students: pd.DataFrame) -> pd.DataFrame:
    rows = []
    attempt_id = 1
    for _, s in students.iterrows():
        for week in range(1, N_WEEKS + 1):
            if week > int(s["last_active_week"]):
                break
            if rng.random() > P_ATTEMPT_IF_ACTIVE:
                continue

            quiz_id = QUIZ_BASE_ID + week
            n_attempts = int(rng.poisson(0.3)) + 1
            mu = 58.0 + 9.0 * s["ability"] + 4.0 * s["trend"] * (week / N_WEEKS)

            for k in range(1, n_attempts + 1):
                start_ts = week_start(week) + pd.Timedelta(
                    days=int(rng.integers(0, 7)), seconds=int(rng.integers(0, 86400))
                )
                duration_min = float(rng.lognormal(mean=np.log(20.0), sigma=0.35))
                finish_ts = start_ts + pd.Timedelta(minutes=duration_min)

                if rng.random() < P_INPROGRESS:
                    state = "inprogress"
                    grade = np.nan
                    finish_epoch = 0
                else:
                    state = "finished"
                    grade = float(np.clip(mu + rng.normal(0.0, 7.0), 0.0, 100.0))
                    grade = round(grade, 2)
                    finish_epoch = to_epoch(finish_ts)

                rows.append(
                    {
                        "id": attempt_id,
                        "quiz": quiz_id,
                        "userid": int(s["userid"]),
                        "attempt": k,
                        "state": state,
                        "timestart": to_epoch(start_ts),
                        "timefinish": finish_epoch,
                        "sumgrades": grade,
                    }
                )
                attempt_id += 1

    df = pd.DataFrame(rows)

    # Nilai hilang secara acak untuk menguji penanganan missing value
    if len(df):
        mask = rng.random(len(df)) < P_MISSING_GRADE
        df.loc[mask, "sumgrades"] = np.nan

    return df.sort_values(["userid", "timestart"]).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    rng = np.random.default_rng(SEED)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    students = build_students(rng)
    logs = build_logs(rng, students)
    attempts = build_quiz_attempts(rng, students)

    logs_path = RAW_DIR / "mdl_logstore_standard_log.csv"
    attempts_path = RAW_DIR / "mdl_quiz_attempts.csv"
    logs.to_csv(logs_path, index=False)
    attempts.to_csv(attempts_path, index=False)

    info = {
        "seed": SEED,
        "n_students": N_STUDENTS,
        "n_weeks": N_WEEKS,
        "course_id": COURSE_ID,
        "course_start_utc": str(COURSE_START),
        "p_attempt_if_active": P_ATTEMPT_IF_ACTIVE,
        "p_inprogress": P_INPROGRESS,
        "p_missing_grade": P_MISSING_GRADE,
        "n_dropped_students": int(students["dropped"].sum()),
        "rows_log": int(len(logs)),
        "rows_quiz_attempts": int(len(attempts)),
        "missing_sumgrades": int(attempts["sumgrades"].isna().sum()),
        "note": "Data sintetis. Nilai kuis sudah dalam skala 0-100.",
    }
    (RAW_DIR / "generator_info.json").write_text(
        json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print("Dataset sintetis selesai dibuat.")
    print(f"  {logs_path.relative_to(ROOT)}: {len(logs)} baris")
    print(f"  {attempts_path.relative_to(ROOT)}: {len(attempts)} baris")
    print(f"  Mahasiswa berhenti aktif: {info['n_dropped_students']} dari {N_STUDENTS}")


if __name__ == "__main__":
    main()
