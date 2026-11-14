# PRD: EWS ITS (Early Warning System & Retention Risk Pembelajar)

Versi: 2.0 (dataset OULAD)
Proyek: Tugas Besar Praktikum Intelligent Tutor System, Program Studi S1 Sistem Informasi, Universitas Bengkulu
Lokasi project: `D:\Project\ews_its`

Detail data dan fitur ada di `DATASET_OULAD.md`. Jika ada perbedaan untuk bagian data, `DATASET_OULAD.md` yang berlaku.

---

## 1. Ringkasan

EWS ITS adalah prototipe web yang memprediksi risiko mahasiswa gagal atau berhenti (*withdraw*) sejak awal presentasi mata kuliah. Prediksi dibuat dari aktivitas klik di Virtual Learning Environment (VLE) dan nilai tugas pada enam minggu pertama, memakai data nyata dari Open University Learning Analytics Dataset (OULAD).

Hasil prediksi ditampilkan di dashboard web, lengkap dengan rekomendasi intervensi dan elemen gamifikasi (XP dan level, badge, progress bar) untuk mendorong keterlibatan belajar.

Sistem ini prototipe akademik. Hasilnya tidak boleh dipakai sebagai keputusan akademik yang sesungguhnya.

## 2. Masalah dan Tujuan

Dosen sering baru tahu ada mahasiswa tertinggal setelah ujian tengah atau akhir, ketika intervensi sudah terlambat. Data aktivitas sudah tersedia di LMS, tetapi belum dimanfaatkan untuk deteksi dini.

Tujuan:
1. Mengklasifikasikan risiko (berisiko atau tidak) dengan dua algoritma, KNN dan JST (MLP), lalu membandingkan hasilnya.
2. Menampilkan level risiko (rendah, sedang, tinggi) beserta alasan utamanya.
3. Memberi rekomendasi intervensi berbasis aturan yang bisa dijelaskan.
4. Menerapkan minimal 3 elemen gamifikasi yang terhubung dengan output algoritma.
5. Menyediakan REST API (FastAPI) dan antarmuka web (HTML, CSS, JavaScript murni) tanpa reload halaman.

## 3. Bukan Tujuan

- Tidak terintegrasi langsung dengan Moodle atau LMS apa pun. Sistem memakai data ekspor OULAD.
- Tidak ada login atau autentikasi. Ini prototipe lokal.
- Tidak mengirim email atau WhatsApp. Notifikasi berupa banner di dalam aplikasi.
- Tidak memakai framework frontend dan tidak memakai library CSS.
- Tidak menyimpan data pribadi. Identitas memakai ID anonim.
- Tidak membuat rekomendasi materi lengkap. Itu tema kelompok lain. Di sini cukup rekomendasi remedial berbasis aturan.
- Tidak memakai data demografi (gender, wilayah, IMD, usia, pendidikan, disabilitas) pada model utama.

## 4. Pengguna

| Pengguna | Kebutuhan utama |
|---|---|
| Dosen atau pengelola kelas | Melihat daftar mahasiswa berisiko, alasannya, dan rekomendasi intervensi. |
| Mahasiswa (peran demo) | Melihat XP, level, badge, progres, dan riwayat aktivitasnya. |
| Tim penguji atau dosen praktikum | Menjalankan sistem di komputer lain dengan README dan `requirements.txt`. |

## 5. Dataset

### 5.1 Sumber

Open University Learning Analytics Dataset (OULAD), Kuzilek, Hlosta, Zdrahal (2017). Lisensi CC BY 4.0.
- Situs resmi: https://analyse.kmi.open.ac.uk/open_dataset
- UCI Machine Learning Repository, ID 349: https://archive.ics.uci.edu/dataset/349

Data mencakup sekitar 32.000 pendaftaran dari tujuh modul. Data berasal dari universitas jarak jauh di Inggris, bukan kampus di Indonesia.

### 5.2 Unit data dan jendela waktu

