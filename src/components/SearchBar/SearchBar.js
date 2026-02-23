import './SearchBar.css';
import { FILTER_TO_TYPE, TYPE_LABELS } from '../../constants/searchFilters.js';
import { CloseUrl } from '../../assets/icons.js';

/**
 * Панель поиска с фильтрами по типу контента (текст, изображения, видео, аудио, файлы) и общий поиск по всем типам.
 */
export default class SearchBar {
  /**
   * @param {Object} notification - компонент уведомлений
   * @param {MessagesManager} messagesManager - менеджер сообщений (для поиска)
   * @param {Object} [messageComponent] - компонент сообщений (для отображения результатов и прокрутки к сообщению)
   */
  constructor(notification, messagesManager, messageComponent = null) {
    this.filters = {
      text: true,
      link: true,
      images: true,
      videos: true,
      audio: true,
      files: true,
    };
    this.results = [];

    this.messagesManager = messagesManager;
    this.notification = notification;
    this.messageComponent = messageComponent;

    /** Таймер задержки перед отправкой поиска (debounce), мс. */
    this.searchDebounceMs = 350;
    this._searchDebounceTimer = null;

    this.render();
    this.bindEvents();
  }

  /** Находит элементы панели поиска (поле ввода, чекбоксы фильтров, контейнер результатов). */
  render() {
    this.container = document.querySelector('#searchBarContainer');
    this.searchPanel = this.container.querySelector('.search-panel');
    this.searchInputWrap = this.container.querySelector('.search-input-wrap');
    this.searchInput = this.container.querySelector('.search-input');
    this.searchClearBtn = this.container.querySelector('.search-clear-btn');
    this.filterOptions = this.container.querySelector('#filterOptions');
    this.filterCheckboxes = this.container.querySelectorAll('input[name="filter"]');
    this.searchResults = this.container.querySelector('#searchResults');
    if (this.searchClearBtn) {
      this.searchClearBtn.innerHTML = `<img src="${CloseUrl}" alt="" class="search-clear-icon" aria-hidden="true">`;
    }
  }

