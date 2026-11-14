import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend import storage
from backend.gamification import default_progress, update_progress
from backend.schemas import Intervention, PredictResponse, PredictionResult


client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_progress(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "PROGRESS_PATH", tmp_path / "progress.json")


def valid_payload(**overrides):
    payload = {
        "student_id": "S-001",
        "aktivitas_7h": 60,
        "aktivitas_14h": 86,
        "hari_sejak_aktif": 1,
        "rata_nilai_tugas": 78,
        "tren_nilai": 2,
        "jumlah_tugas_dikumpulkan": 1,
        "rasio_tugas_selesai": 1,
    }
    payload.update(overrides)
    return payload


def activity(student_id="S-TEST", **overrides):
    payload = {"student_id": student_id, "type": "kuis", "score": 90, "item_id": "M1"}
    payload.update(overrides)
    return client.post("/api/activity", json=payload)


def test_tc01_predict_valid():
    response = client.post("/api/predict", json=valid_payload())
    assert response.status_code == 200
    assert response.json()["prediction"]["probability"] >= 0


def test_tc02_active_student_is_low_risk():
    response = client.post("/api/predict", json=valid_payload())
    assert response.status_code == 200
    assert response.json()["prediction"]["risk_level"] == "rendah"


def test_tc03_inactive_low_score_has_remedial_recommendation():
    response = client.post(
        "/api/predict",
        json=valid_payload(
            aktivitas_7h=0,
            aktivitas_14h=0,
            hari_sejak_aktif=30,
            rata_nilai_tugas=40,
            tren_nilai=-20,
            jumlah_tugas_dikumpulkan=0,
            rasio_tugas_selesai=0,
        ),
    )
    assert response.status_code == 200
    assert response.json()["prediction"]["risk_level"] == "tinggi"
    assert {item["id"] for item in response.json()["intervention"]["quest"]} >= {"R1", "R2"}


def test_tc04_score_above_range_is_rejected():
    assert client.post("/api/predict", json=valid_payload(rata_nilai_tugas=150)).status_code == 422


def test_tc05_negative_activity_is_rejected():
    assert client.post("/api/predict", json=valid_payload(aktivitas_7h=-5)).status_code == 422


def test_tc06_string_number_is_rejected():
    assert client.post("/api/predict", json=valid_payload(aktivitas_7h="abc")).status_code == 422


def test_tc07_missing_required_field_is_rejected():
    payload = valid_payload()
    del payload["aktivitas_7h"]
    assert client.post("/api/predict", json=payload).status_code == 422


def test_tc08_empty_body_is_rejected():
    assert client.post("/api/predict", json={}).status_code == 422


def test_tc09_nullable_score_is_accepted():
    response = client.post("/api/predict", json=valid_payload(rata_nilai_tugas=None))
    assert response.status_code == 200
    assert "Belum ada nilai tugas" in response.json()["explanation"]


def test_tc10_quiz_score_ninety_gives_nineteen_xp():
    response = activity()
    assert response.status_code == 200
    assert response.json()["xp_earned"] == 19


def test_tc11_level_increases_after_more_than_one_hundred_xp():
    for index in range(6):
        response = activity(student_id="S-LEVEL", item_id=f"M{index + 1}")
    assert response.json()["total_xp"] == 114
    assert response.json()["level"] == 2


def test_tc12_three_high_scores_award_accuracy_badge():
    for index in range(3):
        response = activity(student_id="S-BADGE", item_id=f"M{index + 1}")
    assert "Akurasi Tinggi" in response.json()["new_badges"]


def test_tc13_remedial_awards_badge_and_progress():
    response = client.post(
        "/api/activity",
        json={"student_id": "S-REMEDIAL", "type": "remedial", "item_id": "R1"},
    )
    assert response.status_code == 200
    assert "Remedial Selesai" in response.json()["new_badges"]
    assert response.json()["progress_percent"] > 0


def test_tc14_missing_models_returns_503(monkeypatch):
    monkeypatch.setattr("backend.main.is_model_loaded", lambda: False)
    response = client.post("/api/predict", json=valid_payload())
    assert response.status_code == 503
    assert "Model belum tersedia" in response.json()["detail"]


def test_tc15_health_reports_loaded_models():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["model_loaded"] is True


def test_tc16_students_returns_model_predictions_without_target_label():
    response = client.get("/api/students")
    assert response.status_code == 200
    item = response.json()[0]
    assert set(item) == {"student_id", "risk_label", "risk_level", "probability", "primary_model"}
    assert "at_risk" not in item
    assert item["student_id"] == "S-00001"


def test_tc17_metrics_returns_both_models():
    response = client.get("/api/metrics")
    assert response.status_code == 200
    body = response.json()
    assert body["primary_model"] == "knn"
    assert "knn" in body and "mlp" in body


def test_tc18_seven_consecutive_days_award_streak_badge():
    progress = default_progress()
    for day in range(7):
        progress, _, badges = update_progress(progress, "bacaan", None, None, f"2026-11-{12 + day:02d}")
    assert "Learning Streak 7 Hari" in badges


def test_tc19_risk_drop_awards_back_on_track_badge(monkeypatch):
    high = PredictResponse(
        student_id="S-RISK",
        prediction=PredictionResult(label="berisiko", risk_level="tinggi", probability=0.8, per_model={"knn": 0.8, "mlp": 0.8}, primary_model="knn"),
        explanation=[],
        intervention=Intervention(message="", quest=[]),
    )
    low = PredictResponse(
        student_id="S-RISK",
        prediction=PredictionResult(label="tidak_berisiko", risk_level="rendah", probability=0.2, per_model={"knn": 0.2, "mlp": 0.2}, primary_model="knn"),
        explanation=[],
        intervention=Intervention(message="", quest=[]),
    )
    responses = iter([high, low])
    monkeypatch.setattr("backend.main.predict", lambda request: next(responses))
    payload = valid_payload(student_id="S-RISK")
    assert client.post("/api/predict", json=payload).status_code == 200
    assert client.post("/api/predict", json=payload).status_code == 200
    progress = client.get("/api/progress/S-RISK")
    assert progress.status_code == 200
    assert "Kembali ke Jalur" in progress.json()["badges"]
