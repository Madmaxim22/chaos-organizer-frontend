import './Message.css';
import './MessageAttachments.css';
import { formatBytes } from '@/utils/format.js';
import { escapeHTML } from '@/utils/html.js';
import { messageHTML as renderMessageHTML, renderFormattedText } from './MessageTemplates.js';
import { decryptText, decryptFile } from '@/services/EncryptionService.js';
import { showPasswordModal } from '@/utils/passwordModal.js';
import PinnedMessageHandler from './PinnedMessageHandler.js';
import MessageTextExpand from './MessageTextExpand.js';
import DecryptedPreviewLoader from './DecryptedPreviewLoader.js';
import MessageActionsHandler from './MessageActionsHandler.js';
import { PinUrl, PinnedUrl } from '@/assets/icons.js';

/**
 * Компонент сообщения: оркестрация списка, подгрузка, pin/favorite/delete, вызов шаблонов.
 */
export default class MessageComponent {
  /**
   * @param {Object} notification - Компонент уведомлений
   * @param {Object} messagesManager - Менеджер сообщений
   */
  constructor(notification, messagesManager) {
    this.baseUrl = __API_URL__;
    this.formatters = {
      escapeHTML,
      formatBytes: (bytes) => formatBytes(bytes, { locale: 'ru' }),
    };

    this.messagesContainer = document.querySelector('.messages-container');
    this.listMessage = this.messagesContainer.querySelector('.list-message');
    this.pinnedMessageContainer = this.messagesContainer.querySelector('.pinned-message');

    this.messagesManager = messagesManager;
    this.notification = notification;
    /** Кэш расшифрованного текста по id сообщения (сессия). */
    this.decryptedMessageContent = new Map();
    /** Кэш пароля по id сообщения для скачивания вложений. */
    this.decryptedPasswords = new Map();
    /** Object URL превью расшифрованных вложений (для отзыва при перерисовке). messageId -> [{ url }] */
    this.decryptedAttachmentUrls = new Map();

    this.pinnedHandler = new PinnedMessageHandler(this);
    this.textExpand = new MessageTextExpand();
    this.decryptedPreviews = new DecryptedPreviewLoader(this);
    this.actionsHandler = new MessageActionsHandler(this);
  }

  /**
   * Отрисовывает полный список сообщений (в обратном порядке), обновляет закреплённое и привязывает события.
   * @param {Object[]} messages - массив сообщений (MessageReceiveModel или plain object)
   */
  renderMessages(messages) {
    this.decryptedPreviews.revokeDecryptedAttachmentUrls();
    this.listMessage.innerHTML = '';
    this.pinnedHandler.clearPinnedMessage();

    // Обращаем порядок сообщений
    const reversedMessages = [ ...messages ].reverse();

    reversedMessages.forEach(msg => {
      const msgWithDecrypted = {
        ...msg, _decryptedContent: msg.encrypted ? this.decryptedMessageContent.get(String(msg.id)) : undefined
      };
      const htmlString = renderMessageHTML(msgWithDecrypted, this.baseUrl, this.formatters);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString.trim();
      const messageEl = tempDiv.firstChild;
      if (msg.pinned) this.pinnedHandler.updatePinnedMessage(msg);
      this.listMessage.append(messageEl);
      this.bindMessageEvents(messageEl, msg);
      if (msg.encrypted && this.decryptedMessageContent.has(String(msg.id)) && msg.metadata?.length) {
        const pwd = this.decryptedPasswords.get(String(msg.id));
        if (pwd) this.decryptedPreviews.loadDecryptedAttachmentPreviews(messageEl, msg, pwd);
      }
    });

    this.scrollToBottom();
  }

  /**
   * Добавляет одно сообщение в конец списка и прокручивает к нему.
   * @param {Object} message - сообщение (MessageReceiveModel или plain object)
   */
  renderMessage(message) {
    const decrypted = message.encrypted ? this.decryptedMessageContent.get(String(message.id)) : undefined;
    const msgWithDecrypted = {
      ...message, _decryptedContent: decrypted
    };
    const htmlString = renderMessageHTML(msgWithDecrypted, this.baseUrl, this.formatters);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString.trim();
    const messageEl = tempDiv.firstChild;
    this.listMessage.append(messageEl);
    this.bindMessageEvents(messageEl, message);
    this.scrollToBottom();
  }