  /** Привязывает обработчики: ввод в поле поиска (с задержкой), изменение фильтров, фокус/очистка/закрытие. */
  bindEvents() {
    this.searchInput.addEventListener('input', (e) => {
      this.updateClearButtonVisibility();
      this.scheduleSearch(e.target.value);
    });
    this.searchInput.addEventListener('focus', () => {
      this.filterOptions?.classList.add('is-visible');
      this.updateClearButtonVisibility();
    });
    this.searchClearBtn?.addEventListener('click', () => this.clearInput());
    this.filterCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => this.handleFilterChange());
    });
    this.updateClearButtonVisibility();
  }

  /** Показывает кнопку очистки, если есть текст или открыты фильтры (кнопка очищает и закрывает фильтры). */
  updateClearButtonVisibility() {
    const hasText = this.searchInput?.value.trim() !== '';
    const filtersVisible = this.filterOptions?.classList.contains('is-visible');
    this.searchInputWrap?.classList.toggle('has-text', !!hasText || !!filtersVisible);
  }

  /** Очищает поле поиска, закрывает фильтры, очищает и скрывает блок результатов. */
  clearInput() {
    this.searchInput.value = '';
    this.filterOptions?.classList.remove('is-visible');
    this.updateClearButtonVisibility();
    this.results = [];
    if (this.searchResults) {
      this.searchResults.innerHTML = '';
      this.searchResults.style.display = 'none';
    }
    const typeParam = this.getSelectedTypesParam();
    if (typeParam) this.handleSearch('');
  }

  /** Откладывает выполнение поиска; при новом вводе предыдущий таймер сбрасывается. */
  scheduleSearch(query) {
    if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
    const q = query.trim();
    const typeParam = this.getSelectedTypesParam();
    if (q === '' && !typeParam) {
      this.hideResults();
      return;
    }
    this._searchDebounceTimer = setTimeout(() => {
      this._searchDebounceTimer = null;
      this.handleSearch(query);
    }, this.searchDebounceMs);
  }

  /** Собирает параметр type для API: выбранные типы через запятую или пусто (поиск по всем типам). */
  getSelectedTypesParam() {
    const selected = [];
    this.filterCheckboxes.forEach((cb) => {
      if (cb.checked && FILTER_TO_TYPE[cb.value]) selected.push(FILTER_TO_TYPE[cb.value]);
    });
    const total = Array.from(this.filterCheckboxes).filter((c) => FILTER_TO_TYPE[c.value]).length;
    if (selected.length === 0 || selected.length === total) return undefined;
    return selected.join(',');
  }

  /** Выполняет поиск по запросу и выбранным типам через API, отображает результаты или ошибку. */
  handleSearch(query) {
    const q = query.trim();
    const typeParam = this.getSelectedTypesParam();
    if (q === '' && !typeParam) {
      this.hideResults();
      return;
    }
    const filters = {};
    if (typeParam) filters.type = typeParam;
    const sentQuery = q === '' ? undefined : q;

    this.messagesManager.searchMessages(sentQuery, Object.keys(filters).length ? filters : {}).then(({ messages }) => {
      if (this.searchInput.value.trim() !== q) return;
      this.results = messages;
      this.displayResults();
    }).catch((err) => {
      console.error('Search error:', err);
      this.notification?.warning?.('Поиск', 'Не удалось выполнить поиск.');
      this.displayError();
    });
  }

  /** Обновляет this.filters по чекбоксам и повторяет поиск при непустом запросе. */
  handleFilterChange() {
    this.filters = {};
    this.filterCheckboxes.forEach((cb) => {
      this.filters[cb.value] = cb.checked;
    });
    if (this.searchInput.value.trim() !== '') {
      this.handleSearch(this.searchInput.value);
    }
  }

  /** Отрисовывает список результатов; при клике показывает в ленте и прокручивает к сообщению. */
  displayResults() {
    const query = this.searchInput.value.trim();
    if (this.results.length === 0) {
      this.searchResults.innerHTML = '<div class="no-results">Ничего не найдено</div>';
      this.searchResults.style.display = 'block';
      return;
    }
    const typeLabel = (type) => TYPE_LABELS[type] || type || '—';
    this.searchResults.innerHTML = this.results.map((result) => {
      const content = result.content ?? '';
      const safeContent = this.escapeHtml(content.slice(0, 120) + (content.length > 120 ? '…' : ''));
      const highlighted = query ? this.highlightText(safeContent, query) : safeContent;
      const dateStr = result.timestamp ? new Date(result.timestamp).toLocaleString('ru-RU') : '';
      return `
        <div class="result-item" data-id="${result.id}" role="button" tabindex="0">
          <strong>${this.escapeHtml(result.author ?? '')}</strong>
          <div class="result-content">${highlighted}</div>
          <div class="result-meta">${dateStr} • ${typeLabel(result.type)}</div>
        </div>
      `;
    }).join('');
    this.searchResults.style.display = 'block';
    this.searchResults.querySelectorAll('.result-item').forEach((item) => {
      item.addEventListener('click', () => this.onResultSelect(item.getAttribute('data-id')));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.onResultSelect(item.getAttribute('data-id'));
        }
      });
    });
  }

  /** Экранирование HTML для безопасной вставки в разметку. */
  escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** При выборе результата прокручивает ленту к сообщению, не меняя список сообщений. */
  onResultSelect(messageId) {
    if (!this.messageComponent || !messageId) return;
    this.messageComponent.scrollToMessage(messageId);
  }

  /** Подсвечивает вхождения query в text тегом <mark>. */
  highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /** Показывает сообщение «Ошибка при поиске» в контейнере результатов. */
  displayError() {
    const resultsContainer = this.searchResults;
    resultsContainer.innerHTML = '<div class="no-results">Ошибка при поиске</div>';
    resultsContainer.style.display = 'block';
  }

  /** Скрывает блок результатов. */
  hideResults() {
    this.searchResults.style.display = 'none';
  }

  /** Устанавливает результаты и отображает их (для внешнего вызова). */
  setResults(results) {
    this.results = results;
    this.displayResults();
  }

  /** Очищает поле поиска и скрывает результаты. */
  clear() {
    this.searchInput.value = '';
    this.updateClearButtonVisibility();
    this.hideResults();
  }

  /** Открывает поиск: фокус в поле ввода (панель фильтров показывается по :focus-within). */
  open() {
    this.searchInput.focus();
  }

  /** Закрывает поиск: снимает фокус с поля ввода. */
  close() {
    this.searchInput.blur();
  }
}