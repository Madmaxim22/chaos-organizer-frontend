/**
 * Экранирование HTML для предотвращения XSS.
 * @param {string} text - строка для экранирования
 * @returns {string}
 */
export function escapeHTML(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Экранирование строки для использования в атрибутах HTML.
 * @param {string} str - строка для экранирования
 * @returns {string}
 */
export function escapeAttr(str) {
  const s = String(str);
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
