import { appState } from './state.js';
import { setText, updateClassStatsUI } from './ui.js';

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


export { renderStudents, updateStudentInbox, filterRisk };

function initStudentControls() {
  document.querySelectorAll('.student-view-btn').forEach(button => {
    button.addEventListener('click', () => filterRisk(button.dataset.studentFilter));
  });
  document.getElementById('student-search')?.addEventListener('input', updateStudentInbox);
  document.querySelector('.student-context-action')?.addEventListener('click', prepareStudentPrediction);
}

export { initStudentControls };


