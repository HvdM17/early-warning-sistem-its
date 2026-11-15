/**
 * State Management untuk EWS ITS
 * Menyimpan status aplikasi dan menyinkronkan dengan EWS_CONFIG
 */

import { EWS_CONFIG } from './api.js';

export const appState = {
  authMode: 'demo', // 'demo' | 'authenticated'
  token: null,
  user: null,
  role: 'dosen', // 'dosen' | 'mahasiswa'
  activeSection: 'ringkasan',
  studentId: null,
  studentProgress: null,
  students: [],
  metrics: null,
  modelStatus: null,
  listeners: []
};

export function subscribe(listener) {
  appState.listeners.push(listener);
  return () => {
    appState.listeners = appState.listeners.filter(l => l !== listener);
  };
}

function notify(event, payload) {
  appState.listeners.forEach(fn => fn(event, payload, appState));
}

export function setAuthMode(mode) {
  appState.authMode = mode;
  notify('auth_mode_changed', mode);
}

export function setAuthToken(token) {
  appState.token = token;
  EWS_CONFIG.token = token;
  if (token) {
    sessionStorage.setItem('ews_auth_token', token);
  } else {
    sessionStorage.removeItem('ews_auth_token');
  }
  notify('auth_token_changed', token);
}

export function setUser(user) {
  appState.user = user;
  if (user) {
  }
  notify('user_changed', user);
}

export function clearAuth() {
  const previousRole = appState.role;
  appState.user = null;
  appState.token = null;
  EWS_CONFIG.token = null;
  EWS_CONFIG.studentId = null;
  appState.studentId = null;
  setAuthMode('demo');
  setAuthToken(null);
  appState.role = 'dosen';
  if (previousRole !== 'dosen') {
    notify('role_changed', 'dosen');
  }
  notify('auth_cleared', null);
}

export function setRole(newRole) {
  if (appState.authMode === 'authenticated' && appState.user && appState.user.role && appState.user.role !== newRole) {
    return;
  }
  if (appState.role === newRole) return;
  appState.role = newRole;
  notify('role_changed', newRole);
}

export function setActiveSection(sectionId) {
  appState.activeSection = sectionId;
  notify('section_changed', sectionId);
}

export function setStudentId(id) {
  if (appState.authMode === 'authenticated' && appState.user && appState.user.student_id && appState.user.student_id !== id) {
    return;
  }
  appState.studentId = id;
  EWS_CONFIG.studentId = id;
  notify('student_id_changed', id);
}

export function setStudentProgress(progress) {
  appState.studentProgress = progress;
  notify('progress_updated', progress);
}
