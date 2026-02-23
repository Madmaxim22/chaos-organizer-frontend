/**
 * Чистые функции для рендеринга HTML-шаблонов сообщений.
 * formatters: { escapeHTML, formatBytes, yandexMapsApiKey?: string }
 */

import LocationService from '../../services/LocationService.js';
import {
  ImgUrl, VideoUrl, AudioUrl, FileUrl, PinUrl, PinnedUrl, FavoriteUrl,
  LockOnUrl, LockOffUrl, DeleteUrl, DownloadUrl, DownloadsUrl,
} from '../../assets/icons.js';

const EMOJI_MAP = {
  smile: '😊',
  sad: '😢',
  wink: '😉',
  heart: '❤️',
  thumbsup: '👍',
  fire: '🔥',
  rocket: '🚀',
  check: '✅',
  warning: '⚠️',
  info: 'ℹ️'
};

const TRUNCATE_LENGTH = 500;

/**
 * Преобразует URL в тексте в кликабельные ссылки <a target="_blank">.
 * @param {string} text - исходный текст
 * @returns {string} - HTML-строка с обёрнутыми ссылками
 */
function renderTextWithLinks(text) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part) => {
    if (/^https?:\/\//.test(part)) {
      return `<a href="${part}" target="_blank" rel="noopener noreferrer">${part}</a>`;
    }
    return part;
  }).join('');
}

/**
 * Рендеринг форматированного текста (markdown-like, ссылки, обрезка).
 * @param {string} text
 * @param {string|number} messageId
 * @param {{ escapeHTML: (t: string) => string }} formatters
 * @returns {string}
 */
export function renderFormattedText(text, messageId, formatters) {
  if (!text) return '';
  const { escapeHTML } = formatters;

  const safeText = escapeHTML(text);
  const withLinks = renderTextWithLinks(safeText);

  let formatted = withLinks
    .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>')
    .replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/:([a-z0-9_+-]+):/g, (match, name) => EMOJI_MAP[name] ?? match);

  const shouldTruncate = formatted.length > TRUNCATE_LENGTH;
  const truncatedText = shouldTruncate ? formatted.substring(0, TRUNCATE_LENGTH) + '...' : formatted;
  const toggleButton = shouldTruncate
    ? `<button type="button" class="text-toggle-btn" data-message-id="${messageId}"
      aria-label="Показать полный текст">Показать полностью</button>`
    : '';

  return `
      <div class="message-text ${shouldTruncate ? 'truncated' : ''}" data-full-text="${escapeHTML(formatted)}">
        ${truncatedText}
      </div>
      ${toggleButton}
    `;
}

/**
 * Рендер одного вложения (карточка).
 * @param {Object} metadata - { id, mimeType, fileName, fileSize, duration, fileExtension? }
 * @param {string} baseUrl
 * @param {{ escapeHTML: (t: string) => string, formatBytes: (bytes: number) => string }} formatters
 * @param {{ isEncrypted?: boolean }} [options] - если true, не показывать превью медиа
 * @returns {string}
 */
