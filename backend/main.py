import json
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from .gamification import (
    default_progress,
    level_for,
    progress_percent,
    record_risk_level,
    update_progress,
)
from .predictor import is_model_loaded, model_status, predict
from .schemas import (
    ActivityRequest,
    ActivityResponse,
    HealthResponse,
    PredictRequest,
    PredictResponse,
    ProgressResponse,
    QuestItem,
    StudentSummary,
)
from .storage import read_progress, write_progress

app = FastAPI(title="EWS ITS")
ROOT = Path(__file__).resolve().parents[1]

@app.get("/health", response_model=HealthResponse)
def health():
    return model_status()


@app.post("/api/predict", response_model=PredictResponse)
def api_predict(request: PredictRequest):
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="Model belum tersedia. Jalankan training terlebih dahulu.")
    try:
        result = predict(request)
        if request.student_id:
            progress = read_progress(request.student_id) or default_progress()
            record_risk_level(progress, result.prediction.risk_level)
            write_progress(request.student_id, progress)
        return result
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


@app.get("/api/students", response_model=list[StudentSummary])
def api_students():
    dataset_path = ROOT / "data" / "processed" / "dataset.csv"
    if not dataset_path.exists():
        return []
    feature_columns = [
        "aktivitas_7h",
        "aktivitas_14h",
        "hari_sejak_aktif",
        "rata_nilai_tugas",
        "tren_nilai",
        "jumlah_tugas_dikumpulkan",
        "rasio_tugas_selesai",
    ]
    frame = pd.read_csv(dataset_path, usecols=feature_columns).head(50)
    summaries = []
    for index, row in enumerate(frame.itertuples(index=False), 1):
        values = dict(zip(feature_columns, row))
        values["student_id"] = f"S-{index:05d}"
        for name in ("rata_nilai_tugas", "tren_nilai", "rasio_tugas_selesai"):
            if pd.isna(values[name]):
                values[name] = None
        result = predict(PredictRequest(**values))
        summaries.append(
            StudentSummary(
                student_id=values["student_id"],
                risk_label=result.prediction.label,
                risk_level=result.prediction.risk_level,
                probability=result.prediction.probability,
                primary_model=result.prediction.primary_model,
            )
        )
    return summaries


@app.get("/api/metrics", response_model=dict[str, Any])
def api_metrics():
    metrics_path = ROOT / "models" / "metrics.json"
    if not metrics_path.exists():
        raise HTTPException(status_code=404, detail="Metrik model belum tersedia")
    return json.loads(metrics_path.read_text(encoding="utf-8"))

# Mount frontend paling akhir agar tidak menutupi endpoint API.
app.mount("/", StaticFiles(directory=str(ROOT / "frontend"), html=True), name="frontend")
