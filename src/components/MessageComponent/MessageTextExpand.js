/**
 * Развёртка и свёртка длинного текста сообщения с компенсацией скролла.
 */
export default class MessageTextExpand {
  /**
   * Разворачивает длинный текст сообщения (показывает полностью), компенсируя скролл вверх.
   * @param {HTMLElement} messageEl - элемент сообщения
   * @param {string|number} messageId - id сообщения
   * @param {HTMLElement} messagesContainer - контейнер списка сообщений
   */
  expandMessageText(messageEl, messageId, messagesContainer) {
    const messageBody = messageEl.querySelector('.message-body');
    const messageTextEl = messageEl.querySelector('.message-text');
    const toggleBtn = messageBody?.querySelector('.text-toggle-btn');
    if (!messageTextEl) return;

    const container = messagesContainer;
    const heightBefore = messageEl.offsetHeight;
    const scrollBefore = container.scrollTop;

    const fullText = messageTextEl.getAttribute('data-full-text');
    if (fullText) {
      messageTextEl.innerHTML = fullText;
      messageTextEl.classList.remove('truncated');
      messageTextEl.classList.add('expanded');
      if (toggleBtn) {
        toggleBtn.textContent = 'Свернуть';
        toggleBtn.setAttribute('aria-label', 'Свернуть текст');
      }
    }

    const heightAfter = messageEl.offsetHeight;
    container.scrollTop = scrollBefore + (heightAfter - heightBefore);
  }

  /**
   * Сворачивает длинный текст сообщения (обрезка до 500 символов), сохраняя визуальную позицию.
   * @param {HTMLElement} messageEl - элемент сообщения
   * @param {string|number} messageId - id сообщения
   * @param {HTMLElement} messagesContainer - контейнер списка сообщений
   */
  collapseMessageText(messageEl, messageId, messagesContainer) {
    const messageBody = messageEl.querySelector('.message-body');
    const messageTextEl = messageEl.querySelector('.message-text');
    const toggleBtn = messageBody?.querySelector('.text-toggle-btn');
    if (!messageTextEl) return;

    const container = messagesContainer;
    const heightBefore = messageEl.offsetHeight;
    const scrollBefore = container.scrollTop;

    const fullText = messageTextEl.getAttribute('data-full-text');
    if (fullText) {
      const truncatedText = fullText.length > 500 ? fullText.substring(0, 500) + '...' : fullText;
      messageTextEl.innerHTML = truncatedText;
      messageTextEl.classList.add('truncated');
      messageTextEl.classList.remove('expanded');
      if (toggleBtn) {
        toggleBtn.textContent = 'Показать полностью';
        toggleBtn.setAttribute('aria-label', 'Показать полный текст');
      }
    }

    const heightAfter = messageEl.offsetHeight;
    container.scrollTop = scrollBefore + (heightAfter - heightBefore);
  }
}
