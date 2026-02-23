/**
 * Сервис для получения геолокации пользователя через Geolocation API.
 */
export default class LocationService {
  /**
   * Запрашивает текущую позицию пользователя.
   * @param {PositionOptions} [options] - опции: enableHighAccuracy, timeout, maximumAge
   * @returns {Promise<{ latitude: number, longitude: number, accuracy?: number }>}
   */
  getCurrentPosition(options = {}) {
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };
    const opts = {
      ...defaultOptions, ...options
    };

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Геолокация не поддерживается браузером'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          const message = this._errorMessage(error.code);
          reject(new Error(message));
        },
        opts
      );
    });
  }

  /**
   * Формирует ссылку на Яндекс.Карты по координатам.
   * @param {number} latitude
   * @param {number} longitude
   * @returns {string}
   */
  getMapUrl(latitude, longitude) {
    return `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=17`;
  }

  /**
   * Формирует текст сообщения с геолокацией (координаты + ссылка).
   * @param {number} latitude
   * @param {number} longitude
   * @returns {string}
   */
  formatLocationMessage(latitude, longitude) {
    return `📍 Геолокация: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }

  /**
   * Извлекает координаты из текста сообщения с геолокацией.
   * Поддерживает: "📍 Геолокация: lat, lon", "Геолокация: lat, lon", URL yandex (pt=lon,lat), OSM (mlat/mlon).
   * @param {string} content - текст сообщения
   * @returns {{ latitude: number, longitude: number } | null}
   */
  static parseLocationFromContent(content) {
    if (!content || typeof content !== 'string') return null;
    const s = content.trim();
    // "📍 Геолокация: 55.750000, 37.620000" или "Геолокация: 55.75, 37.62" (эмодзи опционален)
    const prefixMatch = s.match(/Геолокация:\s*([-\d.]+)\s*,\s*([-\d.]+)/i);
    if (prefixMatch) {
      const lat = parseFloat(prefixMatch[1]);
      const lon = parseFloat(prefixMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return {
        latitude: lat, longitude: lon
      };
    }
    // URL Яндекс.Карты: pt=lon,lat или pt=lon%2Clat
    const yandexMatch = s.match(/pt=([-\d.]+)[,%2C]([-\d.]+)/);
    if (yandexMatch) {
      const lon = parseFloat(yandexMatch[1]);
      const lat = parseFloat(yandexMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return {
        latitude: lat, longitude: lon
      };
    }
    return null;
  }

  /**
   * URL для статического изображения карты Yandex (требуется API ключ).
   * @param {number} latitude
   * @param {number} longitude
   * @param {string} apiKey - ключ Yandex Static API
   * @param {{ width?: number, height?: number, zoom?: number }} [opts]
   * @returns {string}
   */
  static getYandexStaticMapUrl(latitude, longitude, apiKey, opts = {}) {
    const { width = 320, height = 200, zoom = 16 } = opts;
    const ll = `${longitude},${latitude}`;
    const pt = `${longitude},${latitude}`;
    const params = new URLSearchParams({
      apikey: apiKey,
      ll,
      size: `${width},${height}`,
      z: String(zoom),
      pt: `${pt},pm2rdm`,
    });
    return `https://static-maps.yandex.ru/v1?${params.toString()}`;
  }

  /**
   * @param {number} code - код ошибки GeolocationPositionError
   * @returns {string}
   */
  _errorMessage(code) {
    switch (code) {
    case 1:
      return 'Доступ к геолокации запрещён';
    case 2:
      return 'Не удалось определить местоположение';
    case 3:
      return 'Превышено время ожидания';
    default:
      return 'Ошибка получения геолокации';
    }
  }
}
