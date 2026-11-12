# PRD: EWS ITS (Early Warning System & Retention Risk Pembelajar)

Versi: 1.0
Proyek: Tugas Besar Praktikum Intelligent Tutor System, Program Studi S1 Sistem Informasi, Universitas Bengkulu
Lokasi project: `D:\Project\ews_its`

---

## 1. Ringkasan

EWS ITS adalah prototipe web yang memprediksi apakah seorang mahasiswa berisiko gagal atau drop-out, berdasarkan aktivitas dan nilai kuis yang diambil dari data Moodle (atau dataset sintetis jika data asli belum tersedia). Hasil prediksi ditampilkan di dashboard web beserta rekomendasi intervensi dan elemen gamifikasi (XP dan level, badge, progress bar) untuk mendorong keterlibatan belajar.

Sistem ini hanya prototipe akademik. Keputusan yang dihasilkan tidak boleh dipakai sebagai keputusan akademik yang sesungguhnya.

## 2. Masalah

Dosen atau pengelola kelas sering baru tahu ada mahasiswa tertinggal setelah ujian tengah atau akhir. Pada saat itu intervensi sudah terlambat. Data aktivitas sebenarnya sudah tersedia di LMS (log akses dan nilai kuis), tetapi belum dimanfaatkan untuk deteksi dini.

## 3. Tujuan

1. Mengklasifikasikan mahasiswa menjadi berisiko atau tidak berisiko dengan dua algoritma: KNN dan JST (MLP), lalu membandingkan hasilnya.
2. Menampilkan tingkat risiko (rendah, sedang, tinggi) beserta alasan utamanya.
3. Memberikan rekomendasi intervensi otomatis berbasis aturan yang bisa dijelaskan.
4. Menerapkan minimal 3 elemen gamifikasi yang terhubung langsung dengan output algoritma.
5. Menyediakan REST API (FastAPI) dan antarmuka web (HTML, CSS, JavaScript murni) yang berjalan tanpa reload halaman.

## 4. Bukan Tujuan (Non-Goals)

- Tidak terintegrasi langsung dengan server Moodle yang sedang berjalan. Data diekspor dulu menjadi CSV.
- Tidak ada login atau autentikasi. Ini prototipe lokal.
- Tidak mengirim email atau WhatsApp. Notifikasi berupa banner di dalam aplikasi.
- Tidak memakai framework frontend (React, Vue, dll.) dan tidak memakai library CSS seperti Bootstrap atau Tailwind.
- Tidak menyimpan data pribadi mahasiswa. Identitas memakai ID anonim.
- Tidak membuat rekomendasi materi lengkap. Rekomendasi materi adalah tema kelompok lain (Sistem Rekomendasi Adaptif). Di sini cukup rekomendasi remedial berbasis aturan sederhana.

## 5. Pengguna

| Pengguna | Kebutuhan utama |
|---|---|
| Dosen / pengelola kelas | Melihat daftar mahasiswa berisiko dan alasannya, serta rekomendasi intervensi. |
| Mahasiswa (peran demo) | Melihat XP, level, badge, dan progress belajarnya sendiri. |
| Tim penguji / dosen praktikum | Menjalankan sistem di komputer lain dengan README dan `requirements.txt`. |

## 6. Sumber Data dan Label

### 6.1 Sumber data

Prioritas sumber data:

1. Data Moodle asli dari kelas atau dosen pengampu (diekspor dari `mdl_logstore_standard_log`, `mdl_quiz_attempts`, dan `mdl_question_attempts`), jika tersedia dan diizinkan.
2. Dataset sintetis yang dibangkitkan oleh skrip di `training/`, dengan pola yang masuk akal (siswa aktif cenderung nilainya lebih tinggi, siswa tidak aktif cenderung berisiko). Metode pembangkitan wajib dijelaskan di laporan.

Dataset sintetis dapat diterima untuk tugas ini selama metodenya ditulis jelas dan hasilnya tidak diklaim sebagai kinerja pada data nyata.

### 6.2 Fitur (input model)

Semua fitur dihitung per mahasiswa dari jendela waktu observasi (misalnya minggu 1 sampai 6 perkuliahan):

