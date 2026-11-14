/**
 * Dashboard Module untuk EWS ITS (Pekerjaan Caca)
 * Mengelola #ringkasan, #siswa-berisiko, dan #metrik-model
 * Dilengkapi visualisasi Grouped Bar Chart dan Radar Chart (Chart.js)
 */

import { apiGetHealth, apiGetStudents, apiGetMetrics } from './api.js';
import { appState, subscribe } from './state.js';
import { escapeHtml, showToast } from './ui.js';
import { navigateToSection } from './navigation.js';

let barChartInstance = null;
let radarChartInstance = null;

export async function initDashboard() {
  await Promise.all([
    loadHealth(),
    loadStudents(),
    loadMetrics()
  ]);

  initFilterButtons();
  initDetailClose();

  subscribe((event, payload) => {
    if (event === 'role_changed') {
      renderRingkasanPerRole(payload);
    } else if (event === 'student_id_changed' || event === 'progress_updated') {
      renderStudentDashboard();
    } else if (event === 'section_changed' && payload === 'metrik-model') {
      // Pastikan chart di-render ulang/resize saat section dibuka
      if (barChartInstance) barChartInstance.resize();
      if (radarChartInstance) radarChartInstance.resize();
    }
  });

  renderRingkasanPerRole(appState.role);
}

async function loadHealth() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const primaryModelInfo = document.getElementById('primaryModelInfo');

  try {
    const health = await apiGetHealth();
    appState.modelStatus = health;

    if (health.model_loaded) {
      if (statusDot) statusDot.className = 'status-indicator ready';
      if (statusText) statusText.textContent = `Model aktif (${health.primary_model.toUpperCase()})`;
      if (primaryModelInfo) {
        primaryModelInfo.textContent = `Model utama adalah ${health.primary_model.toUpperCase()}, dengan pembanding ${health.models.filter(m => m !== health.primary_model).map(m => m.toUpperCase()).join(', ')}. Model siap melayani inferensi.`;
      }
    } else {
      if (statusDot) statusDot.className = 'status-indicator error';
      if (statusText) statusText.textContent = 'Model belum dimuat';
    }
  } catch (err) {
    if (statusDot) statusDot.className = 'status-indicator error';
    if (statusText) statusText.textContent = 'Server offline';
  }
}

async function loadStudents() {
  const containerTop = document.getElementById('topRiskContainer');
  const containerAll = document.getElementById('studentsTableContainer');

  try {
    const list = await apiGetStudents();
    appState.students = list;
    renderTopRiskStudents(list);
    renderStudentsTable(list);
    renderClassSummary(list);
  } catch (err) {
    if (containerTop) containerTop.innerHTML = '<p class="placeholder-text">Gagal memuat data ringkasan siswa.</p>';
    if (containerAll) containerAll.innerHTML = '<p class="placeholder-text">Gagal memuat data siswa berisiko.</p>';
  }
}

function renderClassSummary(list) {
  const summaryEl = document.getElementById('classSummarySentence');
  if (!summaryEl) return;

  const counts = { tinggi: 0, sedang: 0, rendah: 0 };
  list.forEach(s => {
    if (counts[s.risk_level] !== undefined) counts[s.risk_level]++;
  });

  summaryEl.textContent = `${counts.tinggi} berisiko tinggi, ${counts.sedang} sedang, ${counts.rendah} rendah (dari ${list.length} sampel pendaftaran OULAD).`;
  renderRiskOverview(counts, list.length);
}

function renderRiskOverview(counts, total) {
  const donut = document.getElementById('riskDonut');
  if (!donut || !total) return;

  const high = counts.tinggi || 0;
  const mid = counts.sedang || 0;
  const low = counts.rendah || 0;
  const highEnd = (high / total) * 360;
  const midEnd = ((high + mid) / total) * 360;
  const atRiskPercent = Math.round(((high + mid) / total) * 100);
  donut.style.background = `conic-gradient(#FF626A 0deg ${highEnd}deg, #FFC94D ${highEnd}deg ${midEnd}deg, #39C98A ${midEnd}deg 360deg)`;

  const percentEl = document.getElementById('riskPercent');
  if (percentEl) percentEl.textContent = `${atRiskPercent}%`;
  [
    ['riskHighCount', high],
    ['riskMidCount', mid],
    ['riskLowCount', low]
  ].forEach(([id, count]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = `${count} (${Math.round((count / total) * 100)}%)`;
  });
}

