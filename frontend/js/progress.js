/**
 * Progress & Gamification Module untuk EWS ITS (Pekerjaan Dini)
 * Mengelola #progres-saya, gamifikasi (XP, level, badge, quest), dan #riwayat
 */

import { EWS_CONFIG, apiGetProgress, apiSendActivity } from './api.js';
import { appState, setStudentId, setStudentProgress, subscribe } from './state.js';
import { escapeHtml, showToast } from './ui.js';

// Definisi 4 Lencana Resmi Sistem ITS (berdasarkan backend/gamification.py)
const OFFICIAL_BADGES = [
  {
    name: 'Akurasi Tinggi',
    icon: 'target',
    description: 'Mencapai rata-rata skor minimal 85 pada 3 kuis pembelajaran terakhir.',
    category: 'Akademik'
  },
  {
    name: 'Learning Streak 7 Hari',
    icon: 'flame',
    description: 'Konsisten aktif dalam aktivitas pembelajaran selama 7 hari berturut-turut.',
    category: 'Konsistensi'
  },
  {
    name: 'Remedial Selesai',
    icon: 'award',
    description: 'Berhasil menyelesaikan minimal 1 modul rekomendasi intervensi remedial.',
    category: 'Ketekunan'
  },
  {
    name: 'Kembali ke Jalur',
    icon: 'shield-check',
    description: 'Berhasil menurunkan status risiko dari sedang/tinggi menjadi rendah.',
    category: 'Peningkatan'
  }
];

export function initProgress() {
  const progresSection = document.getElementById('progres-saya');
  const riwayatSection = document.getElementById('riwayat');

  // Render awal riwayat (empty state informatif)
  if (riwayatSection) {
    renderHistorySection(riwayatSection);
  }

  // Dengarkan perubahan state
  subscribe((event, payload) => {
    if (event === 'student_id_changed' || event === 'section_changed') {
      if (appState.activeSection === 'progres-saya') {
        checkAndRenderProgress(progresSection);
      }
    }
  });

  // Render progres saat pertama kali diinisialisasi jika berada di tab progres
  checkAndRenderProgress(progresSection);
}

/**
 * Memeriksa ketersediaan identitas studentId dari EWS_CONFIG / appState
 */
export async function checkAndRenderProgress(container) {
  if (!container) return;

  const currentId = EWS_CONFIG.studentId || appState.studentId;

  if (!currentId) {
    renderUnconnectedAccountState(container);
    return;
  }

  // Tampilkan loading skeleton
  renderProgressLoadingState(container, currentId);

  try {
    const data = await apiGetProgress(currentId);
    setStudentProgress(data);
    renderConnectedProgressUI(container, data);
  } catch (err) {
    if (err.status === 404) {
      // Mahasiswa baru terdaftar, belum memiliki riwayat tersimpan di progress.json
      const initialProgress = {
        student_id: currentId,
        total_xp: 0,
        level: 1,
        badges: [],
        progress_percent: 0,
        quest: [
          { id: 'M1', title: 'Modul 1: Pengantar Algoritma Pembelajaran', done: false },
          { id: 'M2', title: 'Modul 2: Eksplorasi Fitur & Interaksi LMS', done: false },
          { id: 'M3', title: 'Modul 3: Pengerjaan Tugas Mandiri', done: false },
          { id: 'M4', title: 'Modul 4: Evaluasi Pembelajaran Berkala', done: false },
          { id: 'M5', title: 'Modul 5: Refleksi & Pemecahan Masalah', done: false }
        ]
      };
      setStudentProgress(initialProgress);
      renderConnectedProgressUI(container, initialProgress, true);
    } else {
      renderProgressErrorState(container, err.message || 'Gagal memuat data progres mahasiswa.');
    }
  }
}

/**
 * State Akun Belum Terhubung (Sesuai Butir 4 & 5 Jobdesk Dini)
 * TIDAK MENAMPILKAN DATA PALSU / XP PALSU
 */
