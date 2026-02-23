import { decryptFile } from '../../services/EncryptionService.js';
import { getMimeFromExtension } from '../../utils/mime.js';

/**
 * Загрузка и отображение превью расшифрованных вложений; отзыв object URL при перерисовке.
 */
export default class DecryptedPreviewLoader {
  /**
   * @param {import('./MessageComponent.js').default} messageComponent - родительский компонент
   */
  constructor(messageComponent) {
    this.messageComponent = messageComponent;
  }

  /** Отзывает все object URL из decryptedAttachmentUrls и очищает кэш. */
  revokeDecryptedAttachmentUrls() {
    const decryptedAttachmentUrls = this.messageComponent.decryptedAttachmentUrls;
    for (const arr of decryptedAttachmentUrls.values()) {
      for (const { url } of arr) {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {
          /* ignore */
        }
      }
    }
    decryptedAttachmentUrls.clear();
  }

  /**
   * Для зашифрованного сообщения после ввода пароля: скачивает вложения, расшифровывает и подставляет
   * превью (img/video/audio).
   * @param {HTMLElement} messageEl - DOM сообщения
   * @param {Object} message - сообщение с metadata
   * @param {string} password - пароль
   */
  async loadDecryptedAttachmentPreviews(messageEl, message, password) {
    const { messagesManager, decryptedAttachmentUrls, formatters } = this.messageComponent;
    const urlList = [];
    decryptedAttachmentUrls.set(String(message.id), urlList);
    const { escapeHTML } = formatters;

    for (const meta of message.metadata) {
      const card = messageEl.querySelector(`.attachment-card[data-id="${meta.id}"]`);
      const container = card?.querySelector('.attachment-preview-container');
      if (!container) continue;

      try {
        const file = await messagesManager.downloadFile(meta.id);
        const decryptedBlob = await decryptFile(file.blob, password);
        const mime = (meta.mimeType && !meta.mimeType.includes('octet-stream'))
          ? meta.mimeType
          : getMimeFromExtension(meta.fileName || '');
        const url = URL.createObjectURL(decryptedBlob);
        urlList.push({ url });

        const isImage = mime.startsWith('image/');
        const isVideo = mime.startsWith('video/');
        const isAudio = mime.startsWith('audio/');
        const safeAlt = escapeHTML(meta.fileName || '');

        if (isImage) {
          const img = document.createElement('img');
          img.src = url;
          img.alt = safeAlt;
          img.className = 'attachment-preview';
          img.loading = 'lazy';
          container.innerHTML = '';
          container.appendChild(img);
        } else if (isVideo) {
          const video = document.createElement('video');
          video.controls = true;
          video.className = 'attachment-preview';
          video.setAttribute('aria-label', 'Видео вложение');
          video.preload = 'none';
          const source = document.createElement('source');
          source.src = url;
          source.type = mime;
          video.appendChild(source);
          container.innerHTML = '';
          container.appendChild(video);
        } else if (isAudio) {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.className = 'attachment-preview';
          audio.setAttribute('aria-label', 'Аудио вложение');
          const source = document.createElement('source');
          source.src = url;
          source.type = mime;
          audio.appendChild(source);
          container.innerHTML = '';
          container.appendChild(audio);
        }
      } catch (err) {
        console.error('Preview decrypt failed for attachment', meta.id, err);
      }
    }
  }
}
