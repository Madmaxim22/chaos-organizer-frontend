import { escapeHTML } from '../../utils/html.js';
import { renderFormattedText } from './messageTemplates.js';
import { decryptText } from '../../services/EncryptionService.js';
import { showPasswordModal } from '../../utils/passwordModal.js';
import { LockOffUrl } from '../../assets/icons.js';

/**
 * Обработчик блока закреплённого сообщения: отображение, расшифровка, прокрутка к сообщению.
 */
export default class PinnedMessageHandler {
  /**
   * @param {import('./MessageComponent.js').default} messageComponent - родительский компонент
   */
  constructor(messageComponent) {
    this.messageComponent = messageComponent;
    this._pinnedMessageData = null;
    this.bindClick();
  }

  /** Привязывает клик по контейнеру закреплённого: расшифровка или прокрутка. */
  bindClick() {
    const container = this.messageComponent.pinnedMessageContainer;
    if (!container) return;
    container.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="decrypt"]')) {
        this.handlePinnedDecrypt();
      } else {
        this.scrollToPinnedMessage();
      }
    });
  }

  /** Очищает блок закреплённого сообщения и скрывает его. */
  clearPinnedMessage() {
    const container = this.messageComponent.pinnedMessageContainer;
    container.innerHTML = '';
    delete container.dataset.pinnedId;
    container.removeAttribute('title');
    container.classList.add('hidden');
  }

  /**
   * Обновляет блок закреплённого сообщения (автор, время, текст). Для зашифрованных — заглушка и кнопка.
   * @param {Object} message - сообщение с id, author, content, encrypted, getFormattedDate/timestamp
   */
  updatePinnedMessage(message) {
    if (!message || message.id == null) return;
    this._pinnedMessageData = message;
    const { pinnedMessageContainer, decryptedMessageContent, formatters } = this.messageComponent;
    const timestamp = typeof message.getFormattedDate === 'function'
      ? message.getFormattedDate()
      : (message.timestamp ? new Date(message.timestamp).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : '');
    const decrypted = decryptedMessageContent.get(String(message.id));
    let bodyHTML;
    if (message.encrypted && decrypted == null) {
      bodyHTML = `
        <div class="message-body-encrypted" data-encrypted-placeholder="true">
          <p class="encrypted-placeholder-text">Зашифрованное сообщение</p>
          <button type="button" class="action-button decrypt-btn" data-action="decrypt"
            aria-label="Ввести пароль для расшифровки">
            <img src="${LockOffUrl}" alt="" aria-hidden="true" class="decrypt-btn-icon"> Ввести пароль
          </button>
        </div>`;
    } else {
      const text = message.encrypted && decrypted != null ? decrypted : (message.content ?? '');
      bodyHTML = renderFormattedText(text, message.id, formatters);
    }
    const safeAuthor = escapeHTML(message.author ?? '');

    pinnedMessageContainer.dataset.pinnedId = String(message.id);
    pinnedMessageContainer.title = 'Нажмите, чтобы перейти к сообщению';
    pinnedMessageContainer.innerHTML = `
      <div class="message-pinned">
        <div class="message-header">
          <span class="message-author" id="message-author-pinned-${message.id}">${safeAuthor}</span>
          <span class="message-time" aria-label="Время отправки: ${timestamp}">${timestamp}</span>
        </div>
        <div class="message-body" aria-live="polite">
          ${bodyHTML}
        </div>
      </div>
    `;

    pinnedMessageContainer.classList.remove('hidden');
  }

  /** Расшифровка закреплённого сообщения по паролю и обновление блока pinned. */
  async handlePinnedDecrypt() {
    const message = this._pinnedMessageData;
    if (!message?.encrypted) return;
    const { decryptedPasswords, pinnedMessageContainer, notification, formatters } = this.messageComponent;
    let password = decryptedPasswords.get(String(message.id));
    if (!password) {
      password = await showPasswordModal('Введите пароль для расшифровки');
      if (!password) return;
    }
    try {
      const decrypted = decryptText(message.content, password);
      this.messageComponent.decryptedMessageContent.set(String(message.id), decrypted);
      decryptedPasswords.set(String(message.id), password);
      const bodyEl = pinnedMessageContainer.querySelector('.message-body');
      if (bodyEl) {
        bodyEl.innerHTML = renderFormattedText(decrypted, message.id, formatters);
      }
    } catch (err) {
      notification.error('Ошибка', 'Неверный пароль');
    }
  }

  /** Прокручивает список к закреплённому сообщению по data-pinned-id. */
  scrollToPinnedMessage() {
    const pinnedId = this.messageComponent.pinnedMessageContainer.dataset.pinnedId;
    if (!pinnedId) return;
    this.messageComponent.scrollToMessage(pinnedId);
  }
}