function renderStudentDashboard() {
  const progress = appState.studentProgress;
  const studentId = appState.studentId;
  const progressMatchesStudent = progress && studentId && progress.student_id === studentId;
  const progressRing = document.getElementById('studentProgressRing');
  const percentEl = document.getElementById('studentProgressPercent');
  const progressCopy = document.getElementById('studentProgressCopy');
  const questNotice = document.getElementById('studentQuestNotice');
  const modelNotice = document.getElementById('studentModelNotice');
  const riskCopy = document.getElementById('studentRiskCopy');

  const percent = progressMatchesStudent
    ? Math.max(0, Math.min(100, Number(progress.progress_percent) || 0))
    : null;
  if (progressRing) progressRing.style.setProperty('--progress-value', `${percent ?? 0}%`);
  if (percentEl) percentEl.textContent = percent === null ? '—' : `${percent}%`;

  if (progressCopy) {
    if (!studentId) {
      progressCopy.textContent = 'Hubungkan identitas mahasiswa untuk melihat progres.';
    } else if (!progressMatchesStudent) {
      progressCopy.textContent = `Progres pembelajaran untuk ${studentId} belum dimuat.`;
    } else {
      const quests = Array.isArray(progress.quest) ? progress.quest : [];
      const completed = quests.filter(item => item.done).length;
      progressCopy.textContent = `${completed} dari ${quests.length} quest selesai · ${Number(progress.total_xp) || 0} XP terkumpul.`;
    }
  }

  if (questNotice) {
    if (!progressMatchesStudent) {
      questNotice.textContent = studentId
        ? 'Buka progres untuk memuat quest dan aktivitas belajar.'
        : 'Progres dan aktivitas belajar tersedia di halaman mahasiswa.';
    } else {
      const quests = Array.isArray(progress.quest) ? progress.quest : [];
      questNotice.textContent = `${quests.filter(item => item.done).length} dari ${quests.length} quest pembelajaran telah selesai.`;
    }
  }

  if (modelNotice) {
    modelNotice.textContent = appState.modelStatus?.model_loaded
      ? `Model ${String(appState.modelStatus.primary_model || '').toUpperCase()} siap untuk prediksi risiko.`
      : 'Status model sedang diperiksa.';
  }

  if (riskCopy) {
    const student = studentId && appState.students.find(item => item.student_id === studentId);
    riskCopy.textContent = student
      ? `Status risiko: ${student.risk_level} · probabilitas ${Math.round(student.probability * 100)}%.`
      : studentId
        ? 'Belum ada prediksi risiko untuk identitas ini.'
        : 'Hubungkan identitas untuk melihat ringkasan prediksi risiko.';
  }
}

