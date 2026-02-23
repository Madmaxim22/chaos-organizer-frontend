/**
 * Сервис для отображения панели выбора эмодзи (emoji-picker-element) и вставки выбранного эмодзи в поле ввода.
 */
import 'emoji-picker-element';

export default class EmojiPickerService {
  /**
   * @param {Object} options
   * @param {string|HTMLElement} options.container - контейнер для панели (селектор или элемент)
   * @param {string|HTMLElement} options.targetInput - textarea, куда вставлять эмодзи (селектор или элемент)
   * @param {string|HTMLElement|(string|HTMLElement)[]} [options.triggerButton] - кнопка открытия
   * @param {() => void} [options.onOpen]
   * @param {() => void} [options.onClose]
   */
  constructor(options = {}) {
    this.containerSelector = typeof options.container === 'string' ? options.container : null;
    this.container = typeof options.container === 'object' && options.container ? options.container : null;
    this.targetInputSelector = typeof options.targetInput === 'string' ? options.targetInput : null;
    this.targetInput = typeof options.targetInput === 'object' && options.targetInput ? options.targetInput : null;
    const raw = options.triggerButton;
    this.triggerButtons = Array.isArray(raw) ? raw.filter(Boolean) : (raw ? [ raw ] : []);
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.picker = null;
    this._boundHandleDocumentClick = this._handleDocumentClick.bind(this);
  }

  /**
   * Находит контейнер и поле ввода, создаёт emoji-picker, подписывается на emoji-click.
   */
  init() {
    if (this.containerSelector)
      this.container = document.querySelector(this.containerSelector);
    if (this.targetInputSelector)
      this.targetInput = document.querySelector(this.targetInputSelector);
    this.triggerButtons = this.triggerButtons.map((t) =>
      typeof t === 'string' ? document.querySelector(t) : t
    ).filter(Boolean);
    if (!this.container || !this.targetInput) return;

    this.picker = document.createElement('emoji-picker');
    this.picker.classList.add('light');
    this.container.append(this.picker);

    this.picker.addEventListener('emoji-click', (e) => {
      const unicode = e.detail?.unicode;
      if (unicode) {
        this._insertAtCursor(unicode);
      }
    });

    document.addEventListener('click', this._boundHandleDocumentClick);
  }

  /**
   * Вставляет строку в позицию курсора в targetInput и триггерит input.
   * @param {string} text
   */
  _insertAtCursor(text) {
    const el = this.targetInput;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    const before = value.substring(0, start);
    const after = value.substring(end);
    el.value = before + text + after;
    const newPos = start + text.length;
    el.selectionStart = el.selectionEnd = newPos;
    el.focus();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Закрывает панель при клике вне контейнера и не по кнопке открытия.
   * @param {MouseEvent} e
   */
  _handleDocumentClick(e) {
    if (!this.container || !this.container.classList.contains('is-open')) return;
    const clickedTrigger = this.triggerButtons.some((btn) => btn && btn.contains(e.target));
    if (!this.container.contains(e.target) && !clickedTrigger) {
      this.close();
    }
  }

  open() {
    if (!this.container) return;
    this.container.classList.add('is-open');
    this.container.setAttribute('aria-hidden', 'false');
    this.onOpen?.();
  }

  close() {
    if (!this.container) return;
    this.container.classList.remove('is-open');
    this.container.setAttribute('aria-hidden', 'true');
    this.onClose?.();
  }

  toggle() {
    if (!this.container) return;
    const isVisible = this.container.classList.contains('is-open');
    if (isVisible) {
      this.close();
    } else {
      this.open();
    }
  }
}
