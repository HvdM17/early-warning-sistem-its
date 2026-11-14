/**
 * UI Utilities untuk EWS ITS
 * Toast notifications, banners, dan helper visual
 */

export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

/**
 * Menampilkan pesan toast sementara di pojok kanan bawah
 * @param {string} message Pesan yang ditampilkan
 * @param {'info'|'success'|'warning'|'danger'} type Jenis toast
 * @param {number} duration Durasi tayang dalam milidetik (default 4000ms)
 */
export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-indicator"></span>
      <span class="toast-text">${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Tutup notifikasi">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => toast.remove());

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 250);
    }
  }, duration);
}

/**
 * Menampilkan banner notifikasi di area header/banner
 */
export function showBanner(message, type = 'info', containerId = 'bannerArea') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const banner = document.createElement('div');
  banner.className = `banner banner-${type}`;
  banner.innerHTML = `
    <div class="banner-body">
      <span class="banner-icon"></span>
      <span class="banner-text">${escapeHtml(message)}</span>
    </div>
    <button type="button" class="banner-btn-close" aria-label="Tutup banner">&times;</button>
  `;

  banner.querySelector('.banner-btn-close').addEventListener('click', () => banner.remove());
  container.appendChild(banner);
}

/**
 * Membersihkan semua banner di area banner
 */
export function clearBanners(containerId = 'bannerArea') {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';
}