function renderUnconnectedAccountState(container) {
  container.innerHTML = `
    <div class="unconnected-state-wrapper animated-fade-in">
      <div class="unconnected-card">
        <div class="unconnected-illustration">
          <svg viewBox="0 0 24 24" class="unconnected-icon" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        </div>
        <h2 class="unconnected-title">Akun Mahasiswa Belum Terhubung</h2>
        <p class="unconnected-message">
          Akun mahasiswa belum terhubung. Hubungkan identitas mahasiswa terlebih dahulu untuk melihat progres pembelajaran dan pencapaian Anda.
        </p>

        <div class="connect-account-box">
          <label for="inputConnectStudentId" class="connect-label">Masukkan ID Mahasiswa Anda (OULAD / Sistem):</label>
          <div class="connect-input-group">
            <input type="text" id="inputConnectStudentId" placeholder="Contoh: S-00001 atau S-001" maxlength="20" class="connect-input">
            <button type="button" class="btn btn-primary" id="btnConnectStudent">Hubungkan Akun</button>
          </div>
          <div class="connect-suggestions">
            <span class="suggestion-label">Atau gunakan sampel pendaftaran:</span>
            <div class="suggestion-chips">
              <button type="button" class="chip-btn" data-preset="S-00001">S-00001</button>
              <button type="button" class="chip-btn" data-preset="S-00002">S-00002</button>
              <button type="button" class="chip-btn" data-preset="S-00003">S-00003</button>
              <button type="button" class="chip-btn" data-preset="S-001">S-001</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Listener input connect
  const btnConnect = container.querySelector('#btnConnectStudent');
  const inputId = container.querySelector('#inputConnectStudentId');

  btnConnect?.addEventListener('click', () => {
    const val = inputId?.value.trim();
    if (!val) {
      showToast('Masukkan ID mahasiswa terlebih dahulu.', 'warning');
      return;
    }
    setStudentId(val);
    showToast(`Akun terhubung sebagai ${val}. Memuat data...`, 'success');
  });

  inputId?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnConnect?.click();
    }
  });

  container.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetId = btn.dataset.preset;
      setStudentId(presetId);
      showToast(`Akun terhubung sebagai ${presetId}. Memuat data...`, 'success');
    });
  });
}

/**
 * Render antarmuka progres nyata mahasiswa (XP, Level, Progress Bar, Quests, Badges)
 */
function renderConnectedProgressUI(container, progress, isNew = false) {
  const totalXp = progress.total_xp || 0;
  const level = progress.level || 1;
  const xpCurrentLevel = totalXp % 100;
  const xpNeeded = 100 - xpCurrentLevel;
  const progressPercent = progress.progress_percent || 0;
  const quests = progress.quest || [];
  const completedCount = quests.filter(q => q.done).length;

  const earnedBadgesSet = new Set(progress.badges || []);

  container.innerHTML = `
    <div class="progress-dashboard-wrapper animated-fade-in">
      <!-- Top Profile & Level Banner -->
      <div class="student-hero-card">
        <div class="student-hero-left">
          <div class="student-avatar-badge">
            <span class="avatar-text">ITS</span>
          </div>
          <div class="student-info-meta">
            <div class="student-id-tag">
              <span>Mahasiswa Terhubung:</span>
              <strong>${escapeHtml(progress.student_id)}</strong>
              <button type="button" class="link-btn-subtle" id="btnDisconnectStudent" title="Ganti akun">(Ganti Akun)</button>
            </div>
            <h2 class="student-hero-title">Dashboard Progres &amp; Gamifikasi</h2>
            <p class="student-hero-desc">Tingkatkan keterlibatan belajar, selesaikan quest mingguan, dan kumpulkan lencana prestasi akademik.</p>
          </div>
        </div>

        <div class="student-hero-right">
          <div class="level-showcase-box">
            <div class="level-indicator-ring">
              <span class="level-label-small">LEVEL</span>
              <span class="level-number-huge">${level}</span>
            </div>
            <div class="xp-counter-wrap">
              <div class="xp-number-large">${totalXp} <span class="xp-unit">XP</span></div>
              <span class="xp-next-sub">${xpNeeded} XP lagi menuju Level ${level + 1}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Overall Progress Bar Card -->
      <div class="progress-bar-card card">
        <div class="progress-card-header">
          <div>
            <h3 class="card-title">Perkembangan Pembelajaran Periode Ini</h3>
            <span class="card-subtitle">${completedCount} dari ${quests.length} quest selesai</span>
          </div>
          <span class="progress-percentage-pill">${progressPercent}% Selesai</span>
        </div>
        <div class="progress-bar-large-track">
          <div class="progress-bar-large-fill" style="width: ${progressPercent}%;"></div>
        </div>
      </div>

      <!-- Main Columns: Quests on Left, Badges on Right -->
      <div class="gamification-grid">
        <!-- Quests Column -->
        <div class="quests-column">
          <div class="card quest-container-card">
            <div class="card-header-styled">
              <div class="header-icon-wrap icon-purple">
                <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              </div>
              <div>
                <h3 class="card-title">Daftar Quest &amp; Modul Pembelajaran</h3>
                <p class="card-desc">Selesaikan modul untuk mengumpulkan XP dan membuka badge prestasi.</p>
              </div>
            </div>

            <div class="quest-items-flow" id="questListContainer">
              ${renderQuestItemsList(quests, progress.student_id)}
            </div>

            <!-- Quiz Action Simulator Box -->
            <div class="quiz-simulator-box">
              <h4 class="simulator-title">Simulasi Pengerjaan Kuis Pembelajaran</h4>
              <p class="simulator-desc">Kerjakan kuis untuk mendapatkan XP dinamis (10 XP + floor(skor / 10)). Skor ≥ 85 sebanyak 3 kali membuka lencana <strong>Akurasi Tinggi</strong>.</p>
              <div class="simulator-controls">
                <div class="simulator-input-wrap">
                  <label for="quizScoreInput" class="simulator-label">Skor Kuis (0-100):</label>
                  <input type="number" id="quizScoreInput" min="0" max="100" value="90" class="input-modern">
                </div>
                <div class="simulator-input-wrap">
                  <label for="quizTargetQuest" class="simulator-label">Modul Target:</label>
                  <select id="quizTargetQuest" class="select-modern">
                    ${quests.map(q => `<option value="${escapeHtml(q.id)}">${escapeHtml(q.id)}: ${escapeHtml(q.title)}</option>`).join('')}
                  </select>
                </div>
                <button type="button" class="btn btn-primary btn-sim-submit" id="btnSubmitQuiz">Kirim Kuis</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Badges Column -->
        <div class="badges-column">
          <div class="card badges-container-card">
            <div class="card-header-styled">
              <div class="header-icon-wrap icon-blue">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
              </div>
              <div>
                <h3 class="card-title">Lencana Pencapaian (Badges)</h3>
                <p class="card-desc">${earnedBadgesSet.size} dari ${OFFICIAL_BADGES.length} lencana diraih</p>
              </div>
            </div>

            <div class="badges-flow">
              ${renderBadgesList(earnedBadgesSet)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachProgressEventListeners(container, progress.student_id);
}

function renderQuestItemsList(quests, studentId) {
  if (!quests.length) {
    return '<p class="placeholder-text">Belum ada quest yang ditugaskan.</p>';
  }

  return quests.map(q => {
    const isRemedial = q.id.startsWith('R');
    const statusClass = q.done ? 'quest-done' : 'quest-active';

    return `
      <div class="quest-item-card ${statusClass}">
        <div class="quest-left-col">
          <div class="quest-status-checkbox ${q.done ? 'checked' : ''}">
            ${q.done ? '&#10003;' : ''}
          </div>
          <div class="quest-text-wrap">
            <div class="quest-badges-row">
              <span class="quest-id-pill">${escapeHtml(q.id)}</span>
              ${isRemedial ? '<span class="badge badge-remedial">Modul Remedial</span>' : '<span class="badge badge-regular">Reguler</span>'}
            </div>
            <h4 class="quest-item-heading ${q.done ? 'line-through' : ''}">${escapeHtml(q.title)}</h4>
          </div>
        </div>
        <div class="quest-right-col">
          ${q.done
            ? '<span class="badge badge-success-outline">Selesai (+XP)</span>'
            : `<button type="button" class="btn btn-secondary btn-sm btn-action-quest" data-quest-id="${escapeHtml(q.id)}" data-is-remedial="${isRemedial}">
                 <span>Kerjakan</span>
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

function renderBadgesList(earnedSet) {
  return OFFICIAL_BADGES.map(b => {
    const isEarned = earnedSet.has(b.name);
    const badgeStateClass = isEarned ? 'badge-earned' : 'badge-locked';

    return `
      <div class="badge-item-card ${badgeStateClass}">
        <div class="badge-icon-bubble ${isEarned ? 'bubble-earned' : 'bubble-locked'}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            ${isEarned
              ? '<polyline points="9 11 12 14 22 4"></polyline>'
              : '<line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
            }
          </svg>
        </div>
        <div class="badge-content">
          <div class="badge-top-meta">
            <span class="badge-category-tag">${escapeHtml(b.category)}</span>
            ${isEarned ? '<span class="badge-status-tag status-earned">&#10003; Terbuka</span>' : '<span class="badge-status-tag status-locked">&#128274; Terkunci</span>'}
          </div>
          <h4 class="badge-name">${escapeHtml(b.name)}</h4>
          <p class="badge-desc">${escapeHtml(b.description)}</p>
        </div>
      </div>
    `;
  }).join('');
}

function attachProgressEventListeners(container, studentId) {
  // Tombol disconnect
  container.querySelector('#btnDisconnectStudent')?.addEventListener('click', () => {
    setStudentId(null);
    showToast('Identitas mahasiswa diputus.', 'info');
  });

  // Tombol action quest
  container.querySelectorAll('.btn-action-quest').forEach(btn => {
    btn.addEventListener('click', async () => {
      const questId = btn.dataset.questId;
      const isRemedial = btn.dataset.isRemedial === 'true';

      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Memproses...';

      try {
        const payload = {
          student_id: studentId,
          type: isRemedial ? 'remedial' : 'bacaan',
          score: null,
          item_id: questId
        };
        const response = await apiSendActivity(payload);
        showToast(`+${response.xp_earned} XP! Quest ${questId} selesai.`, 'success');

        if (response.new_badges && response.new_badges.length) {
          response.new_badges.forEach(badge => {
            showToast(`Lencana Baru Terbuka: ${badge}!`, 'success', 6000);
          });
        }

        // Re-fetch dan update UI
        await checkAndRenderProgress(container);
      } catch (err) {
        showToast(err.message || 'Gagal memperbarui aktivitas.', 'danger');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
  });

  // Tombol submit kuis simulator
  const btnQuiz = container.querySelector('#btnSubmitQuiz');
  const scoreInput = container.querySelector('#quizScoreInput');
  const targetSelect = container.querySelector('#quizTargetQuest');

  btnQuiz?.addEventListener('click', async () => {
    const scoreVal = parseFloat(scoreInput.value);
    const targetQuest = targetSelect.value;

    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      showToast('Skor kuis harus antara 0 sampai 100.', 'warning');
      return;
    }

    const originalHtml = btnQuiz.innerHTML;
    btnQuiz.disabled = true;
    btnQuiz.innerHTML = 'Mengirim...';

    try {
      const payload = {
        student_id: studentId,
        type: 'kuis',
        score: scoreVal,
        item_id: targetQuest
      };
      const response = await apiSendActivity(payload);
      showToast(`+${response.xp_earned} XP diperoleh dari kuis (Skor: ${scoreVal})!`, 'success');

      if (response.new_badges && response.new_badges.length) {
        response.new_badges.forEach(badge => {
          showToast(`Lencana Baru Terbuka: ${badge}!`, 'success', 6000);
        });
      }

      await checkAndRenderProgress(container);
    } catch (err) {
      showToast(err.message || 'Gagal mengirim nilai kuis.', 'danger');
    } finally {
      btnQuiz.disabled = false;
      btnQuiz.innerHTML = originalHtml;
    }
  });

}

function renderProgressLoadingState(container, studentId) {
  container.innerHTML = `
    <div class="progress-loading-wrapper animated-fade-in">
      <div class="spinner-large"></div>
      <p class="loading-text">Memuat progres dan gamifikasi mahasiswa <strong>${escapeHtml(studentId)}</strong>...</p>
    </div>
  `;
}

function renderProgressErrorState(container, message) {
  container.innerHTML = `
    <div class="error-state-card animated-fade-in">
      <h3 class="error-state-title">Gagal Mengambil Progres</h3>
      <p class="error-state-desc">${escapeHtml(message)}</p>
      <button type="button" class="btn btn-secondary mt-12" id="btnRetryProgress">Coba Lagi</button>
    </div>
  `;
  container.querySelector('#btnRetryProgress')?.addEventListener('click', () => {
    checkAndRenderProgress(container);
  });
}

/**
 * Render Halaman Riwayat Aktivitas (#riwayat)
 * Sesuai Butir 5 Jobdesk Dini:
 * Backend belum menyediakan endpoint riwayat aktivitas individual.
 * Tampilkan empty state yang informatif, menarik, tanpa data palsu.
 */
function renderHistorySection(container) {
  container.innerHTML = `
    <div class="history-dashboard-wrapper animated-fade-in">
      <div class="card history-empty-card">
        <div class="history-icon-wrapper">
          <svg viewBox="0 0 24 24" class="history-hero-icon" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <h2 class="history-empty-title">Riwayat Aktivitas Belum Tersedia</h2>
        <p class="history-empty-text">
          Riwayat aktivitas pembelajaran belum tersedia karena endpoint backend riwayat belum disediakan oleh sistem saat ini.
        </p>
        <div class="history-status-badge">
          <span class="status-dot-pulse"></span>
          <span>Status Sistem: Menunggu Integrasi Endpoint Riwayat Backend</span>
        </div>

        <div class="history-blueprint-box">
          <h4 class="blueprint-title">Kesiapan Arsitektur Frontend:</h4>
          <p class="blueprint-desc">
            Antarmuka telah disiapkan dan siap menerima data riwayat begitu endpoint backend diimplementasikan (misal: <code>GET /api/history/{student_id}</code>). Setiap aktivitas (waktu akses modul, pengumpulan tugas, perolehan XP, dan pencapaian lencana) akan langsung disajikan dalam bentuk linimasa interaktif tanpa perlu perombakan komponen.
          </p>
        </div>
      </div>
    </div>
  `;
}