| Fitur | Deskripsi |
|---|---|
| `aktivitas_7h` | Jumlah aktivitas log dalam 7 hari terakhir dari jendela observasi. |
| `aktivitas_14h` | Jumlah aktivitas log dalam 14 hari terakhir dari jendela observasi. |
| `hari_sejak_aktif` | Jumlah hari sejak aktivitas terakhir sampai akhir jendela observasi. |
| `rata_nilai_kuis` | Rata-rata nilai kuis (0 sampai 100). |
| `tren_nilai` | Selisih rata-rata sisi akhir dengan sisi awal nilai kuis (maksimal 3 kuis per sisi, minimal 2 nilai). Negatif berarti menurun. |
| `jumlah_percobaan_kuis` | Total percobaan kuis. |
| `rasio_kuis_selesai` | Kuis yang diselesaikan dibagi kuis yang diwajibkan (0 sampai 1). |
| `rata_durasi_menit` | Rata-rata durasi pengerjaan kuis dalam menit. |

### 6.3 Label

`at_risk = 1` jika nilai akhir mahasiswa di bawah 60, dengan nilai akhir diambil dari periode setelah jendela observasi (misalnya minggu 7 sampai 14). Selain itu, `at_risk = 1` jika mahasiswa tidak lagi aktif sama sekali pada periode tersebut.

Label harus berasal dari periode yang berbeda dengan fitur. Jika label dihitung dari aktivitas yang sama dengan fitur, model hanya belajar menebak ulang aturan label, dan akurasinya terlihat tinggi secara palsu.

### 6.4 Pembagian data

- Pemisahan latih dan uji 80:20 dengan stratifikasi terhadap label.
- Pemilihan nilai k pada KNN memakai cross-validation (5-fold) hanya pada data latih.
- Data uji tidak boleh dipakai untuk memilih parameter apa pun.

## 7. Algoritma

| Komponen | Keterangan |
|---|---|
| Preprocessing | Imputasi missing value dengan median dari data latih saja, `StandardScaler` yang di-fit pada data latih saja, dan penyimpanan nama fitur berurutan. |
| KNN (`KNeighborsClassifier`) | k dicari dari kandidat {3, 5, 7, 9, 11, 15} dengan GridSearchCV. Metrik jarak Euclidean. |
| JST / MLP (`MLPClassifier`) | Hidden layer (32, 16), aktivasi ReLU, `early_stopping=True`, `max_iter=500`, `random_state` tetap. |
| Klasifikasi utama | Biner: berisiko vs tidak berisiko. |
| Level risiko (tampilan) | Dihitung dari probabilitas model: tinggi jika ≥ 0,70, sedang jika 0,40 sampai 0,69, rendah jika < 0,40. Ini bukan model multiclass terpisah. |
| Evaluasi | Accuracy, precision, recall, F1, confusion matrix, dan ROC-AUC untuk KNN dan MLP. |
| Metrik utama | Recall kelas berisiko. Siswa berisiko yang terlewat lebih merugikan daripada false alarm. |
| Ekspor | Pipeline KNN dan MLP (termasuk imputasi dan scaling) disimpan sebagai `knn_model.joblib` dan `mlp_model.joblib`, serta urutan fitur dan model utama di `feature_columns.json`. |

Hasil evaluasi wajib dibandingkan secara jujur. Jika KNN lebih baik, itu yang ditulis. Target recall 0,80 adalah target awal, bukan jaminan.

## 8. Gamifikasi

Panduan mewajibkan minimal 2 sampai 3 elemen. Proyek ini memakai 3 elemen, dan masing-masing terhubung ke output algoritma.

### 8.1 XP dan Dynamic Leveling

- Setiap kuis selesai memberi XP: `XP_kuis = 10 + floor(skor / 10)`, dengan nilai maksimal 20.
- Setiap bacaan atau modul selesai memberi 5 XP.
- Level: `level = floor(total_XP / 100) + 1`.
- XP bertambah real-time di UI setelah event dikirim ke server.

### 8.2 Adaptive Badges

| Badge | Syarat |
|---|---|
| Akurasi Tinggi | Rata-rata nilai kuis ≥ 85 dengan minimal 3 kuis. |
| Learning Streak 7 Hari | Aktif setiap hari selama 7 hari berturut-turut. |
| Remedial Selesai | Menyelesaikan minimal 1 item remedial yang direkomendasikan sistem. |
| Kembali ke Jalur | Status risiko turun dari tinggi atau sedang menjadi rendah. |

Badge diberikan otomatis oleh `gamification.py` ketika syarat terpenuhi.

### 8.3 Progress Bar dan Quest Line

- Quest line terdiri dari 5 item mingguan (misalnya Modul 1 sampai 5).
- Progress (%) = item selesai / total item × 100.
- Untuk mahasiswa berisiko tinggi, quest line remedial ditambahkan otomatis berdasarkan rekomendasi intervensi.

### 8.4 Rekomendasi intervensi (berbasis aturan)

