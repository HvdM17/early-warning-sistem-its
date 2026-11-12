import { appState } from './state.js';
import { setText } from './ui.js';

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


export { updateNavigation };

function initNavigation() {
  window.addEventListener('hashchange', updateNavigation);
  updateNavigation();
}

export { initNavigation };