- Satu baris = satu pendaftaran, yaitu kombinasi (`code_module`, `code_presentation`, `id_student`).
- Fitur dihitung dari hari ke-0 sampai hari ke-41 (enam minggu pertama presentasi).
- Label diambil dari hasil akhir presentasi, bukan dari jendela fitur.

### 5.3 Label

`at_risk = 1` jika hasil akhir (`final_result`) adalah **Fail** atau **Withdrawn**.
`at_risk = 0` jika hasil akhir adalah **Pass** atau **Distinction**.

Pendaftaran yang mundur sebelum hari ke-0 dikeluarkan dari dataset, karena tidak pernah mengikuti presentasi.

### 5.4 Fitur

| No | Fitur | Definisi |
|---|---|---|
| 1 | `aktivitas_7h` | Total klik (`sum_click`) pada hari 35 sampai 41 |
| 2 | `aktivitas_14h` | Total klik pada hari 28 sampai 41 |
| 3 | `hari_sejak_aktif` | 41 dikurangi hari klik terakhir di jendela. Tanpa klik: 42 |
| 4 | `rata_nilai_tugas` | Rata-rata nilai tugas yang dikumpulkan di jendela (boleh kosong) |
| 5 | `tren_nilai` | Rata-rata sisi akhir dikurangi sisi awal, maksimal 3 tugas per sisi, minimal 2 nilai (boleh kosong) |
| 6 | `jumlah_tugas_dikumpulkan` | Jumlah pengumpulan tugas di jendela, tidak termasuk tugas `is_banked = 1` |
| 7 | `rasio_tugas_selesai` | Tugas yang jatuh tempo di jendela dan dikumpulkan, dibagi tugas yang jatuh tempo di jendela |

`rata_durasi_menit` dari versi sebelumnya dihapus, karena OULAD tidak punya durasi pengerjaan.

### 5.5 Kolom yang tidak dipakai sebagai fitur

`final_result` dan `date_unregistration` (membocorkan label), `is_banked` (hanya untuk menyaring), dan seluruh kolom demografi.

## 6. Algoritma

| Komponen | Keterangan |
|---|---|
| Pipeline setiap model | Imputasi median, `StandardScaler`, lalu model. Imputasi dan scaling di-fit hanya pada data latih, termasuk di setiap fold validasi silang. |
| KNN | `KNeighborsClassifier`. Nilai k dicari dari {3, 5, 7, 9, 11, 15} dengan GridSearchCV, 5-fold stratified, pada data latih. |
| JST / MLP | `MLPClassifier` dengan hidden layer (32, 16), aktivasi ReLU, solver `adam`, early stopping dengan validation split 10%, `n_iter_no_change=10`, `max_iter=200`. Early stopping dipakai karena data latih sekitar 24.000 baris. Pada data sebesar ini `lbfgs` tidak konvergen dalam 2000 iterasi dan sekitar 16 kali lebih lambat dengan recall yang hampir sama. |
| Pembagian data | Split 80:20 stratified, `random_state=42`. |
| Pemilihan model utama | Dari rata-rata recall validasi silang pada data latih. Data uji tidak dipakai untuk memilih model. |
| Ambang keputusan | Probabilitas ≥ 0,5 berarti berisiko. |
| Level risiko (tampilan) | Dari probabilitas: tinggi ≥ 0,70, sedang ≥ 0,40, rendah lainnya. Bukan model multiclass terpisah. |
| Evaluasi | Accuracy, precision, recall, F1, ROC-AUC, dan confusion matrix pada data uji. |
| Metrik utama | Recall kelas berisiko. Mahasiswa berisiko yang terlewat lebih merugikan daripada false alarm. |
| Ekspor | `knn_model.joblib`, `mlp_model.joblib` (keduanya pipeline lengkap), `feature_columns.json`, `metrics.json`. |

Target recall 0,80 adalah target awal, bukan jaminan. Semua hasil dilaporkan apa adanya.

## 7. Gamifikasi

Panduan mewajibkan minimal 2 hingga 3 elemen. Proyek ini memakai tiga elemen, dan masing-masing terhubung dengan output algoritma.

