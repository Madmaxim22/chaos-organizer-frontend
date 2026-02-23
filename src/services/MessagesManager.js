/**
 * Менеджер сообщений для работы с API сообщений
 * Инкапсулирует логику отправки, получения, управления сообщениями
 */
import ApiService from '@/services/Api.js';
import MessageSendModel from '@/model/MessageSendModel.js';
import MessageReceiveModel from '@/model/MessageReceiveModel.js';

export class MessagesManager {
  /**
   * Создаёт менеджер сообщений с указанным API-сервисом.
   * @param {ApiService} [apiService=ApiService] - экземпляр API для запросов
   */
  constructor(apiService = ApiService) {
    this.api = apiService;
  }

  /**
   * Получить список сообщений с пагинацией
   * @param {number} limit - количество сообщений
   * @param {number} offset - смещение (0 = последние сообщения)
   * @returns {Promise<{ messages: MessageReceiveModel[], total: number, fromCache?: boolean }>}
   */
  async getMessages(limit = 10, offset = 0) {
    try {
      const data = await this.api.getMessages(limit, offset);
      const messages = (data.messages ?? []).map(item => new MessageReceiveModel(item));
      const total = data.total ?? messages.length;
      return {
        messages, total, fromCache: data.fromCache
      };
    } catch (error) {
      console.error('MessagesManager.getMessages failed:', error);
      throw error;
    }
  }

  /**
   * Отправить сообщение
   * @param {MessageSendModel|Object} messageData - данные сообщения
   * @param {{ onProgress?: function(number): void }} [options] - опции (onProgress для индикации загрузки 0–100)
   * @returns {Promise<MessageReceiveModel>}
   */
  async sendMessage(messageData, options = {}) {
    try {
      const formData = messageData.toFormData();
      const { onProgress } = options;

      const response = typeof onProgress === 'function'
        ? await this.api.sendMessageWithProgress(formData, onProgress)
        : await this.api.sendMessage(formData);

      if (response && response.botReply != null) {
        return {
          message: new MessageReceiveModel(response.message),
          botReply: new MessageReceiveModel(response.botReply),
        };
      }
      return new MessageReceiveModel(response);
    } catch (error) {
      console.error('MessagesManager.sendMessage failed:', error);
      throw error;
    }
  }

  /**
   * Удалить сообщение
   * @param {string|number} id - идентификатор сообщения
   * @returns {Promise<void>}
   */
  async deleteMessage(id) {
    try {
      await this.api.deleteMessage(id);
    } catch (error) {
      console.error('MessagesManager.deleteMessage failed:', error);
      throw error;
    }
  }

  /**
   * Скачать файл
   * @param {string|number} fileId - идентификатор файла
   * @param {{ onProgress?: function(number): void }} [options] - опции (onProgress 0–100 для индикации скачивания)
   * @returns {Promise<{ blob: Blob, url: string }>}
   */
  async downloadFile(fileId, options = {}) {
    try {
      const { onProgress } = options;
      return typeof onProgress === 'function'
        ? await this.api.downloadFileWithProgress(fileId, onProgress)
        : await this.api.downloadFile(fileId);
    } catch (error) {
      console.error('MessagesManager.downloadFile failed:', error);
      throw error;
    }
  }

  /**
   * Скачать ZIP всех вложений сообщения
   * @param {string|number} messageId - идентификатор сообщения
   * @param {{ onProgress?: function(number): void }} [options] - опции (onProgress 0–100)
   * @returns {Promise<{ blob: Blob, url: string }>}
   */
  async downloadMessageAttachments(messageId, options = {}) {
    try {
      const { onProgress } = options;
      return typeof onProgress === 'function'
        ? await this.api.downloadMessageAttachmentsWithProgress(messageId, onProgress)
        : await this.api.downloadMessageAttachments(messageId);
    } catch (error) {
      console.error('MessagesManager.downloadMessageAttachments failed:', error);
      throw error;
    }
  }

  /**
   * Закрепить/открепить сообщение
   * @param {string|number} id - идентификатор сообщения
   * @param {boolean} pinned - закрепить (true) или открепить (false)
   * @returns {Promise<MessageReceiveModel>}
   */
  async pinMessage(id, pinned = true) {
    try {
      const response = await this.api.pinMessage(id, pinned);
      return new MessageReceiveModel(response);
    } catch (error) {
      console.error('MessagesManager.pinMessage failed:', error);
      throw error;
    }
  }

