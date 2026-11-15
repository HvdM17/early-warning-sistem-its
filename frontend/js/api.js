/**
 * API Service & Configuration for EWS ITS
 * Mengatur komunikasi REST API dengan FastAPI backend
 */

export const EWS_CONFIG = {
  apiBaseUrl: '',
  studentId: null,
  token: null,
  timeoutMs: 10000
};

function getStoredToken() {
  try {
    return sessionStorage.getItem('ews_auth_token');
  } catch (error) {
    return null;
  }
}

export function clearStoredToken() {
  try {
    sessionStorage.removeItem('ews_auth_token');
  } catch (error) {
    // no-op in sandboxed or restricted contexts
  }
  EWS_CONFIG.token = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ews-auth-expired'));
  }
}

async function request(endpoint, options = {}) {
  const url = `${EWS_CONFIG.apiBaseUrl}${endpoint}`;
  const token = EWS_CONFIG.token || getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Auth-Token': token } : {}),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredToken();
      }
      const errorMsg = data?.detail || `Permintaan gagal dengan status ${response.status}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const networkError = new Error('Server tidak merespons. Pastikan backend uvicorn aktif di terminal.');
      networkError.status = 0;
      throw networkError;
    }
    throw err;
  }
}

export async function apiLogin(payload) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function apiLogout() {
  return request('/api/auth/logout', {
    method: 'POST'
  });
}

export async function apiGetMe() {
  return request('/api/auth/me');
}

export async function apiGetHealth() {
  return request('/health');
}

export async function apiPredict(payload) {
  return request('/api/predict', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function apiGetProgress(studentId) {
  if (!studentId) {
    throw new Error('studentId wajib disertakan untuk mengambil progres.');
  }
  return request(`/api/progress/${encodeURIComponent(studentId)}`);
}

export async function apiGetHistory(studentId) {
  if (!studentId) {
    throw new Error('studentId wajib disertakan untuk mengambil riwayat.');
  }
  return request(`/api/history/${encodeURIComponent(studentId)}`);
}

export async function apiSendActivity(payload) {
  return request('/api/activity', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function apiGetStudents() {
  return request('/api/students');
}

export async function apiGetMetrics() {
  return request('/api/metrics');
}
