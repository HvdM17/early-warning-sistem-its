/**
 * Dashboard Master Orchestrator (Jobdesk Caca)
 * Mengoordinasikan seluruh sub-modul Dashboard:
 * - dashboard-summary.js: Ringkasan, Donut Chart, Status Model & KPI
 * - dashboard-students.js: Top 5 Siswa, Tabel 50 Siswa, Filter & Detail Drawer
 * - dashboard-metrics.js: Evaluasi Model, Grouped Bar Chart, Radar Chart & Confusion Matrix
 */

import { appState, subscribe } from './state.js';
import { loadHealthStatus, renderRoleRingkasan, renderStudentRingkasanStatus } from './dashboard-summary.js';
import { loadStudentsData, initStudentsInteractions } from './dashboard-students.js';
import { loadModelMetrics, onMetricsTabOpened } from './dashboard-metrics.js';

let isDashboardInitialized = false;

/**
 * Entry point utama inisialisasi modul Dashboard
 */
export async function initDashboard() {
  if (isDashboardInitialized) return;
  isDashboardInitialized = true;

  // 1. Inisialisasi interaksi tombol filter dan penutup modal segera
  initStudentsInteractions();

  // 2. Daftarkan pendengar event perubahan state aplikasi
  subscribe((event, payload) => {
    if (event === 'role_changed') {
      renderRoleRingkasan(payload);
    } else if (event === 'student_id_changed' || event === 'progress_updated') {
      renderStudentRingkasanStatus();
    } else if (event === 'section_changed' && payload === 'metrik-model') {
      onMetricsTabOpened();
    }
  });

  // 3. Tampilkan tampilan awal peran saat ini (Dosen vs Mahasiswa)
  renderRoleRingkasan(appState.role);

  // 4. Muat seluruh data API secara paralel asinkron (non-blocking)
  try {
    await Promise.allSettled([
      loadHealthStatus(),
      loadStudentsData(),
      loadModelMetrics()
    ]);
  } catch (err) {
    console.error('Error saat inisialisasi data dashboard:', err);
  }
}
