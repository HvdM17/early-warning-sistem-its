/**
 * Navigation Module untuk EWS ITS
 * Mengatur pergantian peran (Dosen/Mahasiswa), navigasi antar section, dan parameter URL (?role=mahasiswa)
 */

import { appState, setRole, setActiveSection, setStudentId, subscribe } from './state.js';

const SECTION_TITLES = {
  'ringkasan': 'Ringkasan Dashboard',
  'siswa-berisiko': 'Daftar Siswa Berisiko',
  'prediksi': 'Prediksi Risiko Mahasiswa',
  'progres-saya': 'Progres & Gamifikasi Mahasiswa',
  'riwayat': 'Riwayat Aktivitas Pembelajaran',
  'metrik-model': 'Metrik & Evaluasi Model ML'
};

export function initNavigation() {
  const btnRoleDosen = document.getElementById('btnRoleDosen');
  const btnRoleMhs = document.getElementById('btnRoleMhs');
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const pageTitle = document.getElementById('pageTitle');

  // Baca parameter URL saat pertama kali dimuat
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

  // Event listener tombol peran
  if (btnRoleDosen) {
    btnRoleDosen.addEventListener('click', () => {
      setRole('dosen');
      updateUrlParam('role', 'dosen');
    });
  }

  if (btnRoleMhs) {
    btnRoleMhs.addEventListener('click', () => {
      setRole('mahasiswa');
      updateUrlParam('role', 'mahasiswa');
    });
  }

  // Event listener menu sidebar
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) {
        navigateToSection(section);
      }
    });
  });

  // Listener untuk link atau tombol dengan data-nav-target
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-nav-target]');
    if (target) {
      e.preventDefault();
      const section = target.dataset.navTarget;
      if (section) {
        navigateToSection(section);
      }
    }
  });

  // Subscribe ke perubahan state
  subscribe((event, payload, state) => {
    if (event === 'role_changed') {
      applyRoleUI(payload);
    } else if (event === 'section_changed') {
      applySectionUI(payload);
    }
  });

  // Terapkan UI awal
  applyRoleUI(appState.role);
  applySectionUI(appState.activeSection);
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

    // Jika section aktif sekarang khusus dosen, alihkan ke ringkasan
    if (['siswa-berisiko', 'metrik-model'].includes(appState.activeSection)) {
      navigateToSection('ringkasan');
    }
  } else {
    if (btnRoleDosen) btnRoleDosen.classList.add('active');
    if (btnRoleMhs) btnRoleMhs.classList.remove('active');

    dosenNavItems.forEach(el => (el.style.display = 'flex'));
    mhsNavItems.forEach(el => (el.style.display = 'none'));

    // Jika section aktif sekarang khusus mhs, alihkan ke ringkasan
    if (['progres-saya', 'riwayat'].includes(appState.activeSection)) {
      navigateToSection('ringkasan');
    }
  }
}

function applySectionUI(sectionId) {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const pageTitle = document.getElementById('pageTitle');
  const sections = document.querySelectorAll('.app-section');

  // Update aktif pada nav
  navItems.forEach(item => {
    if (item.dataset.section === sectionId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update judul halaman
  if (pageTitle && SECTION_TITLES[sectionId]) {
    pageTitle.textContent = SECTION_TITLES[sectionId];
  }

  // Tampilkan section yang dipilih dan sembunyikan yang lain
  sections.forEach(sec => {
    if (sec.id === sectionId) {
      sec.style.display = 'block';
    } else {
      sec.style.display = 'none';
    }
  });

  // Scroll konten utama ke atas saat ganti section
  const main = document.querySelector('.app-content');
  if (main) main.scrollTop = 0;
}

function updateUrlParam(key, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState({}, '', url.toString());
}
