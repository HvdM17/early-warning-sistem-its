/**
 * EWS ITS frontend — API-connected screens
 */

// The backend can inject { role, studentId, apiBase } before this file.
const runtimeConfig = window.EWS_CONFIG || {};
const previewRole = new URLSearchParams(window.location.search).get('role');
const configuredRole = runtimeConfig.role || previewRole;
// shortcut: the backend has no authentication endpoint yet; replace this preview fallback when it supplies the signed-in role.
const initialRole = configuredRole === 'mahasiswa' ? 'mahasiswa' : 'dosen';

// State Management
const appState = {
  currentRole: initialRole,
  currentScreen: 'ringkasan',
  studentId: runtimeConfig.studentId || '',
  students: [],
  studentFilter: 'all',
  selectedStudent: null,
  studentXP: 0,
  completedQuestsCount: 0,
  totalQuests: 5,
  classStats: {
    total: 0,
    high: 0,
    mid: 0,
    low: 0
  }
};

// Navigation & Screen Management
const navLinks = [...document.querySelectorAll('[data-nav-target]')];
const screens = [...document.querySelectorAll('[data-screen-id]')];
const rolePanels = [...document.querySelectorAll('[data-role-panel]')];
const breadcrumbTitle = document.getElementById('breadcrumb-title');

const screenNames = {
  'ringkasan': 'Ringkasan',
  'siswa-berisiko': 'Siswa Berisiko',
  'prediksi': 'Prediksi Risiko',
  'metrik-model': 'Metrik Model',
  'progres-saya': 'Progres & Gamifikasi',
  'riwayat': 'Riwayat Aktivitas'
};

