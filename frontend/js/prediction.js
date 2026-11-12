import { apiRequest } from './api.js';
import { setText, showToast } from './ui.js';

function renderPrediction(result) {
  const prediction = result.prediction;
  const riskNames = { tinggi: 'Risiko Tinggi', sedang: 'Risiko Sedang', rendah: 'Risiko Rendah' };
  const riskClass = prediction.risk_level === 'tinggi' ? 'high' : prediction.risk_level === 'sedang' ? 'mid' : 'low';
  const banner = document.getElementById('res-banner');
  if (banner) banner.className = `prediction-hero-banner ${riskClass}`;
  setText('#res-level-text', riskNames[prediction.risk_level] || prediction.label);
  setText('#res-prob-text', `${(prediction.probability * 100).toFixed(1)}%`);
  setText('#prediction-model-tag', `Backend · ${prediction.primary_model.toUpperCase()} utama`);
  ['knn', 'mlp'].forEach(name => {
    const probability = prediction.per_model[name];
    const value = probability == null ? null : probability * 100;
    const bar = document.getElementById(`${name}-bar`);
    if (bar && value != null) bar.style.width = `${value}%`;
    setText(`#${name}-prob-val`, value == null ? '—' : `${value.toFixed(1)}%`);
  });
  const factors = document.getElementById('res-factors');
  if (factors) {
    factors.replaceChildren();
    (result.explanation.length ? result.explanation : ['Tidak ada faktor risiko khusus dari fitur yang dikirim.']).forEach(reason => {
      const item = document.createElement('li');
      item.textContent = reason;
      factors.append(item);
    });
  }
  const intervention = result.intervention;
  const questText = intervention.quest.map(item => item.title).join(', ');
  setText('#res-recommendation', `${intervention.message}${questText ? ` Rekomendasi: ${questText}.` : ''}`);
  const tag = document.getElementById('prediction-model-tag');
  if (tag) tag.title = result.disclaimer;
}

async function runPrediction(event) {
  event.preventDefault();
  const button = document.getElementById('btn-submit-predict');
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Menghubungi model…';
  const number = id => Number(document.getElementById(id).value);
  const optionalNumber = id => document.getElementById(id).value.trim() === '' ? null : number(id);
  const payload = {
    student_id: document.getElementById('inp-student-id').value.trim() || null,
    aktivitas_7h: number('inp-akt-7h'),
    aktivitas_14h: number('inp-akt-14h'),
    hari_sejak_aktif: number('inp-hari-aktif'),
    rata_nilai_tugas: optionalNumber('inp-rata-kuis'),
    tren_nilai: optionalNumber('inp-tren-nilai'),
    jumlah_tugas_dikumpulkan: number('inp-percobaan'),
    rasio_tugas_selesai: optionalNumber('inp-rasio-kuis')
  };
  try {
    renderPrediction(await apiRequest('/api/predict', { method: 'POST', body: JSON.stringify(payload) }));
    showToast('Prediksi berhasil dihitung oleh backend.');
  } catch (error) {
    const banner = document.getElementById('res-banner');
    if (banner) banner.className = 'prediction-hero-banner';
    setText('#res-level-text', 'Prediksi gagal');
    setText('#res-prob-text', '—');
    setText('#prediction-model-tag', 'API tidak mengembalikan hasil');
    setText('#res-recommendation', error.message);
    showToast(`Prediksi tidak berhasil: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}


export { renderPrediction, runPrediction };

function initPrediction() {
  document.getElementById('prediction-form')?.addEventListener('submit', runPrediction);
}

export { initPrediction };

