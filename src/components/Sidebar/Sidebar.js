import './Sidebar.css';
import {
  ImgUrl, VideoUrl, AudioUrl, FileUrl, LinkUrl, FavoriteUrl, MessagesUrl,
  ImportUrl, ExportUrl, SettingUrl,
} from '../../assets/icons.js';

/** Id категорий сайдбара. */
const CATEGORY_IDS = [
  'all', 'images', 'videos', 'audio', 'files', 'links', 'favorites'
];

/** Соответствие type сообщения → id категории (для подсчёта). */
const MESSAGE_TYPE_TO_CATEGORY = {
  image: 'images',
  video: 'videos',
  audio: 'audio',
  file: 'files',
  link: 'links',
};

/**
 * Боковое меню навигации по категориям (все, изображения, видео, аудио, файлы, ссылки, избранное).
 */
export default class Sidebar {
  /**
   * @param {Object} notification - компонент уведомлений
   * @param {MessagesManager} messagesManager - менеджер сообщений
   * @param {Object} [options={}] - колбеки: onCategorySelect(categoryId), onExport(), onImport(), onSettings()
   */
  constructor(notification, messagesManager, options = {}) {
    this.options = {
      onCategorySelect: () => {},
      onExport: () => {},
      onImport: () => {},
      onSettings: () => {},
      ...options,
    };
    this.categories = [
      {
        id: 'all', label: 'Все сообщения', iconUrl: MessagesUrl, count: 0
      },
      {
        id: 'images', label: 'Изображения', iconUrl: ImgUrl, count: 0
      },
      {
        id: 'videos', label: 'Видео', iconUrl: VideoUrl, count: 0
      },
      {
        id: 'audio', label: 'Аудио', iconUrl: AudioUrl, count: 0
      },
      {
        id: 'files', label: 'Другие файлы', iconUrl: FileUrl, count: 0
      },
      {
        id: 'links', label: 'Ссылки', iconUrl: LinkUrl, count: 0
      },
      {
        id: 'favorites', label: 'Избранное', iconUrl: FavoriteUrl, count: 0
      },
    ];
    this.activeCategory = 'all';
    this.messagesManager = messagesManager;
    this.notification = notification;

    this.render();
    this.bindEvents();
  }

  /** Находит элементы сайдбара и обновляет список категорий со счётчиками. */
  render() {
    this.container = document.querySelector('#sidebarContainer');
    if (!this.container) return;

    this.sidebarToggle = this.container.querySelector('#sidebarToggle');
    this.sidebar = this.container.querySelector('#sidebar');
    this.categoryList = this.container.querySelector('#categoryList');
    this.exportBtn = this.container.querySelector('#exportBtn');
    this.importBtn = this.container.querySelector('#importBtn');
    this.settingsBtn = this.container.querySelector('#settingsBtn');

    this.updateRenderCategoryCounts();
    this.injectSidebarIcons();
  }

  /** Подставляет SVG-иконки в кнопки экспорта/импорта и ссылку настройки. */
  injectSidebarIcons() {
    if (this.exportBtn) {
      this.exportBtn.innerHTML = `<img src="${ExportUrl}" alt="" aria-hidden="true"
        class="sidebar-btn-icon"> Экспорт истории`;
    }
    if (this.importBtn) {
      this.importBtn.innerHTML = `<img src="${ImportUrl}" alt="" aria-hidden="true"
        class="sidebar-btn-icon"> Импорт истории`;
    }
    if (this.settingsBtn) {
      this.settingsBtn.innerHTML = `<img src="${SettingUrl}" alt="" aria-hidden="true"
        class="sidebar-btn-icon"> Настройки`;
    }
  }

