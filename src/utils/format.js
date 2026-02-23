/**
 * Форматирование размера файла в читаемый вид.
 * @param {number} bytes - размер в байтах
 * @param {{ locale?: 'ru' | 'en' }} [options] - locale: 'ru' (Б, КБ, МБ, ГБ, ТБ) или 'en' (B, KB, MB, GB, TB)
 * @returns {string}
 */
export function formatBytes(bytes, options = {}) {
  const { locale = 'ru' } = options;
  if (bytes === 0) return locale === 'ru' ? '0 Б' : '0 B';

  const k = 1024;
  const sizesRu = [
    'Б', 'КБ', 'МБ', 'ГБ', 'ТБ'
  ];
  const sizesEn = [
    'B', 'KB', 'MB', 'GB', 'TB'
  ];
  const sizes = locale === 'ru' ? sizesRu : sizesEn;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2));
  return `${value} ${sizes[i]}`;
}
