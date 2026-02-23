/**
 * Сервис настроек приложения (фон, шрифт). Сохраняет в localStorage и применяет к документу.
 */
const STORAGE_KEY = 'chaos-organizer-settings';

const BACKGROUND_PRESETS = {
  default: {
    label: 'Серый градиент',
    bg: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)',
    root: '#f9fafb',
  },
  light: {
    label: 'Светлая',
    bg: 'linear-gradient(180deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)',
    root: '#f8fafc',
  },
  dark: {
    label: 'Тёмная',
    bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)',
    root: '#0f172a',
  },
  blue: {
    label: 'Синий градиент',
    bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #1e3a8a 100%)',
    root: '#eff6ff',
  },
  green: {
    label: 'Зелёный градиент',
    bg: 'linear-gradient(135deg, #22c55e 0%, #15803d 50%, #14532d 100%)',
    root: '#f0fdf4',
  },
  custom: {
    label: 'Свой цвет',
    bg: null,
    root: null,
  },
};

const FONT_PRESETS = {
  system: {
    label: 'Системный',
    value: '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Oxygen, Ubuntu, sans-serif',
  },
  georgia: {
    label: 'Georgia',
    value: 'Georgia, \'Times New Roman\', serif',
  },
  verdana: {
    label: 'Verdana',
    value: 'Verdana, Geneva, sans-serif',
  },
  arial: {
    label: 'Arial',
    value: 'Arial, Helvetica, sans-serif',
  },
  times: {
    label: 'Times New Roman',
    value: '\'Times New Roman\', Times, serif',
  },
  monospace: {
    label: 'Моноширинный',
    value: '\'Consolas\', \'Monaco\', \'Courier New\', monospace',
  },
};

const FONT_SIZE_PRESETS = {
  small: {
    label: 'Маленький', value: '14px'
  },
  medium: {
    label: 'Средний', value: '16px'
  },
  large: {
    label: 'Крупный', value: '18px'
  },
};

const ACCENT_PRESETS = {
  indigo: {
    label: 'Индиго', color: '#4f46e5', hover: '#4338ca'
  },
  blue: {
    label: 'Синий', color: '#3b82f6', hover: '#2563eb'
  },
  green: {
    label: 'Зелёный', color: '#10b981', hover: '#059669'
  },
  violet: {
    label: 'Фиолетовый', color: '#8b5cf6', hover: '#7c3aed'
  },
  rose: {
    label: 'Розовый', color: '#f43f5e', hover: '#e11d48'
  },
  custom: {
    label: 'Свой', color: null, hover: null
  },
};

export const SettingsService = {
  getDefaults() {
    return {
      background: 'default',
      customBgColor: '#6b7280',
      fontFamily: 'system',
      fontSize: 'medium',
      accent: 'indigo',
      customAccentColor: '#4f46e5',
      messageColor: '#787878',
      messageOpacity: 0.2,
    };
  },

  /** Преобразует hex в r, g, b (0–255). */
  hexToRgb(hex) {
    const m = hex.replace(/^#/, '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? [
      parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)
    ] : [
      120, 120, 120
    ];
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.getDefaults();
      const parsed = JSON.parse(raw);
      return {
        ...this.getDefaults(), ...parsed
      };
    } catch {
      return this.getDefaults();
    }
  },

  save(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      this.apply(settings);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Применяет настройки к документу (CSS-переменные на :root).
   * @param {Object} [settings] - если не передано, загружает из localStorage
   */
  apply(settings = null) {
    const s = settings ?? this.load();
    const root = document.documentElement;

    if (s.background === 'custom' && s.customBgColor) {
      root.style.setProperty('--app-bg', s.customBgColor);
      root.style.setProperty('--app-bg-root', s.customBgColor);
    } else {
      const preset = BACKGROUND_PRESETS[s.background] || BACKGROUND_PRESETS.default;
      root.style.setProperty('--app-bg', preset.bg);
      root.style.setProperty('--app-bg-root', preset.root);
    }

    const fontPreset = FONT_PRESETS[s.fontFamily] || FONT_PRESETS.system;
    root.style.setProperty('--app-font', fontPreset.value);

    const sizePreset = FONT_SIZE_PRESETS[s.fontSize] || FONT_SIZE_PRESETS.medium;
    root.style.setProperty('--app-font-size', sizePreset.value);

    let primaryColor, primaryHover;
    if (s.accent === 'custom' && s.customAccentColor) {
      primaryColor = s.customAccentColor;
      primaryHover = s.customAccentColor;
    } else {
      const accentPreset = ACCENT_PRESETS[s.accent] || ACCENT_PRESETS.indigo;
      primaryColor = accentPreset.color;
      primaryHover = accentPreset.hover || accentPreset.color;
    }
    root.style.setProperty('--primary-color', primaryColor);
    root.style.setProperty('--primary-hover', primaryHover);
    /* --tg-blue и --tg-blue-hover заданы в CSS как алиасы var(--primary-color) / var(--primary-hover) */

    const [
      r, g, b
    ] = this.hexToRgb(s.messageColor || '#787878');
    const opacity = Math.max(0.1, Math.min(1, Number(s.messageOpacity) || 0.2));
    const opacityHover = Math.min(1, opacity + 0.3);
    root.style.setProperty('--message-bg', `rgba(${r}, ${g}, ${b}, ${opacity})`);
    root.style.setProperty('--message-bg-hover', `rgba(${r}, ${g}, ${b}, ${opacityHover})`);
  },

  getBackgroundPresets: () => BACKGROUND_PRESETS,
  getFontPresets: () => FONT_PRESETS,
  getFontSizePresets: () => FONT_SIZE_PRESETS,
  getAccentPresets: () => ACCENT_PRESETS,
};
