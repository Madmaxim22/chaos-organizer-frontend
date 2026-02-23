/**
 * Сервис для взаимодействия с бэкендом Chaos Organizer
 * Базовый URL настраивается через .env API_URL
 */
export class ApiService {
  /**
   * Создаёт экземпляр API-сервиса с базовым URL бэкенда.
   */
  constructor() {
    const raw = typeof __API_URL__ !== 'undefined' ? __API_URL__ : 'http://localhost:3000';
    this.baseUrl = raw.replace(/\/$/, '');
  }

  /**
   * Выполняет HTTP-запрос к API. Для FormData не устанавливает Content-Type.
   * @param {string} endpoint - путь запроса (например, /api/messages)
   * @param {RequestInit} [options] - опции fetch (method, body, headers)
   * @returns {Promise<Object>} - JSON-ответ
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    // Определяем, является ли body FormData
    const isFormData = options.body && options.body instanceof FormData;
    const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
    const config = {
      ...options,
      headers: {
        ...defaultHeaders, ...options.headers
      },
    };
    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        const hint = `Не удалось подключиться к серверу (${this.baseUrl}). Убедитесь, что бэкенд запущен.`;
        console.error('API request failed:', hint, error);
        throw new Error(hint);
      }
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Получает список сообщений с пагинацией.
   * Использует fetch напрямую, чтобы при ответе из кеша SW (Workbox) прокинуть флаг fromCache.
   * @param {number} [limit=10] - количество сообщений
   * @param {number} [offset=0] - смещение
   * @returns {Promise<{ messages: Array, total: number, fromCache?: boolean }>}
   */
  async getMessages(limit = 10, offset = 0) {
    const url = `${this.baseUrl}/api/messages?limit=${limit}&offset=${offset}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const fromCache = response.headers.get('X-From-Cache') === '1';
      const data = await response.json();
      return {
        messages: data.messages ?? [],
        total: data.total ?? data.messages?.length ?? 0,
        fromCache,
      };
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        const hint = `Не удалось подключиться к серверу (${this.baseUrl}). Убедитесь, что бэкенд запущен.`;
        console.error('API request failed:', hint, error);
        throw new Error(hint);
      }
      throw error;
    }
  }

  /**
   * Отправляет сообщение (FormData с полями author, content, files и т.д.).
   * @param {FormData} messageData - данные сообщения
   * @returns {Promise<Object>}
   */
  async sendMessage(messageData) {
    return this.request('/api/messages', {
      method: 'POST',
      body: messageData,
    });
  }

  /**
   * Отправляет сообщение с индикацией прогресса загрузки (XHR upload progress).
   * @param {FormData} messageData - данные сообщения (FormData)
   * @param {function(number): void} [onProgress] - колбек прогресса 0–100
   * @returns {Promise<Object>}
   */
  sendMessageWithProgress(messageData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.baseUrl}/api/messages`;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (err) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));

      xhr.open('POST', url);
      xhr.send(messageData);
    });
  }

  /**
   * Удаляет сообщение по ID.
   * @param {string|number} id - идентификатор сообщения
   * @returns {Promise<Object>}
   */
  async deleteMessage(id) {
    return this.request(`/api/messages/${id}`, { method: 'DELETE', });
  }

  /**
   * Закрепляет или открепляет сообщение.
   * @param {string|number} id - идентификатор сообщения
   * @param {boolean} [pinned=true] - закрепить (true) или открепить (false)
   * @returns {Promise<Object>}
   */
  async pinMessage(id, pinned = true) {
    return this.request(`/api/messages/${id}/pin`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned }),
    });
  }

  /**
   * Добавляет сообщение в избранное или убирает из избранного.
   * @param {string|number} id - идентификатор сообщения
   * @param {boolean} [favorite=true] - в избранное (true) или убрать (false)
   * @returns {Promise<Object>}
   */
  async favoriteMessage(id, favorite = true) {
    return this.request(`/api/messages/${id}/favorite`, {
      method: 'PATCH',
      body: JSON.stringify({ favorite }),
    });
  }

  /**
   * Скачивает файл по ID и возвращает blob и object URL.
   * @param {string|number} fileId - идентификатор файла
   * @returns {Promise<{ blob: Blob, url: string }>}
   */
  async downloadFile(fileId) {
    const response = await fetch(`${this.baseUrl}/api/files/${fileId}`);
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return {
      blob, url
    };
  }

  /**
   * Скачивает файл по ID с индикацией прогресса (потоковое чтение по Content-Length).
   * @param {string|number} fileId - идентификатор файла
   * @param {function(number): void} [onProgress] - колбек прогресса 0–100 (если сервер отдал Content-Length)
   * @returns {Promise<{ blob: Blob, url: string }>}
   */
  async downloadFileWithProgress(fileId, onProgress) {
    const response = await fetch(`${this.baseUrl}/api/files/${fileId}`);
    if (!response.ok) throw new Error('Download failed');
    const total = response.headers.get('Content-Length');
    const totalNum = total ? parseInt(total, 10) : 0;
    if (!response.body) throw new Error('No response body');
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (totalNum > 0 && typeof onProgress === 'function') {
        onProgress(Math.min(100, Math.round((loaded / totalNum) * 100)));
      }
    }
    const blob = new Blob(chunks);
    const url = URL.createObjectURL(blob);
    return {
      blob, url
    };
  }

  /**
   * Скачивает ZIP всех вложений сообщения по ID сообщения.
   * @param {string|number} messageId - идентификатор сообщения
   * @returns {Promise<{ blob: Blob, url: string }>}
   */
  async downloadMessageAttachments(messageId) {
    const response = await fetch(`${this.baseUrl}/api/files/messages/${messageId}`);
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return {
      blob, url
    };
  }

  /**
   * Скачивает ZIP вложений сообщения с индикацией прогресса.
   * @param {string|number} messageId - идентификатор сообщения
   * @param {function(number): void} [onProgress] - колбек прогресса 0–100
   * @returns {Promise<{ blob: Blob, url: string }>}
   */
  async downloadMessageAttachmentsWithProgress(messageId, onProgress) {
    const response = await fetch(`${this.baseUrl}/api/files/messages/${messageId}`);
    if (!response.ok) throw new Error('Download failed');
    const total = response.headers.get('Content-Length');
    const totalNum = total ? parseInt(total, 10) : 0;
    if (!response.body) throw new Error('No response body');
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (totalNum > 0 && typeof onProgress === 'function') {
        onProgress(Math.min(100, Math.round((loaded / totalNum) * 100)));
      }
    }
    const blob = new Blob(chunks);
    const url = URL.createObjectURL(blob);
    return {
      blob, url
    };
  }

  /**
   * Поиск/фильтрация сообщений — GET /api/search/messages (q, type, dateFrom, dateTo).
   * @param {string} query - поисковый запрос
   * @param {Object} [filters={}] - type (один или несколько через запятую), dateFrom, dateTo
   * @returns {Promise<{ messages: Array, total: number }>}
   */
  async searchMessages(query, filters = {}) {
    const params = new URLSearchParams();
    if (query != null && query !== '') params.set('q', String(query));
    Object.entries(filters).forEach(([
      key, value
    ]) => {
      if (value != null && value !== '') params.set(key, String(value));
    });
    const queryString = params.toString();
    return this.request(`/api/search/messages${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Создаёт напоминание.
   * @param {Object} reminderData - данные напоминания (text, triggerAt и т.д.)
   * @returns {Promise<Object>}
   */
  async createReminder(reminderData) {
    return this.request('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(reminderData),
    });
  }

  /**
   * Получает список напоминаний.
   * @returns {Promise<Object>}
   */
  async getReminders() {
    return this.request('/api/reminders');
  }

  /**
   * Скачивает экспорт истории сообщений (blob).
   * @returns {Promise<Blob>}
   */
  async exportHistory() {
    const response = await fetch(`${this.baseUrl}/api/export`);
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    return blob;
  }

  /**
   * Импортирует историю из загруженного файла.
   * @param {File} file - файл импорта
   * @returns {Promise<Object>}
   */
  async importHistory(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/api/import', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Устанавливает WebSocket-соединение для получения обновлений в реальном времени.
   * @param {Function} onMessage - колбек при получении сообщения (data) => void
   * @returns {WebSocket}
   */
  connectWebSocket(onMessage) {
    const socket = new WebSocket(`${this.baseUrl.replace('http', 'ws')}/ws`);
    socket.onopen = () => console.log('WebSocket connected');
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    socket.onerror = (error) => console.error('WebSocket error:', error);
    socket.onclose = () => console.log('WebSocket closed');
    return socket;
  }
}

// Экспорт синглтона
export default new ApiService();