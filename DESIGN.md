# DESIGN: EWS ITS

Dokumen ini menjadi acuan visual dan komponen untuk `frontend\index.html`, `frontend\css\style.css`, dan `frontend\js\app.js`. Kebutuhan fungsional ada di PRD.md. Struktur teknis ada di ARCHITECTURE.md.

Referensi utama: pola tata letak dashboard e-learning Plume (https://dribbble.com/shots/11999865-Personal-e-learning-dashboard-lms-learning-management-system). Hanya pola struktur yang diambil. Logo, ilustrasi, foto, dan badge milik Plume tidak dipakai.

---

## 1. Tujuan Visual

Sistem ini dipakai untuk bekerja. Dosen perlu cepat melihat siapa yang perlu dibantu. Mahasiswa perlu tahu langkah berikutnya. Karena itu tampilan harus tenang, mudah dipindai, dan jelas dalam membedakan status. Gamifikasi ditampilkan sebagai informasi yang bermakna, bukan hiasan.

Tiga prinsip:
1. **Satu pertanyaan per layar.** Setiap halaman menjawab satu hal: siapa yang perlu dibantu, apa langkah berikutnya, atau seberapa yakin model.
2. **Status selalu berbicara dengan teks.** Warna memperkuat, tidak menggantikan label.
3. **Tidak ada elemen yang hanya untuk tampilan.** Jika sebuah elemen tidak membantu keputusan atau tindakan, elemen itu dihapus.

## 2. Tata Letak Umum

### 2.1 Desktop (≥ 900px)

```
┌──────────────┬──────────────────────────────────────────────┐
│              │  Header: judul halaman · selector peran      │
│  Sidebar     ├──────────────────────────────────────────────┤
│  220px       │                                              │
│              │  Konten utama (maks. 1100px)                 │
│  - Ringkasan │                                              │
│  - Siswa     │  [kartu utama]                               │
│    Berisiko  │  [kartu sekunder] [kartu sekunder]           │
│  - Prediksi  │                                              │
│  - Progres   │                                              │
│  - Riwayat   │                                              │
│  - Metrik    │                                              │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│  Footer: Academic Disclaimer                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Tablet dan mobile (< 900px)

- Sidebar berubah menjadi bar horizontal di atas, bisa digulir ke samping.
- Semua kartu tersusun satu kolom.
- Tabel berubah menjadi daftar kartu di bawah 640px (lihat bagian 6.4).

### 2.3 Grid

- Lebar konten maksimal 1100px, dipusatkan.
- Kolom menggunakan CSS Grid. Dua kolom untuk layar lebar, satu kolom untuk layar sempit.
- Jarak antar kartu 24px (desktop) dan 16px (mobile).

## 3. Menu dan Navigasi

Sidebar memakai lima menu sesuai referensi Plume, disesuaikan dengan sistem kita.

| Menu | Peran | Isi |
|---|---|---|
| Ringkasan | Dosen dan mahasiswa | Dashboard utama sesuai peran (lihat bagian 5). |
| Siswa Berisiko | Dosen | Tabel semua siswa dengan level risiko dan rekomendasi. |
| Prediksi | Dosen | Form input fitur dan hasil prediksi. |
| Progres Saya | Mahasiswa | XP, level, badge, quest line. |
| Riwayat | Mahasiswa | Timeline aktivitas. |
| Metrik Model | Dosen | Perbandingan KNN dan MLP, confusion matrix, dan catatan keterbatasan. |

Aturan:
- Menu aktif diberi garis kiri 3px dengan warna aksen dan teks tebal. Latar tidak diubah secara mencolok.
- Ikon menggunakan SVG inline dengan stroke 1.75px, ukuran 20px. Jangan memakai emoji sebagai ikon.
- Selector peran (Dosen | Mahasiswa) berada di header kanan. Menu yang tidak sesuai peran disembunyikan, bukan dinonaktifkan.

## 4. Sistem Warna

Palet dibuat netral dengan satu warna aksen. Tidak ada gradien.

### 4.1 Token warna

```css
:root {
  /* Netral */
  --color-bg: #F6F5F2;          /* latar halaman, sedikit hangat */
  --color-surface: #FFFFFF;      /* kartu */
  --color-border: #E3E1DB;       /* garis pemisah */
  --color-text: #1F1E1B;         /* teks utama */
  --color-text-muted: #6B6862;   /* teks sekunder, kontras 4.5:1 di atas surface */

  /* Aksen */
  --color-accent: #1D5C7A;       /* tombol utama, menu aktif, link */
  --color-accent-soft: #E4EEF3;  /* latar menu aktif, bar progres */

  /* Status risiko (selalu disertai teks) */
  --color-risk-low: #2E6B45;
  --color-risk-low-bg: #E7F2EB;
  --color-risk-mid: #8A5A00;
  --color-risk-mid-bg: #FBF0D9;
  --color-risk-high: #A1282A;
  --color-risk-high-bg: #F8E4E4;

  /* Fokus */
  --color-focus: #1D5C7A;
}
```

Versi pertama hanya memakai tema terang. Tidak ada mode gelap.

### 4.2 Aturan penggunaan

- Aksen hanya untuk: tombol utama, menu aktif, link, bar XP, dan fokus keyboard.
- Warna risiko hanya untuk: badge status, bar probabilitas, dan banner notifikasi. Jangan dipakai untuk dekorasi.
- Kontras teks minimal 4.5:1 untuk teks biasa, 3:1 untuk teks besar dan ikon.
- Kombinasi teks dan latar risiko harus diuji. Kuning `#8A5A00` di atas `#FBF0D9` lolos 4.5:1.

## 5. Komponen per Layar

### 5.1 Ringkasan (dosen)

Kartu utama: **Perlu perhatian sekarang**
- Daftar lima siswa dengan risiko tertinggi, masing-masing dengan nama anonim (misalnya S-014), level risiko, dan satu alasan utama.
- Tombol "Lihat semua" menuju menu Siswa Berisiko.

Kartu sekunder: **Ringkasan kelas**
- Jumlah siswa per level risiko, ditulis sebagai kalimat: "3 berisiko tinggi, 7 sedang, 22 rendah".
- Tanggal data terakhir diperbarui ("Data per 12 November 2026"). Ini sesuai pelajaran dari Adelaide.

Tidak ada kartu statistik besar dengan angka tanpa konteks.

### 5.2 Ringkasan (mahasiswa)

Kartu utama: **Lanjutkan**
- Satu kalimat: "Langkah berikutnya: Modul 3, Kuis Bab 2."
- Satu tombol utama: "Lanjutkan belajar". Tombol ini menandai item sebagai dimulai, bukan langsung selesai.
- Ilustrasi tidak dipakai. Gunakan teks dan bar progres.

Kartu sekunder: **Level saya**
- Teks: "Level 2 · 81 XP lagi ke level 3".
- Bar progres lebar penuh dengan tinggi 8px.

Kartu sekunder: **Riwayat singkat**
- Tiga aktivitas terakhir dengan link "Lihat riwayat".

### 5.3 Siswa Berisiko (dosen)

Tabel dengan kolom: ID siswa, Level risiko, Probabilitas, Alasan utama, Rekomendasi, Terakhir aktif.

- Urutkan default dari risiko tertinggi.
- Klik baris membuka panel detail di sisi kanan (lebar 380px di desktop) yang berisi faktor risiko, nilai fitur, dan quest yang direkomendasikan.
- Filter dengan tiga tombol: Semua, Tinggi, Sedang, Rendah. Tombol aktif memakai gaya menu aktif.

### 5.4 Prediksi (dosen)

Form dibagi dua fieldset: **Aktivitas** dan **Nilai**.

- Setiap field punya label di atas, bukan placeholder sebagai label.
- Hint kecil di bawah field menjelaskan rentang, misalnya "0 sampai 100".
- Tombol "Jalankan prediksi" di kanan bawah. Saat diproses, tombol menampilkan "Memproses..." dan disabled.
- Hasil muncul di kolom kanan (desktop) atau di bawah form (mobile) tanpa reload.

Kartu hasil:
- Badge status besar: "Risiko tinggi" dengan latar merah lembut dan teks merah.
- Teks probabilitas: "Model memperkirakan 78% kemungkinan berisiko." Ini bukan kepastian.
- Dua bar kecil untuk KNN dan MLP dengan label dan angka.
- Daftar "Alasan utama" berisi maksimal tiga poin.
- Daftar quest rekomendasi dengan checkbox read-only.
- Disclaimer kecil di bawah kartu: "Prototipe ITS edukatif. Bukan keputusan akademik resmi."

### 5.5 Progres Saya (mahasiswa)

- Kartu level: nomor level besar, teks "81 XP lagi ke level 3", bar progres.
- Quest line: lima item mingguan sebagai daftar bercentang. Item selesai diberi tanda centang dan teks dicoret tipis. Item remedial diberi label "Remedial" dengan badge kecil berwarna netral.
- Badge: grid kecil berisi chip dengan nama dan syarat. Badge yang belum didapat ditampilkan dengan teks muted, tidak disembunyikan. Badge yang didapat menampilkan tanggal.
- Progress keseluruhan: teks "2 dari 5 item selesai (40%)".

### 5.6 Riwayat (mahasiswa)

Timeline vertikal dengan titik di sebelah kiri, mengikuti pola Plume.

- Setiap entri berisi: tanggal (bold), jenis aktivitas, dan detail singkat.
- Jenis aktivitas: Kuis selesai (skor 85), Bacaan selesai, Badge didapat, Level naik, Prediksi dijalankan.
- Entri dikelompokkan per hari.
- Tidak ada animasi pada timeline.

### 5.7 Metrik Model (dosen)

- Tabel perbandingan KNN dan MLP dengan kolom accuracy, precision, recall, F1, ROC-AUC. Nilai terbaik per kolom ditandai dengan teks "terbaik", bukan hanya warna.
- Confusion matrix sebagai tabel sederhana, bukan grafik dekoratif.
- Catatan keterbatasan dalam kotak teks: "Model dilatih pada data sintetis. Hasil ini tidak menggambarkan performa pada data Moodle nyata."

## 6. Komponen Dasar

### 6.1 Kartu

- Latar `--color-surface`, border 1px `--color-border`, radius 8px, tanpa bayangan.
- Padding 20px (desktop) dan 16px (mobile).
- Judul kartu 16px, weight 600. Link aksi di kanan judul (misalnya "Lihat semua").

### 6.2 Tombol

| Jenis | Gaya | Penggunaan |
|---|---|---|
| Utama | Latar `--color-accent`, teks putih, tinggi 40px | Satu per kartu |
| Sekunder | Border 1px, teks `--color-text` | Aksi pendukung |
| Teks | Tanpa border, teks `--color-accent` | Link aksi |

Status: hover menggelapkan latar 8%, fokus memakai outline 2px `--color-focus` dengan offset 2px, disabled memakai opasitas 50%.

### 6.3 Badge status risiko

Pill kecil berisi teks. Contoh: `Risiko tinggi`. Latar dan teks memakai pasangan warna risiko. Tinggi minimal 24px.

### 6.4 Tabel

- Header teks 13px, weight 600, warna `--color-text-muted`.
- Baris dengan garis bawah 1px. Tanpa zebra striping.
- Di bawah 640px, setiap baris menjadi kartu dengan label kolom di kiri.

### 6.5 Bar progres

- Tinggi 8px, radius 4px, latar `--color-accent-soft`, isi `--color-accent`.
- Selalu disertai teks angka di sebelahnya.
- Animasi lebar hanya 200ms dan tidak diulang saat halaman dimuat ulang.

### 6.6 Input dan form

- Tinggi 44px, border 1px, radius 6px, padding horizontal 12px.
- Fokus: border `--color-accent` dan outline 2px.
- Error: border merah, teks error di bawah field dengan ikon kecil dan pesan spesifik, misalnya "Nilai harus antara 0 sampai 100".
- Validasi 422 dari server ditampilkan di field yang bersangkutan.

### 6.7 Notifikasi (banner)

- Di bagian atas konten, di bawah header.
- Latar sesuai status, teks, dan tombol tutup berbentuk ikon X dengan `aria-label="Tutup"`.
- Banner server tidak aktif: "Server tidak merespons. Pastikan uvicorn sedang berjalan di terminal."
- Notifikasi intervensi: "Mahasiswa S-014 perlu perhatian. Quest remedial sudah ditambahkan."
- Tidak ada pop-up modal yang memblokir.

### 6.8 Toast gamifikasi

- Muncul di pojok kanan bawah selama 4 detik.
- Isi: "+19 XP · Kuis selesai" atau "Badge baru: Akurasi Tinggi".
- Tidak memblokir klik. Bisa ditutup dengan Esc atau tombol X.

## 7. Tipografi

Font menggunakan stack sistem agar cepat dan konsisten di Windows.

```css
font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
```

Skala:

| Peran | Ukuran | Weight | Line height |
|---|---|---|---|
| Judul halaman | 24px | 600 | 1.25 |
| Judul kartu | 16px | 600 | 1.4 |
| Teks isi | 15px | 400 | 1.6 |
| Teks sekunder | 13px | 400 | 1.5 |
| Angka besar (level) | 40px | 600 | 1 |

Aturan:
- Maksimal tiga ukuran dalam satu kartu.
- Jangan memakai huruf kapital seluruhnya kecuali untuk label kecil yang pendek.
- Angka di tabel memakai `font-variant-numeric: tabular-nums`.

## 8. Spasi, Radius, dan Bayangan

- Skala spasi kelipatan 4px: 4, 8, 12, 16, 20, 24, 32, 48.
- Radius: 6px untuk input dan tombol, 8px untuk kartu. Tidak lebih dari 8px.
- Bayangan: tidak dipakai. Pemisahan memakai border.
- Ikon: 20px untuk menu, 16px untuk teks inline.

## 9. Ikon

- Gunakan SVG inline yang digambar sederhana, stroke 1.75px, `stroke-linecap="round"`, dan `fill="none"`.
- Ikon yang dibutuhkan saja: beranda, daftar, prediksi (grafik), progres (bintang atau lencana), riwayat (jam), metrik (batang), tutup (X), centang, peringatan.
- Ikon harus selalu disertai teks di menu. Di layar sempit, teks boleh disembunyikan, tetapi harus ada `aria-label`.

## 10. Gerak dan Animasi

- Transisi hanya untuk: hover tombol (150ms), perubahan lebar bar progres (200ms), dan munculnya toast (200ms).
- Tidak ada animasi pada timeline, kartu, atau tabel.
- Hormati `prefers-reduced-motion: reduce` dengan menghilangkan semua transisi.

## 11. Aksesibilitas

- Setiap input punya `<label for="...">`.
- Elemen dinamis (hasil prediksi, toast, banner) memakai `aria-live="polite"`. Banner error memakai `role="alert"`.
- Tabel memakai `<th scope="col">`.
- Seluruh elemen dapat dioperasikan dengan keyboard. Urutan Tab mengikuti urutan visual.
- Fokus terlihat di semua elemen interaktif.
- Target sentuh minimal 44px di mobile.
- Warna tidak boleh menjadi satu-satunya pembeda (lihat bagian 4.2).

## 12. Teks dan Bahasa

- Bahasa Indonesia baku tetapi tidak kaku. Contoh: "Lanjutkan belajar", bukan "Lanjutkan proses pembelajaran Anda".
- Kalimat pendek, satu ide per kalimat.
- Gunakan "Anda" untuk mahasiswa dan dosen. Hindari "kamu" di antarmuka.
- Hindari kata seperti "luar biasa", "fantastis", atau "selamat" berlebihan.
- Istilah teknis dijelaskan sekali di tempat pertama muncul. Contoh: "Probabilitas (kemungkinan menurut model)".
- Pesan error menyebut apa yang salah dan apa yang harus dilakukan.

## 13. Layar Kosong, Memuat, dan Error

| Kondisi | Tampilan |
|---|---|
| Belum ada prediksi | Teks: "Belum ada hasil prediksi. Isi form untuk memulai." dengan tombol ke menu Prediksi. |
| Belum ada riwayat | Teks: "Riwayat akan muncul setelah Anda menyelesaikan kuis atau bacaan." |
| Memuat data | Teks "Memuat..." di tempat konten. Tidak ada spinner berputar yang besar. |
| Server error (500) | Banner merah: "Terjadi kesalahan di server. Coba lagi beberapa saat." |
| Model belum dimuat (503) | Banner kuning: "Model belum tersedia. Jalankan training terlebih dahulu." |
| Siswa tidak ditemukan (404) | Teks: "Data siswa S-XXX tidak ditemukan." |

## 14. Anti-Pola (Dilarang)

Ini daftar pola yang membuat tampilan terasa generik atau dibuat AI. Semua dilarang kecuali ada alasan yang jelas dan tertulis.

- Gradien warna pada tombol, latar, atau teks.
- Efek kaca buram (glassmorphism) atau bayangan tebal.
- Emoji sebagai ikon atau dekorasi, misalnya 🚀 📊 ✨.
- Kartu statistik dengan angka yang tidak punya arti jelas, misalnya "98% kepuasan" tanpa sumber.
- Ilustrasi, maskot, atau gambar stok sebagai dekorasi.
- Badge yang hanya ikon tanpa nama.
- Judul marketing seperti "Selamat datang di masa depan pembelajaran!".
- Animasi konfeti, pulsa, atau gerak terus-menerus.
- Warna pastel acak untuk setiap kategori. Hanya warna status yang punya makna.
- Kartu di dalam kartu (nesting) lebih dari satu level.
- Teks abu-abu sangat terang yang sulit dibaca.
- Tombol "Pelajari lebih lanjut" atau "Klik di sini" tanpa konteks.
- Font dekoratif atau font Google yang tidak diperlukan.

## 15. Pemetaan dari Referensi Plume

| Elemen Plume | Keputusan | Alasan |
|---|---|---|
| Sidebar lima menu | Dipakai, menu disesuaikan | Pola navigasi jelas dan cocok |
| Kartu "Pick up where you left off" | Dipakai sebagai "Lanjutkan" | Mengurangi keputusan pengguna |
| Kartu daftar kursus dengan "Continue course" | Diubah menjadi quest line | Sistem kita tidak punya daftar kursus |
| Level dengan bar dan teks sisa poin | Dipakai dengan teks XP | Jelas dan langsung dipahami |
| Timeline di kolom kanan | Dipakai sebagai halaman Riwayat terpisah | Panel samping terlalu sempit untuk daftar panjang |
| Badge grid dengan "+9 more" | Diubah: badge berisi nama dan syarat, semua ditampilkan | Badge tanpa nama tidak bermakna |
| Ilustrasi hero | Tidak dipakai | Dekoratif, tidak membantu pekerjaan |
| Foto profil | Diganti dengan ID anonim | Data pribadi tidak disimpan |
| Warna ungu | Tidak dipakai | Warna aksen kita biru kehijauan netral |

## 16. Daftar Periksa Sebelum Dianggap Selesai

- [ ] Sidebar sesuai peran (dosen dan mahasiswa berbeda).
- [ ] Setiap status risiko memiliki teks, bukan hanya warna.
- [ ] Tidak ada elemen dari daftar anti-pola (bagian 14).
- [ ] Semua badge punya nama dan syarat.
- [ ] Form tidak reload saat submit.
- [ ] Tabel berubah menjadi kartu di bawah 640px.
- [ ] Kontras teks diuji dengan alat seperti WebAIM Contrast Checker.
- [ ] Navigasi keyboard berfungsi dari awal sampai akhir.
- [ ] Disclaimer tampil di footer dan di kartu hasil.
- [ ] Tampilan diuji di lebar 1280px dan 375px (screenshot untuk Bab IV).