function renderTopRiskStudents(list) {
  const container = document.getElementById('topRiskContainer');
  if (!container) return;

  if (!list || !list.length) {
    container.innerHTML = '<p class="placeholder-text">Tidak ada data siswa ditemukan.</p>';
    return;
  }

  // Urutkan risiko tertinggi
  const sorted = [...list].sort((a, b) => {
    const prio = { tinggi: 3, sedang: 2, rendah: 1 };
    if (prio[b.risk_level] !== prio[a.risk_level]) {
      return prio[b.risk_level] - prio[a.risk_level];
    }
    return b.probability - a.probability;
  });

  const top5 = sorted.slice(0, 5);
  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">ID Siswa</th>
          <th scope="col">Level Risiko</th>
          <th scope="col">Probabilitas</th>
          <th scope="col">Status</th>
          <th scope="col">Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;

  top5.forEach(s => {
    const probPct = Math.round(s.probability * 100);
    html += `
      <tr>
        <td data-label="ID Siswa"><strong>${escapeHtml(s.student_id)}</strong></td>
        <td data-label="Level Risiko"><span class="badge badge-risk-${s.risk_level}">Risiko ${s.risk_level}</span></td>
        <td data-label="Probabilitas">${probPct}%</td>
        <td data-label="Status">${s.risk_label === 'berisiko' ? 'Perlu Perhatian' : 'Aman'}</td>
        <td data-label="Aksi">
          <button type="button" class="btn btn-secondary btn-sm" data-inspect-student="${escapeHtml(s.student_id)}">Periksa</button>
        </td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('[data-inspect-student]').forEach(btn => {
    btn.addEventListener('click', () => {
      openStudentDetail(btn.dataset.inspectStudent);
      navigateToSection('siswa-berisiko');
    });
  });
}

function renderStudentsTable(list, filter = 'semua') {
  const container = document.getElementById('studentsTableContainer');
  if (!container) return;

  const filtered = filter === 'semua' ? list : list.filter(s => s.risk_level === filter);

  if (!filtered.length) {
    container.innerHTML = `<p class="placeholder-text">Tidak ada data siswa untuk kategori ${filter}.</p>`;
    return;
  }

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">ID Siswa</th>
          <th scope="col">Level Risiko</th>
          <th scope="col">Probabilitas</th>
          <th scope="col">Model Penentu</th>
          <th scope="col">Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtered.forEach(s => {
    const probPct = Math.round(s.probability * 100);
    html += `
      <tr class="clickable-row" data-row-id="${escapeHtml(s.student_id)}">
        <td data-label="ID Siswa"><strong>${escapeHtml(s.student_id)}</strong></td>
        <td data-label="Level Risiko"><span class="badge badge-risk-${s.risk_level}">Risiko ${s.risk_level}</span></td>
        <td data-label="Probabilitas">${probPct}%</td>
        <td data-label="Model Penentu">${escapeHtml(s.primary_model.toUpperCase())}</td>
        <td data-label="Aksi">
          <button type="button" class="btn btn-secondary btn-sm" data-inspect-student="${escapeHtml(s.student_id)}">Detail</button>
        </td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('[data-inspect-student]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openStudentDetail(btn.dataset.inspectStudent);
    });
  });

  container.querySelectorAll('.clickable-row').forEach(tr => {
    tr.addEventListener('click', () => {
      openStudentDetail(tr.dataset.rowId);
    });
  });
}

function openStudentDetail(studentId) {
  const student = appState.students.find(s => s.student_id === studentId);
  if (!student) return;

  const panel = document.getElementById('studentDetailPanel');
  const title = document.getElementById('detailStudentId');
  const body = document.getElementById('detailStudentContent');

  if (!panel || !title || !body) return;

  title.textContent = `Detail Siswa: ${student.student_id}`;
  const probPct = Math.round(student.probability * 100);

  body.innerHTML = `
    <div class="result-status-block result-status-${student.risk_level} mb-16">
      <span class="badge badge-risk-${student.risk_level} mb-8">Risiko ${student.risk_level}</span>
      <div class="result-status-title">Probabilitas Berisiko: ${probPct}%</div>
      <div class="result-prob-desc">Model Penentu: <strong>${escapeHtml(student.primary_model.toUpperCase())}</strong></div>
    </div>
    <div class="detail-actions">
      <button type="button" class="btn btn-primary btn-full mb-8" id="btnApplyToPredictForm">Kirim ke Form Prediksi</button>
    </div>
  `;

  panel.style.display = 'block';

  document.getElementById('btnApplyToPredictForm')?.addEventListener('click', () => {
    const inputStudentId = document.getElementById('inputStudentId');
    if (inputStudentId) inputStudentId.value = student.student_id;
    navigateToSection('prediksi');
  });
}

function initFilterButtons() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderStudentsTable(appState.students, btn.dataset.filter);
    });
  });
}

function initDetailClose() {
  const btnClose = document.getElementById('btnCloseDetail');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      const panel = document.getElementById('studentDetailPanel');
      if (panel) panel.style.display = 'none';
    });
  }
}