| Kondisi | Rekomendasi |
|---|---|
| `rata_nilai_kuis` < 60 | Ikuti modul remedial dasar dan kerjakan ulang kuis yang nilainya rendah. |
| `hari_sejak_aktif` > 7 | Login kembali dan selesaikan satu bacaan minggu ini. |
| `rasio_kuis_selesai` < 0,70 | Selesaikan kuis yang tertunda. |
| `tren_nilai` < -10 | Tinjau ulang materi kuis terakhir sebelum mengerjakan kuis berikutnya. |

Rekomendasi ini ditampilkan sebagai teks dan daftar quest, bukan keputusan otomatis.

## 9. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Sistem memuat model KNN, MLP, dan scaler dari `models/` saat server start. | Wajib |
| FR-02 | Form input fitur mahasiswa dikirim ke `POST /api/predict` tanpa reload halaman. | Wajib |
| FR-03 | Hasil prediksi menampilkan label, probabilitas, level risiko, dan prediksi kedua model. | Wajib |
| FR-04 | Input yang tidak valid ditolak server dengan pesan error yang jelas (HTTP 422). | Wajib |
| FR-05 | Frontend menampilkan rekomendasi intervensi dan notifikasi di dalam halaman. | Wajib |
| FR-06 | Aktivitas kuis atau bacaan dikirim ke `POST /api/activity` dan XP, level, serta badge diperbarui di UI. | Wajib |
| FR-07 | Progress bar dan quest line menampilkan kemajuan mahasiswa. | Wajib |
| FR-08 | Dashboard menampilkan daftar siswa contoh beserta level risikonya dari `GET /api/students`. | Dianjurkan |
| FR-09 | Halaman menampilkan Academic Disclaimer. | Wajib |
| FR-10 | Endpoint `GET /health` mengembalikan status server dan status pemuatan model. | Wajib |
| FR-11 | Halaman metrik model (perbandingan KNN dan MLP) ditampilkan di dashboard. | Dianjurkan |

## 10. Kebutuhan Non-Fungsional

- **Reproducible:** proyek bisa dijalankan di komputer lain dengan `requirements.txt` dan langkah di README.
- **Versi Python:** Python 3.13 (64-bit) di Windows.
- **Respons:** prediksi di bawah 1 detik untuk input tunggal di laptop mahasiswa.
- **Tanpa reload:** form tidak memicu reload halaman saat diproses.
- **Responsif:** tampilan dapat dibaca di desktop dan mobile.
- **Validasi input:** semua request divalidasi dengan Pydantic.
- **Keamanan dasar:** tidak ada data pribadi, hanya ID anonim. Server hanya dijalankan di `127.0.0.1`.

## 11. Kriteria Penerimaan dan Pemetaan ke Penilaian

| Aspek penilaian (PDF) | Bobot | Bukti yang harus ada |
|---|---|---|
| Ketepatan metodologi & algoritma | 30% | Perbandingan KNN vs MLP, metrik lengkap, confusion matrix, dan label yang tidak bocor dari fitur. |
| Kualitas sistem web & gamifikasi | 30% | REST API berjalan, UI rapi, XP, badge, dan progress bar bekerja dan terhubung ke hasil model. |
| Pengujian & validasi end-to-end | 20% | Tabel minimal 12 test case (lihat bagian 12). |
| Kelengkapan laporan & dokumen | 20% | Bab sesuai format, diagram arsitektur tiga lapis, source code reproducible. |

## 12. Rencana Pengujian (minimal 12 test case)

| ID | Jenis input | Kondisi | Hasil yang diharapkan |
|---|---|---|---|
| TC-01 | Input valid | Semua field lengkap dan dalam rentang | HTTP 200, label dan probabilitas terisi |
| TC-02 | Input valid | Mahasiswa sangat aktif dan nilai tinggi | Level risiko rendah |
| TC-03 | Input valid | Mahasiswa tidak aktif dan nilai rendah | Level risiko tinggi, rekomendasi remedial muncul |
| TC-04 | Typo / invalid | `rata_nilai_kuis` = 150 | HTTP 422, pesan batas nilai |
| TC-05 | Typo / invalid | `aktivitas_7h` = -5 | HTTP 422 |
| TC-06 | Typo / invalid | Field angka berisi string "abc" | HTTP 422 |
| TC-07 | Missing field | `rata_nilai_kuis` tidak dikirim | HTTP 422, field disebut dalam pesan error |
| TC-08 | Missing field | Body JSON kosong | HTTP 422 |
| TC-09 | Gamifikasi | Kuis skor 90 dikirim ke `/api/activity` | XP bertambah 19, total XP dan level diperbarui |
| TC-10 | Gamifikasi | Akumulasi XP melewati 100 | Level naik menjadi 2 |
| TC-11 | Gamifikasi | 3 kuis dengan rata-rata ≥ 85 | Badge "Akurasi Tinggi" diberikan |
| TC-12 | Gamifikasi | Item remedial diselesaikan | Progress bertambah dan badge "Remedial Selesai" diberikan |
| TC-13 | Sistem | Request ke `/api/predict` saat model belum dimuat | HTTP 503, pesan jelas |
| TC-14 | Sistem | `GET /health` | HTTP 200, `model_loaded: true` |

