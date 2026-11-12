# ARCHITECTURE: EWS ITS

Dokumen ini menjelaskan arsitektur teknis sistem berdasarkan PRD.md. Arsitektur mengikuti pola tiga lapis yang diminta panduan: Frontend UI, Fetch API, REST API Backend, dan Model/Algoritma.

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
│  backend/main.py     → routing endpoint + static files     │
│  backend/schemas.py  → validasi Pydantic                   │
│  backend/predictor.py → memuat model, prediksi             │
│  backend/gamification.py → XP, level, badge, progress      │
│  backend/storage.py  → baca/tulis progress (JSON)          │
└───────────────────────────┬────────────────────────────────┘
                            │  panggilan fungsi Python
                            ▼
┌────────────────────────────────────────────────────────────┐
│  LAPIS 3: MODEL / ALGORITMA (artefak hasil training)       │
│  models/knn_model.joblib     Pipeline: imputasi median -> StandardScaler -> KNN│
│  models/knn_model.joblib     KNeighborsClassifier          │
│  models/mlp_model.joblib     MLPClassifier                 │
│  models/feature_columns.json urutan fitur                  │
└────────────────────────────────────────────────────────────┘

Data offline (tidak dijalankan saat server berjalan):
  data/raw/ (ekspor Moodle atau sintetis) → training/ → models/ + data/processed/
```

Server hanya melayani satu alamat (`http://127.0.0.1:8000`). File frontend dilayani oleh FastAPI melalui `StaticFiles`, sehingga tidak ada CORS dan tidak ada server tambahan.

## 2. Struktur Folder

```
D:\Project\ews_its\
├── backend\
│   ├── main.py            # app FastAPI, endpoint, mount frontend (mount terakhir)
│   ├── schemas.py         # model Pydantic: request dan response
│   ├── predictor.py       # load scaler + KNN + MLP, fungsi predict
│   ├── gamification.py    # hitung XP, level, badge, progress, rekomendasi
│   └── storage.py         # simpan dan baca progress siswa di data\progress.json
├── frontend\
│   ├── index.html         # satu halaman, berisi semua bagian UI + disclaimer
│   ├── css\style.css
│   └── js\app.js          # semua pemanggilan fetch dan render
├── models\                # artefak hasil training (wajib ada saat runtime)
│   ├── knn_model.joblib
│   ├── mlp_model.joblib
│   ├── feature_columns.json
│   └── metrics.json       # hasil evaluasi KNN vs MLP untuk dashboard
├── data\
│   ├── raw\               # ekspor Moodle atau hasil generator sintetis
│   ├── processed\         # dataset fitur + label
│   ├── students_sample.csv
│   └── progress.json      # dibuat otomatis oleh storage.py
├── training\
│   ├── 00_generate_dataset.py   # (sintetis) atau 00_extract_moodle.py
│   ├── 01_eksplorasi.ipynb
│   ├── 02_preprocessing.py
│   └── 03_train_knn_mlp.py
├── tests\
│   └── test_api.py        # 14 test case dari PRD
├── venv\                  # JANGAN dikumpulkan
├── requirements.txt
├── PRD.md
├── ARCHITECTURE.md
└── README.md
```

Catatan: pada tahap awal, `backend\storage.py` dan `tests\` belum ada di scaffold. Keduanya ditambahkan sesuai rencana.

`requirements.txt` harus memuat `pytest` selain library runtime (fastapi, uvicorn, pydantic, scikit-learn, pandas, joblib). Tambahkan dengan `python -m pip install pytest` lalu jalankan ulang `python -m pip freeze > requirements.txt`.

## 3. Komponen dan Tanggung Jawab

| File | Tanggung jawab | Tidak boleh |
|---|---|---|
| `main.py` | Mendaftarkan endpoint, memanggil predictor dan gamification, mount frontend di akhir. | Berisi logika ML atau perhitungan XP langsung. |
| `schemas.py` | Mendefinisikan batas nilai, tipe, dan field wajib untuk setiap request. | Memanggil model atau menyimpan data. |
| `predictor.py` | Memuat artefak sekali saat startup, menjalankan scaler lalu model, mengembalikan probabilitas. | Menangani HTTP atau menyimpan progress. |
| `gamification.py` | Fungsi murni: XP, level, badge, progress, rekomendasi intervensi. Mudah diuji. | Membaca file atau memanggil model. |
| `storage.py` | Membaca dan menulis `data/progress.json` dengan kunci `student_id`. | Berisi aturan gamifikasi. |
| `app.js` | Membangun body JSON, memanggil fetch, lalu merender hasil tanpa reload. | Menghitung ulang label atau XP sendiri. |

Prinsipnya: aturan bisnis ada di `gamification.py` dan `predictor.py`, sedangkan `main.py` hanya perantara HTTP.

## 4. Kontrak API

Semua endpoint berada di bawah `http://127.0.0.1:8000`. Semua body JSON divalidasi Pydantic.