  /**
   * Добавить/удалить из избранного
   * @param {string|number} id - идентификатор сообщения
   * @param {boolean} favorite - добавить в избранное (true) или удалить (false)
   * @returns {Promise<MessageReceiveModel>}
   */
  async favoriteMessage(id, favorite = true) {
    try {
      const response = await this.api.favoriteMessage(id, favorite);
      return new MessageReceiveModel(response);
    } catch (error) {
      console.error('MessagesManager.favoriteMessage failed:', error);
      throw error;
    }
  }

  /**
   * Поиск сообщений по запросу и фильтрам (в т.ч. по типу: type — строка "text" или "text,image,video").
   * @param {string} query - поисковый запрос
   * @param {Object} [filters={}] - type (один или несколько через запятую), dateFrom, dateTo, favorite
   * @returns {Promise<{ messages: MessageReceiveModel[], total: number }>}
   */
  async searchMessages(query, filters = {}) {
    try {
      const data = await this.api.searchMessages(query, filters);
      const messages = (data.messages || []).map((item) => new MessageReceiveModel(item));
      return {
        messages, total: data.total ?? messages.length
      };
    } catch (error) {
      console.error('MessagesManager.searchMessages failed:', error);
      throw error;
    }
  }

  /**
   * Получить сообщения по категории сайдбара (all, images, videos, audio, files, links, favorites).
   * @param {string} categoryId - id категории
   * @param {number} [limit=50] - макс. количество сообщений
   * @param {number} [offset=0] - смещение (только для categoryId === 'all')
   * @returns {Promise<{ messages: MessageReceiveModel[], total: number }>}
   */
  async getMessagesByCategory(categoryId, limit = 50, offset = 0) {
    if (categoryId === 'all') {
      return this.getMessages(limit, offset);
    }
    if (categoryId === 'favorites') {
      const result = await this.searchMessages('', { favorite: 'true' });
      return {
        messages: result.messages.slice(offset, offset + limit),
        total: result.total,
      };
    }
    const typeMap = {
      images: 'image',
      videos: 'video',
      audio: 'audio',
      files: 'file',
      links: 'link',
    };
    const type = typeMap[categoryId];
    if (!type) {
      return this.getMessages(limit, offset);
    }
    const result = await this.searchMessages('', { type });
    return {
      messages: result.messages.slice(offset, offset + limit),
      total: result.total,
    };
  }

  /**
   * Получить сообщение по ID (если есть отдельный эндпоинт)
   * В текущем API нет, но можно добавить позже.
   * @param {string|number} id
   * @returns {Promise<MessageReceiveModel>}
   */
  async getMessageById(id) {
    // Временная реализация через получение всех сообщений и фильтрацию
    // TODO: добавить метод в ApiService
    const { messages } = await this.getMessages(1000, 0);
    const found = messages.find(msg => msg.id === id);
    if (!found) throw new Error(`Message with id ${id} not found`);
    return found;
  }

  /**
   * Обновить сообщение (если API поддерживает)
   * @param {string|number} id
   * @param {Object} updates
   * @returns {Promise<MessageReceiveModel>}
   */
  async updateMessage(id, updates) {
    // TODO: реализовать, когда API добавит PATCH /api/messages/:id
    throw new Error('Not implemented yet');
  }

  /**
   * Экспорт истории сообщений
   * @returns {Promise<Blob>}
   */
  async exportHistory() {
    try {
      return await this.api.exportHistory();
    } catch (error) {
      console.error('MessagesManager.exportHistory failed:', error);
      throw error;
    }
  }

  /**
   * Импорт истории сообщений
   * @param {File} file - файл импорта
   * @returns {Promise<void>}
   */
  async importHistory(file) {
    try {
      await this.api.importHistory(file);
    } catch (error) {
      console.error('MessagesManager.importHistory failed:', error);
      throw error;
    }
  }
}

// Экспорт синглтона по умолчанию
const messagesManager = new MessagesManager();
export default messagesManager;