Pengujian dijalankan dengan `pytest` dan `fastapi.testclient`. Hasil ditulis di Bab IV laporan, termasuk screenshot tampilan desktop dan mobile.

## 13. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Data Moodle asli tidak tersedia | Dataset tidak realistis | Pakai dataset sintetis dengan metode tertulis dan jelaskan keterbatasannya. |
| Kebocoran label ke fitur | Akurasi terlihat palsu | Pisahkan jendela observasi dan periode label (bagian 6.3). |
| Kelas tidak seimbang | Recall rendah | Stratifikasi split, laporkan recall dan F1, bukan hanya accuracy. |
| Model tidak dimuat saat demo | Sistem tidak bisa prediksi | Endpoint `/health` dan pesan 503 yang jelas. |
| Venv tidak ikut dikumpulkan | Proyek tidak bisa dijalankan dosen | README dan `requirements.txt` yang lengkap. |
| Versi Python berbeda | Library error | Catat Python 3.13 di README. |

## 14. Keterbatasan yang Harus Ditulis di Laporan

- Model dilatih pada data sintetis atau data kelas kecil, sehingga belum bisa digeneralisasi.
- Label adalah proksi (nilai rendah atau tidak aktif), bukan keputusan drop-out resmi kampus.
- Rekomendasi intervensi berbasis aturan sederhana dan belum divalidasi oleh dosen.
- Tidak ada autentikasi dan tidak cocok untuk penggunaan produksi.

## 15. Milestone (urutan kerja)

1. **Dataset:** skrip generator atau ekstraksi, label dengan jendela waktu, dan EDA singkat.
2. **Preprocessing dan training:** scaler, KNN dengan GridSearchCV, MLP, evaluasi, dan ekspor `.joblib`.
3. **Backend:** `predictor.py`, `schemas.py`, `gamification.py`, `storage.py`, dan `main.py` dengan endpoint lengkap.
4. **Frontend:** form prediksi, hasil, panel gamifikasi, dan dashboard, semuanya tanpa reload.
5. **Pengujian:** 14 test case di atas dan screenshot.
6. **Dokumen:** README, requirements, dan laporan Bab I sampai V.

## 16. Keputusan yang Sudah Diambil

1. **Sumber data:** dataset sintetis, karena data log Moodle asli belum tersedia. Generator ditulis di `training/00_generate_dataset.py` dengan seed tetap, dan metodenya dijelaskan di laporan Bab II.
2. **Definisi label:** `at_risk = 1` jika nilai akhir < 60 **atau** tidak ada aktivitas sama sekali pada periode outcome (minggu 7 sampai 14). Nilai akhir adalah indikator utama. Inaktivitas dipakai sebagai proksi drop-out. Label tidak dihitung dari jendela fitur (minggu 1 sampai 6).
3. **Quest line:** 5 item mingguan, sesuai rancangan.

## 17. Revisi Kebutuhan (RE) dari Referensi UI

Revisi ini berasal dari referensi tampilan dashboard e-learning (Plume). Hanya pola tata letaknya yang diambil. Aset, ilustrasi, dan branding tidak dipakai.

### 17.1 Kebutuhan baru

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-12 | Navigasi sidebar dengan menu: Ringkasan, Siswa Berisiko, Prediksi, Progres Saya, Riwayat, Metrik Model. Di layar kecil, sidebar menjadi bar navigasi horizontal. | Wajib |
| FR-13 | Kartu "Lanjutkan" di Ringkasan menampilkan satu langkah berikutnya untuk siswa, berdasarkan quest pertama yang belum selesai. | Wajib |
| FR-14 | Panel Riwayat menampilkan urutan aktivitas terbaru (kuis selesai, badge didapat, level naik, prediksi dijalankan) dalam bentuk daftar waktu. | Wajib |
| FR-15 | Level ditampilkan dengan teks dan bar, misalnya "Level 2 · 81 XP lagi ke level 3". | Wajib |
| FR-16 | Setiap badge wajib menampilkan nama dan syarat, tidak hanya ikon. | Wajib |
| FR-17 | Tampilan dibedakan menurut peran: mode Dosen (Siswa Berisiko, Metrik Model) dan mode Mahasiswa (Progres Saya, Riwayat, Lanjutkan). Peran dipilih lewat selector di header karena belum ada login. | Wajib |
| FR-18 | Daftar Siswa Berisiko di mode dosen menampilkan semua siswa dalam tabel, tanpa tombol "lihat lainnya" yang menyembunyikan data. | Wajib |

