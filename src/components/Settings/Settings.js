import './Settings.css';
import { SettingsService } from '../../services/SettingsService.js';
import { CloseUrl } from '../../assets/icons.js';

/**
 * Модальное окно настроек: фон, шрифт, размер шрифта, цвет акцентов, цвет и прозрачность сообщений.
 */
export default class Settings {
  constructor(notification) {
    this.notification = notification;
    this.backdrop = null;
    this.current = { ...SettingsService.load() };
    this.render();
    this.bindEvents();
  }

  render() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'settings-modal-backdrop';
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.backdrop.setAttribute('role', 'dialog');
    this.backdrop.setAttribute('aria-labelledby', 'settingsModalTitle');

    const bgPresets = SettingsService.getBackgroundPresets();
    const fontPresets = SettingsService.getFontPresets();
    const fontSizePresets = SettingsService.getFontSizePresets();
    const accentPresets = SettingsService.getAccentPresets();

    const bgOptionsHtml = Object.entries(bgPresets)
      .filter(([ key ]) => key !== 'custom')
      .map(
        ([
          key, p
        ]) =>
          `<button type="button" class="settings-bg-option" data-bg="${key}">${p.label}</button>`
      )
      .join('');

    const fontOptionsHtml = Object.entries(fontPresets)
      .map(([
        key, p
      ]) => `<option value="${key}">${p.label}</option>`)
      .join('');

    const fontSizeOptionsHtml = Object.entries(fontSizePresets)
      .map(([
        key, p
      ]) => `<option value="${key}">${p.label}</option>`)
      .join('');

    const accentOptionsHtml = Object.entries(accentPresets)
      .filter(([ key ]) => key !== 'custom')
      .map(
        ([
          key, p
        ]) =>
          `<button type="button" class="settings-accent-option" data-accent="${key}"
            style="--accent-preview: ${p.color}" title="${p.label}">${p.label}</button>`
      )
      .join('');

