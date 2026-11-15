/**
 * Navigation Module untuk EWS ITS
 * Mengatur pergantian peran (Dosen/Mahasiswa), navigasi antar section, dan parameter URL (?role=mahasiswa)
 */

import { apiGetMe, apiLogin, apiLogout } from './api.js';
import {
  appState,
  clearAuth,
  setActiveSection,
  setAuthMode,
  setAuthToken,
  setRole,
  setStudentId,
  setUser,
  subscribe,
} from './state.js';

const SECTION_TITLES = {
  'ringkasan': 'Ringkasan Dashboard',
  'siswa-berisiko': 'Daftar Siswa Berisiko',
  'prediksi': 'Prediksi Risiko Mahasiswa',
  'progres-saya': 'Progres & Gamifikasi Mahasiswa',
  'riwayat': 'Riwayat Aktivitas Pembelajaran',
  'metrik-model': 'Metrik & Evaluasi Model ML'
};

let isNavigationInitialized = false;

export function initNavigation() {
  if (isNavigationInitialized) return;
  isNavigationInitialized = true;

  const btnRoleDosen = document.getElementById('btnRoleDosen');
  const btnRoleMhs = document.getElementById('btnRoleMhs');
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

  const urlParams = new URLSearchParams(window.location.search);
  const initialRole = urlParams.get('role');
  const initialStudentId = urlParams.get('student_id') || urlParams.get('studentId');
  const initialSection = urlParams.get('section');

  if (initialStudentId) {
    setStudentId(initialStudentId);
  }

  if (initialRole === 'mahasiswa') {
    setRole('mahasiswa');
  } else {
    setRole('dosen');
  }

  if (initialSection && SECTION_TITLES[initialSection]) {
    setActiveSection(initialSection);
  } else {
    setActiveSection('ringkasan');
  }

  if (btnRoleDosen) {
    btnRoleDosen.addEventListener('click', () => {
      if (appState.authMode === 'authenticated') {
        return;
      }
      setRole('dosen');
      updateUrlParam('role', 'dosen');
    });
  }

  if (btnRoleMhs) {
    btnRoleMhs.addEventListener('click', () => {
      if (appState.authMode === 'authenticated') {
        return;
      }
      setRole('mahasiswa');
      updateUrlParam('role', 'mahasiswa');
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) {
        navigateToSection(section);
      }
    });
  });

  document.addEventListener('click', (e) => {
    const clickedButton = e.target.closest('.btn-secondary');
    if (clickedButton) {
      document.querySelectorAll('.btn-secondary.button-clicked').forEach(button => {
        button.classList.remove('button-clicked');
      });
      clickedButton.classList.add('button-clicked');
    }

    const target = e.target.closest('[data-nav-target]');
    if (target) {
      e.preventDefault();
      const section = target.dataset.navTarget;
      if (section) {
        navigateToSection(section);
      }
    }
  });

  subscribe((event, payload) => {
    if (event === 'role_changed') {
      applyRoleUI(payload);
    } else if (event === 'section_changed') {
      applySectionUI(payload);
    } else if (event === 'auth_mode_changed' || event === 'user_changed' || event === 'auth_cleared') {
      updateAuthPanel();
      applyRoleUI(appState.role);
    }
  });

  window.addEventListener('ews-auth-expired', () => {
    clearAuth();
    applyRoleUI(appState.role);
    updateAuthPanel();
    showPublicView('login');
  });

  initAuthControls();
  const storedToken = window.sessionStorage.getItem('ews_auth_token');
  if (storedToken) {
    setAuthToken(storedToken);
    restoreSession();
  } else {
    setAuthMode('demo');
    updateAuthPanel();
    showPublicView('landing');
  }

  applyRoleUI(appState.role);
  applySectionUI(appState.activeSection);
}

function initAuthControls() {
  const loginButton = document.getElementById('btnOpenLogin');
  const logoutButton = document.getElementById('btnLogout');
  const modal = document.getElementById('loginModal');
  const closeButton = document.getElementById('loginModalClose');
  const form = document.getElementById('loginForm');
  const identifierInput = document.getElementById('loginIdentifier');
  const publicLoginForm = document.getElementById('publicLoginForm');
  const publicIdentifierInput = document.getElementById('publicLoginIdentifier');

  document.querySelectorAll('[data-open-login]').forEach(button => {
    button.addEventListener('click', () => showPublicView('login'));
  });
  document.querySelectorAll('[data-show-landing]').forEach(button => {
    button.addEventListener('click', () => showPublicView('landing'));
  });

  const closeModal = () => {
    modal.hidden = true;
    loginButton?.focus();
  };

  loginButton?.addEventListener('click', () => {
    modal.hidden = false;
    identifierInput?.focus();
  });

  closeButton?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitButton = document.getElementById('loginSubmit');
    submitButton.disabled = true;
    submitButton.textContent = 'Memproses...';

    try {
      const response = await apiLogin({ identifier, password });
      const token = response.token;
      setAuthToken(token);
      setAuthMode('authenticated');
      setUser({
        username: response.username,
        nama: response.nama,
        role: response.role,
        student_id: response.student_id || null,
      });
      if (response.role) {
        setRole(response.role);
      }
      if (response.student_id) {
        setStudentId(response.student_id);
      }
      closeModal();
      form.reset();
      updateAuthPanel();
    } catch (error) {
      const errorNode = document.getElementById('loginError');
      errorNode.textContent = error.message || 'Login gagal.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Masuk';
    }
  });

  publicLoginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const identifier = publicIdentifierInput.value.trim();
    const password = document.getElementById('publicLoginPassword').value;
    const submitButton = document.getElementById('publicLoginSubmit');
    const errorNode = document.getElementById('publicLoginError');
    submitButton.disabled = true;
    submitButton.textContent = 'Memproses...';
    errorNode.textContent = '';

    try {
      const response = await apiLogin({ identifier, password });
      applyAuthenticatedUser(response);
      publicLoginForm.reset();
      showPublicView('app');
    } catch (error) {
      errorNode.textContent = error.message || 'Login gagal. Periksa kembali data login.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Masuk';
    }
  });

  logoutButton?.addEventListener('click', async () => {
    try {
      await apiLogout();
    } catch (error) {
      // abaikan karena token bisa sudah kedaluwarsa
    }
    clearAuth();
    updateAuthPanel();
    showPublicView('landing');
  });
}

