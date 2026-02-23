/**
 * Сервис ленивой подгрузки сообщений при скролле вверх.
 * Хранит состояние пагинации и вешает обработчик скролла на контейнер.
 */
import { PAGE_SIZE, SCROLL_LOAD_THRESHOLD } from '@/constants/pagination.js';

/**
 * @typedef {Object} LazyMessagesLoaderOptions
 * @property {number} [pageSize] - размер страницы (по умолчанию PAGE_SIZE)
 * @property {number} [scrollThreshold] - порог в px от верха для подгрузки (по умолчанию SCROLL_LOAD_THRESHOLD)
 * @property {function(string, number, number):
 * Promise<{ messages: *, total: number }>} fetchPage - загрузка страницы (categoryId, limit, offset)
 * @property {function(*): void} onPrepend - вставка сообщений сверху списка
 * @property {function(Error): void} [onError] - колбэк при ошибке подгрузки
 */

export class LazyMessagesLoader {
  /**
   * @param {LazyMessagesLoaderOptions} options
   */
  constructor(options) {
    this.pageSize = options.pageSize ?? PAGE_SIZE;
    this.scrollThreshold = options.scrollThreshold ?? SCROLL_LOAD_THRESHOLD;
    this.fetchPage = options.fetchPage;
    this.onPrepend = options.onPrepend;
    this.onError = options.onError ?? (() => {});

    this.currentCategoryId = 'all';
    this.currentOffset = 0;
    this.total = 0;
    this.loadingMore = false;

    this._container = null;
    this._scrollListenerBound = null;
    this._scrollListenerAttached = false;
  }

  /**
   * Сбрасывает состояние под текущую категорию (после первой загрузки страницы).
   * @param {string} categoryId
   * @param {number} offset - текущий offset после загрузки первой страницы
   * @param {number} total - общее количество
   */
  setState(categoryId, offset, total) {
    this.currentCategoryId = categoryId;
    this.currentOffset = offset;
    this.total = total;
  }

  /**
   * Вешает обработчик скролла на контейнер сообщений (один раз).
   * @param {HTMLElement | null} container - контейнер со скроллом
   */
  attach(container) {
    if (!container || this._scrollListenerAttached) return;
    this._container = container;
    this._scrollListenerBound = () => this._onScroll();
    container.addEventListener('scroll', this._scrollListenerBound, { passive: true });
    this._scrollListenerAttached = true;
  }

  /**
   * Отвязывает обработчик скролла.
   */
  detach() {
    if (this._container && this._scrollListenerBound) {
      this._container.removeEventListener('scroll', this._scrollListenerBound);
      this._scrollListenerAttached = false;
      this._scrollListenerBound = null;
      this._container = null;
    }
  }

  _onScroll() {
    const container = this._container;
    if (!container || this.loadingMore || this.currentOffset >= this.total) return;
    if (container.scrollTop <= this.scrollThreshold) {
      this.loadMore();
    }
  }

  /**
   * Подгружает следующую порцию старых сообщений и вызывает onPrepend.
   * @returns {Promise<boolean>} true если была подгрузка, false если не нужно или ошибка
   */
  async loadMore() {
    if (this.loadingMore || this.currentOffset >= this.total) return false;
    this.loadingMore = true;
    try {
      const { messages, total } = await this.fetchPage(
        this.currentCategoryId,
        this.pageSize,
        this.currentOffset
      );
      this.total = total;
      if (messages.length > 0) {
        this.onPrepend(messages);
        this.currentOffset += messages.length;
      }
      return true;
    } catch (err) {
      this.onError(err);
      return false;
    } finally {
      this.loadingMore = false;
    }
  }
}