export function renderAttachment(metadata, baseUrl, formatters, options = {}) {
  const { escapeHTML, formatBytes } = formatters;
  const isEncrypted = options.isEncrypted === true;

  const isImage = metadata.mimeType && metadata.mimeType.startsWith('image/');
  const isVideo = metadata.mimeType && metadata.mimeType.startsWith('video/');
  const isAudio = metadata.mimeType && metadata.mimeType.startsWith('audio/');
  const isFile = !isImage && !isVideo && !isAudio;

  let previewContent = '';
  let iconImg = FileUrl;

  if (isEncrypted) {
    previewContent = `<div class="attachment-preview attachment-encrypted-placeholder" aria-hidden="true">
      <img src="${LockOnUrl}" alt="" class="encrypted-placeholder-icon" aria-hidden="true"> Зашифровано</div>`;
    if (isImage) iconImg = ImgUrl;
    else if (isVideo) iconImg = VideoUrl;
    else if (isAudio) iconImg = AudioUrl;
  } else if (isImage) {
    previewContent = `<img src="${baseUrl}/api/files/images/${metadata.id}"
      alt="${escapeHTML(metadata.fileName || '')}" class="attachment-preview" loading="lazy">`;
    iconImg = ImgUrl;
  } else if (isVideo) {
    previewContent = `<video controls class="attachment-preview" aria-label="Видео вложение" preload="none">
      <source src="${baseUrl}/api/files/videos/${metadata.id}" type="${metadata.mimeType}"></video>`;
    iconImg = VideoUrl;
  } else if (isAudio) {
    previewContent = `<audio controls class="attachment-preview" aria-label="Аудио вложение">
      <source src="${baseUrl}/api/files/audio/${metadata.id}" type="${metadata.mimeType}"></audio>`;
    iconImg = AudioUrl;
  } else if (isFile) {
    previewContent = `<div class="file-icon">
      <img src="${iconImg}" alt="" aria-hidden="true" class="file-type-icon"></div>`;
  }

  const rawFilename = metadata.fileName || 'Без названия';
  const safeFilename = escapeHTML(rawFilename);
  const displayFilename = rawFilename.length > 20
    ? escapeHTML(rawFilename.slice(0, 20) + '…')
    : safeFilename;
  const fileSize = metadata.fileSize ? formatBytes(metadata.fileSize) : '';
  const duration = metadata.duration ? `Длительность: ${Math.round(metadata.duration)}с` : '';

  return `
      <div class="attachment-card" data-id="${metadata.id}">
        <div class="attachment-preview-container">
          ${previewContent}
        </div>
        <div class="attachment-info">
          <div class="attachment-filename" title="${safeFilename}">${displayFilename}</div>
          <div class="attachment-meta">
            ${fileSize ? `<span class="attachment-size">${fileSize}</span>` : ''}
            ${duration ? `<span class="attachment-duration">${duration}</span>` : ''}
            <span class="attachment-type">${metadata.mimeType || 'Файл'}</span>
          </div>
        </div>
        <button class="attachment-download-btn" data-action="download" data-id="${metadata.id}"
          aria-label="Скачать ${safeFilename}" title="Скачать">
          <img src="${DownloadUrl}" alt="" aria-hidden="true" class="download-icon"> Скачать
        </button>
      </div>
    `;
}

/**
 * Рендер блока превью карты для сообщения с геолокацией.
 * Картинка запрашивается через прокси бэкенда /api/static-map (ключ Yandex только на сервере).
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} baseUrl - базовый URL API (например http://localhost:3000)
 * @returns {string}
 */
function renderMapPreview(latitude, longitude, baseUrl) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    w: '640',
    h: '400',
    z: '16',
  });
  const imgUrl = `${baseUrl}/api/static-map?${params.toString()}`;
  const mapLink = `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=16`;
  return `
      <div class="message-map-preview">
        <a href="${mapLink}" target="_blank" rel="noopener noreferrer"
          class="message-map-preview-link" title="Открыть на Яндекс.Картах">
          <img src="${imgUrl}" alt="Превью карты: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}"
            class="message-map-preview-img" loading="lazy">
        </a>
        <span class="message-map-preview-caption">Яндекс.Карты</span>
      </div>`;
}

/**
 * Рендер полного HTML одного сообщения.
 * @param {Object} message - { id, author, content, pinned, favorite, metadata, getFormattedDate }
 * @param {string} baseUrl
 * @param {Object} formatters - escapeHTML, formatBytes, yandexMapsApiKey?
 * @returns {string}
 */
