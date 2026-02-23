/** Модель данных сообщения для отправки на сервер (автор, текст, флаги, файлы). */
export default class MessageSendModel {
  /**
   * @param {Object} [data={}] - автор, content, encrypted, pinned, favorite, files (массив File)
   */
  constructor(data = {}) {
    this.author = data.author;
    this.content = data.content || ''; // текст или URL
    this.encrypted = data.encrypted || false;
    this.pinned = data.pinned || false;
    this.favorite = data.favorite || false;
    this.files = data.files || []; // массив File объектов
  }

  /** Преобразует модель в FormData для отправки через fetch (author, content, files и т.д.). */
  toFormData() {
    const formData = new FormData();

    formData.append('author', this.author);
    formData.append('content', this.content);
    formData.append('encrypted', this.encrypted.toString());
    formData.append('pinned', this.pinned.toString());
    formData.append('favorite', this.favorite.toString());

    // Добавляем файлы
    this.files.forEach((file) => {
      formData.append('files', file);
    });

    return formData;
  }
}
