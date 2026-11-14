/**
 * Prediction Module untuk EWS ITS (Pekerjaan Dini)
 * Mengelola form prediksi risiko pembelajaran dan tampilan hasil prediksi
 */

import { apiPredict } from './api.js';
import { escapeHtml, showToast } from './ui.js';
import { setStudentId, appState } from './state.js';

export function initPrediction() {
  const form = document.getElementById('predictionForm');
  const btnReset = document.getElementById('btnResetPredict');
  const resultContainer = document.getElementById('predictionResultCard');

  if (!form) return;

  // Sinkronkan student_id dari state jika tersedia
  const inputStudentId = document.getElementById('inputStudentId');
  if (inputStudentId && appState.studentId) {
    inputStudentId.value = appState.studentId;
  }

  // Event listener submit form prediksi
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const payload = extractFormData(form);
    const validationErrors = validatePayload(payload);

    if (validationErrors.length > 0) {
      validationErrors.forEach(err => showFieldError(err.fieldId, err.message));
      showToast('Mohon perbaiki data input yang belum valid.', 'warning');
      return;
    }

    // Set state loading
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner-sm" aria-hidden="true"></span>
      <span>Memproses Prediksi...</span>
    `;

    try {
      const response = await apiPredict(payload);

      // Render hasil prediksi nyata dari backend
      renderPredictionResult(resultContainer, response);
      showToast(`Prediksi selesai: Siswa diklasifikasikan berisiko ${response.prediction.risk_level}.`, 'success');

      // Jika student_id diinputkan, sinkronkan ke state aplikasi
      if (payload.student_id) {
        setStudentId(payload.student_id);
      }
    } catch (err) {
      handlePredictionError(err, resultContainer);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  });

  // Event listener tombol reset
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      form.reset();
      clearAllErrors();
      renderEmptyPredictionState(resultContainer);
      showToast('Form prediksi telah direset.', 'info');
    });
  }
}

/**
 * Mengambil dan mengonversi nilai input form sesuai tipe data yang dibutuhkan backend
 */
function extractFormData(form) {
  const studentIdVal = form.student_id?.value.trim();
  const rawRataNilai = form.rata_nilai_tugas?.value.trim();
  const rawTrenNilai = form.tren_nilai?.value.trim();
  const rawRasioTugas = form.rasio_tugas_selesai?.value.trim();

  return {
    student_id: studentIdVal || null,
    aktivitas_7h: form.aktivitas_7h?.value === '' ? NaN : parseFloat(form.aktivitas_7h.value),
    aktivitas_14h: form.aktivitas_14h?.value === '' ? NaN : parseFloat(form.aktivitas_14h.value),
    hari_sejak_aktif: form.hari_sejak_aktif?.value === '' ? NaN : parseInt(form.hari_sejak_aktif.value, 10),
    rata_nilai_tugas: rawRataNilai === '' ? null : parseFloat(rawRataNilai),
    tren_nilai: rawTrenNilai === '' ? null : parseFloat(rawTrenNilai),
    jumlah_tugas_dikumpulkan: form.jumlah_tugas_dikumpulkan?.value === '' ? NaN : parseInt(form.jumlah_tugas_dikumpulkan.value, 10),
    rasio_tugas_selesai: rawRasioTugas === '' ? null : parseFloat(rawRasioTugas)
  };
}

/**
 * Validasi sisi klien sesuai kontrak backend (Pydantic PredictRequest)
 */
function validatePayload(p) {
  const errors = [];

  if (p.student_id && (p.student_id.length < 1 || p.student_id.length > 20)) {
    errors.push({ fieldId: 'errStudentId', message: 'ID Siswa maksimal 20 karakter.' });
  }

  if (isNaN(p.aktivitas_7h) || p.aktivitas_7h < 0 || p.aktivitas_7h > 10000) {
    errors.push({ fieldId: 'errAktivitas7h', message: 'Aktivitas 7 hari harus bernilai 0 sampai 10.000 klik.' });
  }

  if (isNaN(p.aktivitas_14h) || p.aktivitas_14h < 0 || p.aktivitas_14h > 10000) {
    errors.push({ fieldId: 'errAktivitas14h', message: 'Aktivitas 14 hari harus bernilai 0 sampai 10.000 klik.' });
  }

  if (isNaN(p.hari_sejak_aktif) || p.hari_sejak_aktif < 0 || p.hari_sejak_aktif > 42) {
    errors.push({ fieldId: 'errHariSejakAktif', message: 'Hari sejak aktif harus antara 0 sampai 42 hari (jendela 6 minggu).' });
  }

  if (p.rata_nilai_tugas !== null && (isNaN(p.rata_nilai_tugas) || p.rata_nilai_tugas < 0 || p.rata_nilai_tugas > 100)) {
    errors.push({ fieldId: 'errRataNilai', message: 'Rata-rata nilai tugas harus antara 0 sampai 100.' });
  }

  if (p.tren_nilai !== null && (isNaN(p.tren_nilai) || p.tren_nilai < -100 || p.tren_nilai > 100)) {
    errors.push({ fieldId: 'errTrenNilai', message: 'Tren nilai harus bernilai antara -100 sampai 100.' });
  }

  if (isNaN(p.jumlah_tugas_dikumpulkan) || p.jumlah_tugas_dikumpulkan < 0 || p.jumlah_tugas_dikumpulkan > 500) {
    errors.push({ fieldId: 'errJumlahTugas', message: 'Jumlah tugas harus bernilai antara 0 sampai 500 tugas.' });
  }

  if (p.rasio_tugas_selesai !== null && (isNaN(p.rasio_tugas_selesai) || p.rasio_tugas_selesai < 0 || p.rasio_tugas_selesai > 1)) {
    errors.push({ fieldId: 'errRasioTugas', message: 'Rasio tugas selesai harus bernilai desimal antara 0.0 sampai 1.0.' });
  }

  return errors;
}

function showFieldError(errorElementId, message) {
  const el = document.getElementById(errorElementId);
  if (el) {
    el.textContent = message;
    el.classList.add('visible');
    const input = el.previousElementSibling?.querySelector('input') || el.previousElementSibling;
    if (input && input.tagName === 'INPUT') {
      input.classList.add('is-invalid');
    }
  }
}

function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
  document.querySelectorAll('.is-invalid').forEach(el => {
    el.classList.remove('is-invalid');
  });
}

/**
 * Menampilkan hasil prediksi ke UI dengan desain modern dan informatif
 */
function renderPredictionResult(container, data) {
  if (!container) return;

  const pred = data.prediction;
  const primaryProbPct = Math.round(pred.probability * 100);
  const knnProb = pred.per_model?.knn !== undefined ? Math.round(pred.per_model.knn * 100) : 0;
  const mlpProb = pred.per_model?.mlp !== undefined ? Math.round(pred.per_model.mlp * 100) : 0;

  const riskBadgeClass = `badge-risk-${pred.risk_level}`;
  const statusCardClass = `status-card-${pred.risk_level}`;

  const explanationsHtml = data.explanation && data.explanation.length
    ? data.explanation.map(item => `<li><span class="bullet-dot"></span><span>${escapeHtml(item)}</span></li>`).join('')
    : '<li><span class="bullet-dot"></span><span>Semua indikator belajar berada dalam parameter aman.</span></li>';

  const questsHtml = data.intervention?.quest && data.intervention.quest.length
    ? data.intervention.quest.map(q => `
        <div class="quest-recommendation-item">
          <svg class="quest-item-icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
          <div class="quest-item-content">
            <span class="quest-item-id">${escapeHtml(q.id)}</span>
            <span class="quest-item-title">${escapeHtml(q.title)}</span>
          </div>
        </div>
      `).join('')
    : '<p class="placeholder-text">Tidak ada modul remedial tambahan yang diperlukan.</p>';

  container.innerHTML = `
    <div class="result-card-inner animated-fade-in">
      <div class="result-header ${statusCardClass}">
        <div class="result-badge-row">
          <span class="badge ${riskBadgeClass}">Tingkat Risiko: ${pred.risk_level.toUpperCase()}</span>
          <span class="result-student-tag">ID: ${escapeHtml(data.student_id || 'Anonim')}</span>
        </div>
        <h3 class="result-headline">Kemungkinan Risiko Gagal/Withdraw: ${primaryProbPct}%</h3>
        <p class="result-subline">
          Status Klasifikasi: <strong>${pred.label === 'berisiko' ? 'Berisiko' : 'Tidak Berisiko'}</strong>
          · Model Utama: <strong>${escapeHtml(pred.primary_model.toUpperCase())}</strong>
        </p>
      </div>

      <div class="result-section">
        <h4 class="result-section-title">Perbandingan Probabilitas Model</h4>
        <div class="model-meter-grid">
          <div class="meter-item">
            <div class="meter-header">
              <span>K-Nearest Neighbors (KNN k=3) ${pred.primary_model === 'knn' ? '<small class="tag-primary">(Utama)</small>' : ''}</span>
              <strong>${knnProb}%</strong>
            </div>
            <div class="meter-track">
              <div class="meter-fill meter-knn" style="width: ${knnProb}%;"></div>
            </div>
          </div>
          <div class="meter-item">
            <div class="meter-header">
              <span>Multi-Layer Perceptron (MLP) ${pred.primary_model === 'mlp' ? '<small class="tag-primary">(Utama)</small>' : ''}</span>
              <strong>${mlpProb}%</strong>
            </div>
            <div class="meter-track">
              <div class="meter-fill meter-mlp" style="width: ${mlpProb}%;"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="result-section">
        <h4 class="result-section-title">Faktor Penyebab Utama (Penjelasan)</h4>
        <ul class="result-explanation-list">
          ${explanationsHtml}
        </ul>
      </div>

      <div class="result-section intervention-wrapper">
        <div class="intervention-header">
          <div class="intervention-icon-box">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <div>
            <h4 class="intervention-headline">Rekomendasi Intervensi ITS</h4>
            <p class="intervention-text">${escapeHtml(data.intervention?.message || '')}</p>
          </div>
        </div>
        <div class="recommended-quests-list">
          ${questsHtml}
        </div>
      </div>

      <div class="result-disclaimer">
        <svg viewBox="0 0 24 24" class="disclaimer-icon" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span>${escapeHtml(data.disclaimer)}</span>
      </div>
    </div>
  `;
}

function renderEmptyPredictionState(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state-box">
      <div class="empty-icon-wrapper">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
      </div>
      <h3 class="empty-title">Belum Ada Hasil Prediksi</h3>
      <p class="empty-desc">Lengkapi parameter form di sisi kiri dan klik "Jalankan Prediksi Risiko" untuk menguji data mahasiswa menggunakan model KNN & MLP.</p>
    </div>
  `;
}

function handlePredictionError(err, container) {
  const errorMsg = err.message || 'Gagal memproses prediksi.';
  showToast(`Error: ${errorMsg}`, 'danger');

  if (container) {
    container.innerHTML = `
      <div class="error-state-card animated-fade-in">
        <div class="error-state-header">
          <svg viewBox="0 0 24 24" class="error-state-icon" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          <div>
            <h4 class="error-state-title">Gagal Menjalankan Prediksi</h4>
            <p class="error-state-desc">${escapeHtml(errorMsg)}</p>
          </div>
        </div>
        <p class="error-state-hint">Pastikan model ML telah terlatih dan backend uvicorn berjalan normal.</p>
      </div>
    `;
  }
}