  /**
   * Вставляет старые сообщения в начало списка (для ленивой подгрузки) и сохраняет позицию скролла.
   * API отдаёт сообщения «новые первые»; для вставки сверху порядок переворачиваем (старые первые).
   * @param {Object[]} messages - массив сообщений (MessageReceiveModel или plain object)
   */
  prependMessages(messages) {
    if (!messages?.length || !this.listMessage || !this.messagesContainer) return;
    const container = this.messagesContainer;
    const oldScrollHeight = container.scrollHeight;
    const oldScrollTop = container.scrollTop;

    const reversedMessages = [ ...messages ].reverse();
    for (const msg of reversedMessages) {
      const msgWithDecrypted = {
        ...msg, _decryptedContent: msg.encrypted ? this.decryptedMessageContent.get(String(msg.id)) : undefined
      };
      const htmlString = renderMessageHTML(msgWithDecrypted, this.baseUrl, this.formatters);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString.trim();
      const messageEl = tempDiv.firstChild;
      if (msg.pinned) this.pinnedHandler.updatePinnedMessage(msg);
      this.listMessage.insertBefore(messageEl, this.listMessage.firstChild);
      this.bindMessageEvents(messageEl, msg);
      if (msg.encrypted && this.decryptedMessageContent.has(String(msg.id)) && msg.metadata?.length) {
        const pwd = this.decryptedPasswords.get(String(msg.id));
        if (pwd) this.decryptedPreviews.loadDecryptedAttachmentPreviews(messageEl, msg, pwd);
      }
    }

    const heightAdded = container.scrollHeight - oldScrollHeight;
    container.scrollTop = oldScrollTop + heightAdded;
  }

  /** Очищает блок закреплённого сообщения и скрывает его. */
  clearPinnedMessage() {
    this.pinnedHandler.clearPinnedMessage();
  }

  /**
   * Обновляет блок закреплённого сообщения (автор, время, текст).
   * @param {Object} message - сообщение с id, author, content, encrypted, getFormattedDate/timestamp
   */
  updatePinnedMessage(message) {
    this.pinnedHandler.updatePinnedMessage(message);
  }

  /** Расшифровка закреплённого сообщения по паролю и обновление блока pinned. */
  handlePinnedDecrypt() {
    this.pinnedHandler.handlePinnedDecrypt();
  }

  /** Прокручивает список к закреплённому сообщению по data-pinned-id. */
  scrollToPinnedMessage() {
    this.pinnedHandler.scrollToPinnedMessage();
  }

  /** Прокручивает список к сообщению по id. */
  scrollToMessage(id) {
    if (id == null) return;
    const messageEl = this.listMessage.querySelector(`.message[data-id="${id}"]`);
    if (messageEl) {
      messageEl.scrollIntoView({
        behavior: 'smooth', block: 'center'
      });
    }
  }

