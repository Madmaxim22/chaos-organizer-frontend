import { escapeHTML, escapeAttr } from '@/utils/html.js';
import { COMMAND_PALETTE_ITEMS } from '@/constants/commandPalette.js';

/** Формат даты/времени в часовом поясе пользователя (HH:MM DD.MM.YYYY). */
function formatLocalTimeRu(date) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const time = date.toLocaleTimeString('ru-RU', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const dateStr = date.toLocaleDateString('ru-RU', {
    timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric'
  });
  return `${time}, ${dateStr}`;
}

/** Текущие время и дата для шаблона @schedule: (HH:MM DD.MM.YYYY в поясе пользователя). */
function getScheduleNow() {
  const d = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const time = d.toLocaleTimeString('ru-RU', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const dateStr = d.toLocaleDateString('ru-RU', {
    timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric'
  });
  return {
    time, dateStr
  };
}

/**
 * Палитра команд при вводе "@" в поле сообщения.
 */
export default class CommandPalette {
  /**
   * @param {import('./InputPanel.js').default} inputPanel - родительская панель ввода
   * @param {{ commandPaletteEl: HTMLElement, listEl: HTMLElement, messageInput: HTMLTextAreaElement }} options
   */
  constructor(inputPanel, options) {
    this.inputPanel = inputPanel;
    this.commandPalette = options.commandPaletteEl;
    this.commandPaletteList = options.listEl;
    this.messageInput = options.messageInput;
    this.selectedIndex = 0;
  }

  /** @returns {{ prefix: string, atIndex: number } | null} */
  getCommandPrefixAtCursor() {
    const el = this.messageInput;
    const value = el.value;
    const pos = el.selectionStart;
    const textBefore = value.substring(0, pos);
    const lastAt = textBefore.lastIndexOf('@');
    if (lastAt === -1) return null;
    const prefix = textBefore.slice(lastAt + 1);
    return {
      prefix: prefix.toLowerCase(), atIndex: lastAt
    };
  }

  getFilteredCommands() {
    const at = this.getCommandPrefixAtCursor();
    if (!at) return [];
    const { prefix } = at;
    if (!prefix) return [ ...COMMAND_PALETTE_ITEMS ];
    return COMMAND_PALETTE_ITEMS.filter(
      (item) =>
        item.value.toLowerCase().startsWith('@' + prefix) ||
        item.value.toLowerCase().includes(prefix) ||
        item.label.toLowerCase().includes(prefix)
    );
  }

  showCommandPalette() {
    if (!this.commandPalette || !this.commandPaletteList) return;
    const commands = this.getFilteredCommands();
    if (commands.length === 0) {
      this.hideCommandPalette();
      return;
    }
    this.selectedIndex = 0;
    const now = formatLocalTimeRu(new Date());
    const scheduleNow = getScheduleNow();
    this.commandPaletteList.innerHTML = commands
      .map(
        (item, i) => {
          const isSchedule = item.value.startsWith('@schedule:');
          const value = isSchedule
            ? `@schedule: ${scheduleNow.time} ${scheduleNow.dateStr} «Текст напоминания»`
            : item.value;
          const desc = item.value === '@chaos: время' ? now : (item.description || '');
          return `<div class="command-palette-item" data-index="${i}" data-value="${escapeAttr(value)}" role="option">
            <span class="command-palette-value">${escapeHTML(value)}</span>
            <span class="command-palette-desc">${escapeHTML(desc)}</span>
          </div>`;
        }
      )
      .join('');
    this.commandPalette.classList.add('visible');
    this.commandPalette.setAttribute('aria-hidden', 'false');
    this.updateCommandPaletteSelection();
  }

  updateCommandPaletteSelection() {
    if (!this.commandPaletteList) return;
    const items = this.commandPaletteList.querySelectorAll('.command-palette-item');
    items.forEach((el, i) => el.classList.toggle('selected', i === this.selectedIndex));
    const selected = items[this.selectedIndex];
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }

  hideCommandPalette() {
    if (!this.commandPalette) return;
    this.commandPalette.classList.remove('visible');
    this.commandPalette.setAttribute('aria-hidden', 'true');
  }

  /**
   * @param {string} [value] - текст команды; если не передан, берётся текущий выбранный по индексу
   */
  insertCommandFromPalette(value) {
    const at = this.getCommandPrefixAtCursor();
    if (!at) return;
    const el = this.messageInput;
    let command = value ?? this.getFilteredCommands()[this.selectedIndex]?.value;
    if (!command) return;
    if (command.startsWith('@schedule:')) {
      const { time, dateStr } = getScheduleNow();
      command = `@schedule: ${time} ${dateStr} «Текст напоминания»`;
    }
    const before = el.value.substring(0, at.atIndex);
    const after = el.value.substring(el.selectionStart);
    el.value = before + command + after;
    el.selectionStart = el.selectionEnd = before.length + command.length;
    el.focus();
    this.hideCommandPalette();
    this.inputPanel.handleTextareaInput();
  }

  /**
   * @param {KeyboardEvent} e
   * @returns {boolean} true если событие обработано
   */
  handleKeydown(e) {
    if (!this.commandPalette?.classList.contains('visible')) return false;
    const commands = this.getFilteredCommands();
    if (commands.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % commands.length;
      this.updateCommandPaletteSelection();
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + commands.length) % commands.length;
      this.updateCommandPaletteSelection();
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      this.insertCommandFromPalette();
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hideCommandPalette();
      return true;
    }
    return false;
  }

  updateFromInput() {
    const at = this.getCommandPrefixAtCursor();
    if (at) {
      this.showCommandPalette();
    } else {
      this.hideCommandPalette();
    }
  }

  bindEvents() {
    if (!this.commandPaletteList) return;
    this.commandPaletteList.addEventListener('click', (e) => {
      const item = e.target.closest('.command-palette-item');
      if (!item) return;
      const value = item.getAttribute('data-value');
      if (value != null) this.insertCommandFromPalette(value);
    });
  }
}