### 4.1 `GET /health`

Respons 200:

```json
{
  "status": "ok",
  "model_loaded": true,
  "models": ["knn", "mlp"]
}
```

Jika artefak tidak lengkap, `model_loaded` bernilai `false` dan `status` tetap `"ok"` agar server bisa diperiksa.

### 4.2 `POST /api/predict`

Request:

```json
{
  "student_id": "S-001",
  "aktivitas_7h": 3,
  "aktivitas_14h": 9,
  "hari_sejak_aktif": 6,
  "rata_nilai_kuis": 58.5,
  "tren_nilai": -12.0,
  "jumlah_percobaan_kuis": 7,
  "rasio_kuis_selesai": 0.6,
  "rata_durasi_menit": 22.0
}
```

Batas validasi (`schemas.py`):

| Field | Tipe | Rentang | Wajib |
|---|---|---|---|
| `student_id` | string | 1 sampai 20 karakter | Tidak |
| `aktivitas_7h`, `aktivitas_14h` | int | 0 sampai 1000 | Ya |
| `hari_sejak_aktif` | int | 0 sampai 365 | Ya |
| `rata_nilai_kuis` | float | 0 sampai 100 | Ya |
| `tren_nilai` | float | -100 sampai 100 | Ya |
| `jumlah_percobaan_kuis` | int | 0 sampai 500 | Ya |
| `rasio_kuis_selesai` | float | 0 sampai 1 | Ya |
| `rata_durasi_menit` | float | 0 sampai 600 | Ya |

Respons 200:

```json
{
  "student_id": "S-001",
  "prediction": {
    "label": "berisiko",
    "risk_level": "sedang",
    "probability": 0.62,
    "per_model": { "knn": 0.60, "mlp": 0.64 },
    "primary_model": "mlp"
  },
  "explanation": ["Rata-rata nilai kuis di bawah 60", "Tidak aktif 6 hari terakhir"],
  "intervention": {
    "message": "Mahasiswa perlu perhatian. Ikuti modul remedial dasar.",
    "quest": [
      { "id": "R1", "title": "Modul remedial dasar", "done": false },
      { "id": "R2", "title": "Kerjakan ulang kuis dengan nilai terendah", "done": false }
    ]
  },
  "disclaimer": "Prototipe ITS edukatif. Bukan keputusan akademik resmi."
}
```

Respons 422 dikembalikan otomatis oleh FastAPI jika validasi gagal, dengan daftar field yang bermasalah. Respons 503 dikembalikan jika model belum dimuat.

### 4.3 `POST /api/activity`

Dipakai saat siswa menyelesaikan kuis atau bacaan. Ini sumber XP real-time.

Request:

```json
{
  "student_id": "S-001",
  "type": "kuis",
  "score": 90,
  "item_id": "K3"
}
```

`type` bernilai `"kuis"`, `"bacaan"`, atau `"remedial"`. `score` wajib jika `type` adalah `"kuis"` dan 0 sampai 100.

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

Mengembalikan status gamifikasi lengkap satu siswa (total XP, level, badge, progress, quest). Dipakai saat halaman dimuat ulang agar tampilan tetap konsisten dengan data tersimpan.

### 4.5 `GET /api/students` (dianjurkan)

Mengembalikan daftar siswa contoh dari `data/students_sample.csv` beserta level risikonya, dihitung saat startup. Dipakai untuk dashboard dosen.

### 4.6 `GET /api/metrics` (dianjurkan)

Mengembalikan isi `models/metrics.json` (accuracy, precision, recall, F1, ROC-AUC untuk KNN dan MLP) agar dashboard bisa menampilkan perbandingan model.

## 5. Alur Data

### 5.1 Alur prediksi (tanpa reload)

