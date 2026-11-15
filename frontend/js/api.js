/**
 * API Service & Configuration for EWS ITS
 * Mengatur komunikasi REST API dengan FastAPI backend
 */

export const EWS_CONFIG = {
  apiBaseUrl: '', // Host relatif (misal http://127.0.0.1:8000)
  studentId: null, // Identitas mahasiswa aktif (null jika akun belum terhubung)
  timeoutMs: 10000
};

/**
 * Helper pembungkus fetch dengan penanganan error dan parsing JSON
 */
async function request(endpoint, options = {}) {
  const url = `${EWS_CONFIG.apiBaseUrl}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
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

/**
 * Health check status model ML
 */
export async function apiGetHealth() {
  return request('/health');
}

/**
 * Prediksi risiko mahasiswa (KNN & MLP)
 * @param {Object} payload Sesuai skema PredictRequest
 */
export async function apiPredict(payload) {
  return request('/api/predict', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Mengambil progres dan gamifikasi mahasiswa
 * @param {string} studentId
 */
export async function apiGetProgress(studentId) {
  if (!studentId) {
    throw new Error('studentId wajib disertakan untuk mengambil progres.');
  }
  return request(`/api/progress/${encodeURIComponent(studentId)}`);
}

/**
 * Mencatat aktivitas belajar mahasiswa (kuis, bacaan, remedial)
 * @param {Object} payload { student_id, type, score, item_id }
 */
export async function apiSendActivity(payload) {
  return request('/api/activity', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Mengambil 50 sampel data siswa berisiko dari dataset OULAD
 */
export async function apiGetStudents() {
  return request('/api/students');
}

/**
 * Mengambil metrik evaluasi model (Accuracy, Recall, ROC-AUC, CM)
 */
export async function apiGetMetrics() {
  return request('/api/metrics');
}