export function messageHTML(message, baseUrl, formatters) {
  const { escapeHTML, formatBytes } = formatters;
  const timestamp = typeof message.getFormattedDate === 'function'
    ? message.getFormattedDate()
    : (message.timestamp ? new Date(message.timestamp).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '');

  const safeAuthor = escapeHTML(message.author);
  const pinnedClass = message.pinned ? 'pinned' : '';
  const favoritedClass = message.favorite ? 'favorited' : '';
  const alignmentClass = message.author === 'Пользователь'
    ? 'user-message' : 'other-message';

  const attachmentOptions = message.encrypted ? { isEncrypted: true } : {};
  let attachmentsHTML = '';
  if (message.metadata && message.metadata.length !== 0) {
    attachmentsHTML += '<div class="attachments-grid">';
    for (const metadata of message.metadata) {
      attachmentsHTML += renderAttachment(metadata, baseUrl, formatters, attachmentOptions);
    }
    attachmentsHTML += '</div>';
  }

  const content = message.content ?? '';
  const decryptedContent = message._decryptedContent;
  let bodyHTML;
  let mapPreviewHTML = '';
  if (message.encrypted && decryptedContent == null) {
    bodyHTML = `
      <div class="message-body-encrypted" data-encrypted-placeholder="true">
        <p class="encrypted-placeholder-text">Зашифрованное сообщение</p>
        <button type="button" class="action-button decrypt-btn" data-action="decrypt"
          aria-label="Ввести пароль для расшифровки">
          <img src="${LockOffUrl}" alt="" aria-hidden="true" class="decrypt-btn-icon"> Ввести пароль
        </button>
      </div>`;
  } else if (message.encrypted && decryptedContent != null) {
    bodyHTML = renderFormattedText(decryptedContent, message.id, formatters);
    mapPreviewHTML = '';
  } else {
    bodyHTML = renderFormattedText(content, message.id, formatters);
    const location = LocationService.parseLocationFromContent(content);
    mapPreviewHTML = location ? renderMapPreview(location.latitude, location.longitude, baseUrl) : '';
  }

  const encryptedClass = message.encrypted ? ' message-encrypted' : '';
  return `
      <div class="message ${alignmentClass} ${pinnedClass} ${favoritedClass}${encryptedClass}"
        data-id="${message.id}" role="article" aria-labelledby="message-author-${message.id}">
        <div class="message-header">
          <span class="message-author" id="message-author-${message.id}">${safeAuthor}</span>
          <span class="message-time" aria-label="Время отправки: ${timestamp}">
            ${timestamp}</span>
        </div>
        <div class="message-body" aria-live="polite">
          ${bodyHTML}
          ${mapPreviewHTML}
        </div>
        ${attachmentsHTML}
        <div class="message-actions" role="toolbar" aria-label="Действия с сообщением">
          <button class="action-button pin-btn"
            title="${message.pinned ? 'Открепить' : 'Закрепить'}"
            aria-label="${message.pinned ? 'Открепить сообщение' : 'Закрепить сообщение'}" data-action="pin">
            <img src="${message.pinned ? PinnedUrl : PinUrl}" alt="" aria-hidden="true" class="action-icon pin-icon">
          </button>
          <button class="action-button favorite-btn"
            title="${message.favorite ? 'Убрать из избранного' : 'В избранное'}"
            aria-label="${message.favorite ? 'Убрать из избранного' : 'Добавить в избранное'}"
            data-action="favorite">
            <span class="star">
              <img src="${FavoriteUrl}" alt="" aria-hidden="true"
                class="action-icon favorite-icon${message.favorite ? ' is-filled' : ''}">
            </span>
          </button>
          <button class="action-button delete-btn" aria-label="Удалить сообщение" data-action="delete">
            <img src="${DeleteUrl}" alt="" aria-hidden="true" class="action-icon delete-icon"> Удалить
          </button>
          ${message.metadata && message.metadata.length > 1
    ? `<button class="action-button download-all-btn" aria-label="Скачать все вложения"
              data-action="download-all"><img src="${DownloadsUrl}" alt="" aria-hidden="true"
              class="download-all-icon"> Скачать всё</button>`
    : ''}
        </div>
      </div>
    `;
}
