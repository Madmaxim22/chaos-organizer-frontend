import MessageComponent from '@/components/MessageComponent/MessageComponent.js';
import InputPanel from '@/components/InputPanel/InputPanel.js';
import Sidebar from '@/components/Sidebar/Sidebar.js';
import SearchBar from '@/components/SearchBar/SearchBar.js';
import Notification from '@/components/Notification/Notification.js';
import Settings from '@/components/Settings/Settings.js';
import { MessagesManager } from '@/services/MessagesManager.js';
import ApiService from '@/services/Api.js';
import ReminderService from '@/services/ReminderService.js';
import { WebSocketService } from '@/services/WebSocketService.js';
import { SettingsService } from '@/services/SettingsService.js';
import { LazyMessagesLoader } from '@/services/LazyMessagesLoader.js';
import { ExportImportService } from '@/services/ExportImportService.js';
import { PAGE_SIZE } from '@/constants/pagination.js';

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
    this.exportImportService = new ExportImportService({ messagesManager: this.messagesManager });
    this.lazyLoader = new LazyMessagesLoader({
      fetchPage: (categoryId, limit, offset) =>
        this.messagesManager.getMessagesByCategory(categoryId, limit, offset),
      onPrepend: (messages) => this.messageComponent.prependMessages(messages),
      onError: (err) =>
        this.notification.warning('Не удалось подгрузить сообщения', err?.message || 'Попробуйте снова.'),
    });
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
      onNewMessage: (payload) => {
        if (payload && typeof payload === 'object' && payload.id != null) {
          this.messageComponent.renderMessage(payload);
        } else {
          this.loadMessages();
        }
      },
      onMessageDeleted: (payload) => {
        if (payload && payload.id != null) {
          this.messageComponent.removeMessageFromList(payload.id);
        } else {
          this.loadMessages();
        }
      },
      onMessageUpdated: (payload) => {
        if (payload && typeof payload === 'object' && payload.id != null) {
          this.messageComponent.updateMessageInList(payload);
        } else {
          this.loadMessages();
        }
      },
    });
    this.wsService.connect();
  }

  /**
   * Загружает сообщения по выбранной категории сайдбара и отображает их (первая страница).
   * @param {string} categoryId - all | images | videos | audio | files | favorites
   */
  async loadMessagesByCategory(categoryId) {
    try {
      const { messages, total, fromCache } = await this.messagesManager.getMessagesByCategory(categoryId, PAGE_SIZE, 0);
      this.lazyLoader.setState(categoryId, messages.length, total);
      this.messageComponent.renderMessages(messages);
      this.lazyLoader.attach(this.messageComponent?.messagesContainer);
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
      const { messages, total, fromCache } = await this.messagesManager.getMessages(PAGE_SIZE, 0);
      this.lazyLoader.setState('all', messages.length, total);
      this.messageComponent.renderMessages(messages);
      this.sidebar.updateSidebarCounts(messages, {
        total, categoryId: 'all'
      });
      this.lazyLoader.attach(this.messageComponent?.messagesContainer);
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
   * Экспорт истории чата: скачивает JSON-архив с сервера и сохраняет как файл.
   */
  async exportHistory() {
    try {
      await this.exportImportService.exportHistory();
      this.notification.success('Экспорт', 'История чата сохранена в файл.');
    } catch (error) {
      console.error('Экспорт истории:', error);
      this.notification.warning('Экспорт', error?.message || 'Не удалось скачать архив.');
    }
  }

  /**
   * Импорт истории чата: открывает выбор файла, отправляет его на сервер и обновляет список.
   */
  async importHistory() {
    try {
      const done = await this.exportImportService.importHistory();
      if (!done) return;
      await this.loadMessages();
      this.notification.success('Импорт', 'История чата восстановлена.');
    } catch (error) {
      console.error('Импорт истории:', error);
      this.notification.warning('Импорт', error?.message || 'Не удалось загрузить архив.');
    }
  }
}