### 7.1 XP dan Dynamic Leveling
- Setiap kuis atau tugas yang diselesaikan di aplikasi memberi XP: `XP = 10 + floor(skor / 10)`, maksimal 20.
- Setiap bacaan atau modul selesai memberi 5 XP.
- Level = `floor(total_XP / 100) + 1`.
- XP bertambah real-time di UI setelah event dikirim ke server.

### 7.2 Adaptive Badges

| Badge | Syarat |
|---|---|
| Akurasi Tinggi | Rata-rata nilai kuis ≥ 85 dengan minimal 3 kuis |
| Learning Streak 7 Hari | Aktif 7 hari berturut-turut |
| Remedial Selesai | Menyelesaikan minimal 1 item remedial yang direkomendasikan |
| Kembali ke Jalur | Level risiko turun dari sedang atau tinggi menjadi rendah |

Setiap badge menampilkan nama dan syarat.

### 7.3 Progress Bar dan Quest Line
- Quest line terdiri dari 5 item mingguan.
- Progres (%) = item selesai / total item × 100.
- Untuk level risiko tinggi, quest remedial ditambahkan otomatis dari rekomendasi intervensi.

## 8. Rekomendasi Intervensi

Berbasis aturan, deterministik, dan bisa diuji.

| Kondisi | Rekomendasi |
|---|---|
| `rata_nilai_tugas` < 60 | Quest R1 (modul remedial dasar) dan R2 (kerjakan ulang tugas dengan nilai terendah) |
| `hari_sejak_aktif` > 7 | Quest R3 (login dan selesaikan satu bacaan minggu ini) |
| `rasio_tugas_selesai` < 0,70 | Quest R4 (selesaikan tugas yang tertunda) |
| `tren_nilai` < -10 | Penjelasan "nilai menurun" pada alasan utama |

Rekomendasi ditampilkan sebagai teks dan daftar quest, bukan keputusan otomatis.

## 9. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Server memuat `knn_model.joblib`, `mlp_model.joblib`, dan `feature_columns.json` saat start. | Wajib |
| FR-02 | Form input fitur dikirim ke `POST /api/predict` tanpa reload halaman. Field kosong (null) untuk fitur nilai diterima. | Wajib |
| FR-03 | Hasil prediksi menampilkan label, probabilitas, level risiko, dan prediksi kedua model. | Wajib |
| FR-04 | Input tidak valid ditolak dengan HTTP 422 dan pesan yang menyebut field bermasalah. | Wajib |
| FR-05 | Frontend menampilkan rekomendasi intervensi dan notifikasi di dalam halaman. | Wajib |
| FR-06 | Aktivitas kuis atau bacaan dikirim ke `POST /api/activity`. XP, level, dan badge diperbarui di UI. | Wajib |
| FR-07 | Progress bar dan quest line menampilkan kemajuan. | Wajib |
| FR-08 | Dashboard menampilkan daftar siswa contoh dan level risikonya dari `GET /api/students`. | Dianjurkan |
| FR-09 | Halaman menampilkan Academic Disclaimer. | Wajib |
| FR-10 | `GET /health` mengembalikan status server dan status model. | Wajib |
| FR-11 | Dashboard menampilkan perbandingan KNN dan MLP dari `GET /api/metrics`. | Dianjurkan |
| FR-12 | Navigasi sidebar: Ringkasan, Siswa Berisiko, Prediksi, Progres Saya, Riwayat, Metrik Model. Di layar kecil menjadi bar horizontal. | Wajib |
| FR-13 | Kartu "Lanjutkan" di Ringkasan menampilkan langkah berikutnya untuk mahasiswa. | Wajib |
| FR-14 | Riwayat menampilkan aktivitas terbaru dalam bentuk daftar waktu. | Wajib |
| FR-15 | Level ditampilkan dengan teks dan bar, misalnya "Level 2 · 81 XP lagi ke level 3". | Wajib |
| FR-16 | Setiap badge menampilkan nama dan syarat. | Wajib |
| FR-17 | Tampilan dibedakan menurut peran (Dosen atau Mahasiswa) lewat selector di header. | Wajib |
| FR-18 | Daftar Siswa Berisiko menampilkan semua siswa dalam tabel tanpa tombol "lihat lainnya". | Wajib |

