/**
 * Клиент WebSocket для получения в реальном времени событий от сервера:
 * new_message, message_updated, message_deleted.
 * Автоматически переподключается при обрыве связи.
 */
export class WebSocketService {
  /**
   * @param {string} baseUrl - базовый URL API (например http://localhost:3000)
   * @param {Object} [callbacks] - onNewMessage, onMessageDeleted, onMessageUpdated
   */
  constructor(baseUrl, callbacks = {}) {
    this.baseUrl = baseUrl;
    this.callbacks = callbacks;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.reconnectTimer = null;
  }

  get wsUrl() {
    const url = this.baseUrl.replace(/^http/, 'ws');
    return `${url.endsWith('/') ? url.slice(0, -1) : url}/ws`;
  }

  isRenderHost() {
    return /onrender\.com/i.test(this.baseUrl || '');
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    const doConnect = () => this.doConnect();
    if (this.isRenderHost() && this.reconnectAttempts === 0) {
      const base = this.baseUrl.replace(/\/$/, '');
      fetch(`${base}/api/messages?limit=1`).catch(() => {}).finally(() => {
        setTimeout(doConnect, 2500);
      });
      return;
    }
    doConnect();
  }

  doConnect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        console.log('WebSocket: подключено к серверу');
      };
      this.ws.onmessage = (event) => {
        try {
          const { event: eventType, payload } = JSON.parse(event.data);
          if (eventType === 'new_message' && typeof this.callbacks.onNewMessage === 'function') {
            this.callbacks.onNewMessage(payload);
          } else if (eventType === 'message_deleted' && typeof this.callbacks.onMessageDeleted === 'function') {
            this.callbacks.onMessageDeleted(payload);
          } else if (eventType === 'message_updated' && typeof this.callbacks.onMessageUpdated === 'function') {
            this.callbacks.onMessageUpdated(payload);
          }
        } catch (err) {
          console.warn('WebSocket: не удалось разобрать сообщение', err);
        }
      };
      this.ws.onclose = (ev) => {
        // #region agent log
        const logPayload = (hypothesisId) => ({
          sessionId: '1086c4',
          location: 'WebSocketService.js:onclose',
          message: 'WS closed',
          data: {
            code: ev.code, reason: ev.reason, wasClean: ev.wasClean
          },
          timestamp: Date.now(),
          hypothesisId,
        });
        fetch('http://127.0.0.1:7354/ingest/4b02a71a-0f83-4f29-a927-057527a9c97e', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', 'X-Debug-Session-Id': '1086c4'
          },
          body: JSON.stringify(logPayload('H2')),
        }).catch(() => {});
        fetch('http://127.0.0.1:7354/ingest/4b02a71a-0f83-4f29-a927-057527a9c97e', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', 'X-Debug-Session-Id': '1086c4'
          },
          body: JSON.stringify(logPayload('H3')),
        }).catch(() => {});
        // #endregion
        this.ws = null;
        this.scheduleReconnect();
      };
      this.ws.onerror = (err) => {
        // #region agent log
        fetch('http://127.0.0.1:7354/ingest/4b02a71a-0f83-4f29-a927-057527a9c97e', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', 'X-Debug-Session-Id': '1086c4'
          },
          body: JSON.stringify({
            sessionId: '1086c4',
            location: 'WebSocketService.js:onerror',
            message: 'WS error',
            data: {},
            timestamp: Date.now(),
            hypothesisId: 'H5',
          }),
        }).catch(() => {});
        // #endregion
        console.warn('WebSocket error:', err);
      };
    } catch (err) {
      console.warn('WebSocket: ошибка подключения', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('WebSocket: достигнут лимит переподключений');
      return;
    }
    this.reconnectAttempts += 1;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`WebSocket: переподключение через ${delay} мс (попытка ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
  }
}
