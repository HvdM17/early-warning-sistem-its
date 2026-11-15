/**
 * Dashboard Students Module (Jobdesk Caca)
 * Mengelola komponen Siswa Berisiko: Top 5 siswa, tabel 50 siswa OULAD, filter risiko, & detail drawer
 */

import { apiGetStudents } from './api.js';
import { appState } from './state.js';
import { escapeHtml } from './ui.js';
import { navigateToSection } from './navigation.js';
import { renderClassOverview } from './dashboard-summary.js';

let activeFilter = 'semua';

/**
 * Mengambil data sampel pendaftaran siswa dari API backend
 */
export async function loadStudentsData() {
  const containerTop = document.getElementById('topRiskContainer');
  const containerAll = document.getElementById('studentsTableContainer');

  try {
    const res = await apiGetStudents();
    const list = Array.isArray(res) ? res : (res?.students || []);
    appState.students = list;

    // Render komponen-komponen yang membutuhkan data siswa
    renderTop5Students(list);
    renderAllStudentsTable(list, activeFilter);
    renderClassOverview(list);
    updateFilterBadgeCounts(list);
  } catch (err) {
    if (containerTop) {
      containerTop.innerHTML = '<p class="placeholder-text">Gagal memuat ringkasan siswa berisiko (server backend belum aktif).</p>';
    }
    if (containerAll) {
      containerAll.innerHTML = '<p class="placeholder-text">Gagal memuat daftar siswa berisiko (server backend belum aktif).</p>';
    }
    const summaryEl = document.getElementById('classSummarySentence');
    if (summaryEl) {
      summaryEl.textContent = 'Data siswa belum dapat dimuat dari backend.';
    }
  }
}

/**
 * Memperbarui angka badge pada tombol-tombol filter
 */
export function updateFilterBadgeCounts(list) {
  if (!list) return;
  const counts = { semua: list.length, tinggi: 0, sedang: 0, rendah: 0 };
  list.forEach(s => {
    if (counts[s.risk_level] !== undefined) counts[s.risk_level]++;
  });

  const btnSemua = document.querySelector('[data-filter="semua"] .filter-badge-count');
  const btnTinggi = document.querySelector('[data-filter="tinggi"] .filter-badge-count');
  const btnSedang = document.querySelector('[data-filter="sedang"] .filter-badge-count');
  const btnRendah = document.querySelector('[data-filter="rendah"] .filter-badge-count');

  if (btnSemua) btnSemua.textContent = counts.semua;
  if (btnTinggi) btnTinggi.textContent = counts.tinggi;
  if (btnSedang) btnSedang.textContent = counts.sedang;
  if (btnRendah) btnRendah.textContent = counts.rendah;
}

/**
 * Merender 5 siswa dengan tingkat risiko tertinggi di kartu ringkasan
 * @param {Array} list
 */
