import './Notification.css';
import { CloseUrl } from '@/assets/icons.js';

/**
 * Система уведомлений (всплывающие нотификации)
 */
export default class Notification {
  constructor() {
    this.notificationContainer = document.querySelector('#notificationContainer');
    this.notifications = [];
  }

  /**
   * Показать уведомление
   * @param {Object} options
   * @param {string} options.title - Заголовок
   * @param {string} options.message - Сообщение
   * @param {string} options.type - Тип (success, warning, error, info)
   * @param {number} options.duration - Длительность в мс (0 = не скрывать автоматически)
   * @param {Function} options.onClose - Колбек при закрытии
   * @returns {string} ID уведомления
   */
  show(options) {
    const id = 'notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const { title, message, type = 'info', duration = 5000, onClose } = options;

    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️',
    };

    const notificationEl = document.createElement('div');
    notificationEl.className = `notification ${type}`;
    notificationEl.id = id;
    notificationEl.innerHTML = `
      <div class="notification-icon">${icons[type] || icons.info}</div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" data-id="${id}">
        <img src="${CloseUrl}" alt="" class="notification-close-icon" aria-hidden="true">
      </button>
    `;

    this.notificationContainer.append(notificationEl);
    this.notifications.push({
      id, element: notificationEl, onClose
    });

    // Автоматическое закрытие
    if (duration > 0) {
      setTimeout(() => this.close(id), duration);
    }

    // Обработчик закрытия по кнопке
    notificationEl.querySelector('.notification-close').addEventListener('click', () => this.close(id));

    return id;
  }

  /**
   * Закрывает уведомление по id с анимацией и удаляет из DOM.
   * @param {string} id - идентификатор уведомления
   */
  close(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (!notification) return;

    const element = notification.element;
    element.classList.add('fade-out');
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.notifications = this.notifications.filter(n => n.id !== id);
      if (notification.onClose) notification.onClose();
    }, 300);
  }

  /** Закрывает все активные уведомления. */
  closeAll() {
    this.notifications.forEach(n => this.close(n.id));
  }

  /** Показать уведомление об успехе. */
  success(title, message, duration = 3000) {
    return this.show({
      title, message, type: 'success', duration
    });
  }

  /** Показать предупреждение. */
  warning(title, message, duration = 4000) {
    return this.show({
      title, message, type: 'warning', duration
    });
  }

  /** Показать уведомление об ошибке. */
  error(title, message, duration = 5000) {
    return this.show({
      title, message, type: 'error', duration
    });
  }

  /** Показать информационное уведомление. */
  info(title, message, duration = 3000) {
    return this.show({
      title, message, type: 'info', duration
    });
  }

  /**
   * Показать системное уведомление через Notification API браузера.
   * @param {string} title - заголовок
   * @param {NotificationOptions} [options] - опции (body, icon и т.д.)
   * @returns {Notification|null}
   */
  static showSystemNotification(title, options = {}) {
    if (!('Notification' in window)) {
      console.warn('Браузер не поддерживает Notification API');
      return null;
    }
    if (Notification.permission === 'granted') {
      return new Notification(title, options);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, options);
        }
      });
    }
    return null;
  }
}