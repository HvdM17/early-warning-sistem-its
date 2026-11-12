import json
import os
import tempfile
from pathlib import Path
from threading import Lock

ROOT = Path(__file__).resolve().parents[1]
PROGRESS_PATH = ROOT / "data" / "progress.json"
_lock = Lock()


def read_progress(student_id: str) -> dict | None:
    with _lock:
        if not PROGRESS_PATH.exists():
            return None
        data = json.loads(PROGRESS_PATH.read_text(encoding="utf-8"))
        return data.get(student_id)


def write_progress(student_id: str, progress: dict) -> None:
    with _lock:
        PROGRESS_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {}
        if PROGRESS_PATH.exists():
            data = json.loads(PROGRESS_PATH.read_text(encoding="utf-8"))
        data[student_id] = progress
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=PROGRESS_PATH.parent, delete=False) as temp:
            json.dump(data, temp, ensure_ascii=False, indent=2)
            temp.write("\n")
            temp_path = temp.name
        os.replace(temp_path, PROGRESS_PATH)