export function renderTop5Students(list) {
  const container = document.getElementById('topRiskContainer');
  if (!container) return;

  if (!list || !list.length) {
    container.innerHTML = '<p class="placeholder-text">Tidak ada data siswa yang ditemukan.</p>';
    return;
  }

  // Pengurutan prioritas: Tinggi (3) -> Sedang (2) -> Rendah (1), kemudian probabilitas tertinggi
  const sorted = [...list].sort((a, b) => {
    const prio = { tinggi: 3, sedang: 2, rendah: 1 };
    if (prio[b.risk_level] !== prio[a.risk_level]) {
      return prio[b.risk_level] - prio[a.risk_level];
    }
    return (b.probability || 0) - (a.probability || 0);
  });

  const top5 = sorted.slice(0, 5);

  let html = `
    <div class="dash-table-wrap">
      <table class="dash-table">
        <thead>
          <tr>
            <th scope="col">ID Mahasiswa</th>
            <th scope="col">Tingkat Risiko</th>
            <th scope="col">Probabilitas</th>
            <th scope="col">Status Intervensi</th>
            <th scope="col" style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
  `;

  top5.forEach(s => {
    const probPct = Math.round((s.probability || 0) * 100);
    const probBarClass = s.risk_level === 'tinggi' ? 'prob-high' : s.risk_level === 'sedang' ? 'prob-mid' : 'prob-low';

    html += `
      <tr>
        <td>
          <span class="dash-student-id-badge">${escapeHtml(s.student_id)}</span>
        </td>
        <td>
          <span class="dash-risk-pill risk-${escapeHtml(s.risk_level)}">Risiko ${escapeHtml(s.risk_level)}</span>
        </td>
        <td>
          <div class="prob-cell">
            <div class="prob-track">
              <div class="prob-bar ${probBarClass}" style="width: ${probPct}%;"></div>
            </div>
            <span class="prob-val">${probPct}%</span>
          </div>
        </td>
        <td>
          <span style="font-weight: 650; color: ${s.risk_label === 'berisiko' ? '#DC2626' : '#059669'};">
            ${s.risk_label === 'berisiko' ? '⚠️ Perlu Perhatian' : '✓ Aman'}
          </span>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn btn-secondary btn-sm" data-inspect-student="${escapeHtml(s.student_id)}">
            Periksa →
          </button>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  // Pasang listener pada tombol "Periksa"
  container.querySelectorAll('[data-inspect-student]').forEach(btn => {
    btn.addEventListener('click', () => {
      const studentId = btn.dataset.inspectStudent;
      openStudentDetailModal(studentId);
      navigateToSection('siswa-berisiko');
    });
  });
}

/**
 * Merender tabel lengkap 50 siswa berisiko dengan filter
 * @param {Array} list
 * @param {string} filter 'semua' | 'tinggi' | 'sedang' | 'rendah'
 */
export function renderAllStudentsTable(list, filter = 'semua') {
  const container = document.getElementById('studentsTableContainer');
  if (!container) return;

  activeFilter = filter;
  const filtered = filter === 'semua' ? list : list.filter(s => s.risk_level === filter);

  if (!filtered.length) {
    container.innerHTML = `
      <div style="padding: 36px 20px; text-align: center; color: #64748B;">
        <p style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">Tidak ada data siswa ditemukan</p>
        <p style="font-size: 12px; margin: 0;">Tidak ada catatan mahasiswa untuk filter kategori "${filter}".</p>
      </div>
    `;
    return;
  }

  // Urutkan berdasarkan keparahan risiko dan probabilitas
  const sorted = [...filtered].sort((a, b) => {
    const prio = { tinggi: 3, sedang: 2, rendah: 1 };
    if (prio[b.risk_level] !== prio[a.risk_level]) {
      return prio[b.risk_level] - prio[a.risk_level];
    }
    return (b.probability || 0) - (a.probability || 0);
  });

  let html = `
    <div class="dash-table-wrap">
      <table class="dash-table">
        <thead>
          <tr>
            <th scope="col">ID Mahasiswa</th>
            <th scope="col">Tingkat Risiko</th>
            <th scope="col">Probabilitas Kegagalan</th>
            <th scope="col">Model Penentu</th>
            <th scope="col" style="text-align: right;">Detail</th>
          </tr>
        </thead>
        <tbody>
  `;

  sorted.forEach(s => {
    const probPct = Math.round((s.probability || 0) * 100);
    const probBarClass = s.risk_level === 'tinggi' ? 'prob-high' : s.risk_level === 'sedang' ? 'prob-mid' : 'prob-low';
    const modelTag = (s.primary_model || 'knn').toUpperCase();

    html += `
      <tr class="dash-student-row" data-row-id="${escapeHtml(s.student_id)}" style="cursor: pointer;">
        <td>
          <span class="dash-student-id-badge">${escapeHtml(s.student_id)}</span>
        </td>
        <td>
          <span class="dash-risk-pill risk-${escapeHtml(s.risk_level)}">Risiko ${escapeHtml(s.risk_level)}</span>
        </td>
        <td>
          <div class="prob-cell">
            <div class="prob-track">
              <div class="prob-bar ${probBarClass}" style="width: ${probPct}%;"></div>
            </div>
            <span class="prob-val">${probPct}%</span>
          </div>
        </td>
        <td>
          <span style="font-size: 12px; font-weight: 700; color: #475569;">${modelTag}</span>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn btn-secondary btn-sm" data-inspect-student="${escapeHtml(s.student_id)}">
            Buka Detail
          </button>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  // Pasang listener klik tombol detail
  container.querySelectorAll('[data-inspect-student]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openStudentDetailModal(btn.dataset.inspectStudent);
    });
  });

  // Pasang listener klik baris tabel
  container.querySelectorAll('.dash-student-row').forEach(tr => {
    tr.addEventListener('click', () => {
      openStudentDetailModal(tr.dataset.rowId);
    });
  });
}

/**
 * Menginisialisasi event listeners tombol filter dan penutup detail panel
 */
export function initStudentsInteractions() {
  const filterButtons = document.querySelectorAll('.filter-btn, .dash-filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetFilter = btn.dataset.filter || 'semua';
      renderAllStudentsTable(appState.students, targetFilter);
    });
  });

  const btnClose = document.getElementById('btnCloseDetail');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      closeStudentDetailModal();
    });
  }
}