function updateNavigation() {
  const hash = window.location.hash.slice(1) || 'ringkasan';
  const role = appState.currentRole;

  const allowed = (link) => link.dataset.audience === 'all' || link.dataset.audience === role;
  const target = navLinks.some(link => link.dataset.navTarget === hash && allowed(link)) ? hash : 'ringkasan';

  appState.currentScreen = target;

  if (window.location.hash !== `#${target}`) {
    window.history.replaceState(null, '', `#${target}`);
  }

  // Update Breadcrumb
  if (breadcrumbTitle) {
    breadcrumbTitle.textContent = screenNames[target] || 'Dashboard';
  }
  setText('#active-role-label', role === 'mahasiswa' ? 'Mahasiswa' : 'Dosen');

  // Update nav links visibility & active state
  for (const link of navLinks) {
    const isVisible = allowed(link);
    link.hidden = !isVisible;
    if (link.dataset.navTarget === target) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
  document.querySelectorAll('.nav-group-label[data-audience]').forEach(label => {
    label.hidden = label.dataset.audience !== role;
  });

  // Show / hide screens
  for (const screen of screens) {
    screen.hidden = screen.dataset.screenId !== target;
  }

  // Show / hide role panels inside screen
  for (const panel of rolePanels) {
    panel.hidden = panel.dataset.rolePanel !== role;
  }
}

// Reactive Update for Class Distribution Progress Bar & Stat Cards
function updateClassStatsUI() {
  const { total, high, mid, low } = appState.classStats;

  // 1. Update Top Stat Cards
  const statTotal = document.getElementById('stat-total-students');
  if (statTotal) statTotal.textContent = total;

  const statHigh = document.getElementById('stat-high-students');
  if (statHigh) statHigh.textContent = high;

  const statMid = document.getElementById('stat-mid-students');
  if (statMid) statMid.textContent = mid;

  const statLow = document.getElementById('stat-low-students');
  if (statLow) statLow.textContent = low;

  // 2. Calculate percentages (handles edge cases)
  const highPct = total > 0 ? (high / total * 100) : 0;
  const midPct = total > 0 ? (mid / total * 100) : 0;
  const lowPct = total > 0 ? (low / total * 100) : 0;

  // 3. Update Stacked Progress Bar Segments with smooth width transitions
  const barHigh = document.getElementById('dist-bar-high');
  if (barHigh) {
    barHigh.style.width = `${highPct.toFixed(1)}%`;
    barHigh.title = `Berisiko: ${high} mahasiswa (${highPct.toFixed(1)}%)`;
  }

  const barMid = document.getElementById('dist-bar-mid');
  if (barMid) {
    barMid.style.width = `${midPct.toFixed(1)}%`;
    barMid.title = `Sedang: ${mid} siswa (${midPct.toFixed(1)}%)`;
  }

  const barLow = document.getElementById('dist-bar-low');
  if (barLow) {
    barLow.style.width = `${lowPct.toFixed(1)}%`;
    barLow.title = `Tidak berisiko: ${low} mahasiswa (${lowPct.toFixed(1)}%)`;
  }

  // 4. Update Header Title & Metadata
  const distTitle = document.getElementById('class-dist-title');
  if (distTitle) distTitle.textContent = `Distribusi Label Risiko (${total} Mahasiswa)`;

  const distMeta = document.getElementById('class-dist-meta');
  if (distMeta) distMeta.textContent = `Total ${total} Mahasiswa`;

  // 5. Update Legend Numbers & Percentages
  const legHighVal = document.getElementById('legend-high-val');
  if (legHighVal) legHighVal.textContent = high;
  const legHighPct = document.getElementById('legend-high-pct');
  if (legHighPct) legHighPct.textContent = `${highPct.toFixed(1)}%`;

  const legMidVal = document.getElementById('legend-mid-val');
  if (legMidVal) legMidVal.textContent = mid;
  const legMidPct = document.getElementById('legend-mid-pct');
  if (legMidPct) legMidPct.textContent = `${midPct.toFixed(1)}%`;

  const legLowVal = document.getElementById('legend-low-val');
  if (legLowVal) legLowVal.textContent = low;
  const legLowPct = document.getElementById('legend-low-pct');
  if (legLowPct) legLowPct.textContent = `${lowPct.toFixed(1)}%`;

  // 6. Update Sidebar Badge count
  const navBadge = document.getElementById('badge-berisiko-count');
  if (navBadge) {
    navBadge.textContent = high;
    navBadge.hidden = high === 0;
  }
}

function updateGamificationUI() {
  const currentXP = appState.studentXP;
  const level = Math.floor(currentXP / 100) + 1;
  const xpInCurrentLevel = currentXP % 100;
  const xpNeededNext = 100 - xpInCurrentLevel;

  // Level & XP displays
  const lvlBig = document.getElementById('lvl-big-num');
  if (lvlBig) lvlBig.textContent = level;

  const lvlSub = document.getElementById('lvl-subtitle');
  if (lvlSub) lvlSub.textContent = `Total: ${currentXP} XP`;

  const studentLevelDisplay = document.getElementById('student-level-display');
  if (studentLevelDisplay) studentLevelDisplay.textContent = `Level ${level}`;

  const studentXpToNext = document.getElementById('student-xp-to-next');
  if (studentXpToNext) studentXpToNext.textContent = `${xpNeededNext} XP lagi ke Level ${level + 1}`;

  const xpBarText = document.getElementById('xp-bar-text');
  if (xpBarText) xpBarText.textContent = `${xpInCurrentLevel} / 100 XP`;

  const xpLevelLabel = document.getElementById('xp-level-label');
  if (xpLevelLabel) xpLevelLabel.textContent = `Progres Level ${level} ke ${level + 1}`;

  const xpProgressFill = document.getElementById('xp-progress-fill');
  if (xpProgressFill) xpProgressFill.style.width = `${xpInCurrentLevel}%`;

  const xpProgressTrack = document.getElementById('xp-progress-track');
  if (xpProgressTrack) xpProgressTrack.setAttribute('aria-valuenow', xpInCurrentLevel);

  const xpRemainingHint = document.getElementById('xp-remaining-hint');
  if (xpRemainingHint) xpRemainingHint.textContent = `Tersisa ${xpNeededNext} XP lagi untuk naik level!`;

  const questCountTag = document.getElementById('quest-count-tag');
  if (questCountTag) questCountTag.textContent = `${appState.completedQuestsCount} / ${appState.totalQuests} Selesai`;
}

// Toast System
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('width', '18');
  icon.setAttribute('height', '18');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2.5');
  icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(icon, text);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

const API_BASE = (runtimeConfig.apiBase || '').replace(/\/$/, '');
const defaultQuestList = ['M1', 'M2', 'M3', 'M4', 'M5'].map((id, index) => ({ id, title: `Modul ${index + 1}`, done: false }));

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || `Permintaan gagal (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function renderStudentRow(tableBody, student) {
  const atRisk = student.risk_label === 'berisiko';
  const riskClass = atRisk ? 'high' : 'low';
  const row = document.createElement('tr');
  row.dataset.risk = riskClass;
  row.dataset.studentId = student.student_id;
  const idCell = row.insertCell();
  const idText = document.createElement('button');
  idText.type = 'button';
  idText.className = 'student-select-btn';
  idText.textContent = student.student_id;
  idText.setAttribute('aria-label', `Lihat konteks mahasiswa ${student.student_id}`);
  idCell.append(idText);
  const riskCell = row.insertCell();
  riskCell.innerHTML = `<span class="risk-pill ${riskClass}"><span class="dot"></span>${atRisk ? 'Berisiko' : 'Tidak berisiko'}</span>`;
  row.addEventListener('click', () => selectStudent(student));
  tableBody.append(row);
}

function renderStudents(students) {
  appState.students = students;
  const atRisk = students.filter(student => student.risk_label === 'berisiko').length;
  const safe = students.length - atRisk;
  appState.classStats = { total: students.length, high: atRisk, mid: 0, low: safe };
  updateClassStatsUI();
  ['Berisiko', 'Tidak berisiko', 'Model utama'].forEach((label, index) => {
    const value = document.querySelector(['#stat-high-students', '#stat-mid-students', '#stat-low-students'][index]);
    if (value?.previousElementSibling) value.previousElementSibling.textContent = label;
  });
  setText('#stat-high-students', atRisk);
  setText('#stat-mid-students', safe);
  setText('#stat-low-students', (appState.primaryModel || 'knn').toUpperCase());
  setText('#data-source-label', `Dataset API · ${students.length} dari maksimal 50 baris`);
  const legends = document.querySelectorAll('.class-dist-legend-item');
  if (legends.length >= 3) {
    legends[0].querySelector('span:last-child').childNodes[0].textContent = 'Berisiko (';
    legends[1].hidden = true;
    legends[2].querySelector('span:last-child').childNodes[0].textContent = 'Tidak berisiko (';
  }
  const middleBar = document.getElementById('dist-bar-mid');
  if (middleBar) middleBar.hidden = true;
  setText('#model-status-title', `Model utama: ${appState.primaryModel || '—'}`);

  const tableBody = document.querySelector('#students-table tbody');
  if (tableBody) {
    tableBody.replaceChildren();
    if (students.length) students.forEach(student => renderStudentRow(tableBody, student));
    else {
      const row = tableBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 2;
      cell.textContent = 'Dataset siswa belum tersedia.';
    }
  }
  const priorityBody = document.querySelector('#priority-students-table tbody');
  if (priorityBody) {
    priorityBody.replaceChildren();
    const priorityStudents = students.filter(student => student.risk_label === 'berisiko').slice(0, 5);
    priorityStudents.forEach(student => {
      const row = document.createElement('tr');
      const name = row.insertCell();
      name.textContent = student.student_id;
      const label = row.insertCell();
      label.innerHTML = '<span class="risk-pill high"><span class="dot"></span>Berisiko</span>';
      priorityBody.append(row);
    });
    if (!priorityStudents.length) {
      const row = priorityBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 2;
      cell.textContent = 'Tidak ada baris berlabel berisiko pada sampel ini.';
    }
  }
  updateStudentInbox();
  const selected = students.find(student => student.student_id === appState.selectedStudent?.student_id)
    || students.find(student => student.risk_label === 'berisiko')
    || students[0];
  if (selected) selectStudent(selected);
  else renderStudentContext(null);
}

function filterRisk(filter) {
  appState.studentFilter = filter;
  document.querySelectorAll('.student-view-btn').forEach(button => {
    const active = button.dataset.studentFilter === filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateStudentInbox();
}

function updateStudentInbox() {
  const query = document.getElementById('student-search')?.value.trim().toLowerCase() || '';
  const riskCount = appState.students.filter(student => student.risk_label === 'berisiko').length;
  const safeCount = appState.students.length - riskCount;
  setText('#student-count-all', appState.students.length);
  setText('#student-count-risk', riskCount);
  setText('#student-count-safe', safeCount);
  let visibleCount = 0;
  document.querySelectorAll('#students-table tbody tr[data-student-id]').forEach(row => {
    const matchesSearch = row.dataset.studentId.toLowerCase().includes(query);
    const matchesFilter = appState.studentFilter === 'all' || row.dataset.risk === appState.studentFilter;
    row.hidden = !matchesSearch || !matchesFilter;
    if (!row.hidden) visibleCount += 1;
  });
  setText('#inbox-data-note', `${visibleCount} terlihat · ${appState.students.length} dari maksimal 50 baris API`);
  const selectedRow = [...document.querySelectorAll('#students-table tbody tr[data-student-id]')]
    .find(row => row.dataset.studentId === appState.selectedStudent?.student_id);
  if (selectedRow?.hidden) {
    const firstVisibleId = [...document.querySelectorAll('#students-table tbody tr[data-student-id]')]
      .find(row => !row.hidden)?.dataset.studentId;
    selectStudent(appState.students.find(student => student.student_id === firstVisibleId) || null);
  }
}

function renderStudentContext(student) {
  const empty = document.getElementById('student-context-empty');
  const content = document.getElementById('student-context-content');
  const selectedId = student?.student_id;
  if (!selectedId) {
    if (empty) empty.hidden = false;
    if (content) content.hidden = true;
    return;
  }
  const atRisk = student.risk_label === 'berisiko';
  const riskClass = atRisk ? 'high' : 'low';
  if (empty) empty.hidden = true;
  if (content) content.hidden = false;
  setText('#student-context-id', selectedId);
  const risk = document.getElementById('student-context-risk');
  if (risk) risk.innerHTML = `<span class="risk-pill ${riskClass}"><span class="dot"></span>${atRisk ? 'Berisiko' : 'Tidak berisiko'}</span>`;
  const predictionLink = document.getElementById('student-context-predict');
  if (predictionLink) predictionLink.dataset.studentId = selectedId;
}

function selectStudent(student) {
  appState.selectedStudent = student;
  const studentId = student?.student_id;
  document.querySelectorAll('#students-table tbody tr[data-student-id]').forEach(row => {
    const selected = Boolean(studentId) && row.dataset.studentId === studentId;
    row.classList.toggle('is-selected', selected);
    const button = row.querySelector('.student-select-btn');
    if (button) button.setAttribute('aria-pressed', String(selected));
  });
  renderStudentContext(student);
}

function prepareStudentPrediction() {
  const studentId = appState.selectedStudent?.student_id;
  const input = document.getElementById('inp-student-id');
  if (input && studentId) input.value = studentId;
}

function renderMetrics(metrics) {
  const models = [metrics.knn, metrics.mlp];
  const names = ['KNN', 'MLP'];
  const primary = metrics.primary_model === 'mlp' ? 1 : 0;
  const primaryTest = models[primary].test;
  const metricCards = document.querySelectorAll('#metrik-model .metric-stat-box .metric-val');
  const cardValues = [primaryTest.recall, primaryTest.accuracy, primaryTest.roc_auc, primaryTest.f1];
  metricCards.forEach((node, index) => {
    if (cardValues[index] != null) node.textContent = index === 2 ? cardValues[index].toFixed(3) : `${(cardValues[index] * 100).toFixed(1)}%`;
  });
  document.querySelectorAll('#metrik-model .metric-stat-box .metric-winner-tag').forEach((node, index) => {
    node.textContent = `Model utama ${names[primary]} · data uji`;
  });
  const headers = document.querySelectorAll('#metrik-model .data-table thead th');
  if (headers[1]) headers[1].textContent = `KNN (k=${metrics.knn.best_k})`;
  if (headers[2]) headers[2].textContent = `MLP (${metrics.mlp.hidden_layers.join(', ')})`;

  const rows = document.querySelectorAll('#metrik-model .data-table tbody tr');
  const keys = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc'];
  rows.forEach((row, index) => {
    const key = keys[index];
    if (!key) return;
    [0, 1].forEach((modelIndex) => {
      const cell = row.cells[modelIndex + 1];
      if (cell) cell.textContent = key === 'roc_auc' ? models[modelIndex].test[key].toFixed(3) : `${(models[modelIndex].test[key] * 100).toFixed(1)}%`;
    });
  });
  const matrix = primaryTest.confusion_matrix;
  const matrixValues = [matrix.tn, matrix.fp, matrix.fn, matrix.tp];
  document.querySelectorAll('#metrik-model .cm-cell strong').forEach((node, index) => {
    if (matrixValues[index] != null) node.textContent = matrixValues[index];
  });
  setText('#metrik-model .section-description', `Kinerja model pada data uji (N=${metrics.n_test}) dari ${metrics.n_train + metrics.n_test} data; model utama ${names[primary]}.`);
  const cmHeading = document.querySelector('#metrik-model .confusion-matrix-table')?.previousElementSibling?.querySelector('.card-title');
  if (cmHeading) cmHeading.textContent = `Confusion Matrix ${names[primary]} (N=${metrics.n_test})`;
  const modelNote = document.querySelector('#metrik-model .content-grid-2col .card > div:last-child');
  if (modelNote) modelNote.textContent = `* Model utama: ${names[primary]}. Metrik dihitung dari data uji pada dataset backend.`;
  const confusionNote = document.querySelector('#metrik-model .confusion-matrix-table + div');
  if (confusionNote) confusionNote.textContent = `TN ${matrix.tn} · FP ${matrix.fp} · FN ${matrix.fn} · TP ${matrix.tp} pada data uji.`;
}

function renderPrediction(result) {
  const prediction = result.prediction;
  const riskNames = { tinggi: 'Risiko Tinggi', sedang: 'Risiko Sedang', rendah: 'Risiko Rendah' };
  const riskClass = prediction.risk_level === 'tinggi' ? 'high' : prediction.risk_level === 'sedang' ? 'mid' : 'low';
  const banner = document.getElementById('res-banner');
  if (banner) banner.className = `prediction-hero-banner ${riskClass}`;
  setText('#res-level-text', riskNames[prediction.risk_level] || prediction.label);
  setText('#res-prob-text', `${(prediction.probability * 100).toFixed(1)}%`);
  setText('#prediction-model-tag', `Backend · ${prediction.primary_model.toUpperCase()} utama`);
  ['knn', 'mlp'].forEach(name => {
    const probability = prediction.per_model[name];
    const value = probability == null ? null : probability * 100;
    const bar = document.getElementById(`${name}-bar`);
    if (bar && value != null) bar.style.width = `${value}%`;
    setText(`#${name}-prob-val`, value == null ? '—' : `${value.toFixed(1)}%`);
  });
  const factors = document.getElementById('res-factors');
  if (factors) {
    factors.replaceChildren();
    (result.explanation.length ? result.explanation : ['Tidak ada faktor risiko khusus dari fitur yang dikirim.']).forEach(reason => {
      const item = document.createElement('li');
      item.textContent = reason;
      factors.append(item);
    });
  }
  const intervention = result.intervention;
  const questText = intervention.quest.map(item => item.title).join(', ');
  setText('#res-recommendation', `${intervention.message}${questText ? ` Rekomendasi: ${questText}.` : ''}`);
  const tag = document.getElementById('prediction-model-tag');
  if (tag) tag.title = result.disclaimer;
}

