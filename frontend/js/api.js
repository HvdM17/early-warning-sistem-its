import { runtimeConfig } from './state.js';

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


export { apiRequest, defaultQuestList };

