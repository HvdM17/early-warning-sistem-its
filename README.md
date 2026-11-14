# EWS ITS (Early Warning System & Retention Risk Pembelajar)

Prototipe sistem cerdas deteksi dini risiko putus studi/kegagalan belajar (*retention risk*) berbasis data Open University Learning Analytics Dataset (OULAD) dengan integrasi gamifikasi (XP, level, lencana prestasi, quest intervensi).

## 1. Prasyarat & Lingkungan

- Python 3.10, 3.12, atau versi yang didukung
- Model machine learning terlatih (`models/knn_model.joblib`, `models/mlp_model.joblib`)
- Virtual environment dengan dependensi yang tercantum di `requirements.txt`

## 2. Cara Menjalankan

### Aktivasi Virtual Environment & Jalankan Server:

```powershell
# Mengaktifkan virtual environment
.\.venv\Scripts\Activate.ps1

# Menjalankan server FastAPI menggunakan uvicorn
uvicorn backend.main:app --port 8000 --reload
```

Akses aplikasi pada peramban web:
- **Dashboard Web EWS**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Dokumentasi Interaktif Swagger API**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check Endpoint**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

## 3. Menjalankan Pengujian (Testing)

Jalankan test suite menggunakan pytest:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

## 4. Struktur Arsitektur Tiga Lapis

1. **Lapis 1 (Frontend UI)**: HTML5, CSS kustom (tanpa framework/library pihak ketiga), Vanilla JavaScript Fetch API (`frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`).
2. **Lapis 2 (Backend REST API)**: FastAPI (`backend/main.py`), validasi Pydantic (`backend/schemas.py`), gamifikasi & rekomendasi intervensi (`backend/gamification.py`), penyimpanan file JSON atomik (`backend/storage.py`).
3. **Lapis 3 (Model & Algoritma ML)**: Model KNN & MLP (`models/knn_model.joblib`, `models/mlp_model.joblib`), metadata fitur (`models/feature_columns.json`), metrik performa (`models/metrics.json`).
