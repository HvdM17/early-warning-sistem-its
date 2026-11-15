/**
 * EWS ITS - Master Application Entry Point
 * Menghubungkan seluruh modul ES native: navigasi, dashboard, prediksi, dan progres
 */

import { initNavigation } from './navigation.js';
import { initDashboard } from './dashboard.js';
import { initPrediction } from './prediction.js';
import { initProgress } from './progress.js';

let isAppBootstrapped = false;

/**
 * Bootstrap aplikasi EWS ITS
 * Mengutamakan inisialisasi Dashboard Caca sebagai landing page utama (#ringkasan)
 */
async function bootstrapApp() {
  if (isAppBootstrapped) return;
  isAppBootstrapped = true;

  // 1. Inisialisasi navigasi dan routing parameter URL (?role=...&section=...)
  initNavigation();

  // 2. Inisialisasi Dashboard Dosen, Siswa Berisiko & Metrik Model (Jobdesk Caca)
  await initDashboard();

  // 3. Inisialisasi fitur Prediksi Mahasiswa (Jobdesk Dini)
  initPrediction();

  // 4. Inisialisasi fitur Progres, Gamifikasi & Riwayat (Jobdesk Dini)
  initProgress();
}

// Pastikan bootstrap terpanggil baik saat DOM masih loading maupun sudah siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
