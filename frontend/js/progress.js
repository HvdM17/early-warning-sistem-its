import { appState } from './state.js';
import { apiRequest, defaultQuestList } from './api.js';
import { setText, showToast, updateGamificationUI } from './ui.js';

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


export { loadProgress };

