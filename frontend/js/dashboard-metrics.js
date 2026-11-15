/**
 * Dashboard Metrics Module (Jobdesk Caca)
 * Mengelola komponen Metrik Model: KPI evaluasi, Grouped Bar Chart, Radar Chart, & Confusion Matrix
 */

import { apiGetMetrics } from './api.js';
import { appState } from './state.js';

let barChartInstance = null;
let radarChartInstance = null;

/**
 * Mengambil data metrik evaluasi model Machine Learning dari backend
 */
export async function loadModelMetrics() {
  const container = document.getElementById('metricsTableContainer');
  const knnCm = document.getElementById('knnCmContainer');
  const mlpCm = document.getElementById('mlpCmContainer');

  try {
    const metrics = await apiGetMetrics();
    appState.metrics = metrics;

    // 1. Render kartu KPI ringkasan model
    renderMetricsCards(metrics);

    // 2. Render visualisasi diagram (Grouped Bar & Radar Chart)
    renderMetricsCharts(metrics);

    // 3. Render tabel komparasi detail metrik
    if (container) renderMetricsComparisonTable(container, metrics);

    // 4. Render confusion matrix untuk kedua model
    if (knnCm) renderConfusionMatrixTable(knnCm, metrics.knn?.test?.confusion_matrix, 'KNN');
    if (mlpCm) renderConfusionMatrixTable(mlpCm, metrics.mlp?.test?.confusion_matrix, 'MLP');
  } catch (err) {
    if (container) {
      container.innerHTML = '<p class="placeholder-text">Gagal memuat tabel metrik model (server backend belum aktif).</p>';
    }
    const summaryCards = document.getElementById('metricsSummaryCards');
    if (summaryCards) {
      summaryCards.innerHTML = '<p class="placeholder-text">Data evaluasi metrik model belum dapat dimuat dari backend.</p>';
    }
    if (knnCm) knnCm.innerHTML = '<p class="placeholder-text">Confusion matrix tidak tersedia.</p>';
    if (mlpCm) mlpCm.innerHTML = '<p class="placeholder-text">Confusion matrix tidak tersedia.</p>';
  }
}

/**
 * Dipanggil saat tab Metrik Model dibuka untuk memastikan canvas yang sebelumnya hidden dirender sempurna
 */
export function onMetricsTabOpened() {
  if (!appState.metrics) return;

  if (!barChartInstance || !radarChartInstance) {
    renderMetricsCharts(appState.metrics);
  } else {
    try {
      barChartInstance.resize();
      barChartInstance.update();
      radarChartInstance.resize();
      radarChartInstance.update();
    } catch {
      renderMetricsCharts(appState.metrics);
    }
  }
}

/**
 * Merender 4 kartu KPI ringkasan evaluasi model
 * @param {Object} m Data metrik dari /api/metrics
 */
