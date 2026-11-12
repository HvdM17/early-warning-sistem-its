# HANDOFF: EWS ITS (versi OULAD)

Dokumen ini untuk melanjutkan pengerjaan di `D:\Project\ews_its`.

Sumber kebenaran, dalam urutan prioritas:
1. `DATASET_OULAD.md` untuk data, label, dan definisi fitur.
2. `ARCHITECTURE.md` untuk struktur kode, kontrak API, dan alur.
3. `PRD.md` untuk kebutuhan dan pengujian.
4. `DESIGN.md` untuk tampilan.

Jika kode dan dokumen berbeda, ikuti dokumen dan laporkan perbedaannya. Jangan mengubah dokumen diam-diam.

---

## 1. Konteks

Tugas Besar Praktikum Intelligent Tutor System, S1 Sistem Informasi, Universitas Bengkulu. Tema: Early Warning System & Retention Risk Pembelajar.

Sistem memprediksi risiko mahasiswa gagal atau berhenti dari aktivitas klik dan nilai tugas pada enam minggu pertama, memakai data nyata OULAD. Hasilnya ditampilkan di web dengan rekomendasi intervensi dan gamifikasi.

Aturan dari panduan:
- Backend FastAPI dengan validasi Pydantic.
- Frontend HTML5, CSS3, dan JavaScript murni dengan Fetch API. Tanpa framework dan tanpa library CSS. Form tidak boleh reload.
- Minimal 2 sampai 3 elemen gamifikasi. Proyek ini memakai tiga.
- Academic Disclaimer wajib ada di halaman.
- Minimal 12 test case.
- Model diekspor ke `.joblib`.

## 2. Status