    this.backdrop.innerHTML = `
      <div class="settings-modal">
        <div class="settings-modal-header">
          <h2 id="settingsModalTitle">Настройки</h2>
          <button type="button" class="settings-modal-close" aria-label="Закрыть">
            <img src="${CloseUrl}" alt="" class="settings-close-icon" aria-hidden="true">
          </button>
        </div>
        <div class="settings-modal-body">
          <div class="settings-group">
            <span class="settings-group-label">Фон приложения</span>
            <div class="settings-bg-options">
              ${bgOptionsHtml}
              <button type="button" class="settings-bg-option" data-bg="custom">Свой цвет</button>
            </div>
            <div class="settings-custom-color-wrap" id="settingsCustomColorWrap" style="display: none;">
              <input type="color" id="settingsCustomColor"
                value="${this.current.customBgColor || '#6b7280'}" />
              <label for="settingsCustomColor">Выберите цвет</label>
            </div>
          </div>
          <div class="settings-group">
            <label class="settings-group-label" for="settingsFontSelect">Шрифт</label>
            <select id="settingsFontSelect" class="settings-font-select">${fontOptionsHtml}</select>
          </div>
          <div class="settings-group">
            <label class="settings-group-label" for="settingsFontSizeSelect">Размер шрифта</label>
            <select id="settingsFontSizeSelect" class="settings-font-select">${fontSizeOptionsHtml}</select>
          </div>
          <div class="settings-group">
            <span class="settings-group-label">Цвет кнопок и акцентов</span>
            <div class="settings-accent-options">
              ${accentOptionsHtml}
              <button type="button" class="settings-accent-option settings-accent-custom"
                data-accent="custom">Свой</button>
            </div>
            <div class="settings-custom-color-wrap" id="settingsAccentColorWrap" style="display: none;">
              <input type="color" id="settingsAccentColor" value="${this.current.customAccentColor || '#4f46e5'}" />
              <label for="settingsAccentColor">Выберите цвет</label>
            </div>
          </div>
          <div class="settings-group">
            <span class="settings-group-label">Сообщения</span>
            <div class="settings-message-row">
              <label for="settingsMessageColor" class="settings-inline-label">Цвет фона</label>
              <input type="color" id="settingsMessageColor" value="${this.current.messageColor || '#787878'}" />
            </div>
            <div class="settings-message-row">
              <label for="settingsMessageOpacity" class="settings-inline-label">
                Прозрачность <span id="settingsMessageOpacityValue">
                  ${Math.round((this.current.messageOpacity ?? 0.2) * 100)}%</span>
              </label>
              <input type="range" id="settingsMessageOpacity" min="10" max="100"
                value="${Math.round((this.current.messageOpacity ?? 0.2) * 100)}" />
            </div>
          </div>
        </div>
        <div class="settings-modal-footer">
          <button type="button" class="action-button" id="settingsResetBtn">Сбросить</button>
          <button type="button" class="primary-button" id="settingsSaveBtn">Сохранить</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.backdrop);
    this.syncUI();
  }

  syncUI() {
    const bgOptions = this.backdrop.querySelectorAll('.settings-bg-option');
    bgOptions.forEach((btn) => {
      const key = btn.getAttribute('data-bg');
      btn.classList.toggle('active', this.current.background === key);
    });

    const customWrap = this.backdrop.querySelector('#settingsCustomColorWrap');
    const customColor = this.backdrop.querySelector('#settingsCustomColor');
    if (customWrap) {
      customWrap.style.display = this.current.background === 'custom' ? 'flex' : 'none';
    }
    if (customColor && this.current.customBgColor) {
      customColor.value = this.current.customBgColor;
    }

    const fontSelect = this.backdrop.querySelector('#settingsFontSelect');
    if (fontSelect) fontSelect.value = this.current.fontFamily || 'system';

    const fontSizeSelect = this.backdrop.querySelector('#settingsFontSizeSelect');
    if (fontSizeSelect) fontSizeSelect.value = this.current.fontSize || 'medium';

    const accentOptions = this.backdrop.querySelectorAll('.settings-accent-option');
    accentOptions.forEach((btn) => {
      const key = btn.getAttribute('data-accent');
      btn.classList.toggle('active', this.current.accent === key);
    });
    const accentWrap = this.backdrop.querySelector('#settingsAccentColorWrap');
    const accentColor = this.backdrop.querySelector('#settingsAccentColor');
    if (accentWrap) {
      accentWrap.style.display = this.current.accent === 'custom' ? 'flex' : 'none';
    }
    if (accentColor && this.current.customAccentColor) {
      accentColor.value = this.current.customAccentColor;
    }

    const messageColorEl = this.backdrop.querySelector('#settingsMessageColor');
    if (messageColorEl) messageColorEl.value = this.current.messageColor || '#787878';
    const messageOpacityEl = this.backdrop.querySelector('#settingsMessageOpacity');
    const messageOpacityValueEl = this.backdrop.querySelector('#settingsMessageOpacityValue');
    if (messageOpacityEl) {
      const pct = Math.round((this.current.messageOpacity ?? 0.2) * 100);
      messageOpacityEl.value = pct;
      if (messageOpacityValueEl) messageOpacityValueEl.textContent = pct + '%';
    }
  }

  bindEvents() {
    this.backdrop.querySelector('.settings-modal-close').addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.backdrop.querySelectorAll('.settings-bg-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-bg');
        this.current.background = key;
        this.syncUI();
      });
    });

    const customColorEl = this.backdrop.querySelector('#settingsCustomColor');
    if (customColorEl) {
      customColorEl.addEventListener('input', (e) => {
        this.current.customBgColor = e.target.value;
      });
    }

    const fontSelect = this.backdrop.querySelector('#settingsFontSelect');
    if (fontSelect) {
      fontSelect.addEventListener('change', (e) => {
        this.current.fontFamily = e.target.value;
      });
    }

    const fontSizeSelect = this.backdrop.querySelector('#settingsFontSizeSelect');
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', (e) => {
        this.current.fontSize = e.target.value;
      });
    }

    this.backdrop.querySelectorAll('.settings-accent-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.current.accent = btn.getAttribute('data-accent');
        this.syncUI();
      });
    });

    const accentColorEl = this.backdrop.querySelector('#settingsAccentColor');
    if (accentColorEl) {
      accentColorEl.addEventListener('input', (e) => {
        this.current.customAccentColor = e.target.value;
      });
    }

    const messageColorEl = this.backdrop.querySelector('#settingsMessageColor');
    if (messageColorEl) {
      messageColorEl.addEventListener('input', (e) => {
        this.current.messageColor = e.target.value;
      });
    }
    const messageOpacityEl = this.backdrop.querySelector('#settingsMessageOpacity');
    const messageOpacityValueEl = this.backdrop.querySelector('#settingsMessageOpacityValue');
    if (messageOpacityEl) {
      messageOpacityEl.addEventListener('input', (e) => {
        const pct = Number(e.target.value);
        this.current.messageOpacity = pct / 100;
        if (messageOpacityValueEl) messageOpacityValueEl.textContent = pct + '%';
      });
    }

    this.backdrop.querySelector('#settingsSaveBtn').addEventListener('click', () => this.save());
    this.backdrop.querySelector('#settingsResetBtn').addEventListener('click', () => this.reset());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  }

  open() {
    this.current = { ...SettingsService.load() };
    this.syncUI();
    this.backdrop.classList.add('is-open');
    this.backdrop.setAttribute('aria-hidden', 'false');
  }

  close() {
    this.backdrop.classList.remove('is-open');
    this.backdrop.setAttribute('aria-hidden', 'true');
  }

  isOpen() {
    return this.backdrop?.classList.contains('is-open') ?? false;
  }

  save() {
    const ok = SettingsService.save(this.current);
    if (ok) {
      this.notification?.success('Настройки', 'Настройки сохранены.');
      this.close();
    } else {
      this.notification?.warning('Ошибка', 'Не удалось сохранить настройки.');
    }
  }

  reset() {
    this.current = { ...SettingsService.getDefaults() };
    SettingsService.save(this.current);
    this.syncUI();
    this.notification?.info('Настройки', 'Настройки сброшены.');
  }
}