```
Siswa/dosen isi form
   │
   ▼
app.js: kumpulkan field → JSON.stringify → fetch("/api/predict", POST)
   │
   ▼
main.py: Pydantic memvalidasi body (422 jika gagal)
   │
   ▼
predictor.py:
   X = [fitur sesuai urutan feature_columns.json]
   p_knn = knn_pipeline.predict_proba(X)[0,1]   # imputasi dan scaling sudah di dalam pipeline
   p_mlp = mlp_pipeline.predict_proba(X)[0,1]
   label = "berisiko" jika p_primary ≥ 0,5
   risk_level dari probabilitas (≥ 0,70 tinggi, ≥ 0,40 sedang, lainnya rendah)
   │
   ▼
gamification.py: explanation dan quest dari aturan (bagian 6 di bawah)
   │
   ▼
Respons JSON → app.js → render kartu hasil, quest, dan banner notifikasi
```

### 5.2 Alur gamifikasi (XP real-time)

```
Siswa selesaikan kuis (skor 90)
   │
   ▼
app.js: fetch("/api/activity", POST)
   │
   ▼
main.py → storage.py: baca progress S-001
   │
   ▼
gamification.py:
   xp = 10 + floor(90/10) = 19
   total_xp += 19, level = floor(total_xp/100)+1
   cek badge (Akurasi Tinggi, Streak, Remedial, Kembali ke Jalur)
   progress = item_selesai / total_item × 100
   │
   ▼
storage.py: tulis progress.json
   │
   ▼
Respons → app.js: animasi XP, update level, munculkan badge baru
```

## 6. Aturan Rekomendasi Intervensi

Logika ini ada di `gamification.py` dan bersifat deterministik sehingga mudah diuji.

| Kondisi | Hasil |
|---|---|
| `rata_nilai_kuis` < 60 | Tambahkan quest R1 (modul remedial dasar) dan R2 (kerjakan ulang kuis terendah). |
| `hari_sejak_aktif` > 7 | Tambahkan quest R3 (login dan selesaikan satu bacaan minggu ini). |
| `rasio_kuis_selesai` < 0,70 | Tambahkan quest R4 (selesaikan kuis yang tertunda). |
| `tren_nilai` < -10 | Tambahkan penjelasan "nilai menurun" pada `explanation`. |

Jika tidak ada kondisi yang terpenuhi, quest default berisi modul mingguan saja.

## 7. Model dan Pipeline Training

Urutan training di folder `training\`:

1. **00_generate_dataset.py** (atau `00_extract_moodle.py`): membuat atau mengekspor data mentah ke `data/raw/`. Untuk sintetis, pola dibuat dengan distribusi yang masuk akal dan seed tetap.
2. **02_preprocessing.py**: membangun fitur sesuai bagian 6.2 PRD dari minggu 1 sampai 6, membuat label dari minggu 7 sampai 14 (anti-leakage), dan menyimpan `data/processed/dataset.csv` beserta `label_audit.csv`. Missing value dibiarkan sebagai NaN di tahap ini.
   - Imputasi dengan median dilakukan di `03_train_knn_mlp.py`, dan median dihitung dari data latih saja. Ini mencegah data uji ikut memengaruhi nilai pengisi.
   - `tren_nilai` membandingkan maksimal 3 kuis pertama dengan maksimal 3 kuis terakhir, dengan minimal 2 nilai. Definisi ini menggantikan "3 kuis pertama vs 3 kuis terakhir" karena banyak mahasiswa tidak punya 6 nilai.
3. **03_train_knn_mlp.py**:
   - Split 80:20 stratified.
   - `StandardScaler` di-fit hanya pada data latih.
   - KNN: GridSearchCV dengan `n_neighbors` ∈ {3, 5, 7, 9, 11, 15} dan 5-fold CV.
   - MLP: `MLPClassifier(hidden_layer_sizes=(32,16), early_stopping=True, max_iter=500, random_state=42)`.
   - Evaluasi di data uji, lalu simpan `metrics.json`, confusion matrix, dan artefak `.joblib`.
   - Simpan `feature_columns.json` berisi urutan fitur yang dipakai saat training.

Penting: urutan fitur di `predictor.py` harus sama dengan `feature_columns.json`. Ketidaksesuaian urutan adalah sumber bug paling umum dan tidak memunculkan error, hanya hasil yang salah.

## 8. Penanganan Error

| Situasi | Respons |
|---|---|
| Field kurang, tipe salah, atau di luar rentang | 422, FastAPI menyebut field yang bermasalah |
| Model belum dimuat | 503 dengan pesan "Model belum tersedia. Jalankan training terlebih dahulu." |
| `student_id` tidak ditemukan saat `GET /api/progress` | 404 |
| `type` atau `score` pada `/api/activity` tidak valid | 422 |
| Kesalahan tak terduga | 500 dengan pesan umum, detail dicatat di terminal |

Frontend menampilkan pesan error di dalam halaman. Tidak ada alert browser dan tidak ada reload.

## 9. Frontend

Satu halaman `index.html` dengan empat bagian:

1. **Form prediksi:** input fitur, tombol "Prediksi". Submit ditangani dengan `event.preventDefault()`.
2. **Hasil prediksi:** kartu label, level risiko dengan warna, probabilitas kedua model, penjelasan, dan quest.
3. **Panel gamifikasi:** XP, level, progress bar, daftar badge, dan tombol simulasi kuis atau bacaan.
4. **Dashboard:** tabel siswa contoh dan grafik metrik KNN vs MLP (dari `/api/metrics`).

Disclaimer ditampilkan di footer setiap halaman.

Aturan UI:
- Tidak memakai framework JavaScript atau library CSS.
- Layout dengan CSS Grid dan Flexbox, responsif dengan `@media`.
- Semua pemanggilan server memakai `fetch` dengan path relatif (`/api/...`).

## 10. Konfigurasi dan Menjalankan

Tidak ada file konfigurasi eksternal. Nilai yang dapat diubah ditulis langsung di kode dan didokumentasikan di README:
- Ambang risiko (0,40 dan 0,70) di `predictor.py`.
- Model utama (`primary_model`) di `predictor.py`, ditentukan dari hasil evaluasi.
- Quest mingguan di `gamification.py`.

Perintah menjalankan dari folder root:

```powershell
.\venv\Scripts\Activate.ps1
uvicorn backend.main:app --port 8000
```

Akses:
- Aplikasi: `http://127.0.0.1:8000/`
- Dokumentasi otomatis: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

