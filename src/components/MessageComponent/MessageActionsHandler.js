/**
 * Маршрутизация кликов по кнопкам с data-action в элементе сообщения.
 */
export default class MessageActionsHandler {
  /**
   * @param {import('./MessageComponent.js').default} messageComponent - родительский компонент
   */
  constructor(messageComponent) {
    this.messageComponent = messageComponent;
  }

  /**
   * Настраивает делегирование кликов по кнопкам с data-action: pin, favorite, delete, download, download-all, decrypt.
   * @param {HTMLElement} messageEl - элемент сообщения
   * @param {Object} message - данные сообщения (id, metadata)
   */
  setupEventDelegation(messageEl, message) {
    const mc = this.messageComponent;
    messageEl.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      e.stopPropagation();
      const action = target.getAttribute('data-action');

      switch (action) {
      case 'pin': {
        const msgEl = e.target.closest('.message');
        const isPinned = msgEl?.classList.contains('pinned');
        mc.togglePin(message.id, !isPinned, message);
        break;
      }
      case 'favorite': {
        const msgEl = e.target.closest('.message');
        const isFavorited = msgEl?.classList.contains('favorited');
        mc.toggleFavorite(message.id, !isFavorited);
        break;
      }
      case 'delete':
        mc.deleteMessage(message.id);
        break;
      case 'download': {
        const attachmentId = target.getAttribute('data-id');
        const metadata = message.metadata.find((m) => m.id == attachmentId);
        mc.downloadAttachment(attachmentId, metadata, target, message);
        break;
      }
      case 'download-all':
        if (message.metadata) {
          mc.downloadMessageAttachments(message, target);
        }
        break;
      case 'decrypt':
        mc.handleDecryptMessage(messageEl, message);
        break;
      }
    });
  }
}
