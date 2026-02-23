/**
 * Сервис шифрования сообщений и файлов (crypto-js AES, только на клиенте).
 */
import CryptoJS from 'crypto-js';

/**
 * Преобразует ArrayBuffer в CryptoJS WordArray.
 * @param {ArrayBuffer} buffer
 * @returns {CryptoJS.lib.WordArray}
 */
function arrayBufferToWordArray(buffer) {
  const bytes = new Uint8Array(buffer);
  const words = [];
  for (let i = 0; i < bytes.length; i += 4) {
    const w = (bytes[i] << 24) | ((bytes[i + 1] || 0) << 16) | ((bytes[i + 2] || 0) << 8) | (bytes[i + 3] || 0);
    words.push(w);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

/**
 * Преобразует CryptoJS WordArray в ArrayBuffer.
 * @param {CryptoJS.lib.WordArray} wordArray
 * @returns {ArrayBuffer}
 */
function wordArrayToArrayBuffer(wordArray) {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const buffer = new ArrayBuffer(sigBytes);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < sigBytes; i++) {
    const w = words[i >>> 2];
    bytes[i] = (w >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return buffer;
}

/**
 * Шифрует текст по паролю.
 * @param {string} plainText - исходный текст
 * @param {string} password - пароль
 * @returns {string} base64-строка шифротекста
 */
export function encryptText(plainText, password) {
  if (!password) throw new Error('Пароль не указан');
  return CryptoJS.AES.encrypt(plainText || '', password).toString();
}

/**
 * Расшифровывает текст по паролю.
 * @param {string} ciphertext - base64-строка шифротекста
 * @param {string} password - пароль
 * @returns {string} расшифрованный текст
 * @throws {Error} при неверном пароле или повреждённых данных
 */
export function decryptText(ciphertext, password) {
  if (!password) throw new Error('Пароль не указан');
  if (!ciphertext || typeof ciphertext !== 'string') return '';
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, password);
    const str = bytes.toString(CryptoJS.enc.Utf8);
    if (str === '' && ciphertext.length > 0) throw new Error('Неверный пароль');
    return str;
  } catch (e) {
    if (e.message === 'Неверный пароль') throw e;
    throw new Error('Неверный пароль');
  }
}

/**
 * Шифрует файл по паролю. Результат — Blob в формате base64 (OpenSSL-совместимый), имя файла — originalName.enc.
 * @param {File} file - исходный файл
 * @param {string} password - пароль
 * @returns {Promise<File>} зашифрованный файл с именем file.name + '.enc'
 */
export function encryptFile(file, password) {
  if (!password) return Promise.reject(new Error('Пароль не указан'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wordArray = arrayBufferToWordArray(reader.result);
        const encrypted = CryptoJS.AES.encrypt(wordArray, password).toString();
        const blob = new Blob([ encrypted ], { type: 'application/octet-stream' });
        const name = (file.name || 'file') + (file.name && !file.name.endsWith('.enc') ? '.enc' : '');
        resolve(new File([ blob ], name, { type: blob.type }));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Расшифровывает файл (Blob), полученный с сервера.
 * @param {Blob} blob - зашифрованный blob (содержит base64-строку CryptoJS)
 * @param {string} password - пароль
 * @returns {Promise<Blob>} расшифрованный blob
 * @throws {Error} при неверном пароле
 */
export function decryptFile(blob, password) {
  if (!password) return Promise.reject(new Error('Пароль не указан'));
  return blob.text().then((ciphertext) => {
    try {
      const wordArray = CryptoJS.AES.decrypt(ciphertext, password);
      if (!wordArray.sigBytes || wordArray.sigBytes < 0) throw new Error('Неверный пароль');
      const buffer = wordArrayToArrayBuffer(wordArray);
      return new Blob([ buffer ]);
    } catch (e) {
      if (e.message === 'Неверный пароль') throw e;
      throw new Error('Неверный пароль');
    }
  });
}

export default {
  encryptText, decryptText, encryptFile, decryptFile
};