  /** Привязывает обработчики: переключатель, категории, экспорт, импорт, настройки. */
  bindEvents() {
    this.sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
    this.categoryList?.addEventListener('click', (e) => {
      e.preventDefault();
      const link = e.target.closest('a[data-id]');
      if (!link) return;
      const categoryId = link.getAttribute('data-id');
      this.selectCategory(categoryId);
    });
    this.exportBtn?.addEventListener('click', () => this.options.onExport());
    this.importBtn?.addEventListener('click', () => this.options.onImport());
    this.settingsBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.options.onSettings();
    });
  }

  /** Открывает или закрывает сайдбар (класс open). */
  toggleSidebar() {
    this.sidebar?.classList.toggle('open');
  }

  /**
   * Устанавливает активную категорию, обновляет подсветку и вызывает onCategorySelect.
   * На мобильном закрывает сайдбар после выбора.
   * @param {string} categoryId - id категории (all, images, videos, …)
   */
  selectCategory(categoryId) {
    if (!CATEGORY_IDS.includes(categoryId)) return;
    this.activeCategory = categoryId;

    this.categoryList?.querySelectorAll('a[data-id]').forEach((a) => {
      const isActive = a.getAttribute('data-id') === categoryId;
      a.classList.toggle('active', isActive);
      a.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
    this.options.onCategorySelect(categoryId);

    if (this.isOpen() && window.matchMedia('(max-width: 769px)').matches) {
      this.close();
    }
  }

  /**
   * Подсчитывает по сообщениям количество в каждой категории и обновляет отображение.
   * @param {Object[]} messages - массив сообщений
   * @param {{ total?: number, categoryId?: string }} [options] - total с сервера, categoryId
   */
  updateSidebarCounts(messages, options = {}) {
    const { total, categoryId } = options;
    const counts = this.computeCategoryCounts(messages, total, categoryId);

    this.categories.forEach((cat) => {
      if (counts[cat.id] !== undefined) {
        cat.count = counts[cat.id];
      }
    });
    this.updateRenderCategoryCounts();
  }

  /**
   * Считает количество сообщений по категориям.
   * @param {Object[]} messages
   * @param {number} [total]
   * @param {string} [categoryId]
   * @returns {Record<string, number>}
   */
  computeCategoryCounts(messages, total, categoryId) {
    const list = Array.isArray(messages) ? messages : [];
    const counts = {
      all: total != null && categoryId === 'all' ? total : list.length,
      images: 0,
      videos: 0,
      audio: 0,
      files: 0,
      links: 0,
      favorites: 0,
    };
    list.forEach((m) => {
      const cat = MESSAGE_TYPE_TO_CATEGORY[m.type];
      if (cat) counts[cat]++;
      if (m.favorite) counts.favorites++;
    });
    if (total != null && categoryId && counts[categoryId] !== undefined) {
      counts[categoryId] = total;
    }
    return counts;
  }

  /** Перерисовывает список категорий со счётчиками (количество справа от названия). */
  updateRenderCategoryCounts() {
    if (!this.categoryList) return;
    const safe = (s) => (s == null ? '' : String(s));
    this.categoryList.innerHTML = this.categories
      .map(
        (cat) => {
          const iconContent = cat.iconUrl
            ? `<img src="${cat.iconUrl}" alt="" class="category-icon" aria-hidden="true">`
            : (cat.icon || '');
          return `
      <li>
        <a href="#" data-id="${safe(cat.id)}"
          class="${this.activeCategory === cat.id ? 'active' : ''}"
          aria-current="${this.activeCategory === cat.id ? 'true' : 'false'}">
          <span class="category-label">${iconContent} ${safe(cat.label)}</span>
          <span class="category-count" aria-label="Количество: ${cat.count}">${cat.count}</span>
        </a>
      </li>
    `;
        }
      )
      .join('');
  }

  /** Открывает сайдбар. */
  open() {
    this.sidebar?.classList.add('open');
  }

  /** Закрывает сайдбар. */
  close() {
    this.sidebar?.classList.remove('open');
  }

  /** @returns {boolean} true, если сайдбар открыт */
  isOpen() {
    return this.sidebar?.classList.contains('open') ?? false;
  }
}