async function loadMetrics() {
  const container = document.getElementById('metricsTableContainer');
  const knnCm = document.getElementById('knnCmContainer');
  const mlpCm = document.getElementById('mlpCmContainer');

  try {
    const metrics = await apiGetMetrics();
    appState.metrics = metrics;

    // 1. Render kartu ringkasan model
    renderMetricsSummaryCards(metrics);

    // 2. Render visualisasi diagram (Grouped Bar Chart & Radar Chart)
    renderMetricsCharts(metrics);

    // 3. Render tabel detail metrik (tetap dipertahankan)
    if (container) renderMetricsTable(container, metrics);

    // 4. Render confusion matrix
    if (knnCm) renderConfusionMatrix(knnCm, metrics.knn?.test?.confusion_matrix, 'KNN');
    if (mlpCm) renderConfusionMatrix(mlpCm, metrics.mlp?.test?.confusion_matrix, 'MLP');
  } catch (err) {
    if (container) container.innerHTML = '<p class="placeholder-text">Gagal memuat data metrik evaluasi model.</p>';
  }
}

/**
 * Render Kartu Ringkasan Informasi Model
 */
function renderMetricsSummaryCards(m) {
  const container = document.getElementById('metricsSummaryCards');
  if (!container) return;

  const knn = m.knn?.test || {};
  const mlp = m.mlp?.test || {};
  const primary = m.primary_model || 'knn';
  const cvRecallPrimary = primary === 'knn' ? m.knn?.cv_recall : m.mlp?.cv_recall_mean;

  const nTest = m.n_test ? m.n_test.toLocaleString('id-ID') : '5.983';
  const bestAcc = mlp.accuracy > knn.accuracy ? `MLP (${(mlp.accuracy * 100).toFixed(2)}%)` : `KNN (${(knn.accuracy * 100).toFixed(2)}%)`;
  const bestAuc = mlp.roc_auc > knn.roc_auc ? `MLP (${(mlp.roc_auc * 100).toFixed(2)}%)` : `KNN (${(knn.roc_auc * 100).toFixed(2)}%)`;

  container.innerHTML = `
    <div class="metric-summary-card">
      <div class="summary-card-icon icon-mint">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      </div>
      <div class="summary-card-text">
        <span class="summary-card-label">Model Utama Terpilih</span>
        <h4 class="summary-card-value">${primary.toUpperCase()} (k=3)</h4>
        <span class="summary-card-sub">CV Recall: ${((cvRecallPrimary || 0) * 100).toFixed(2)}% (Data Latih)</span>
      </div>
    </div>

    <div class="metric-summary-card">
      <div class="summary-card-icon icon-purple">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      </div>
      <div class="summary-card-text">
        <span class="summary-card-label">Sampel Data Uji OULAD</span>
        <h4 class="summary-card-value">${nTest} Baris</h4>
        <span class="summary-card-sub">20% Stratified Test Set</span>
      </div>
    </div>

    <div class="metric-summary-card">
      <div class="summary-card-icon icon-mint">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      </div>
      <div class="summary-card-text">
        <span class="summary-card-label">Akurasi Uji Tertinggi</span>
        <h4 class="summary-card-value">${bestAcc}</h4>
        <span class="summary-card-sub">KNN: ${((knn.accuracy || 0) * 100).toFixed(2)}%</span>
      </div>
    </div>

    <div class="metric-summary-card">
      <div class="summary-card-icon icon-purple">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
      </div>
      <div class="summary-card-text">
        <span class="summary-card-label">ROC-AUC Tertinggi</span>
        <h4 class="summary-card-value">${bestAuc}</h4>
        <span class="summary-card-sub">KNN: ${((knn.roc_auc || 0) * 100).toFixed(2)}%</span>
      </div>
    </div>
  `;
}

/**
 * Render Grouped Bar Chart dan Radar Chart menggunakan Chart.js
 */