  /**
   * Привязывает обработчики к элементу сообщения: кнопка «Показать полностью»/«Свернуть» и делегирование действий.
   * @param {HTMLElement} messageEl - DOM-элемент сообщения
   * @param {Object} message - данные сообщения (id и др.)
   */
  bindMessageEvents(messageEl, message) {
    const toggleBtn = messageEl.querySelector('.text-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const textEl = messageEl.querySelector('.message-text');
        if (textEl?.classList.contains('expanded')) {
          this.textExpand.collapseMessageText(messageEl, message.id, this.messagesContainer);
        } else {
          this.textExpand.expandMessageText(messageEl, message.id, this.messagesContainer);
        }
      });
    }
    this.actionsHandler.setupEventDelegation(messageEl, message);
  }

  /**
   * Запрашивает пароль, расшифровывает текст сообщения и подставляет его в DOM; кэширует пароль;
   * подгружает превью вложений (скачивает, расшифровывает, подставляет img/video/audio).
   * @param {HTMLElement} messageEl - элемент сообщения
   * @param {Object} message - данные сообщения (id, content, encrypted, metadata)
   */
  async handleDecryptMessage(messageEl, message) {
    let password = this.decryptedPasswords.get(String(message.id));
    if (!password) {
      password = await showPasswordModal('Введите пароль для расшифровки');
      if (!password) return;
    }
    try {
      const decrypted = decryptText(message.content, password);
      this.decryptedMessageContent.set(String(message.id), decrypted);
      this.decryptedPasswords.set(String(message.id), password);
      const bodyEl = messageEl.querySelector('.message-body');
      if (bodyEl) {
        const newBodyHTML = renderFormattedText(decrypted, message.id, this.formatters);
        bodyEl.innerHTML = newBodyHTML;
        messageEl.classList.remove('message-encrypted');
      }
      if (message.metadata?.length) {
        await this.decryptedPreviews.loadDecryptedAttachmentPreviews(messageEl, message, password);
      }
    } catch (err) {
      this.notification.error('Ошибка', 'Неверный пароль');
    }
  }

  /**
   * Переключает закрепление сообщения на сервере и обновляет UI (блок закреплённого и классы в списке).
   * @param {string|number} id - id сообщения
   * @param {boolean} pinned - закрепить (true) или открепить (false)
   * @param {Object} [messageForUI] - данные для отображения закреплённого, если API не вернул полный объект
   */
  async togglePin(id, pinned, messageForUI = null) {
    try {
      const oldPinnedId = this.pinnedMessageContainer.dataset.pinnedId || null;
      const updatedMessage = await this.messagesManager.pinMessage(id, pinned);
      this.notification.info('Сообщение', pinned ? 'Закреплено' : 'Откреплено');

      // Обновляем UI: только одно закреплённое — при закреплении нового старое снимаем в списке
      if (pinned) {
        if (oldPinnedId && oldPinnedId !== String(id)) {
          const oldEl = this.listMessage.querySelector(`.message[data-id="${oldPinnedId}"]`);
          if (oldEl) {
            oldEl.classList.remove('pinned');
            const pinBtn = oldEl.querySelector('.pin-btn');
            if (pinBtn) {
              pinBtn.title = 'Закрепить';
              pinBtn.setAttribute('aria-label', 'Закрепить сообщение');
              pinBtn.innerHTML = `<img src="${PinUrl}" alt="" aria-hidden="true" class="action-icon pin-icon">`;
            }
          }
        }
        const messageToShow = (updatedMessage && updatedMessage.id != null) ? updatedMessage : messageForUI;
        if (messageToShow) this.updatePinnedMessage(messageToShow);
        const newEl = this.listMessage.querySelector(`.message[data-id="${id}"]`);
        if (newEl) {
          newEl.classList.add('pinned');
          const pinBtn = newEl.querySelector('.pin-btn');
          if (pinBtn) {
            pinBtn.title = 'Открепить';
            pinBtn.setAttribute('aria-label', 'Открепить сообщение');
            pinBtn.innerHTML = `<img src="${PinnedUrl}" alt="" aria-hidden="true" class="action-icon pin-icon">`;
          }
        }
      } else if (!pinned && oldPinnedId === String(id)) {
        this.clearPinnedMessage();
        const el = this.listMessage.querySelector(`.message[data-id="${id}"]`);
        if (el) {
          el.classList.remove('pinned');
          const pinBtn = el.querySelector('.pin-btn');
          if (pinBtn) {
            pinBtn.title = 'Закрепить';
            pinBtn.setAttribute('aria-label', 'Закрепить сообщение');
            pinBtn.innerHTML = `<img src="${PinUrl}" alt="" aria-hidden="true" class="action-icon pin-icon">`;
          }
        }
      }
    } catch (error) {
      console.error('Ошибка закрепления сообщения:', error);
      this.notification.error('Ошибка закрепления', 'Не удалось изменить статус закрепления на сервере.');
    }
  }

  /**
   * Добавляет или убирает сообщение из избранного на сервере и обновляет класс/иконку в списке.
   * @param {string|number} id - id сообщения
   * @param {boolean} favorited - в избранное (true) или убрать (false)
   */
  async toggleFavorite(id, favorited) {
    try {
      await this.messagesManager.favoriteMessage(id, favorited);
      this.notification.info('Сообщение', favorited ? 'Добавлено в избранное' : 'Удалено из избранного');
      // Обновляем отображение избранного без перерисовки всего списка
      const messageEl = this.listMessage?.querySelector(`.message[data-id="${id}"]`);
      if (messageEl) {
        messageEl.classList.toggle('favorited', favorited);
        const favoriteIcon = messageEl.querySelector('.favorite-btn .star .favorite-icon');
        const btn = messageEl.querySelector('.favorite-btn');
        if (favoriteIcon) favoriteIcon.classList.toggle('is-filled', favorited);
        if (btn) {
          btn.title = favorited ? 'Убрать из избранного' : 'В избранное';
          btn.setAttribute('aria-label', favorited ? 'Убрать из избранного' : 'Добавить в избранное');
        }
      }
    } catch (error) {
      console.error('Ошибка добавления в избранное:', error);
      this.notification.error('Ошибка избранного', 'Не удалось изменить статус избранного на сервере.');
    }
  }

  /**
   * Удаляет сообщение из DOM без запроса к серверу (для синхронизации по WebSocket).
   * @param {string|number} id - id сообщения
   */
  removeMessageFromList(id) {
    const messageEl = this.listMessage?.querySelector(`.message[data-id="${id}"]`);
    if (messageEl) messageEl.remove();
    if (this.pinnedMessageContainer?.dataset?.pinnedId === String(id)) {
      this.pinnedHandler.clearPinnedMessage();
    }
  }

  /**
   * Обновляет одно сообщение в списке (для синхронизации по WebSocket: pin/favorite и т.д.).
   * @param {Object} message - полное сообщение с сервера
   */
  updateMessageInList(message) {
    const messageEl = this.listMessage?.querySelector(`.message[data-id="${message.id}"]`);
    if (!messageEl) return;
    const decrypted = message.encrypted ? this.decryptedMessageContent.get(String(message.id)) : undefined;
    const msgWithDecrypted = {
      ...message, _decryptedContent: decrypted
    };
    const htmlString = renderMessageHTML(msgWithDecrypted, this.baseUrl, this.formatters);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString.trim();
    const newEl = tempDiv.firstChild;
    messageEl.replaceWith(newEl);
    this.bindMessageEvents(newEl, message);
    if (message.pinned) this.pinnedHandler.updatePinnedMessage(message);
  }

  /** Удаляет сообщение на сервере и удаляет его элемент из DOM. */
  async deleteMessage(id) {
    try {
      await this.messagesManager.deleteMessage(id);
      this.notification.warning('Сообщение удалено', 'Сообщение было удалено из истории.');
      this.removeMessageFromList(id);
    } catch (error) {
      console.error('Ошибка удаления сообщения:', error);
      this.notification.error('Ошибка удаления', 'Не удалось удалить сообщение на сервере.');
    }
  }

  /**
   * Скачивает все вложения сообщения. Для обычных — ZIP через API; для зашифрованных — по одному файлу с расшифровкой.
   * @param {Object} message - сообщение с id и metadata
   * @param {HTMLElement} [downloadBtn] - кнопка «Скачать всё» для отображения прогресса
   */
  async downloadMessageAttachments(message, downloadBtn) {
    const originalLabel = downloadBtn ? downloadBtn.innerHTML : null;
    const originalTitle = downloadBtn ? downloadBtn.getAttribute('title') : null;
    const setProgress = (percent, text) => {
      if (downloadBtn) {
        downloadBtn.disabled = true;
        const icon = downloadBtn.querySelector('.download-all-icon');
        const shortText = percent != null ? `${percent}%` : (text || '…');
        downloadBtn.title = text || 'Скачивание…';
        if (icon) {
          downloadBtn.innerHTML = icon.outerHTML + ' ' + shortText;
        } else {
          downloadBtn.textContent = shortText;
        }
      }
    };
    const restoreBtn = () => {
      if (downloadBtn && originalLabel !== null) {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = originalLabel;
        if (originalTitle !== null) downloadBtn.setAttribute('title', originalTitle);
        else downloadBtn.removeAttribute('title');
      }
    };
    try {
      if (message.encrypted && message.metadata?.length) {
        let password = this.decryptedPasswords.get(String(message.id));
        if (!password) {
          password = await showPasswordModal('Введите пароль для расшифровки вложений');
          if (!password) return;
          this.decryptedPasswords.set(String(message.id), password);
        }
        const total = message.metadata.length;
        for (let i = 0; i < total; i++) {
          const meta = message.metadata[i];
          setProgress(Math.round(((i + 1) / total) * 100), `Скачивание ${i + 1}/${total}`);
          const file = await this.messagesManager.downloadFile(meta.id);
          try {
            const decrypted = await decryptFile(file.blob, password);
            let name = meta.fileName ?? 'file';
            if (name.endsWith('.enc')) name = name.slice(0, -4);
            const url = URL.createObjectURL(decrypted);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
          } catch (err) {
            this.notification.error('Ошибка', 'Неверный пароль или повреждённый файл');
            restoreBtn();
            return;
          }
        }
        this.notification.success('Вложения скачаны', 'Расшифрованные файлы сохранены.');
      } else {
        setProgress(null);
        const onProgress = (percent) => setProgress(percent, `Скачивание ${percent}%`);
        const { blob, url } = await this.messagesManager.downloadMessageAttachments(message.id, { onProgress });
        const a = document.createElement('a');
        a.href = url;
        a.download = `message-${message.id}-attachments.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        this.notification.success('Архив вложений скачивается', 'Все вложения сообщения начинают скачиваться.');
      }
    } catch (error) {
      console.error('Ошибка при скачивании вложений:', error);
      this.notification.error('Ошибка скачивания', 'Не удалось скачать вложения');
    } finally {
      restoreBtn();
    }
  }

  /**
   * Скачивает один файл по ID. Для зашифрованных сообщений запрашивает пароль и расшифровывает перед скачиванием.
   * @param {string|number} fileId - id файла
   * @param {Object} metadata - метаданные вложения (fileName, fileExtension)
   * @param {HTMLElement} [downloadBtn] - кнопка «Скачать» для отображения прогресса
   * @param {Object} [message] - сообщение (для encrypted: запрос пароля и расшифровка)
   */
  async downloadAttachment(fileId, metadata, downloadBtn, message = null) {
    const originalLabel = downloadBtn ? downloadBtn.innerHTML : null;
    const setProgress = (percent) => {
      if (downloadBtn) {
        downloadBtn.disabled = true;
        const icon = downloadBtn.querySelector('.download-icon');
        const text = percent != null ? `Скачивание ${percent}%` : 'Скачивание…';
        if (icon) {
          downloadBtn.innerHTML = icon.outerHTML + ' ' + text;
        } else {
          downloadBtn.textContent = text;
        }
      }
    };
    const restoreBtn = () => {
      if (downloadBtn && originalLabel !== null) {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = originalLabel;
      }
    };
    try {
      setProgress(null);
      const file = await this.messagesManager.downloadFile(fileId, { onProgress: (percent) => setProgress(percent), });

      let blob = file.blob;
      let filename = metadata?.fileName ?? 'file';
      const hasExtension = filename.includes('.') && filename.lastIndexOf('.') > 0;
      if (!hasExtension && metadata?.fileExtension) {
        filename = `${filename}${metadata.fileExtension}`;
      }

      if (message?.encrypted) {
        let password = this.decryptedPasswords.get(String(message.id));
        if (!password) {
          password = await showPasswordModal('Введите пароль для расшифровки вложения');
          if (!password) {
            restoreBtn();
            return;
          }
          this.decryptedPasswords.set(String(message.id), password);
        }
        try {
          blob = await decryptFile(blob, password);
        } catch (err) {
          this.notification.error('Ошибка', 'Неверный пароль');
          restoreBtn();
          return;
        }
        if (filename.endsWith('.enc')) {
          filename = filename.slice(0, -4);
        }
      }

      const url = message?.encrypted ? URL.createObjectURL(blob) : file.url;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (message?.encrypted) setTimeout(() => URL.revokeObjectURL(url), 100);

      this.notification.success('Файл скачивается', 'Файл начинает скачиваться...');
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error);
      this.notification.error('Ошибка скачивания', 'Не удалось скачать файл');
    } finally {
      restoreBtn();
    }
  }

  /** Прокручивает контейнер сообщений в самый низ. */
  scrollToBottom() {
    this.messagesContainer.scrollTop = this.listMessage.scrollHeight;
  }
}