/**
 * Dashboard Summary Module (Jobdesk Caca)
 * Mengelola komponen Ringkasan (#ringkasan): KPI statistik, Donut Chart, status model & ringkasan kelas
 */

import { apiGetHealth } from './api.js';
import { appState } from './state.js';

/**
 * Memuat status kesiapan model ML dan koneksi backend
 */
export async function loadHealthStatus() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const primaryModelInfo = document.getElementById('primaryModelInfo');
  const kpiModelEl = document.getElementById('kpiPrimaryModel');

  try {
    const health = await apiGetHealth();
    appState.modelStatus = health;

    if (health.model_loaded) {
      const primaryName = (health.primary_model || 'knn').toUpperCase();
      if (statusDot) statusDot.className = 'status-indicator ready';
      if (statusText) statusText.textContent = `Model aktif (${primaryName})`;
      if (primaryModelInfo) {
        primaryModelInfo.textContent = `Model utama adalah ${primaryName}, dengan pembanding ${health.models.filter(m => m !== health.primary_model).map(m => m.toUpperCase()).join(', ')}. Model siap melayani inferensi prediktif.`;
      }
      if (kpiModelEl) {
        kpiModelEl.textContent = `${primaryName} (k=3)`;
      }
    } else {
      if (statusDot) statusDot.className = 'status-indicator error';
      if (statusText) statusText.textContent = 'Model belum dimuat';
      if (primaryModelInfo) {
        primaryModelInfo.textContent = 'Model machine learning belum dimuat pada backend.';
      }
      if (kpiModelEl) kpiModelEl.textContent = 'Belum Dimuat';
    }
  } catch (err) {
    if (statusDot) statusDot.className = 'status-indicator error';
    if (statusText) statusText.textContent = 'Server offline';
    if (primaryModelInfo) {
      primaryModelInfo.textContent = 'Tidak dapat terhubung ke backend FastAPI (pastikan uvicorn berjalan).';
    }
    if (kpiModelEl) kpiModelEl.textContent = 'Offline';
  }
}

/**
 * Menghitung dan merender Donut Chart serta indikator persentase risiko
 * @param {Object} counts { tinggi, sedang, rendah }
 * @param {number} total Total data sampel
 */
export function renderRiskDonut(counts, total) {
  const donut = document.getElementById('riskDonut');
  if (!donut || !total) return;

  const high = counts.tinggi || 0;
  const mid = counts.sedang || 0;
  const low = counts.rendah || 0;

  const highEnd = (high / total) * 360;
  const midEnd = ((high + mid) / total) * 360;
  const atRiskPercent = Math.round(((high + mid) / total) * 100);

  // Gradient melingkar 3-fase semantik: Merah (tinggi), Amber (sedang), Emerald (rendah/aman)
  donut.style.background = `conic-gradient(#EF4444 0deg ${highEnd}deg, #F59E0B ${highEnd}deg ${midEnd}deg, #10B981 ${midEnd}deg 360deg)`;

  const percentEl = document.getElementById('riskPercent');
  if (percentEl) percentEl.textContent = `${atRiskPercent}%`;

  const mapping = [
    ['riskHighCount', high],
    ['riskMidCount', mid],
    ['riskLowCount', low]
  ];

  mapping.forEach(([id, count]) => {
    const el = document.getElementById(id);
    if (el) {
      const pct = Math.round((count / total) * 100);
      el.textContent = `${count} (${pct}%)`;
    }
  });
}

/**
 * Merender KPI Ringkasan Kelas dan Donut Chart dari data siswa
 * @param {Array} list Daftar siswa dari API /api/students
 */