function renderMetricsCharts(m) {
  if (typeof window.Chart === 'undefined') {
    return;
  }

  const knn = m.knn?.test || {};
  const mlp = m.mlp?.test || {};

  const labels = ['Accuracy', 'Precision', 'Recall', 'F1-Score', 'ROC-AUC'];
  const knnValues = [
    parseFloat(((knn.accuracy || 0) * 100).toFixed(2)),
    parseFloat(((knn.precision || 0) * 100).toFixed(2)),
    parseFloat(((knn.recall || 0) * 100).toFixed(2)),
    parseFloat(((knn.f1 || 0) * 100).toFixed(2)),
    parseFloat(((knn.roc_auc || 0) * 100).toFixed(2))
  ];
  const mlpValues = [
    parseFloat(((mlp.accuracy || 0) * 100).toFixed(2)),
    parseFloat(((mlp.precision || 0) * 100).toFixed(2)),
    parseFloat(((mlp.recall || 0) * 100).toFixed(2)),
    parseFloat(((mlp.f1 || 0) * 100).toFixed(2)),
    parseFloat(((mlp.roc_auc || 0) * 100).toFixed(2))
  ];

  // 1. Grouped Bar Chart
  const barCanvas = document.getElementById('perfBarChart');
  if (barCanvas) {
    if (barChartInstance) barChartInstance.destroy();

    barChartInstance = new window.Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: `KNN (k=3) ${m.primary_model === 'knn' ? '★ Model Utama' : ''}`,
            data: knnValues,
            backgroundColor: 'rgba(16, 185, 129, 0.78)',
            borderColor: '#10B981',
            borderWidth: 2,
            borderRadius: 8,
            hoverBackgroundColor: '#10B981'
          },
          {
            label: `MLP (32, 16) ${m.primary_model === 'mlp' ? '★ Model Utama' : ''}`,
            data: mlpValues,
            backgroundColor: 'rgba(139, 92, 246, 0.78)',
            borderColor: '#8B5CF6',
            borderWidth: 2,
            borderRadius: 8,
            hoverBackgroundColor: '#8B5CF6'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 14,
              boxHeight: 14,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { family: "'Segoe UI', sans-serif", weight: '700', size: 13 },
              color: '#334155',
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { family: "'Segoe UI', sans-serif", weight: '700', size: 13 },
            bodyFont: { family: "'Segoe UI', sans-serif", size: 13 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`
            }
          }
        },
        scales: {
          y: {
            min: 50,
            max: 90,
            grid: {
              color: 'rgba(226, 232, 240, 0.7)'
            },
            ticks: {
              stepSize: 10,
              callback: (val) => `${val}%`,
              font: { family: "'Segoe UI', sans-serif", weight: '600' },
              color: '#64748B'
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'Segoe UI', sans-serif", weight: '700' },
              color: '#334155'
            }
          }
        }
      }
    });
  }

  // 2. Radar Chart
  const radarCanvas = document.getElementById('perfRadarChart');
  if (radarCanvas) {
    if (radarChartInstance) radarChartInstance.destroy();

    radarChartInstance = new window.Chart(radarCanvas, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'KNN (k=3)',
            data: knnValues,
            backgroundColor: 'rgba(16, 185, 129, 0.22)',
            borderColor: '#10B981',
            borderWidth: 2.5,
            pointBackgroundColor: '#10B981',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'MLP (32, 16)',
            data: mlpValues,
            backgroundColor: 'rgba(139, 92, 246, 0.22)',
            borderColor: '#8B5CF6',
            borderWidth: 2.5,
            pointBackgroundColor: '#8B5CF6',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 14,
              boxHeight: 14,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { family: "'Segoe UI', sans-serif", weight: '700', size: 13 },
              color: '#334155',
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { family: "'Segoe UI', sans-serif", weight: '700', size: 13 },
            bodyFont: { family: "'Segoe UI', sans-serif", size: 13 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`
            }
          }
        },
        scales: {
          r: {
            min: 50,
            max: 85,
            ticks: {
              stepSize: 10,
              callback: (val) => `${val}%`,
              backdropColor: 'transparent',
              color: '#94A3B8',
              font: { size: 11, family: "'Segoe UI', sans-serif" }
            },
            pointLabels: {
              font: { size: 12, weight: '700', family: "'Segoe UI', sans-serif" },
              color: '#334155'
            },
            grid: {
              color: 'rgba(226, 232, 240, 0.8)'
            },
            angleLines: {
              color: 'rgba(226, 232, 240, 0.8)'
            }
          }
        }
      }
    });
  }
}