function applyAuthenticatedUser(response) {
  setAuthToken(response.token);
  setAuthMode('authenticated');
  setUser({
    username: response.username,
    nama: response.nama,
    role: response.role,
    student_id: response.student_id || null,
  });
  setRole(response.role || 'dosen');
  setStudentId(response.student_id || null);
  updateAuthPanel();
}

async function restoreSession() {
  try {
    const me = await apiGetMe();
    setAuthMode('authenticated');
    setUser(me);
    setRole(me.role || 'dosen');
    setStudentId(me.student_id || null);
    showPublicView('app');
  } catch (error) {
    clearAuth();
    showPublicView('login');
  }
  updateAuthPanel();
}

function updateAuthPanel() {
  const loginButton = document.getElementById('btnOpenLogin');
  const logoutButton = document.getElementById('btnLogout');
  const authStatus = document.getElementById('authStatusLabel');

  if (appState.authMode === 'authenticated' && appState.user) {
    loginButton.hidden = true;
    logoutButton.hidden = false;
    authStatus.textContent = `${appState.user.nama} • ${appState.user.role}`;
    return;
  }

  loginButton.hidden = false;
  logoutButton.hidden = true;
  authStatus.textContent = 'Mode Demo';
}

function showPublicView(view) {
  const landing = document.getElementById('landingView');
  const login = document.getElementById('loginView');
  const app = document.getElementById('appView');
  if (!landing || !login || !app) return;

  landing.hidden = view !== 'landing';
  login.hidden = view !== 'login';
  app.hidden = view !== 'app';

  if (view === 'login') {
    document.getElementById('publicLoginIdentifier')?.focus();
  }
}

export function navigateToSection(sectionId) {
  setActiveSection(sectionId);
  updateUrlParam('section', sectionId);
}

function applyRoleUI(role) {
  const btnRoleDosen = document.getElementById('btnRoleDosen');
  const btnRoleMhs = document.getElementById('btnRoleMhs');
  const dosenNavItems = document.querySelectorAll('.nav-role-dosen');
  const mhsNavItems = document.querySelectorAll('.nav-role-mhs');

  if (role === 'mahasiswa') {
    if (btnRoleMhs) btnRoleMhs.classList.add('active');
    if (btnRoleDosen) btnRoleDosen.classList.remove('active');

    dosenNavItems.forEach(el => (el.style.display = 'none'));
    mhsNavItems.forEach(el => (el.style.display = 'flex'));

    if (['siswa-berisiko', 'metrik-model'].includes(appState.activeSection)) {
      navigateToSection('ringkasan');
    }
  } else {
    if (btnRoleDosen) btnRoleDosen.classList.add('active');
    if (btnRoleMhs) btnRoleMhs.classList.remove('active');

    dosenNavItems.forEach(el => (el.style.display = 'flex'));
    mhsNavItems.forEach(el => (el.style.display = 'none'));

    if (['progres-saya', 'riwayat'].includes(appState.activeSection)) {
      navigateToSection('ringkasan');
    }
  }

  btnRoleDosen?.setAttribute('aria-pressed', String(role === 'dosen'));
  btnRoleMhs?.setAttribute('aria-pressed', String(role === 'mahasiswa'));

  if (appState.authMode === 'authenticated' && appState.user && appState.user.role) {
    if (btnRoleDosen) btnRoleDosen.disabled = appState.user.role !== 'dosen';
    if (btnRoleMhs) btnRoleMhs.disabled = appState.user.role !== 'mahasiswa';
  } else {
    if (btnRoleDosen) btnRoleDosen.disabled = false;
    if (btnRoleMhs) btnRoleMhs.disabled = false;
  }
}

function applySectionUI(sectionId) {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const pageTitle = document.getElementById('pageTitle');
  const sections = document.querySelectorAll('.app-section');

  navItems.forEach(item => {
    if (item.dataset.section === sectionId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  if (pageTitle && SECTION_TITLES[sectionId]) {
    pageTitle.textContent = SECTION_TITLES[sectionId];
  }

  sections.forEach(sec => {
    if (sec.id === sectionId) {
      sec.style.display = 'block';
    } else {
      sec.style.display = 'none';
    }
  });

  const main = document.querySelector('.app-content');
  if (main) main.scrollTop = 0;
}

function updateUrlParam(key, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState({}, '', url.toString());
}