export function renderClassOverview(list) {
  const summaryEl = document.getElementById('classSummarySentence');
  const kpiTotal = document.getElementById('kpiTotalStudents');
  const kpiHigh = document.getElementById('kpiHighRisk');
  const kpiMid = document.getElementById('kpiMidRisk');
  const kpiLow = document.getElementById('kpiLowRisk');

  if (!list || !list.length) {
    if (summaryEl) summaryEl.textContent = 'Data siswa belum tersedia.';
    return;
  }

  const counts = { tinggi: 0, sedang: 0, rendah: 0 };
  list.forEach(s => {
    if (counts[s.risk_level] !== undefined) {
      counts[s.risk_level]++;
    }
  });

  const total = list.length;

  if (summaryEl) {
    summaryEl.textContent = `${counts.tinggi} berisiko tinggi, ${counts.sedang} sedang, ${counts.rendah} rendah (dari ${total} sampel pendaftaran OULAD).`;
  }

  // Perbarui nilai pada KPI Cards
  if (kpiTotal) kpiTotal.textContent = `${total} Siswa`;
  if (kpiHigh) kpiHigh.textContent = `${counts.tinggi}`;
  if (kpiMid) kpiMid.textContent = `${counts.sedang}`;
  if (kpiLow) kpiLow.textContent = `${counts.rendah}`;

  // Perbarui Donut Chart
  renderRiskDonut(counts, total);
}

/**
 * Mengatur visibilitas Ringkasan berdasarkan peran yang aktif (Dosen vs Mahasiswa)
 * @param {string} role 'dosen' | 'mahasiswa'
 */
export function renderRoleRingkasan(role) {
  const dosenView = document.getElementById('ringkasanDosenWrapper');
  const mhsView = document.getElementById('ringkasanMhsWrapper');

  if (role === 'mahasiswa') {
    if (dosenView) dosenView.style.display = 'none';
    if (mhsView) mhsView.style.display = 'block';
    renderStudentRingkasanStatus();
  } else {
    if (dosenView) dosenView.style.display = 'block';
    if (mhsView) mhsView.style.display = 'none';
  }
}

/**
 * Merender ringkasan status akademik untuk mode Mahasiswa
 */
export function renderStudentRingkasanStatus() {
  const progress = appState.studentProgress;
  const studentId = appState.studentId;
  const progressMatches = progress && studentId && progress.student_id === studentId;

  const progressRing = document.getElementById('studentProgressRing');
  const percentEl = document.getElementById('studentProgressPercent');
  const progressCopy = document.getElementById('studentProgressCopy');
  const questNotice = document.getElementById('studentQuestNotice');
  const modelNotice = document.getElementById('studentModelNotice');
  const riskCopy = document.getElementById('studentRiskCopy');

  const percent = progressMatches
    ? Math.max(0, Math.min(100, Number(progress.progress_percent) || 0))
    : null;

  if (progressRing) progressRing.style.setProperty('--progress-value', `${percent ?? 0}%`);
  if (percentEl) percentEl.textContent = percent === null ? '—' : `${percent}%`;

  if (progressCopy) {
    if (!studentId) {
      progressCopy.textContent = 'Hubungkan identitas mahasiswa untuk melihat progres pembelajaran.';
    } else if (!progressMatches) {
      progressCopy.textContent = `Data progres pembelajaran untuk ${studentId} belum dimuat.`;
    } else {
      const quests = Array.isArray(progress.quest) ? progress.quest : [];
      const completed = quests.filter(q => q.done).length;
      progressCopy.textContent = `${completed} dari ${quests.length} quest selesai · ${Number(progress.total_xp) || 0} XP terkumpul.`;
    }
  }

  if (questNotice) {
    if (!progressMatches) {
      questNotice.textContent = studentId
        ? 'Buka tab Progres untuk memuat quest dan aktivitas remedial.'
        : 'Progres dan aktivitas belajar dapat diakses di tab Progres & Gamifikasi.';
    } else {
      const quests = Array.isArray(progress.quest) ? progress.quest : [];
      questNotice.textContent = `${quests.filter(q => q.done).length} dari ${quests.length} quest pembelajaran telah diselesaikan.`;
    }
  }

  if (modelNotice) {
    modelNotice.textContent = appState.modelStatus?.model_loaded
      ? `Model ${String(appState.modelStatus.primary_model || '').toUpperCase()} aktif dan siap untuk prediksi risiko.`
      : 'Status model ML sedang diperiksa...';
  }

  if (riskCopy) {
    const student = studentId && appState.students.find(s => s.student_id === studentId);
    riskCopy.textContent = student
      ? `Status risiko terkini: ${student.risk_level.toUpperCase()} (Skor model: ${Math.round(student.probability * 100)}%).`
      : studentId
        ? 'Belum ada catatan prediksi risiko untuk identitas mahasiswa ini.'
        : 'Hubungkan identitas mahasiswa Anda untuk melihat estimasi risiko.';
  }
}