Laragon tidak diperlukan untuk menjalankan aplikasi. Laragon hanya dibutuhkan jika data diambil dari database Moodle lokal saat tahap training.

## 11. Keputusan Desain dan Alasannya

| Keputusan | Alasan | Alternatif yang ditolak |
|---|---|---|
| Satu server untuk API dan frontend | Tidak perlu CORS dan cukup satu perintah | Dua server (frontend terpisah) |
| Progress disimpan di JSON | Sederhana dan tidak perlu instalasi database | SQLite atau MySQL (menambah setup) |
| Rekomendasi berbasis aturan | Dapat dijelaskan dan diuji deterministik | Model rekomendasi terpisah (di luar cakupan) |
| Label dari periode berbeda dengan fitur | Menghindari kebocoran label | Label dari aktivitas yang sama (hasil terlihat tinggi tetapi palsu) |
| Scaler disimpan terpisah dan di-fit hanya pada data latih | Mencegah data leakage ke data uji | Scaling di seluruh data |
| Frontend tanpa framework | Sesuai panduan | React, Vue, Bootstrap |
| Notifikasi berupa banner | Tidak memerlukan layanan email | Email atau WhatsApp (di luar cakupan) |
| Dua model dengan probabilitas | Memenuhi perbandingan KNN vs JST pada panduan | Satu model saja |

## 12. Risiko Teknis

| Risiko | Mitigasi |
|---|---|
| Urutan fitur di API tidak sama dengan saat training | Simpan `feature_columns.json` dan validasi di `predictor.py` saat startup. |
| Model tidak bisa dimuat karena versi scikit-learn berbeda | Catat versi di `requirements.txt` dan README. |
| `progress.json` rusak saat penulisan | Tulis ke file sementara lalu ganti (atomic write). |
| Server dibuka dari komputer lain | Jalankan dengan `--host 127.0.0.1` (default) selama prototipe. |
| `StaticFiles` menutupi endpoint API | Mount frontend selalu di baris terakhir `main.py`. |

## 13. Urutan Implementasi

1. Dataset dan label (training 00 dan 02).
2. Training KNN dan MLP, ekspor artefak (training 03).
3. `predictor.py` dan `schemas.py`, uji dengan `/api/predict` dari `/docs`.
4. `gamification.py` dan `storage.py`, uji dengan `/api/activity`.
5. `main.py` lengkap dan mount frontend.
6. Frontend `index.html`, `style.css`, `app.js`.
7. `tests/test_api.py` (14 test case).
8. README dan dokumen laporan.
