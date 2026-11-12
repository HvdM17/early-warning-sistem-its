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


export { appState, runtimeConfig };

