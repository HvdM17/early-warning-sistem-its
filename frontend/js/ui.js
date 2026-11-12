import { appState } from './state.js';

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

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}


export { updateClassStatsUI, updateGamificationUI, showToast, setText };