export function renderMetricsCards(m) {
  const container = document.getElementById('metricsSummaryCards');
  if (!container) return;

  const knn = m.knn?.test || {};
  const mlp = m.mlp?.test || {};
  const primary = (m.primary_model || 'knn').toUpperCase();
  const cvRecallPrimary = m.primary_model === 'knn' ? m.knn?.cv_recall : m.mlp?.cv_recall_mean;

  const nTest = m.n_test ? m.n_test.toLocaleString('id-ID') : '5.983';
  const bestAcc = mlp.accuracy > knn.accuracy
    ? `MLP (${((mlp.accuracy || 0) * 100).toFixed(2)}%)`
    : `KNN (${((knn.accuracy || 0) * 100).toFixed(2)}%)`;
  const bestAuc = mlp.roc_auc > knn.roc_auc
    ? `MLP (${((mlp.roc_auc || 0) * 100).toFixed(2)}%)`
    : `KNN (${((knn.roc_auc || 0) * 100).toFixed(2)}%)`;

  container.innerHTML = `
    <div class="dash-metric-card">
      <div class="dash-metric-icon icon-knn">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      </div>
      <div class="dash-metric-info">
        <span class="dash-metric-label">Model Utama Terpilih</span>
        <h4 class="dash-metric-val">${primary} (k=3)</h4>
        <span class="dash-metric-sub">CV Recall: ${((cvRecallPrimary || 0) * 100).toFixed(2)}% (Data Latih)</span>
      </div>
    </div>

    <div class="dash-metric-card">
      <div class="dash-metric-icon icon-mlp">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      </div>
      <div class="dash-metric-info">
        <span class="dash-metric-label">Sampel Data Uji OULAD</span>
        <h4 class="dash-metric-val">${nTest} Baris</h4>
        <span class="dash-metric-sub">20% Stratified Test Set</span>
      </div>
    </div>

    <div class="dash-metric-card">
      <div class="dash-metric-icon icon-knn">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      </div>
      <div class="dash-metric-info">
        <span class="dash-metric-label">Akurasi Uji Tertinggi</span>
        <h4 class="dash-metric-val">${bestAcc}</h4>
        <span class="dash-metric-sub">KNN: ${((knn.accuracy || 0) * 100).toFixed(2)}% · MLP: ${((mlp.accuracy || 0) * 100).toFixed(2)}%</span>
      </div>
    </div>

    <div class="dash-metric-card">
      <div class="dash-metric-icon icon-mlp">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
      </div>
      <div class="dash-metric-info">
        <span class="dash-metric-label">ROC-AUC Tertinggi</span>
        <h4 class="dash-metric-val">${bestAuc}</h4>
        <span class="dash-metric-sub">KNN: ${((knn.roc_auc || 0) * 100).toFixed(2)}% · MLP: ${((mlp.roc_auc || 0) * 100).toFixed(2)}%</span>
      </div>
    </div>
  `;
}

/**
 * Merender Grouped Bar Chart dan Radar Chart menggunakan Chart.js
 * @param {Object} m Data metrik
 */
