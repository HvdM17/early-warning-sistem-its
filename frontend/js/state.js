/**
 * State Management untuk EWS ITS
 * Menyimpan status aplikasi dan menyinkronkan dengan EWS_CONFIG
 */

import { EWS_CONFIG } from './api.js';

export const appState = {
  role: 'dosen', // 'dosen' | 'mahasiswa'
  activeSection: 'ringkasan',
  studentId: null, // Identitas mahasiswa aktif
  studentProgress: null,
  students: [],
  metrics: null,
  modelStatus: null,
  listeners: []
};

/**
 * Mendaftarkan pendengar perubahan state
 */
export function subscribe(listener) {
  appState.listeners.push(listener);
  return () => {
    appState.listeners = appState.listeners.filter(l => l !== listener);
  };
}

/**
 * Memberitahu seluruh listener bahwa state telah berubah
 */
function notify(event, payload) {
  appState.listeners.forEach(fn => fn(event, payload, appState));
}

/**
 * Mengubah peran aktif (Dosen atau Mahasiswa)
 */
export function setRole(newRole) {
  if (appState.role === newRole) return;
  appState.role = newRole;
  notify('role_changed', newRole);
}

/**
 * Mengubah section/layar aktif
 */
export function setActiveSection(sectionId) {
  appState.activeSection = sectionId;
  notify('section_changed', sectionId);
}

/**
 * Menghubungkan akun mahasiswa
 */
export function setStudentId(id) {
  appState.studentId = id;
  EWS_CONFIG.studentId = id;
  notify('student_id_changed', id);
}

/**
 * Memperbarui data progres mahasiswa
 */
export function setStudentProgress(progress) {
  appState.studentProgress = progress;
  notify('progress_updated', progress);
}
