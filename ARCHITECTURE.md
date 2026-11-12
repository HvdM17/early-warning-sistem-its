# ARCHITECTURE: EWS ITS (versi OULAD)

Dokumen ini menjelaskan arsitektur teknis berdasarkan PRD.md. Detail data dan definisi fitur ada di DATASET_OULAD.md. Arsitektur mengikuti pola tiga lapis yang diminta panduan: Frontend UI, Fetch API, REST API Backend, dan Model/Algoritma.

---

## 1. Diagram Arsitektur Tiga Lapis

```
┌────────────────────────────────────────────────────────────┐
│  LAPIS 1: FRONTEND (browser)                               │
│  index.html + css/style.css + js/app.js                    │
│  Form prediksi, hasil, panel gamifikasi, dashboard         │
└───────────────────────────┬────────────────────────────────┘
                            │  Fetch API (JSON, tanpa reload)
                            ▼
┌────────────────────────────────────────────────────────────┐
│  LAPIS 2: REST API BACKEND (FastAPI, Python)               │
│  backend/main.py          endpoint + mount frontend        │
│  backend/schemas.py       validasi Pydantic                │
│  backend/predictor.py     muat model, prediksi, penjelasan │
│  backend/gamification.py  XP, level, badge, progres        │
│  backend/storage.py       baca/tulis progres (JSON)        │
└───────────────────────────┬────────────────────────────────┘
                            │  pemanggilan fungsi Python
                            ▼
┌────────────────────────────────────────────────────────────┐
│  LAPIS 3: MODEL / ALGORITMA (artefak training)             │
│  models/knn_model.joblib   Pipeline: imputasi → scaler → KNN│
│  models/mlp_model.joblib   Pipeline: imputasi → scaler → MLP│
│  models/feature_columns.json  urutan fitur, model utama    │
│  models/metrics.json       hasil CV dan evaluasi uji       │
└────────────────────────────────────────────────────────────┘

Data offline (tidak berjalan saat server aktif):
  data/raw_oulad/  →  training/00_extract_oulad.py  →  data/processed/dataset.csv
                   →  training/03_train_knn_mlp.py  →  models/
```

Server melayani satu alamat (`http://127.0.0.1:8000`). File frontend dilayani FastAPI lewat `StaticFiles`, sehingga tidak perlu CORS dan tidak ada server tambahan.

## 2. Struktur Folder

```
D:\Project\ews_its\
├── backend\
│   ├── main.py             app FastAPI, endpoint, mount frontend (paling akhir)
│   ├── schemas.py          model Pydantic: request dan response
│   ├── predictor.py        muat dua pipeline, prediksi, penjelasan dan intervensi
│   ├── gamification.py     XP, level, badge, progres (fungsi murni)
│   └── storage.py          baca dan tulis data\progress.json
├── frontend\
│   ├── index.html
│   ├── css\style.css
│   └── js\app.js
├── models\                 artefak training (wajib ada saat runtime)
│   ├── knn_model.joblib
│   ├── mlp_model.joblib
│   ├── feature_columns.json
│   └── metrics.json
├── data\
│   ├── raw_oulad\          ekspor OULAD asli (tidak dikumpulkan)
│   ├── processed\
│   │   ├── dataset.csv         kunci, 7 fitur, at_risk
│   │   ├── label_audit.csv     kunci, final_result, at_risk (hanya pemeriksaan)
│   │   └── extract_info.json   jumlah baris, pengecualian, proporsi label
│   └── progress.json       dibuat otomatis oleh storage.py
├── training\
│   ├── 00_extract_oulad.py
│   ├── 01_eksplorasi.ipynb        (akan ditulis ulang untuk OULAD)
│   ├── 03b_ablasi_tren.py         (uji banding tren_nilai, menghasilkan feature_selection.json)
│   └── 03_train_knn_mlp.py
├── tests\
│   └── test_api.py
├── venv\                   JANGAN dikumpulkan
├── requirements.txt
├── PRD.md
├── DATASET_OULAD.md
├── ARCHITECTURE.md
├── DESIGN.md
├── HANDOFF.md
└── README.md
```