function renderMetricsTable(container, m) {
  const knn = m.knn?.test || {};
  const mlp = m.mlp?.test || {};

  const metricsList = [
    { name: 'Accuracy', key: 'accuracy' },
    { name: 'Precision', key: 'precision' },
    { name: 'Recall', key: 'recall' },
    { name: 'F1-Score', key: 'f1' },
    { name: 'ROC-AUC', key: 'roc_auc' }
  ];

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">Metrik Evaluasi</th>
          <th scope="col">KNN (k=3) ${m.primary_model === 'knn' ? '(Model Utama)' : ''}</th>
          <th scope="col">MLP (32, 16) ${m.primary_model === 'mlp' ? '(Model Utama)' : ''}</th>
        </tr>
      </thead>
      <tbody>
  `;

  metricsList.forEach(met => {
    const valKnn = knn[met.key] ?? 0;
    const valMlp = mlp[met.key] ?? 0;
    const knnBest = valKnn > valMlp;
    const mlpBest = valMlp > valKnn;

    html += `
      <tr>
        <td data-label="Metrik"><strong>${met.name}</strong></td>
        <td data-label="KNN (k=3)">
          ${(valKnn * 100).toFixed(2)}%
          ${knnBest ? '<span class="badge badge-best">Terbaik</span>' : ''}
        </td>
        <td data-label="MLP (32, 16)">
          ${(valMlp * 100).toFixed(2)}%
          ${mlpBest ? '<span class="badge badge-best">Terbaik</span>' : ''}
        </td>
      </tr>
    `;
  });

  html += `
      <tr>
        <td data-label="Metrik"><strong>Recall Validasi Silang (CV)</strong></td>
        <td data-label="KNN (k=3)">${((m.knn?.cv_recall ?? 0) * 100).toFixed(2)}% (Terbaik)</td>
        <td data-label="MLP (32, 16)">${((m.mlp?.cv_recall_mean ?? 0) * 100).toFixed(2)}% &plusmn; ${((m.mlp?.cv_recall_std ?? 0) * 100).toFixed(2)}%</td>
      </tr>
    </tbody>
  </table>
  `;
  container.innerHTML = html;
}

function renderConfusionMatrix(container, cm, modelName) {
  if (!cm) {
    container.innerHTML = '<p class="placeholder-text">Confusion matrix tidak tersedia.</p>';
    return;
  }
  container.innerHTML = `
    <table class="cm-table">
      <thead>
        <tr>
          <th>Aktual / Prediksi</th>
          <th>Prediksi Tidak Berisiko (0)</th>
          <th>Prediksi Berisiko (1)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>Aktual Tidak Berisiko (0)</th>
          <td><span class="cm-cell-val">${cm.tn.toLocaleString('id-ID')}</span><br><small style="color:var(--color-text-muted)">True Negative (TN)</small></td>
          <td><span class="cm-cell-val">${cm.fp.toLocaleString('id-ID')}</span><br><small style="color:var(--color-text-muted)">False Positive (FP)</small></td>
        </tr>
        <tr>
          <th>Aktual Berisiko (1)</th>
          <td><span class="cm-cell-val">${cm.fn.toLocaleString('id-ID')}</span><br><small style="color:var(--color-text-muted)">False Negative (FN)</small></td>
          <td><span class="cm-cell-val">${cm.tp.toLocaleString('id-ID')}</span><br><small style="color:var(--color-text-muted)">True Positive (TP)</small></td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderRingkasanPerRole(role) {
  const dosenView = document.getElementById('ringkasanDosenWrapper');
  const mhsView = document.getElementById('ringkasanMhsWrapper');

  if (role === 'mahasiswa') {
    if (dosenView) dosenView.style.display = 'none';
    if (mhsView) mhsView.style.display = 'block';
    renderStudentDashboard();
  } else {
    if (dosenView) dosenView.style.display = 'block';
    if (mhsView) mhsView.style.display = 'none';
  }
}
