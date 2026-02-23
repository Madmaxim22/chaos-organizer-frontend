/** Модель сообщения, полученного с сервера (id, автор, контент, дата, метаданные вложений). */
export default class MessageReceiveModel {
  /**
   * @param {Object} data - id, author, content, timestamp, encrypted, pinned, favorite, metadata
   */
  constructor(data) {
    this.id = data.id;
    this.author = data.author;
    this.content = data.content;
    this.type = data.type ?? 'text';
    this.timestamp = new Date(data.timestamp);
    this.encrypted = data.encrypted;
    this.pinned = data.pinned;
    this.favorite = data.favorite;
    this.metadata = data.metadata;
  }

  /** Возвращает дату в формате DD.MM.YYYY, HH:MM (локаль ru-RU). */
  getFormattedDate() {
    return this.timestamp.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /** Возвращает true, если тип сообщения — image, video, audio или file. */
  isFileMessage() {
    return [
      'image', 'video', 'audio', 'file'
    ].includes(this.type);
  }
}