Catatan:
- Nomor `02` tidak dipakai. Tahap preprocessing sudah termasuk di `00_extract_oulad.py` dan di pipeline training.
- Folder `arsip_sintetis\` berisi file dari versi sintetis. Folder itu tidak termasuk dalam struktur akhir dan tidak dikumpulkan.

## 3. Komponen dan Tanggung Jawab

| File | Tanggung jawab | Tidak boleh |
|---|---|---|
| `main.py` | Mendaftarkan endpoint, memanggil predictor dan gamification, mount frontend di akhir. | Berisi logika ML atau perhitungan XP. |
| `schemas.py` | Batas nilai, tipe, field wajib, dan field boleh kosong untuk setiap request. | Memanggil model atau menyimpan data. |
| `predictor.py` | Memuat dua pipeline sekali saat startup, memanggil `predict_proba`, membuat penjelasan dan rekomendasi dari aturan. | Menangani HTTP atau menyimpan progres. Tidak menjalankan scaler sendiri. |
| `gamification.py` | Fungsi murni untuk XP, level, badge, progres. | Membaca file atau memanggil model. |
| `storage.py` | Membaca dan menulis `data\progress.json` dengan kunci `student_id`. | Berisi aturan gamifikasi. |
| `app.js` | Membangun body JSON, memanggil fetch, merender hasil tanpa reload. | Menghitung label atau XP sendiri. |

Aturan bisnis berada di `gamification.py` dan `predictor.py`. `main.py` hanya perantara HTTP.

## 4. Kontrak API

Semua endpoint berada di `http://127.0.0.1:8000`. Semua body JSON divalidasi Pydantic.

### 4.1 `GET /health`

```json
{
  "status": "ok",
  "model_loaded": true,
  "models": ["knn", "mlp"],
  "primary_model": "knn"
}
```

Jika artefak tidak lengkap, `model_loaded` bernilai `false` dan `status` tetap `"ok"` agar server bisa diperiksa.

### 4.2 `POST /api/predict`

Request. Field fitur boleh bernilai `null` untuk `rata_nilai_tugas`, `tren_nilai`, dan `rasio_tugas_selesai`. Nilai null diisi median data latih oleh pipeline.

```json
{
  "student_id": "S-001",
  "aktivitas_7h": 3,
  "aktivitas_14h": 9,
  "hari_sejak_aktif": 12,
  "rata_nilai_tugas": 58.5,
  "tren_nilai": -12.0,
  "jumlah_tugas_dikumpulkan": 2,
  "rasio_tugas_selesai": 0.5
}
```

Batas validasi (`schemas.py`):

| Field | Tipe | Rentang | Boleh null |
|---|---|---|---|
| `student_id` | string | 1 sampai 20 karakter | Tidak (opsional) |
| `aktivitas_7h` | float | 0 sampai 10000 | Tidak |
| `aktivitas_14h` | float | 0 sampai 10000 | Tidak |
| `hari_sejak_aktif` | int | 0 sampai 42 | Tidak |
| `rata_nilai_tugas` | float | 0 sampai 100 | Ya |
| `tren_nilai` | float | -100 sampai 100 | Ya |
| `jumlah_tugas_dikumpulkan` | int | 0 sampai 500 | Tidak |
| `rasio_tugas_selesai` | float | 0 sampai 1 | Ya |

Batas `aktivitas_7h` dan `aktivitas_14h` dikonfirmasi terhadap distribusi data di EDA, lalu diperbarui jika perlu.

Respons 200:

```json
{
  "student_id": "S-001",
  "prediction": {
    "label": "berisiko",
    "risk_level": "sedang",
    "probability": 0.62,
    "per_model": { "knn": 0.60, "mlp": 0.64 },
    "primary_model": "knn"
  },
  "explanation": [
    "Rata-rata nilai tugas di bawah 60",
    "Tidak ada klik selama 12 hari terakhir"
  ],
  "intervention": {
    "message": "Mahasiswa perlu perhatian. Ikuti modul remedial dasar.",
    "quest": [
      { "id": "R1", "title": "Modul remedial dasar", "done": false },
      { "id": "R2", "title": "Kerjakan ulang tugas dengan nilai terendah", "done": false }
    ]
  },
  "disclaimer": "Prototipe ITS edukatif. Bukan keputusan akademik resmi."
}
```

