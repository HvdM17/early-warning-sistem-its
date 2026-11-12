# DATASET_OULAD: Spesifikasi Dataset untuk EWS ITS

Dokumen ini adalah spesifikasi rinci dataset. PRD.md dan ARCHITECTURE.md merujuk ke sini untuk detail data dan fitur. Jika ada perbedaan untuk bagian data, dokumen ini yang berlaku.

Sumber data: Open University Learning Analytics Dataset (Kuzilek, Hlosta, Zdrahal, 2017), CC BY 4.0.
Unduhan: https://analyse.kmi.open.ac.uk/open_dataset atau https://archive.ics.uci.edu/dataset/349
Lokasi lokal: `data\raw_oulad\`

---

## 1. Unit data

Satu baris = satu pendaftaran, yaitu kombinasi (`code_module`, `code_presentation`, `id_student`).

Satu mahasiswa bisa punya beberapa pendaftaran, misalnya mengulang modul di presentasi berbeda. `id_student` saja tidak cukup sebagai kunci.

## 2. Waktu

Semua tanggal dalam OULAD dihitung dalam hari sejak awal presentasi. Hari 0 adalah hari mulai, dan nilai negatif berarti sebelum mulai.

| Jendela | Hari | Keterangan |
|---|---|---|
| Fitur | 0 sampai 41 | Enam minggu pertama. Aktivitas sebelum hari 0 tidak dihitung. |
| Hasil | Akhir presentasi | Diambil dari `final_result`, bukan dari data di jendela. |

Alasan: sistem bertujuan memberi peringatan dini. Fitur hanya boleh memakai data yang sudah tersedia sampai minggu keenam.

## 3. Label

`at_risk = 1` jika `final_result` adalah **Fail** atau **Withdrawn**.
`at_risk = 0` jika `final_result` adalah **Pass** atau **Distinction**.

Label ini adalah hasil nyata dari presentasi, bukan aturan buatan.

## 4. Pendaftaran yang dikeluarkan

| Kondisi | Alasan | Dicatat sebagai |
|---|---|---|
| `date_unregistration` < 0 | Mundur sebelum kuliah mulai, tidak pernah mengikuti presentasi | `excluded_early_unregistration` |
| `final_result` tidak termasuk Pass, Distinction, Fail, atau Withdrawn | Label tidak jelas | `excluded_unknown_label` |

Pendaftaran yang mundur setelah hari 0 tetap dipakai. Penurunan aktivitas sebelum mundur adalah sinyal yang sah.

## 5. Fitur

Semua fitur dihitung dari jendela hari 0 sampai 41.

| No | Nama | Definisi | Kosong jika |
|---|---|---|---|
| 1 | `aktivitas_7h` | Total `sum_click` pada hari 35 sampai 41 | Tidak pernah (diisi 0) |
| 2 | `aktivitas_14h` | Total `sum_click` pada hari 28 sampai 41 | Tidak pernah (diisi 0) |
| 3 | `hari_sejak_aktif` | 41 dikurangi hari klik terakhir di jendela. Jika tidak ada klik, nilainya 42 | Tidak pernah |
| 4 | `rata_nilai_tugas` | Rata-rata `score` tugas yang dikumpulkan di jendela | Tidak ada tugas dinilai di jendela |
| 5 | `tren_nilai` | Rata-rata sisi akhir dikurangi rata-rata sisi awal, maksimal 3 tugas per sisi, minimal 2 nilai | Kurang dari 2 nilai |
| 6 | `jumlah_tugas_dikumpulkan` | Jumlah pengumpulan tugas di jendela | Tidak pernah (diisi 0) |
| 7 | `rasio_tugas_selesai` | Tugas jatuh tempo di jendela yang dikumpulkan, dibagi jumlah tugas jatuh tempo di jendela untuk presentasi tersebut. Nilai dibatasi 0 sampai 1 | Tidak ada tugas jatuh tempo di jendela |

Catatan:
- Tugas dengan `is_banked = 1` **tidak dihitung** di fitur 4 sampai 7. Nilai tersebut dibawa dari presentasi sebelumnya.
- `tren_nilai` sama dengan definisi sebelumnya, sehingga tidak perlu mengubah laporan di bagian itu.
- `rata_durasi_menit` dihapus karena OULAD tidak punya durasi pengerjaan.

## 6. Kolom yang tidak boleh menjadi fitur

| Kolom | Alasan |
|---|---|
| `final_result` | Ini label |
| `date_unregistration` | Membocorkan label Withdrawn |
| `is_banked` | Hanya dipakai untuk menyaring |
| `gender`, `region`, `imd_band`, `age_band`, `highest_education`, `disability` | Berisiko bias. Boleh dibahas di laporan, tetapi tidak dipakai di model utama |
| `num_of_prev_attempts`, `studied_credits` | Belum diuji. Bisa ditambahkan sebagai eksperimen terpisah |

## 7. Nilai kosong

Di semua file OULAD, nilai kosong ditulis sebagai `?`. Skrip membaca `?` sebagai NaN.

NaN pada fitur tidak diisi di tahap ekstraksi. Imputasi dengan median data latih dilakukan di `03_train_knn_mlp.py`, sama seperti sebelumnya.

## 8. Keluaran

| File | Isi |
|---|---|
| `data\processed\dataset.csv` | Kunci pendaftaran, 7 fitur, `at_risk`. Dipakai untuk training. |
| `data\processed\label_audit.csv` | Kunci pendaftaran, `final_result`, `at_risk`. Hanya untuk pemeriksaan, jangan dijadikan fitur. |
| `data\processed\extract_info.json` | Jumlah baris di setiap tahap, jumlah yang dikeluarkan, dan proporsi label. Untuk laporan. |

## 9. Hal yang perlu ditulis di laporan

- Data berasal dari universitas jarak jauh di Inggris, bukan kampus di Indonesia.
- Label memakai hasil akhir resmi, bukan aturan buatan.
- Fitur dari lima tipe data: aktivitas klik, nilai tugas, tren nilai, jumlah pengumpulan, dan rasio tugas.
- Demografi tidak dipakai, dengan alasan menghindari bias.
- Model belum divalidasi pada mahasiswa Indonesia.
