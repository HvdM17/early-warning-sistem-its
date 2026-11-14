/**
 * EWS ITS - Master Application Entry Point
 * Menginisialisasi seluruh modul ES native: navigasi, dashboard, prediksi, dan progres
 */

import { initNavigation } from './navigation.js';
import { initDashboard } from './dashboard.js';
import { initPrediction } from './prediction.js';
import { initProgress } from './progress.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Inisialisasi navigasi dan routing parameter
  initNavigation();

  // Inisialisasi fitur Prediksi Mahasiswa (Jobdesk Dini)
  initPrediction();

  // Inisialisasi fitur Progres, Gamifikasi & Riwayat (Jobdesk Dini)
  initProgress();

  // Inisialisasi Dashboard Dosen, Siswa Berisiko & Metrik (Jobdesk Caca)
  await initDashboard();
});
