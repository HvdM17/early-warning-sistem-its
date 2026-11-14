from math import floor

from .schemas import Intervention, QuestItem

DEFAULT_QUEST = [
    ("M1", "Modul 1"),
    ("M2", "Modul 2"),
    ("M3", "Modul 3"),
    ("M4", "Modul 4"),
    ("M5", "Modul 5"),
]

INTERVENTION_QUESTS = {
    "R1": "Modul remedial dasar",
    "R2": "Kerjakan ulang tugas dengan nilai terendah",
    "R3": "Login dan selesaikan satu bacaan minggu ini",
    "R4": "Selesaikan tugas yang tertunda",
}


def default_progress() -> dict:
    return {
        "total_xp": 0,
        "badges": [],
        "last_risk_level": None,
        "quest": [{"id": key, "title": title, "done": False} for key, title in DEFAULT_QUEST],
        "quiz_scores": [],
        "remedial_items": [],
        "active_days": [],
    }


def record_risk_level(progress: dict, risk_level: str) -> list[str]:
    previous = progress.get("last_risk_level")
    progress.setdefault("badges", [])
    before = set(progress["badges"])
    if previous in {"sedang", "tinggi"} and risk_level == "rendah":
        if "Kembali ke Jalur" not in progress["badges"]:
            progress["badges"].append("Kembali ke Jalur")
    progress["last_risk_level"] = risk_level
    return [badge for badge in progress["badges"] if badge not in before]


def level_for(total_xp: int) -> int:
    return floor(total_xp / 100) + 1


def xp_for(activity_type: str, score: float | None = None) -> int:
    if activity_type == "kuis":
        return min(20, 10 + floor(score / 10))
    return 5


def progress_percent(progress: dict) -> int:
    quests = progress.get("quest", [])
    if not quests:
        return 0
    return round(sum(item.get("done", False) for item in quests) / len(quests) * 100)


def _has_streak(active_days: list[str]) -> bool:
    if len(set(active_days)) < 7:
        return False
    days = sorted({__import__("datetime").date.fromisoformat(day) for day in active_days})
    return any((days[index + 6] - days[index]).days == 6 for index in range(len(days) - 6))


def update_progress(progress: dict, activity_type: str, score: float | None, item_id: str | None, today: str) -> tuple[dict, int, list[str]]:
    before = set(progress.get("badges", []))
    earned = xp_for(activity_type, score)
    progress["total_xp"] = progress.get("total_xp", 0) + earned
    progress.setdefault("quiz_scores", [])
    progress.setdefault("remedial_items", [])
    progress.setdefault("active_days", [])
    progress.setdefault("quest", default_progress()["quest"])

    if today not in progress["active_days"]:
        progress["active_days"].append(today)
    if activity_type == "kuis":
        progress["quiz_scores"].append(score)
    if activity_type == "remedial" and item_id and item_id not in progress["remedial_items"]:
        progress["remedial_items"].append(item_id)

    if item_id:
        if not any(item["id"] == item_id for item in progress["quest"]):
            progress["quest"].append({"id": item_id, "title": INTERVENTION_QUESTS.get(item_id, item_id), "done": False})
        for item in progress["quest"]:
            if item["id"] == item_id:
                item["done"] = True

    scores = progress["quiz_scores"]
    if len(scores) >= 3 and sum(scores[-3:]) / 3 >= 85 and "Akurasi Tinggi" not in progress["badges"]:
        progress["badges"].append("Akurasi Tinggi")
    if _has_streak(progress["active_days"]) and "Learning Streak 7 Hari" not in progress["badges"]:
        progress["badges"].append("Learning Streak 7 Hari")
    if progress["remedial_items"] and "Remedial Selesai" not in progress["badges"]:
        progress["badges"].append("Remedial Selesai")

    return progress, earned, [badge for badge in progress["badges"] if badge not in before]


def intervention_for_features(values: dict) -> tuple[list[str], Intervention]:
    score = values.get("rata_nilai_tugas")
    days = values.get("hari_sejak_aktif", 0)
    ratio = values.get("rasio_tugas_selesai")
    trend = values.get("tren_nilai")
    explanation = []
    quest_ids = []

    if score is None:
        explanation.append("Belum ada nilai tugas")
    elif score < 60:
        explanation.append("Rata-rata nilai tugas di bawah 60")
        quest_ids.extend(["R1", "R2"])
    if days > 7:
        explanation.append(f"Tidak ada klik selama {days} hari terakhir")
        quest_ids.append("R3")
    if ratio is not None and ratio < 0.70:
        explanation.append("Rasio tugas selesai di bawah 70%")
        quest_ids.append("R4")
    if trend is not None and trend < -10:
        explanation.append("Nilai menurun")

    if not quest_ids:
        quest = [QuestItem(id=key, title=title) for key, title in DEFAULT_QUEST]
        message = "Pertahankan aktivitas belajar dan selesaikan modul mingguan."
    else:
        unique_ids = list(dict.fromkeys(quest_ids))
        quest = [QuestItem(id=key, title=INTERVENTION_QUESTS[key]) for key in unique_ids]
        message = "Mahasiswa perlu perhatian. Ikuti rekomendasi intervensi yang tersedia."
    return explanation, Intervention(message=message, quest=quest)
