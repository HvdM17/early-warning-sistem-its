import json
from datetime import date
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from .gamification import default_progress, level_for, progress_percent, update_progress
from .predictor import is_model_loaded, model_status, predict
from .schemas import (
    ActivityRequest,
    ActivityResponse,
    PredictRequest,
    PredictResponse,
    ProgressResponse,
    QuestItem,
)
from .storage import read_progress, write_progress

app = FastAPI(title="EWS ITS")
ROOT = Path(__file__).resolve().parents[1]

@app.get("/health")
def health():
    return model_status()


@app.post("/api/predict", response_model=PredictResponse)
def api_predict(request: PredictRequest):
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="Model belum tersedia. Jalankan training terlebih dahulu.")
    try:
        return predict(request)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/activity", response_model=ActivityResponse)
def api_activity(request: ActivityRequest):
    progress = read_progress(request.student_id) or default_progress()
    progress, earned, new_badges = update_progress(
        progress,
        request.type,
        request.score,
        request.item_id,
        date.today().isoformat(),
    )
    write_progress(request.student_id, progress)
    return ActivityResponse(
        student_id=request.student_id,
        xp_earned=earned,
        total_xp=progress["total_xp"],
        level=level_for(progress["total_xp"]),
        new_badges=new_badges,
        progress_percent=progress_percent(progress),
        quest=[QuestItem(**item) for item in progress["quest"]],
    )


@app.get("/api/progress/{student_id}", response_model=ProgressResponse)
def api_progress(student_id: str):
    progress = read_progress(student_id)
    if progress is None:
        raise HTTPException(status_code=404, detail="student_id tidak ditemukan")
    return ProgressResponse(
        student_id=student_id,
        total_xp=progress["total_xp"],
        level=level_for(progress["total_xp"]),
        badges=progress.get("badges", []),
        progress_percent=progress_percent(progress),
        quest=[QuestItem(**item) for item in progress.get("quest", [])],
    )


@app.get("/api/students")
def api_students():
    dataset_path = ROOT / "data" / "processed" / "dataset.csv"
    if not dataset_path.exists():
        return []
    frame = pd.read_csv(dataset_path, usecols=["id_student", "at_risk"])
    return [
        {"student_id": f"S-{index:05d}", "risk_label": "berisiko" if row.at_risk else "tidak_berisiko"}
        for index, row in enumerate(frame.head(50).itertuples(index=False), 1)
    ]


@app.get("/api/metrics")
def api_metrics():
    metrics_path = ROOT / "models" / "metrics.json"
    if not metrics_path.exists():
        raise HTTPException(status_code=404, detail="Metrik model belum tersedia")
    return json.loads(metrics_path.read_text(encoding="utf-8"))

# Mount frontend paling akhir agar tidak menutupi endpoint API.
app.mount("/", StaticFiles(directory=str(ROOT / "frontend"), html=True), name="frontend")
