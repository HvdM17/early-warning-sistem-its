import { appState } from './state.js';
import { apiRequest } from './api.js';
import { setText, showToast, updateClassStatsUI } from './ui.js';
import { renderStudents } from './students.js';
import { renderMetrics } from './metrics.js';
import { loadProgress } from './progress.js';

async function loadBackendData() {
  appState.classStats = { total: 0, high: 0, mid: 0, low: 0 };
  updateClassStatsUI();
  setText('#stat-total-students', '—');
  ['#stat-high-students', '#stat-mid-students', '#stat-low-students'].forEach(selector => setText(selector, '—'));
  setText('#data-source-label', 'Memuat data dari API');
  setText('#model-status-title', 'Status model menunggu backend');
  setText('#model-status-description', 'Metrik dan status model akan dimuat dari API.');
  ['Berisiko', 'Tidak berisiko', 'Model utama'].forEach((label, index) => {
    const value = document.querySelector(['#stat-high-students', '#stat-mid-students', '#stat-low-students'][index]);
    if (value?.previousElementSibling) value.previousElementSibling.textContent = label;
  });
  const legendItems = document.querySelectorAll('.class-dist-legend-item');
  if (legendItems.length >= 3) {
    legendItems[0].querySelector('span:last-child').childNodes[0].textContent = 'Berisiko (';
    legendItems[1].hidden = true;
    legendItems[2].querySelector('span:last-child').childNodes[0].textContent = 'Tidak berisiko (';
  }
  const middleBar = document.getElementById('dist-bar-mid');
  if (middleBar) middleBar.hidden = true;
  document.querySelectorAll('#metrik-model .metric-val').forEach(node => node.textContent = '—');
  document.querySelectorAll('#metrik-model .metric-winner-tag, #metrik-model .cm-cell strong').forEach(node => { node.textContent = 'Menunggu API'; });
  document.querySelectorAll('#metrik-model .data-table tbody tr').forEach(row => {
    [1, 2].forEach(index => { if (row.cells[index]) row.cells[index].textContent = '—'; });
  });
  const emptyBody = (selector, message, columns) => {
    const body = document.querySelector(`${selector} tbody`);
    if (!body) return;
    const row = document.createElement('tr');
    const cell = row.insertCell();
    cell.colSpan = columns;
    cell.textContent = message;
    body.replaceChildren(row);
  };
  emptyBody('#students-table', 'Memuat daftar dari API…', 2);
  emptyBody('#priority-students-table', 'Memuat daftar dari API…', 2);
  document.querySelector('.streak-calendar-row')?.remove();
  document.querySelectorAll('.period-stat strong').forEach(node => { node.textContent = '—'; });
  setText('.period-streak div strong', '—');
  setText('.learning-chart-heading .demo-data-tag', 'Agregasi belum tersedia');
  const chart = document.querySelector('.learning-chart');
  if (chart) {
    chart.replaceChildren();
    chart.setAttribute('aria-label', 'Agregasi aktivitas harian belum tersedia dari backend');
    const message = document.createElement('p');
    message.className = 'section-description';
    message.textContent = 'Backend belum menyediakan ringkasan aktivitas harian.';
    chart.append(message);
  }
  if (appState.currentRole === 'mahasiswa') {
    setText('#backend-status', appState.studentId ? 'Memuat progres akun mahasiswa…' : 'Akun mahasiswa belum diberikan oleh backend.');
    if (!appState.studentId) setText('#sidebar-backend-status', 'ID mahasiswa belum tersedia');
    await loadProgress();
    return;
  }
  try {
    const health = await apiRequest('/health');
    appState.primaryModel = health.primary_model;
    setText('#backend-status', `Backend aktif · ${health.model_loaded ? 'model siap' : 'model belum tersedia'} (${health.models.join(', ') || 'tanpa model'})`);
    setText('#sidebar-backend-status', health.model_loaded ? `Backend aktif · ${health.primary_model.toUpperCase()} siap` : 'Backend aktif · model belum siap');
    setText('#model-status-title', `Model utama: ${health.primary_model.toUpperCase()}`);
    setText('#model-status-description', health.model_loaded ? 'Model KNN dan MLP berhasil dimuat dari artefak backend.' : 'Backend merespons, tetapi model prediksi belum termuat.');
    setText('#stat-low-students', health.primary_model.toUpperCase());
  } catch (error) {
    setText('#backend-status', `Backend tidak terhubung · ${error.message}`);
    setText('#sidebar-backend-status', 'Backend tidak terhubung');
  }
  const [studentsResult, metricsResult] = await Promise.allSettled([
    apiRequest('/api/students'), apiRequest('/api/metrics')
  ]);
  if (studentsResult.status === 'fulfilled') {
    renderStudents(studentsResult.value);
  } else {
    emptyBody('#students-table', 'Daftar siswa belum tersedia dari API.', 2);
    emptyBody('#priority-students-table', 'Daftar siswa belum tersedia dari API.', 2);
    setText('#student-count-all', 0);
    setText('#student-count-risk', 0);
    setText('#student-count-safe', 0);
    setText('#inbox-data-note', 'Daftar mahasiswa tidak dapat dimuat dari API.');
    setText('#data-source-label', 'Data siswa tidak tersedia dari API');
    showToast(`Daftar siswa belum dapat dimuat: ${studentsResult.reason.message}`);
  }
  if (metricsResult.status === 'fulfilled') renderMetrics(metricsResult.value);
  else setText('#model-status-description', 'Metrik belum dapat dimuat dari API.');
}


export { loadBackendData };

