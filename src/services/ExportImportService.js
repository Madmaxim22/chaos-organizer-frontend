/**
 * Сервис экспорта и импорта истории чата.
 * Скачивание архива как файла и выбор файла для импорта с отправкой на API.
 */

const DEFAULT_EXPORT_FILENAME = 'chaos-organizer-backup.json';
const IMPORT_ACCEPT = '.json,application/json';

/**
 * @typedef {Object} ExportImportServiceOptions
 * @property {import('@/services/MessagesManager.js').MessagesManager} messagesManager - менеджер сообщений для API
 * @property {function(): Promise<Blob>} [getExportBlob] - функция получения blob экспорта
 * @property {function(File): Promise<void>} [importFile] - функция импорта файла
 */

export class ExportImportService {
  /**
   * @param {ExportImportServiceOptions} options
   */
  constructor(options) {
    this.messagesManager = options.messagesManager;
    this.getExportBlob = options.getExportBlob ?? (() => this.messagesManager.exportHistory());
    this.importFile = options.importFile ?? ((file) => this.messagesManager.importHistory(file));
  }

  /**
   * Скачивает blob как файл в браузере.
   * @param {Blob} blob
   * @param {string} [filename] - имя файла
   */
  downloadBlobAsFile(blob, filename = DEFAULT_EXPORT_FILENAME) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Экспорт истории: получает архив с сервера и сохраняет как файл.
   * @returns {Promise<void>}
   * @throws {Error} при ошибке API
   */
  async exportHistory() {
    const blob = await this.getExportBlob();
    this.downloadBlobAsFile(blob);
  }

  /**
   * Открывает диалог выбора файла и возвращает выбранный файл (или null при отмене).
   * @returns {Promise<File | null>}
   */
  chooseImportFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = IMPORT_ACCEPT;
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0] ?? null;
        input.remove();
        resolve(file);
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Импорт истории: выбор файла и отправка на сервер.
   * @returns {Promise<boolean>} true если импорт выполнен, false если пользователь отменил выбор файла
   * @throws {Error} при ошибке API
   */
  async importHistory() {
    const file = await this.chooseImportFile();
    if (!file) return false;
    await this.importFile(file);
    return true;
  }
}