### 17.2 Kebutuhan yang diubah

- FR-08 (dashboard): sekarang bagian dari menu Siswa Berisiko, bukan halaman terpisah.
- FR-11 (metrik model): sekarang menjadi menu Metrik Model.

### 17.3 Kebutuhan non-fungsional tambahan

- Tidak ada ilustrasi, foto, atau gambar dekoratif di halaman.
- Tidak ada gradien dan efek bayangan tebal. Pemisahan antar elemen memakai garis tipis.
- Semua status (risiko rendah, sedang, tinggi) selalu disertai teks, tidak hanya warna.
- Sesuai `DESIGN.md`. Jika ada perbedaan antara PRD dan DESIGN, DESIGN yang berlaku untuk tampilan.

## 18. Pemeriksaan Kepatuhan terhadap Panduan

### 18.1 Sudah sesuai

| Ketentuan panduan (PDF) | Status di dokumen |
|---|---|
| Minimal 2 sampai 3 elemen gamifikasi | 3 elemen: XP dan level, badge, progress bar dan quest line (PRD 8) |
| Backend FastAPI atau Flask dengan Pydantic | FastAPI dan Pydantic (ARCHITECTURE 4) |
| Endpoint minimal `GET /health` dan `POST /api/process` atau `/predict` | `GET /health` dan `POST /api/predict` |
| Model diekspor `.joblib` atau `.pkl` | `.joblib` (ARCHITECTURE 2) |
| Frontend HTML5, CSS3, JavaScript, Fetch API, tanpa reload | Sesuai (PRD 10, DESIGN 6.6) |
| Tanpa software desain tambahan | Tidak ada library CSS atau framework frontend |
| Academic Disclaimer di halaman web | Footer dan kartu hasil (DESIGN 5.4) |
| Klasifikasi KNN dan JST/MLP | Keduanya dilatih dan dibandingkan (PRD 7) |
| Minimal 12 test case | 14 test case (PRD 12) |
| Diagram arsitektur tiga lapis | ARCHITECTURE 1 |
| Enam langkah workflow | Dipetakan di PRD 15 |

### 18.2 Celah yang diperbaiki pada pemeriksaan ini

- **`pytest` belum ada di `requirements.txt`.** Pengujian di PRD 12 memakai pytest, jadi harus dipasang dan dicatat di requirements.
- **Item identitas laporan belum tercatat.** Panduan E.1 mewajibkan judul proyek, kelas, nomor kelompok, dan tabel identitas anggota (nama, NPM, pembagian peran). Ini harus diisi sebelum laporan dikumpulkan.
- **Lampiran wajib.** Panduan E.7 mewajibkan link repository GitHub atau Google Drive. Ini belum ada di milestone.
- **Referensi UI perlu dicantumkan.** Plume dan referensi lain di DESIGN.md harus dikutip di laporan agar tidak dianggap menyalin tanpa sumber.

### 18.3 Catatan yang perlu diputuskan

- **Klasifikasi biner atau multiclass.** Panduan menulis "Biner / Multiclass". Saat ini sistem memakai biner, dan level risiko tiga tingkat hanya berasal dari probabilitas. Kalau dosen menginginkan multiclass sungguhan, model harus dilatih dengan tiga kelas (rendah, sedang, tinggi). Keputusan ini perlu diambil sebelum training.
- **Dataset sintetis dan kolom Moodle.** Panduan merekomendasikan tabel `mdl_logstore_standard_log` dan `mdl_quiz_attempts`. Generator sebaiknya menghasilkan kolom yang mirip dengan tabel tersebut, supaya nanti mudah diganti dengan data asli.

### 18.4 Item yang harus disiapkan di luar dokumen ini

- Judul proyek web ITS.
- Nama kelas dan nomor kelompok.
- Nama, NPM, dan pembagian peran tiap anggota (lima orang).
- Link repository GitHub atau Google Drive.
