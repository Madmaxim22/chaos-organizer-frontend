/**
 * Сервис напоминаний: запрос разрешения Notification API,
 * планирование показов уведомлений по времени срабатывания.
 */
import ApiService from './api.js';

const SCHEDULE_REGEX = /@schedule:\s*(\d{1,2}:\d{2})\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(.+)/i;

/**
 * Парсит строку вида "@schedule: 18:04 31.08.2019 «Текст»" или "@schedule: 18:04 31.08.2019 Текст".
 * @param {string} text - строка из поля ввода
 * @returns {{ triggerAt: Date, text: string } | null}
 */
export function parseScheduleCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const match = trimmed.match(SCHEDULE_REGEX);
  if (!match) return null;

  const [
    , timeStr, day, month, year, textPart
  ] = match;
  // DD.MM.YYYY, HH:MM
  const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timeStr}`;
  const triggerAt = new Date(dateStr);
  if (Number.isNaN(triggerAt.getTime())) return null;

  let reminderText = (textPart || '').trim().replace(/^[«""']|[»""']$/g, '').trim() || 'Напоминание';
  return {
    triggerAt, text: reminderText
  };
}

/**
 * Сервис для создания напоминаний и показа уведомлений через Notification API.
 * @param {Object} [apiService] - API-сервис (по умолчанию ApiService)
 * @param {Object} [notification] - компонент уведомлений приложения (toast) для дублирования в интерфейсе
 */
export class ReminderService {
  constructor(apiService = ApiService, notification) {
    this.api = apiService;
    this.notification = notification;
    this._timeouts = new Map();
    this._permissionAsked = false;
  }

  /**
   * Запрашивает разрешение на уведомления (один раз за сессию).
   * @returns {Promise<'granted'|'denied'|'default'>}
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      this.notification?.warning('Уведомления недоступны', 'Ваш браузер не поддерживает уведомления.');
      return 'denied';
    }
    if (Notification.permission !== 'default') return Notification.permission;
    if (this._permissionAsked) return Notification.permission;
    this._permissionAsked = true;
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      this.notification?.warning(
        'Уведомления отключены',
        'Разрешите уведомления в настройках браузера для напоминаний.'
      );
    }
    return permission;
  }

  /**
   * Показывает браузерное уведомление и при наличии — toast в интерфейсе.
   * @param {string} title
   * @param {string} [body]
   */
  showNotification(title, body = '') {
    this.notification?.info(title, body);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      setTimeout(() => n.close(), 8000);
    } catch (e) {
      console.warn('ReminderService.showNotification failed:', e);
    }
  }

  /**
   * Планирует показ уведомления на triggerAt.
   * @param {{ id: string, text: string, triggerAt: Date|string }} reminder
   */
  scheduleReminder(reminder) {
    const triggerAt = reminder.triggerAt instanceof Date ? reminder.triggerAt : new Date(reminder.triggerAt);
    const now = Date.now();
    const delay = triggerAt.getTime() - now;

    if (delay <= 0) {
      this.showNotification('Chaos Organizer', reminder.text || 'Напоминание');
      return;
    }

    const id = reminder.id || `rem-${Date.now()}`;
    const timeoutId = setTimeout(() => {
      this._timeouts.delete(id);
      this.showNotification('Chaos Organizer', reminder.text || 'Напоминание');
    }, delay);
    this._timeouts.set(id, timeoutId);
  }

  /**
   * Создаёт напоминание на API и планирует уведомление.
   * @param {{ text: string, triggerAt: Date|string }} data
   * @returns {Promise<{ id: string, text: string, triggerAt: string }>}
   */
  async createReminder(data) {
    const triggerAt = data.triggerAt instanceof Date ? data.triggerAt.toISOString() : data.triggerAt;
    const payload = {
      text: data.text, triggerAt
    };
    const reminder = await this.api.createReminder(payload);
    this.scheduleReminder(reminder);
    return reminder;
  }

  /**
   * Загружает напоминания с сервера и планирует те, у которых triggerAt в будущем.
   */
  async scheduleExistingReminders() {
    try {
      const list = await this.api.getReminders();
      const reminders = Array.isArray(list) ? list : (list.reminders || []);
      const now = Date.now();
      reminders.forEach((r) => {
        const t = new Date(r.triggerAt).getTime();
        if (t > now) this.scheduleReminder(r);
      });
    } catch (e) {
      console.warn('ReminderService.scheduleExistingReminders failed:', e);
    }
  }

  /**
   * Инициализация: запрос разрешения и планирование существующих напоминаний.
   */
  async init() {
    await this.requestPermission();
    await this.scheduleExistingReminders();
  }
}

export default ReminderService;