Catatan: `probability` adalah probabilitas dari model utama. `per_model` berisi probabilitas tiap model.

Respons 422 otomatis dari FastAPI jika validasi gagal. Respons 503 jika model belum dimuat.

### 4.3 `POST /api/activity`

Dipakai di aplikasi untuk memberi XP real-time. Ini tidak berasal dari OULAD, melainkan dari interaksi pengguna di aplikasi.

```json
{ "student_id": "S-001", "type": "kuis", "score": 90, "item_id": "K3" }
```

`type` bernilai `"kuis"`, `"bacaan"`, atau `"remedial"`. `score` wajib jika `type` adalah `"kuis"`, bernilai 0 sampai 100.

Respons 200:

```json
{
  "student_id": "S-001",
  "xp_earned": 19,
  "total_xp": 119,
  "level": 2,
  "new_badges": ["Akurasi Tinggi"],
  "progress_percent": 40,
  "quest": [
    { "id": "M1", "title": "Modul 1", "done": true },
    { "id": "M2", "title": "Modul 2", "done": false }
  ]
}
```

### 4.4 `GET /api/progress/{student_id}`

Mengembalikan status gamifikasi lengkap satu siswa: total XP, level, badge, progres, dan quest.

### 4.5 `GET /api/students` (dianjurkan)

Mengembalikan daftar pendaftaran contoh dari `dataset.csv` (kunci dan level risiko dari hasil prediksi). Hanya kunci anonim yang ditampilkan, tanpa data pribadi.

### 4.6 `GET /api/metrics` (dianjurkan)

Mengembalikan isi `models/metrics.json` untuk perbandingan KNN dan MLP di dashboard.

## 5. Alur Data

### 5.1 Alur prediksi (tanpa reload)

```
Pengguna isi form
   │
   ▼
app.js: kumpulkan field → JSON.stringify → fetch("/api/predict", POST)
   │
   ▼
main.py: Pydantic memvalidasi body (422 jika gagal)
   │
   ▼
predictor.py:
   X = DataFrame dengan kolom sesuai feature_columns.json
   p_knn = knn_pipeline.predict_proba(X)[0,1]   # imputasi dan scaling ada di dalam pipeline
   p_mlp = mlp_pipeline.predict_proba(X)[0,1]
   p = p_knn jika primary_model = knn, lainnya p_mlp
   label = "berisiko" jika p ≥ 0,5
   level = tinggi (≥ 0,70), sedang (≥ 0,40), rendah lainnya
   │
   ▼
gamification.py: penjelasan dan quest dari aturan (bagian 6)
   │
   ▼
Respons JSON → app.js → kartu hasil, quest, dan banner
```

Predictor membuat DataFrame dengan urutan kolom dari `feature_columns.json`. Urutan ini harus sama dengan saat training. Kalau tidak sama, hasilnya salah tanpa error.

### 5.2 Alur gamifikasi (XP real-time)

```
Pengguna selesaikan kuis (skor 90)
   │
   ▼
app.js: fetch("/api/activity", POST)
   │
   ▼
main.py → storage.py: baca progres S-001
   │
   ▼
gamification.py:
   xp = 10 + floor(90/10) = 19
   total_xp += 19, level = floor(total_xp/100) + 1
   cek badge, hitung progres = item_selesai / total_item × 100
   │
   ▼
storage.py: tulis progress.json (penulisan atomik)
   │
   ▼
Respons → app.js: animasi XP, level, badge baru
```

## 6. Aturan Rekomendasi Intervensi

Logika ada di `gamification.py` dan bersifat deterministik.

