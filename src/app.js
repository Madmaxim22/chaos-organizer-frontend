import MessageComponent from './components/MessageComponent/MessageComponent.js';
import InputPanel from './components/InputPanel/InputPanel.js';
import Sidebar from './components/Sidebar/Sidebar.js';
import SearchBar from './components/SearchBar/SearchBar.js';
import Notification from './components/Notification/Notification.js';
import Settings from './components/Settings/Settings.js';
import { MessagesManager } from './services/MessagesManager.js';
import ApiService from './services/api.js';
import ReminderService from './services/ReminderService.js';
import { WebSocketService } from './services/WebSocketService.js';
import { SettingsService } from './services/SettingsService.js';

/** Размер одной страницы сообщений при ленивой подгрузке */
const PAGE_SIZE = 20;

/** Порог в пикселях от верха контейнера, при достижении которого подгружаем ещё */
const SCROLL_LOAD_THRESHOLD = 150;

/**
 * Основной класс приложения Chaos Organizer
 */
export default class ChaosOrganizerApp {
  /**
   * Создаёт экземпляр приложения Chaos Organizer.
   * @param {HTMLElement} [container] - контейнер для монтирования приложения (не используется, разметка в HTML)
   */
  constructor(container) {
    SettingsService.apply();
    /** Состояние пагинации для ленивой подгрузки */
    this.currentCategoryId = 'all';
    this.currentOffset = 0;
    this.total = 0;
    this.loadingMore = false;
    this._scrollListenerBound = null;
    this._scrollListenerAttached = false;
    this.render();
    this.loadMessages();
    this.reminderService?.init();
  }

  /**
   * Инициализирует и подключает все компоненты приложения: уведомления, менеджер сообщений,
   * список сообщений, сайдбар, поиск и панель ввода.
   */
  render() {
    // Инициализируем компоненты
    this.notification = new Notification();
    this.messagesManager = new MessagesManager();
    this.reminderService = new ReminderService(ApiService, this.notification);
    this.messageComponent = new MessageComponent(this.notification, this.messagesManager);
    this.settings = new Settings(this.notification);
    this.sidebar = new Sidebar(this.notification, this.messagesManager, {
      onCategorySelect: (categoryId) => this.loadMessagesByCategory(categoryId),
      onExport: () => this.exportHistory(),
      onImport: () => this.importHistory(),
      onSettings: () => this.settings.open(),
    });
    this.searchBar = new SearchBar(
      this.notification, this.messagesManager, this.messageComponent
    );
    this.inputPanel = new InputPanel(
      this.notification, this.messagesManager, this.messageComponent, this.reminderService
    );

    this.wsService = new WebSocketService(__API_URL__, {
      onNewMessage: () => this.loadMessages(),
      onMessageDeleted: () => this.loadMessages(),
      onMessageUpdated: () => this.loadMessages(),
    });
    this.wsService.connect();
  }

  /**
   * Загружает сообщения по выбранной категории сайдбара и отображает их (первая страница).
   * @param {string} categoryId - all | images | videos | audio | files | favorites
   */
  async loadMessagesByCategory(categoryId) {
    try {
      this.currentCategoryId = categoryId;
      this.currentOffset = 0;
      this.total = 0;
      const { messages, total, fromCache } = await this.messagesManager.getMessagesByCategory(categoryId, PAGE_SIZE, 0);
      this.currentOffset = messages.length;
      this.total = total;
      this.messageComponent.renderMessages(messages);
      this.attachScrollListener();
      if (fromCache) {
        this.notification.info('Офлайн', 'Показаны сохранённые сообщения.');
      }
    } catch (error) {
      console.error('Ошибка загрузки по категории:', error);
      this.notification.warning('Не удалось загрузить сообщения', error?.message || 'Попробуйте снова.');
    }
  }

  /**
   * Загружает последние сообщения с сервера и отображает их в списке (первая страница).
   * Обновляет счётчики в сайдбаре. При ошибке показывает предупреждение и использует локальные данные.
   * @returns {Promise<void>}
   */
  async loadMessages() {
    try {
      this.currentCategoryId = 'all';
      this.currentOffset = 0;
      this.total = 0;
      const { messages, total, fromCache } = await this.messagesManager.getMessages(PAGE_SIZE, 0);
      this.currentOffset = messages.length;
      this.total = total;
      this.messageComponent.renderMessages(messages);
      this.sidebar.updateSidebarCounts(messages, {
        total, categoryId: 'all'
      });
      this.attachScrollListener();
      if (fromCache) {
        this.notification.info('Офлайн', 'Показаны сохранённые сообщения.');
      }
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
      const detail = error && error.message ? error.message : 'Используются локальные данные.';
      this.notification.warning('Не удалось загрузить сообщения', detail);
    }
  }

  /**
   * Вешает обработчик скролла на контейнер сообщений для ленивой подгрузки (один раз).
   */
  attachScrollListener() {
    if (!this.messageComponent?.messagesContainer || this._scrollListenerAttached) return;
    this._scrollListenerBound = () => this.onMessagesScroll();
    this.messageComponent.messagesContainer.addEventListener('scroll', this._scrollListenerBound, { passive: true });
    this._scrollListenerAttached = true;
  }

  /**
   * Вызывается при скролле контейнера сообщений; подгружает следующую страницу при приближении к верху.
   */
  onMessagesScroll() {
    const container = this.messageComponent?.messagesContainer;
    if (!container || this.loadingMore || this.currentOffset >= this.total) return;
    if (container.scrollTop <= SCROLL_LOAD_THRESHOLD) {
      this.loadMoreMessages();
    }
  }

  /**
   * Подгружает следующую порцию старых сообщений и вставляет её сверху списка.
   */
  async loadMoreMessages() {
    if (this.loadingMore || this.currentOffset >= this.total) return;
    this.loadingMore = true;
    try {
      const { messages, total } = await this.messagesManager.getMessagesByCategory(
        this.currentCategoryId,
        PAGE_SIZE,
        this.currentOffset
      );
      this.total = total;
      if (messages.length > 0) {
        this.messageComponent.prependMessages(messages);
        this.currentOffset += messages.length;
      }
    } catch (error) {
      console.error('Ошибка подгрузки сообщений:', error);
      this.notification.warning('Не удалось подгрузить сообщения', error?.message || 'Попробуйте снова.');
    } finally {
      this.loadingMore = false;
    }
  }

  /**
   * Экспорт истории чата: скачивает JSON-архив с сервера и сохраняет как файл.
   */
  async exportHistory() {
    try {
      const blob = await this.messagesManager.exportHistory();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chaos-organizer-backup.json';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.notification.success('Экспорт', 'История чата сохранена в файл.');
    } catch (error) {
      console.error('Экспорт истории:', error);
      this.notification.warning('Экспорт', error?.message || 'Не удалось скачать архив.');
    }
  }

  /**
   * Импорт истории чата: открывает выбор файла, отправляет его на сервер и обновляет список.
   */
  importHistory() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await this.messagesManager.importHistory(file);
        await this.loadMessages();
        this.notification.success('Импорт', 'История чата восстановлена.');
      } catch (error) {
        console.error('Импорт истории:', error);
        this.notification.warning('Импорт', error?.message || 'Не удалось загрузить архив.');
      } finally {
        input.remove();
      }
    });
    document.body.appendChild(input);
    input.click();
  }
}