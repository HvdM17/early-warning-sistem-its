import json
from pathlib import Path

import joblib
import pandas as pd

from .gamification import intervention_for_features
from .schemas import PredictRequest, PredictResponse, PredictionResult

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "models"
DISCLAIMER = "Prototipe ITS edukatif. Bukan keputusan akademik resmi."

_state = {
    "models": {},
    "feature_columns": [],
    "primary_model": "knn",
    "threshold": 0.5,
    "risk_level": {"tinggi_min": 0.7, "sedang_min": 0.4},
    "error": None,
}


def load_models() -> None:
    try:
        metadata = json.loads((MODELS_DIR / "feature_columns.json").read_text(encoding="utf-8"))
        models = {
            "knn": joblib.load(MODELS_DIR / "knn_model.joblib"),
            "mlp": joblib.load(MODELS_DIR / "mlp_model.joblib"),
        }
        _state.update(
            models=models,
            feature_columns=metadata["features"],
            primary_model=metadata.get("primary_model", "knn"),
            threshold=metadata.get("threshold", 0.5),
            risk_level=metadata.get("risk_level", {"tinggi_min": 0.7, "sedang_min": 0.4}),
            error=None,
        )
    except (FileNotFoundError, KeyError, OSError, ValueError) as exc:
        _state["models"] = {}
        _state["error"] = str(exc)


load_models()


def model_status() -> dict:
    loaded = sorted(_state["models"])
    return {
        "status": "ok",
        "model_loaded": len(loaded) == 2 and bool(_state["feature_columns"]),
        "models": loaded,
        "primary_model": _state["primary_model"],
    }


def is_model_loaded() -> bool:
    return model_status()["model_loaded"]


def predict(request: PredictRequest) -> PredictResponse:
    if not is_model_loaded():
        raise RuntimeError("Model belum tersedia. Jalankan training terlebih dahulu.")

    values = request.model_dump()
    row = {column: values.get(column) for column in _state["feature_columns"]}
    frame = pd.DataFrame([row], columns=_state["feature_columns"])

    probabilities = {}
    for name, model in _state["models"].items():
        classes = list(model.classes_)
        positive_index = classes.index(1)
        probabilities[name] = float(model.predict_proba(frame)[0, positive_index])

    primary_probability = probabilities[_state["primary_model"]]
    if primary_probability >= _state["risk_level"]["tinggi_min"]:
        risk_level = "tinggi"
    elif primary_probability >= _state["risk_level"]["sedang_min"]:
        risk_level = "sedang"
    else:
        risk_level = "rendah"

    label = "berisiko" if primary_probability >= _state["threshold"] else "tidak_berisiko"
    explanation, intervention = intervention_for_features(values)
    return PredictResponse(
        student_id=request.student_id or "anonymous",
        prediction=PredictionResult(
            label=label,
            risk_level=risk_level,
            probability=round(primary_probability, 4),
            per_model={key: round(value, 4) for key, value in probabilities.items()},
            primary_model=_state["primary_model"],
        ),
        explanation=explanation,
        intervention=intervention,
        disclaimer=DISCLAIMER,
    )