async function runPrediction(event) {
  event.preventDefault();
  const button = document.getElementById('btn-submit-predict');
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Menghubungi model…';
  const number = id => Number(document.getElementById(id).value);
  const optionalNumber = id => document.getElementById(id).value.trim() === '' ? null : number(id);
  const payload = {
    student_id: document.getElementById('inp-student-id').value.trim() || null,
    aktivitas_7h: number('inp-akt-7h'),
    aktivitas_14h: number('inp-akt-14h'),
    hari_sejak_aktif: number('inp-hari-aktif'),
    rata_nilai_tugas: optionalNumber('inp-rata-kuis'),
    tren_nilai: optionalNumber('inp-tren-nilai'),
    jumlah_tugas_dikumpulkan: number('inp-percobaan'),
    rasio_tugas_selesai: optionalNumber('inp-rasio-kuis')
  };
  try {
    renderPrediction(await apiRequest('/api/predict', { method: 'POST', body: JSON.stringify(payload) }));
    showToast('Prediksi berhasil dihitung oleh backend.');
  } catch (error) {
    const banner = document.getElementById('res-banner');
    if (banner) banner.className = 'prediction-hero-banner';
    setText('#res-level-text', 'Prediksi gagal');
    setText('#res-prob-text', '—');
    setText('#prediction-model-tag', 'API tidak mengembalikan hasil');
    setText('#res-recommendation', error.message);
    showToast(`Prediksi tidak berhasil: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function renderProgress(progress) {
  appState.progress = progress;
  appState.studentXP = progress.total_xp || 0;
  appState.completedQuestsCount = progress.quest.filter(item => item.done).length;
  appState.totalQuests = progress.quest.length;
  updateGamificationUI();
  setText('#history-total-xp', progress.total_xp || 0);
  setText('#history-badge-count', progress.badges.length);
  setText('#history-student-id', appState.studentId || '—');
  setText('#student-badge-count', `${progress.badges.length} Lencana`);
  const questList = document.getElementById('quest-list');
  if (questList) {
    questList.replaceChildren();
    progress.quest.forEach(quest => {
      const row = document.createElement('div');
      row.className = `quest-item${quest.done ? ' completed' : ''}`;
      row.dataset.questId = quest.id;
      const left = document.createElement('div');
      left.className = 'quest-left';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'quest-checkbox';
      checkbox.checked = quest.done;
      checkbox.disabled = quest.done;
      checkbox.addEventListener('change', () => completeQuest(quest, checkbox));
      const textWrap = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'quest-title';
      title.textContent = quest.title;
      const note = document.createElement('small');
      note.textContent = quest.done ? 'Tersimpan di backend' : 'Selesaikan untuk mencatat progres';
      textWrap.append(title, note);
      left.append(checkbox, textWrap);
      const reward = document.createElement('span');
      reward.className = quest.done ? 'badge-tag' : 'quest-xp-chip';
      reward.textContent = quest.done ? 'Selesai' : '+5 XP';
      row.append(left, reward);
      questList.append(row);
    });
  }
  const quickQuestList = document.getElementById('quick-quest-list');
  if (quickQuestList) {
    quickQuestList.replaceChildren();
    progress.quest.slice(0, 3).forEach(quest => {
      const row = document.createElement('div');
      row.className = `quest-item${quest.done ? ' completed' : ''}`;
      row.dataset.questId = quest.id;
      const left = document.createElement('div');
      left.className = 'quest-left';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'quest-checkbox';
      checkbox.checked = quest.done;
      checkbox.disabled = quest.done;
      checkbox.addEventListener('change', () => completeQuest(quest, checkbox));
      const title = document.createElement('span');
      title.className = 'quest-title';
      title.textContent = quest.title;
      left.append(checkbox, title);
      const reward = document.createElement('span');
      reward.className = quest.done ? 'badge-tag' : 'quest-xp-chip';
      reward.textContent = quest.done ? 'Selesai' : '+5 XP';
      row.append(left, reward);
      quickQuestList.append(row);
    });
  }
  document.querySelectorAll('.badge-gallery .badge-card').forEach(card => {
    const name = card.querySelector('h4')?.textContent;
    const earned = progress.badges.includes(name);
    card.classList.toggle('unlocked', earned);
    card.classList.toggle('locked', !earned);
    const status = card.querySelector('.badge-status-tag') || card.querySelector('.badge-info span');
    if (status) status.textContent = earned ? 'Telah diraih' : 'Belum diraih';
  });
  const timeline = document.getElementById('activity-timeline');
  if (timeline) {
    const empty = document.createElement('p');
    empty.className = 'section-description';
    empty.textContent = 'Backend belum menyediakan endpoint riwayat per aktivitas.';
    timeline.replaceChildren(empty);
  }
}

async function loadProgress() {
  if (!appState.studentId) {
    setText('#student-level-display', '—');
    setText('#student-xp-to-next', 'Akun mahasiswa belum terhubung.');
    setText('#student-badge-count', '—');
    setText('#history-total-xp', '—');
    setText('#history-badge-count', '—');
    setText('#history-student-id', '—');
    setText('#lvl-subtitle', 'Progres belum tersedia');
    setText('#xp-remaining-hint', 'Akun mahasiswa belum terhubung.');
    setText('#quest-count-tag', '—');
    setText('#student-risk-status', 'Tidak tersedia');
    setText('#student-risk-note', 'Endpoint progres belum menyediakan label risiko.');
    document.getElementById('quest-list')?.replaceChildren();
    document.getElementById('quick-quest-list')?.replaceChildren(document.createTextNode('Akun mahasiswa belum terhubung ke backend.'));
    document.getElementById('activity-timeline')?.replaceChildren(document.createTextNode('Akun mahasiswa belum terhubung ke backend.'));
    document.querySelectorAll('.badge-gallery .badge-card').forEach(card => {
      card.classList.remove('unlocked');
      card.classList.add('locked');
      const status = card.querySelector('.badge-status-tag') || card.querySelector('.badge-info span');
      if (status) status.textContent = 'Akun belum terhubung';
    });
    return;
  }
  document.getElementById('quest-list')?.replaceChildren(document.createTextNode('Memuat progres akun…'));
  document.getElementById('quick-quest-list')?.replaceChildren(document.createTextNode('Memuat progres akun…'));
  document.getElementById('activity-timeline')?.replaceChildren(document.createTextNode('Riwayat aktivitas belum tersedia dari backend.'));
  document.querySelectorAll('.badge-gallery .badge-card').forEach(card => {
    card.classList.remove('unlocked');
    card.classList.add('locked');
    const status = card.querySelector('.badge-status-tag') || card.querySelector('.badge-info span');
    if (status) status.textContent = 'Memuat dari backend…';
  });
  try {
    const progress = await apiRequest(`/api/progress/${encodeURIComponent(appState.studentId)}`);
    renderProgress(progress);
    setText('#sidebar-backend-status', 'Backend aktif · progres termuat');
  } catch (error) {
    if (error.status !== 404) {
      setText('#backend-status', `Progres tidak dapat dimuat · ${error.message}`);
      setText('#sidebar-backend-status', 'Progres gagal dimuat');
      showToast(`Progres belum dapat dimuat: ${error.message}`);
      return;
    }
    renderProgress({ student_id: appState.studentId, total_xp: 0, level: 1, badges: [], progress_percent: 0, quest: defaultQuestList });
    setText('#sidebar-backend-status', 'Backend aktif · progres baru');
  }
}

async function completeQuest(quest, checkbox) {
  document.querySelectorAll('.quest-item[data-quest-id]').forEach(row => {
    if (row.dataset.questId === quest.id) row.querySelector('.quest-checkbox').disabled = true;
  });
  const type = quest.id === 'R3' ? 'bacaan' : quest.id.startsWith('R') ? 'remedial' : 'bacaan';
  try {
    const result = await apiRequest('/api/activity', {
      method: 'POST',
      body: JSON.stringify({ student_id: appState.studentId, type, item_id: quest.id })
    });
    const current = appState.progress;
    renderProgress({ ...current, ...result, badges: [...new Set([...(current.badges || []), ...result.new_badges])] });
    showToast(`Aktivitas tercatat · +${result.xp_earned} XP.`);
  } catch (error) {
    document.querySelectorAll('.quest-item[data-quest-id]').forEach(row => {
      if (row.dataset.questId === quest.id) {
        const input = row.querySelector('.quest-checkbox');
        input.checked = false;
        input.disabled = false;
      }
    });
    showToast(`Progres tidak tersimpan: ${error.message}`);
  }
}

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

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.student-view-btn').forEach(button => {
    button.addEventListener('click', () => filterRisk(button.dataset.studentFilter));
  });
  document.getElementById('student-search')?.addEventListener('input', updateStudentInbox);

  // Hash routing
  window.addEventListener('hashchange', updateNavigation);

  // Initialize
  updateNavigation();
  loadBackendData();
});