| Kondisi | Hasil |
|---|---|
| `rata_nilai_tugas` < 60 | Quest R1 dan R2 |
| `hari_sejak_aktif` > 7 | Quest R3 |
| `rasio_tugas_selesai` < 0,70 | Quest R4 |
| `tren_nilai` < -10 | Penjelasan "nilai menurun" pada alasan |

Jika tidak ada kondisi yang terpenuhi, quest default berisi modul mingguan.

Jika `rata_nilai_tugas` kosong (null), aturan nilai tidak dijalankan dan penjelasan menyebut "belum ada nilai tugas".

## 7. Pipeline Data dan Model

### 7.1 `00_extract_oulad.py`

Membaca lima file OULAD dari `data\raw_oulad\`. Untuk setiap pendaftaran, skrip:
1. Mengeluarkan pendaftaran yang mundur sebelum hari ke-0.
2. Menghitung klik VLE dan fitur aktivitas dari hari 0 sampai 41. `studentVle.csv` dibaca per potongan.
3. Menghitung fitur tugas dari `studentAssessment.csv` dan `assessments.csv`, dengan tugas `is_banked = 1` dikeluarkan.
4. Menyejajarkan fitur dengan semua pendaftaran, sehingga mahasiswa tanpa tugas mendapat 0, bukan kosong.
5. Membuat label dari `final_result`.

Output: `dataset.csv`, `label_audit.csv`, dan `extract_info.json`.

### 7.2 `01_eksplorasi.ipynb`

Akan ditulis ulang untuk OULAD. Membaca `dataset.csv` dan `extract_info.json`, lalu memeriksa:
- Proporsi label dan distribusi per modul.
- Nilai kosong per fitur.
- Distribusi `aktivitas_7h` dan `aktivitas_14h`, untuk memastikan batas validasi di API.
- Hubungan antara fitur dan label.

### 7.3 `03b_ablasi_tren.py` (uji banding fitur `tren_nilai`)

Dijalankan sebelum `03`. Tiga langkah:
1. Memeriksa pola kekosongan `tren_nilai` per modul dan presentasi, serta apakah kekosongannya berkaitan dengan label.
2. Membandingkan KNN dan MLP dengan dan tanpa `tren_nilai`, dengan 5-fold CV pada data latih. Selisih dihitung berpasangan per fold, karena kedua versi memakai fold yang sama.
3. Keputusan: `tren_nilai` dibuang hanya jika selisih rata-rata per fold ≤ 2 galat standar untuk kedua model. Data uji dilaporkan untuk kedua versi, tetapi tidak dipakai untuk keputusan.

Keluaran: `models\ablation.json` (semua hasil) dan `models\feature_selection.json` (daftar fitur final).

### 7.4 `03_train_knn_mlp.py`

1. Membaca `dataset.csv`, dengan kolom kunci dibuang sebelum training.
2. Split 80:20 stratified, `random_state=42`.
3. Setiap model dibungkus `Pipeline`: `SimpleImputer(median)`, `StandardScaler`, lalu model.
4. KNN: `GridSearchCV` untuk `n_neighbors` ∈ {3, 5, 7, 9, 11, 15}, 5-fold stratified, scoring recall.
5. MLP: `MLPClassifier(hidden_layer_sizes=(32,16), solver="adam", early_stopping=True, validation_fraction=0.1, n_iter_no_change=10, max_iter=200, random_state=42)`, dievaluasi dengan 5-fold CV pada data latih.
6. Model utama dipilih dari rata-rata recall CV pada data latih.
7. Evaluasi pada data uji, lalu ekspor artefak.

Pipeline membuat imputasi dan scaling hanya di-fit pada data latih di setiap fold, sehingga tidak ada kebocoran dari data validasi maupun data uji.

## 8. Penanganan Error

| Situasi | Respons |
|---|---|
| Field kurang, tipe salah, atau di luar rentang | 422, FastAPI menyebut field yang bermasalah |
| Model belum dimuat | 503, "Model belum tersedia. Jalankan training terlebih dahulu." |
| `student_id` tidak ditemukan di `GET /api/progress` | 404 |
| `type` atau `score` pada `/api/activity` tidak valid | 422 |
| Kesalahan tak terduga | 500 dengan pesan umum, detail dicatat di terminal |

Frontend menampilkan pesan error di dalam halaman. Tidak ada alert browser dan tidak ada reload.

## 9. Frontend

Rancangan visual ada di DESIGN.md. Satu halaman `index.html` dengan sidebar, dan bagian-bagiannya ditampilkan sesuai peran (Dosen atau Mahasiswa). Semua pemanggilan server memakai `fetch` dengan path relatif (`/api/...`). Tidak memakai framework JavaScript atau library CSS.

## 10. Konfigurasi

Tidak ada file konfigurasi eksternal. Nilai yang dapat diubah ditulis di kode dan dicatat di README:
- Ambang risiko (0,40 dan 0,70) di `predictor.py`.
- Ambang keputusan 0,5 di `03_train_knn_mlp.py`.
- Model utama, ditentukan otomatis dari CV data latih.
- Quest mingguan di `gamification.py`.
- Lokasi data OULAD lewat variabel lingkungan `OULAD_RAW` (opsional, default `data\raw_oulad`).

Perintah menjalankan dari folder root:

```powershell
.\venv\Scripts\Activate.ps1
uvicorn backend.main:app --port 8000
```

Akses:
- Aplikasi: `http://127.0.0.1:8000/`
- Dokumentasi API: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

