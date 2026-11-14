from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    student_id: str | None = Field(default=None, min_length=1, max_length=20)
    aktivitas_7h: float = Field(ge=0, le=10_000)
    aktivitas_14h: float = Field(ge=0, le=10_000)
    hari_sejak_aktif: int = Field(ge=0, le=42)
    rata_nilai_tugas: float | None = Field(default=None, ge=0, le=100)
    tren_nilai: float | None = Field(default=None, ge=-100, le=100)
    jumlah_tugas_dikumpulkan: int = Field(ge=0, le=500)
    rasio_tugas_selesai: float | None = Field(default=None, ge=0, le=1)


class ActivityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(min_length=1, max_length=20)
    type: Literal["kuis", "bacaan", "remedial"]
    score: float | None = Field(default=None, ge=0, le=100)
    item_id: str | None = Field(default=None, min_length=1, max_length=20)

    @model_validator(mode="after")
    def validate_score(self):
        if self.type == "kuis" and self.score is None:
            raise ValueError("score wajib diisi untuk type kuis")
        return self


class QuestItem(BaseModel):
    id: str
    title: str
    done: bool = False


class PredictionResult(BaseModel):
    label: Literal["berisiko", "tidak_berisiko"]
    risk_level: Literal["rendah", "sedang", "tinggi"]
    probability: float = Field(ge=0, le=1)
    per_model: dict[str, float]
    primary_model: str


class Intervention(BaseModel):
    message: str
    quest: list[QuestItem]


class PredictResponse(BaseModel):
    student_id: str
    prediction: PredictionResult
    explanation: list[str]
    intervention: Intervention
    disclaimer: str = "Prototipe ITS edukatif. Bukan keputusan akademik resmi."


class ActivityResponse(BaseModel):
    student_id: str
    xp_earned: int
    total_xp: int
    level: int
    new_badges: list[str]
    progress_percent: int
    quest: list[QuestItem]


class ProgressResponse(BaseModel):
    student_id: str
    total_xp: int
    level: int
    badges: list[str]
    progress_percent: int
    quest: list[QuestItem]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_loaded: bool
    models: list[str]
    primary_model: str


class StudentSummary(BaseModel):
    student_id: str
    risk_label: Literal["berisiko", "tidak_berisiko"]
    risk_level: Literal["rendah", "sedang", "tinggi"]
    probability: float = Field(ge=0, le=1)
    primary_model: str