| Bagian | Status | File |
|---|---|---|
| Spesifikasi data | Selesai | `DATASET_OULAD.md` |
| Dokumen PRD, ARCHITECTURE, DESIGN | Selesai, sudah OULAD | `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md` |
| Ekstraksi OULAD | Selesai. Sudah dijalankan pada data penuh: 29.915 pendaftaran, 48,6% berisiko | `training\00_extract_oulad.py` |
| Uji banding `tren_nilai` | Sudah ditulis, belum dijalankan pada data penuh | `training\03b_ablasi_tren.py` |
| Training KNN dan MLP | Sudah disesuaikan (membaca feature_selection.json, MLP adam). Belum dijalankan pada data penuh | `training\03_train_knn_mlp.py` |
| EDA | Perlu ditulis ulang untuk OULAD | `training\01_eksplorasi.ipynb` |
| Backend | Belum dibuat | `backend\` |
| Frontend | Belum dibuat (kerangka saja) | `frontend\` |
| Test | Belum dibuat | `tests\` |
| README | Belum dibuat | `README.md` |

Catatan:
- `00_extract_oulad.py` sudah diuji dengan lima pendaftaran buatan dan sudah dijalankan pada data penuh tanpa error.
- Hasil data penuh: 29.915 pendaftaran (2.678 dikeluarkan karena mundur sebelum mulai), 48,6% berisiko, tidak ada label yang tidak jelas.
- `tren_nilai` kosong untuk 22.387 dari 29.915 pendaftaran (75%). Ini alasan dilakukannya uji banding `03b`.
- Pada langkah berikutnya, `03b` dijalankan dulu. Keputusan fitur ditentukan dari hasilnya, lalu `03` dijalankan.

## 3. Pipeline

Dijalankan dari folder root dengan venv aktif, berurutan:

```powershell
python training\00_extract_oulad.py
python training\01_eksplorasi.ipynb        (lewat Jupyter, setelah ditulis ulang)
python training\03b_ablasi_tren.py         (uji banding tren_nilai, menghasilkan feature_selection.json)
python training\03_train_knn_mlp.py        (membaca feature_selection.json)
```

Nomor `02` tidak dipakai. Preprocessing sudah termasuk di `00`.

Hasil:
- `data\processed\dataset.csv`: kunci pendaftaran (`code_module`, `code_presentation`, `id_student`), 7 fitur, dan `at_risk`.
- `data\processed\label_audit.csv`: hanya untuk pemeriksaan. Jangan dijadikan fitur.
- `data\processed\extract_info.json`: jumlah baris, pengecualian, dan proporsi label. Dipakai untuk laporan.
- `models\`: `knn_model.joblib`, `mlp_model.joblib`, `feature_columns.json`, `metrics.json`.

Penting:
- Kedua model adalah pipeline lengkap. Predictor cukup memanggil `predict_proba` dengan DataFrame yang kolomnya sesuai `feature_columns.json`.
- Urutan kolom wajib sama dengan saat training. Urutan yang salah menghasilkan prediksi salah tanpa error.
- Nilai kosong diperbolehkan. Pipeline mengisinya dengan median data latih.

## 4. Kontrak fitur

Urutan kolom (sama dengan `FEATURE_COLUMNS`):

| No | Nama | Rentang | Boleh null |
|---|---|---|---|
| 1 | `aktivitas_7h` | 0 sampai 10000 | Tidak |
| 2 | `aktivitas_14h` | 0 sampai 10000 | Tidak |
| 3 | `hari_sejak_aktif` | 0 sampai 42 | Tidak |
| 4 | `rata_nilai_tugas` | 0 sampai 100 | Ya |
| 5 | `tren_nilai` | -100 sampai 100 | Ya |
| 6 | `jumlah_tugas_dikumpulkan` | 0 sampai 500 | Tidak |
| 7 | `rasio_tugas_selesai` | 0 sampai 1 | Ya |

Kolom yang tidak boleh menjadi fitur: `final_result`, `date_unregistration`, `is_banked`, dan seluruh kolom demografi.

## 5. Label (untuk penjelasan di UI dan laporan)

`at_risk = 1` jika `final_result` adalah Fail atau Withdrawn. `at_risk = 0` jika Pass atau Distinction.

Fitur hanya dari hari 0 sampai 41. Pendaftaran yang mundur sebelum hari 0 dikeluarkan.

## 6. Keputusan yang sudah diambil

Jangan diubah tanpa persetujuan:
- Dataset OULAD. Dataset sintetis sudah ditinggalkan.
- Unit data: pendaftaran, bukan `id_student` saja.
- Klasifikasi biner. Level risiko dari probabilitas.
- Ambang keputusan 0,5. Level tinggi ≥ 0,70, sedang ≥ 0,40.
- Imputasi dan scaling di dalam pipeline model.
- MLP dengan solver adam dan early stopping (validation split 10%, max_iter 200). Konfigurasi ini sama di `03b` dan `03`.
- Model utama dipilih dari CV data latih. Saat ini KNN, tetapi bisa berubah jika data penuh berbeda.
- Gamifikasi: XP = 10 + floor(skor/10), maksimal 20. Bacaan atau modul selesai memberi 5 XP. Level = floor(total_XP/100) + 1.
- Badge: Akurasi Tinggi, Learning Streak 7 Hari, Remedial Selesai, Kembali ke Jalur. Setiap badge punya nama dan syarat.
- Quest line: 5 item mingguan.
- Progres disimpan di `data\progress.json`. Tanpa database.
- Tidak ada login. Peran dipilih dari selector di header.

## 7. Yang harus dibuat

### 7.1 Adaptasi training

`03_train_knn_mlp.py` sudah memakai pipeline, tetapi perlu tiga perubahan:
1. Daftar fitur dibaca dari `models\feature_selection.json`, yang dibuat `03b`. Tidak diedit manual. Jika file ini belum ada, `03` berhenti dengan pesan yang jelas.
2. Indeks dataset diganti dari `userid` menjadi kolom kunci pendaftaran. Kolom kunci dibuang sebelum training.
3. Nama file keluaran tidak berubah.

### 7.2 `01_eksplorasi.ipynb`

Ditulis ulang untuk OULAD. Membaca `dataset.csv` dan `extract_info.json`. Memeriksa proporsi label, nilai kosong, distribusi aktivitas, dan hubungan fitur dengan label. Versi lama membaca data sintetis dan harus diganti.

### 7.3 `backend\`

Sesuai ARCHITECTURE.md bagian 2 dan 3:
- `schemas.py`: model Pydantic dengan batas dari bagian 4. Field nullable untuk tiga fitur nilai.
- `predictor.py`: muat dua pipeline sekali saat startup, buat DataFrame dengan urutan kolom dari `feature_columns.json`, hitung label, probabilitas, level, dan penjelasan. Jika model belum ada, kembalikan status untuk 503.
- `gamification.py`: fungsi murni untuk XP, level, badge, progres, dan aturan intervensi (ARCHITECTURE.md bagian 6).
- `storage.py`: baca dan tulis `data\progress.json` dengan penulisan atomik.
- `main.py`: endpoint `/health`, `/api/predict`, `/api/activity`, `/api/progress/{id}`, `/api/students`, `/api/metrics`. Mount frontend di baris paling akhir.

### 7.4 `frontend\`

Sesuai DESIGN.md:
- `index.html`: sidebar dengan enam menu, selector peran, dan Academic Disclaimer di footer serta di kartu hasil.
- `css\style.css`: token dari DESIGN.md bagian 4 dan 7. Tanpa gradien, tanpa bayangan, tanpa emoji sebagai ikon.
- `js\app.js`: Fetch API dengan path relatif. Form tidak reload. Render hasil, quest, badge, toast, dan banner.

Istilah di UI: gunakan "tugas" untuk nilai penilaian. "Kuis" hanya untuk aktivitas di aplikasi, misalnya `type: "kuis"` di `/api/activity`.

### 7.5 `tests\test_api.py`

15 test case dari PRD.md bagian 12. Gunakan `fastapi.testclient.TestClient`. Test nullable (TC-09) dan urutan kolom wajib ada.

### 7.6 `README.md`

Isi minimal:
- Python 3.13 (64-bit).
- Cara membuat venv dan memasang `requirements.txt`.
- Cara mengunduh OULAD dan menaruhnya di `data\raw_oulad\`.
- Urutan pipeline (bagian 3).
- Cara menjalankan server dan alamat-alamatnya.
- Academic Disclaimer.
- Keterbatasan (PRD bagian 14).

## 8. Aturan yang wajib diikuti

- Jangan menambah framework frontend atau library CSS.
- Jangan membuat gradien, glassmorphism, emoji sebagai ikon, ilustrasi dekoratif, atau konfeti (DESIGN.md bagian 14).
- Jangan menyimpan data pribadi. Gunakan kunci anonim.
- Jangan memakai kolom label atau `date_unregistration` sebagai fitur.
- Jangan memakai data uji untuk memilih model atau parameter.
- Jangan mengubah data, model, atau training tanpa menjalankan ulang pipeline dari awal.
- Setiap request divalidasi dengan Pydantic.
- Mount frontend di baris terakhir `main.py`.
- Jangan mengumpulkan `venv\`, `data\raw_oulad\`, atau `arsip_sintetis\`.

## 9. Catatan untuk laporan

- Data OULAD berasal dari universitas jarak jauh di Inggris. Tulis sebagai keterbatasan.
- Label memakai hasil akhir resmi. Definisi "berisiko" sebagai Fail atau Withdrawn adalah pilihan desain.
- Demografi tidak dipakai, dengan alasan bias. Jelaskan di laporan.
- Pemilihan solver MLP mengikuti rekomendasi scikit-learn untuk data kecil. Early stopping gagal pada uji awal karena validation split terlalu kecil. Catat sebagai keputusan desain.
- Referensi UI: Plume (pola tata letak), dan referensi lain di DESIGN.md. Cantumkan sumbernya.
- Sebutkan jumlah pendaftaran dan proporsi label dari `extract_info.json`, bukan dari perkiraan.

## 10. Checklist akhir sebelum pengumpulan

- [ ] `00_extract_oulad.py` berjalan dari nol di komputer lain dengan data OULAD.
- [ ] `03_train_knn_mlp.py` berjalan dan menghasilkan empat artefak di `models\`.
- [ ] `requirements.txt` memuat `pytest`, `matplotlib`, dan `jupyter`, dibuat dari venv.
- [ ] Semua test pytest lolos.
- [ ] `/health` menampilkan `model_loaded: true`.
- [ ] Form prediksi tidak reload dan hasilnya tampil.
- [ ] XP, level, badge, dan progres berubah setelah kuis dikirim.
- [ ] Academic Disclaimer tampil.
- [ ] Tampilan dicek di lebar 1280 px dan 375 px, dengan screenshot untuk Bab IV.
- [ ] Item identitas laporan sudah diisi: judul, kelas, nomor kelompok, anggota, dan link repository.
- [ ] `data\raw_oulad\` dan `venv\` tidak ikut dikumpulkan.