export function renderMetricsCharts(m) {
  if (typeof window.Chart === 'undefined') {
    console.warn('Library Chart.js belum tersedia di window.Chart. Inisialisasi diagram ditunda.');
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
    if (barChartInstance) {
      barChartInstance.destroy();
      barChartInstance = null;
    }

    barChartInstance = new window.Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: `KNN (k=3) ${m.primary_model === 'knn' ? '★ Model Utama' : ''}`,
            data: knnValues,
            backgroundColor: 'rgba(16, 185, 129, 0.82)',
            borderColor: '#10B981',
            borderWidth: 2,
            borderRadius: 8,
            hoverBackgroundColor: '#10B981'
          },
          {
            label: `MLP (32, 16) ${m.primary_model === 'mlp' ? '★ Model Utama' : ''}`,
            data: mlpValues,
            backgroundColor: 'rgba(139, 92, 246, 0.82)',
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
              font: { family: "'Segoe UI', sans-serif", weight: '700', size: 12 },
              color: '#334155',
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleFont: { family: "'Segoe UI', sans-serif", weight: '700', size: 13 },
            bodyFont: { family: "'Segoe UI', sans-serif", size: 12 },
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
              font: { family: "'Segoe UI', sans-serif", weight: '600', size: 11 },
              color: '#64748B'
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'Segoe UI', sans-serif", weight: '700', size: 12 },
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
    if (radarChartInstance) {
      radarChartInstance.destroy();
      radarChartInstance = null;
    }

    radarChartInstance = new window.Chart(radarCanvas, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'KNN (k=3)',
            data: knnValues,
            backgroundColor: 'rgba(16, 185, 129, 0.24)',
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
            backgroundColor: 'rgba(139, 92, 246, 0.24)',
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
              font: { family: "'Segoe UI', sans-serif", weight: '700', size: 12 },
              color: '#334155',
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleFont: { family: "'Segoe UI', sans-serif", weight: '700', size: 13 },
            bodyFont: { family: "'Segoe UI', sans-serif", size: 12 },
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
              font: { size: 10, family: "'Segoe UI', sans-serif" }
            },
            pointLabels: {
              font: { size: 11, weight: '700', family: "'Segoe UI', sans-serif" },
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

/**
 * Merender tabel perbandingan detail metrik evaluasi
 */
export function renderMetricsComparisonTable(container, m) {
  const knn = m.knn?.test || {};
  const mlp = m.mlp?.test || {};

  const metricsList = [
    { name: 'Accuracy (Akurasi Keseluruhan)', key: 'accuracy' },
    { name: 'Precision (Presisi Prediksi Berisiko)', key: 'precision' },
    { name: 'Recall (Sensitivitas Deteksi Siswa Berisiko)', key: 'recall' },
    { name: 'F1-Score (Harmonic Mean Precision & Recall)', key: 'f1' },
    { name: 'ROC-AUC (Kemampuan Diskriminasi Model)', key: 'roc_auc' }
  ];

  let html = `
    <div class="dash-table-wrap">
      <table class="dash-table">
        <thead>
          <tr>
            <th scope="col">Metrik Evaluasi Uji OULAD</th>
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
        <td><strong>${met.name}</strong></td>
        <td>
          <span style="font-weight: 750;">${(valKnn * 100).toFixed(2)}%</span>
          ${knnBest ? '<span class="badge-best-pill">Terbaik</span>' : ''}
        </td>
        <td>
          <span style="font-weight: 750;">${(valMlp * 100).toFixed(2)}%</span>
          ${mlpBest ? '<span class="badge-best-pill">Terbaik</span>' : ''}
        </td>
      </tr>
    `;
  });

  html += `
          <tr style="background: #F8FAFC;">
            <td><strong>Recall Validasi Silang (CV Recall 5-Fold)</strong></td>
            <td><strong style="color: #059669;">${((m.knn?.cv_recall ?? 0) * 100).toFixed(2)}%</strong> <span class="badge-best-pill">Dipilih Jadi Model Utama</span></td>
            <td><strong style="color: #6366F1;">${((m.mlp?.cv_recall_mean ?? 0) * 100).toFixed(2)}% &plusmn; ${((m.mlp?.cv_recall_std ?? 0) * 100).toFixed(2)}%</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Merender tabel 2x2 Confusion Matrix untuk model
 */
export function renderConfusionMatrixTable(container, cm, modelName) {
  if (!cm) {
    container.innerHTML = '<p class="placeholder-text">Confusion matrix tidak tersedia.</p>';
    return;
  }

  container.innerHTML = `
    <table class="dash-cm-table">
      <thead>
        <tr>
          <th style="text-align: left;">Aktual \\ Prediksi</th>
          <th>Prediksi Tidak Berisiko (0)</th>
          <th>Prediksi Berisiko (1)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th style="text-align: left; background: #F8FAFC;">Aktual Tidak Berisiko (0)</th>
          <td class="dash-cm-cell-primary">
            <span class="dash-cm-num">${cm.tn.toLocaleString('id-ID')}</span>
            <span class="dash-cm-tag">True Negative (TN)</span>
          </td>
          <td class="dash-cm-cell-secondary">
            <span class="dash-cm-num">${cm.fp.toLocaleString('id-ID')}</span>
            <span class="dash-cm-tag">False Positive (FP)</span>
          </td>
        </tr>
        <tr>
          <th style="text-align: left; background: #F8FAFC;">Aktual Berisiko (1)</th>
          <td class="dash-cm-cell-secondary">
            <span class="dash-cm-num">${cm.fn.toLocaleString('id-ID')}</span>
            <span class="dash-cm-tag">False Negative (FN)</span>
          </td>
          <td class="dash-cm-cell-primary">
            <span class="dash-cm-num">${cm.tp.toLocaleString('id-ID')}</span>
            <span class="dash-cm-tag">True Positive (TP)</span>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}