## 10. Kebutuhan Non-Fungsional

- **Reproducible:** dijalankan di komputer lain dengan `requirements.txt` dan README.
- **Python:** 3.13 (64-bit) di Windows.
- **Respons:** prediksi di bawah 1 detik untuk satu input.
- **Tanpa reload:** form tidak memicu reload.
- **Responsif:** dapat dibaca di desktop dan mobile.
- **Validasi:** setiap request divalidasi dengan Pydantic.
- **Keamanan dasar:** tidak ada data pribadi. Server hanya berjalan di `127.0.0.1`.
- **Ukuran repository:** `data\raw_oulad\` tidak ikut dikumpulkan karena berukuran ratusan MB.

## 11. Kriteria Penerimaan dan Pemetaan Penilaian

| Aspek penilaian (PDF) | Bobot | Bukti yang harus ada |
|---|---|---|
| Ketepatan metodologi dan algoritma | 30% | Perbandingan KNN dan MLP, metrik lengkap, confusion matrix, label dari hasil akhir nyata, dan pemisahan waktu fitur-label. |
| Kualitas sistem web dan gamifikasi | 30% | REST API berjalan, UI rapi, XP, badge, dan progress bar terhubung ke hasil model. |
| Pengujian dan validasi end-to-end | 20% | Tabel minimal 12 test case (bagian 12). |
| Kelengkapan laporan dan dokumen | 20% | Bab sesuai format, diagram arsitektur tiga lapis, source code reproducible. |

## 12. Rencana Pengujian

Minimal 12 test case. Rencana awal memakai 15; implementasi saat ini memiliki 19 test case.

| ID | Jenis | Kondisi | Hasil yang diharapkan |
|---|---|---|---|
| TC-01 | Input valid | Semua field lengkap dan dalam rentang | HTTP 200, label dan probabilitas terisi |
| TC-02 | Input valid | Mahasiswa aktif dan nilai tinggi | Level risiko rendah |
| TC-03 | Input valid | Mahasiswa tidak aktif dan nilai rendah | Level risiko tinggi, rekomendasi remedial muncul |
| TC-04 | Tidak valid | `rata_nilai_tugas` = 150 | HTTP 422, pesan batas nilai |
| TC-05 | Tidak valid | `aktivitas_7h` = -5 | HTTP 422 |
| TC-06 | Tidak valid | Field angka berisi string "abc" | HTTP 422 |
| TC-07 | Field hilang | `aktivitas_7h` tidak dikirim | HTTP 422, field disebut dalam pesan |
| TC-08 | Field hilang | Body JSON kosong | HTTP 422 |
| TC-09 | Field kosong | `rata_nilai_tugas` = null | HTTP 200, nilai diisi median data latih |
| TC-10 | Gamifikasi | Kuis skor 90 dikirim ke `/api/activity` | XP bertambah 19, total dan level diperbarui |
| TC-11 | Gamifikasi | Total XP melewati 100 | Level naik menjadi 2 |
| TC-12 | Gamifikasi | 3 kuis dengan rata-rata ≥ 85 | Badge "Akurasi Tinggi" diberikan |
| TC-13 | Gamifikasi | Item remedial diselesaikan | Progres bertambah, badge "Remedial Selesai" diberikan |
| TC-14 | Sistem | `/api/predict` saat model belum ada | HTTP 503 dengan pesan jelas |
| TC-15 | Sistem | `GET /health` | HTTP 200, `model_loaded: true` |
| TC-16 | Sistem | `GET /api/students` | Daftar anonim berisi hasil prediksi model tanpa kolom `at_risk` |
| TC-17 | Sistem | `GET /api/metrics` | Metrik KNN dan MLP tersedia |
| TC-18 | Gamifikasi | Aktivitas pada 7 hari berturut-turut | Badge "Learning Streak 7 Hari" diberikan |
| TC-19 | Gamifikasi | Risiko turun dari tinggi/sedang menjadi rendah | Badge "Kembali ke Jalur" diberikan satu kali |

Pengujian memakai `pytest` dan `fastapi.testclient`. Hasil dicantumkan di Bab IV, termasuk screenshot desktop dan mobile.

## 13. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Dataset tidak sesuai konteks Indonesia | Tulis sebagai keterbatasan. Jangan mengklaim generalisasi. |
| Kebocoran label | Label dari hasil akhir. Fitur hanya dari hari 0 sampai 41. Kolom label dan `date_unregistration` tidak dipakai. |
| Kelas tidak seimbang | Laporkan recall dan F1, bukan hanya accuracy. |
| Hasil data uji tidak stabil | Data uji 20% dari dataset (jumlahnya dicatat di `metrics.json`). Laporkan variasi antar fold dan jumlah sampel uji. |
| Model tidak dimuat saat demo | `/health` dan pesan 503 yang jelas. |
| Dataset ikut dikumpulkan | `data\raw_oulad\` tidak masuk ZIP pengumpulan. |
| Venv ikut dikumpulkan | README dan `requirements.txt` yang lengkap. |

## 14. Keterbatasan yang Harus Ditulis di Laporan

- Data berasal dari universitas jarak jauh di Inggris, sehingga belum tentu berlaku untuk mahasiswa Universitas Bengkulu.
- Fitur tugas berasal dari tugas OULAD (TMA dan CMA), bukan kuis Moodle.
- Label memakai hasil akhir resmi, tetapi definisi "berisiko" sebagai Fail atau Withdrawn adalah pilihan desain.
- Rekomendasi intervensi berbasis aturan dan belum divalidasi oleh dosen.
- Tidak ada autentikasi, sehingga tidak cocok untuk produksi.

## 15. Milestone

1. **Dataset:** `00_extract_oulad.py` dijalankan pada data penuh, `extract_info.json` diperiksa.
2. **EDA:** `01_eksplorasi.ipynb` ditulis ulang untuk OULAD.
3. **Training:** `03_train_knn_mlp.py` diadaptasi, lalu dijalankan.
4. **Backend:** `schemas.py`, `predictor.py`, `gamification.py`, `storage.py`, `main.py`.
5. **Frontend:** `index.html`, `style.css`, `app.js` sesuai DESIGN.md.
6. **Pengujian:** 15 test case dan screenshot.
7. **Dokumen:** README, requirements, dan laporan Bab I sampai V.

## 16. Keputusan yang Sudah Diambil

1. Dataset: OULAD (data nyata), menggantikan dataset sintetis.
2. Unit data: pendaftaran (`code_module`, `code_presentation`, `id_student`).
3. Jendela fitur: hari 0 sampai 41. Label dari hasil akhir.
4. Label: Fail atau Withdrawn = berisiko.
5. Klasifikasi biner. Level risiko dari probabilitas.
6. Imputasi dan scaling di dalam pipeline model.
7. MLP dengan solver adam dan early stopping. Keputusan awal (lbfgs tanpa early stopping) dibuat saat data latih masih 400 baris, dan diganti setelah data OULAD dipakai.
8. Model utama dipilih dari CV data latih.
9. Gamifikasi: XP, badge, progress bar dan quest line.
10. Tidak ada login. Peran dipilih dari selector.
11. Notifikasi berupa banner di dalam aplikasi.

## 17. Riwayat Perubahan

- **v1.0:** dataset sintetis dengan label buatan generator.
- **v1.1:** revisi UI berdasarkan referensi Plume, pemeriksaan kepatuhan panduan.
- **v2.0:** dataset diganti menjadi OULAD. Fitur, label, dan pipeline disesuaikan. Fitur `rata_nilai_kuis` menjadi `rata_nilai_tugas`, dan `rata_durasi_menit` dihapus.