/**
 * Membuka drawer detail mahasiswa dan merender ringkasan analitiknya
 * @param {string} studentId
 */
export function openStudentDetailModal(studentId) {
  const student = appState.students.find(s => s.student_id === studentId);
  if (!student) return;

  const panel = document.getElementById('studentDetailPanel');
  const title = document.getElementById('detailStudentId');
  const body = document.getElementById('detailStudentContent');
  const splitContainer = document.querySelector('.dash-split-container, .split-view');

  if (!panel || !title || !body) return;

  title.textContent = `Analisis Mahasiswa: ${student.student_id}`;
  const probPct = Math.round((student.probability || 0) * 100);

  // Rekomendasi intervensi edukatif berbasis tingkat risiko
  let rekomendasiText = '';
  if (student.risk_level === 'tinggi') {
    rekomendasiText = 'Perlu pendampingan dosen wali segera. Rekomendasikan modul remedial intervensi serta evaluasi presensi tugas mingguan.';
  } else if (student.risk_level === 'sedang') {
    rekomendasiText = 'Pantau keaktifan klik LMS 7 hari ke depan. Berikan pengingat tenggat waktu pengerjaan modul tugas.';
  } else {
    rekomendasiText = 'Performa mahasiswa berada pada rentang aman. Pertahankan konsistensi partisipasi belajar.';
  }

  body.innerHTML = `
    <div class="dash-detail-kv-grid">
      <div style="background: #F8FAFC; padding: 14px; border-radius: 12px; border: 1px solid #E2E8F0; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Estimasi Risiko</span>
          <span class="dash-risk-pill risk-${escapeHtml(student.risk_level)}">Risiko ${escapeHtml(student.risk_level)}</span>
        </div>
        <div style="font-size: 24px; font-weight: 850; color: #0F172A; margin: 4px 0;">
          ${probPct}% <span style="font-size: 12px; font-weight: 600; color: #64748B;">Probabilitas Kegagalan</span>
        </div>
        <div class="prob-track" style="height: 8px; margin-top: 8px;">
          <div class="prob-bar ${student.risk_level === 'tinggi' ? 'prob-high' : student.risk_level === 'sedang' ? 'prob-mid' : 'prob-low'}" style="width: ${probPct}%;"></div>
        </div>
      </div>

      <div class="dash-detail-kv-row">
        <span class="dash-detail-kv-label">ID Mahasiswa</span>
        <span class="dash-detail-kv-val" style="font-family: monospace;">${escapeHtml(student.student_id)}</span>
      </div>

      <div class="dash-detail-kv-row">
        <span class="dash-detail-kv-label">Model Penentu</span>
        <span class="dash-detail-kv-val">${escapeHtml((student.primary_model || 'KNN').toUpperCase())} (k=3)</span>
      </div>

      <div class="dash-detail-kv-row">
        <span class="dash-detail-kv-label">Klasifikasi Status</span>
        <span class="dash-detail-kv-val" style="color: ${student.risk_label === 'berisiko' ? '#DC2626' : '#059669'};">
          ${student.risk_label === 'berisiko' ? 'Berisiko / At-Risk' : 'Aman / Normal'}
        </span>
      </div>

      <div style="margin-top: 8px;">
        <label style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.4px;">Rekomendasi Intervensi:</label>
        <p style="font-size: 12px; line-height: 1.5; color: #334155; margin-top: 4px; background: #F1F5F9; padding: 10px 12px; border-radius: 8px;">
          ${rekomendasiText}
        </p>
      </div>

      <div style="margin-top: 14px;">
        <button type="button" class="btn btn-primary btn-full" id="btnApplyToPredictForm" style="width: 100%;">
          Kirim ID ke Form Prediksi →
        </button>
      </div>
    </div>
  `;

  panel.style.display = 'block';
  if (splitContainer) splitContainer.classList.add('has-drawer-open');

  // Pasang listener pada tombol "Kirim ID ke Form Prediksi"
  document.getElementById('btnApplyToPredictForm')?.addEventListener('click', () => {
    const inputStudentId = document.getElementById('inputStudentId');
    if (inputStudentId) inputStudentId.value = student.student_id;
    navigateToSection('prediksi');
  });
}

/**
 * Menutup drawer detail mahasiswa
 */
export function closeStudentDetailModal() {
  const panel = document.getElementById('studentDetailPanel');
  const splitContainer = document.querySelector('.dash-split-container, .split-view');
  if (panel) panel.style.display = 'none';
  if (splitContainer) splitContainer.classList.remove('has-drawer-open');
}