Laragon tidak diperlukan.

## 11. Keputusan Desain dan Alasannya

| Keputusan | Alasan | Alternatif yang ditolak |
|---|---|---|
| Data nyata OULAD | Sesuai permintaan, dan label berasal dari hasil akhir resmi | Data sintetis (ditinggalkan) |
| Unit data pendaftaran | `id_student` tidak unik antar presentasi | Hanya `id_student` |
| Jendela fitur hari 0 sampai 41 | Prediksi dini, fitur tidak menyentuh periode label | Seluruh data presentasi |
| Pipeline per model (imputasi dan scaling di dalam) | Mencegah kebocoran dan kesalahan urutan langkah | Scaler terpisah dan dipanggil manual |
| MLP dengan adam dan early stopping (dulu lbfgs tanpa early stopping) | Data latih sebesar 24.000 baris membuat validation split cukup. lbfgs tidak konvergen dan jauh lebih lambat | lbfgs 2000 iterasi (lambat, tidak konvergen) |
| Model utama dari CV data latih | Data uji tidak dipakai untuk memilih | Memilih dari data uji |
| Progres di JSON | Tidak perlu instalasi database | SQLite atau MySQL |
| Rekomendasi berbasis aturan | Bisa dijelaskan dan diuji deterministik | Model rekomendasi terpisah (di luar cakupan) |
| Frontend tanpa framework | Sesuai panduan | React, Vue, Bootstrap |

## 12. Risiko Teknis

| Risiko | Mitigasi |
|---|---|
| Urutan fitur di API tidak sama dengan saat training | `feature_columns.json` dipakai predictor. Tes memastikan urutan kolom. |
| Versi scikit-learn berbeda | Catat versi di `requirements.txt` dan README. |
| `progress.json` rusak saat ditulis | Tulis ke file sementara, lalu ganti (penulisan atomik). |
| `StaticFiles` menutupi endpoint API | Mount frontend selalu di baris terakhir `main.py`. |
| `studentVle.csv` terlalu besar | Dibaca per potongan di `00_extract_oulad.py`. |

## 13. Urutan Implementasi

1. Jalankan `00_extract_oulad.py` pada data penuh, periksa `extract_info.json`.
2. Tulis ulang `01_eksplorasi.ipynb` untuk OULAD, lalu jalankan.
3. Adaptasi `03_train_knn_mlp.py` (fitur, kolom kunci, indeks), lalu jalankan.
4. `schemas.py` dan `predictor.py`, uji dengan `/docs`.
5. `gamification.py` dan `storage.py`, uji dengan `/api/activity`.
6. `main.py` lengkap dan mount frontend.
7. Frontend sesuai DESIGN.md.
8. `tests/test_api.py` (15 test case).
9. README dan dokumen laporan.
