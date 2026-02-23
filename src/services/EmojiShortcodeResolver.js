/**
 * Резолвер shortcode → unicode для отображения в сообщениях.
 * Использует Database из emoji-picker-element (те же данные, что и в пикере эмодзи).
 * Кэш заполняется асинхронно при init(); до готовности неизвестные shortcode остаются как :name:.
 */
import { Database } from 'emoji-picker-element';

/** Shortcodes для предзаполнения кэша (наши и варианты emojibase: slight_smile, thumbsup и т.д.). */
const SHORTCODES_TO_PREFILL = [
  'smile', 'slight_smile', 'grinning', 'grin',
  'sad', 'disappointed', 'slightly_frowning_face',
  'wink', 'heart', 'thumbsup', '+1', 'fire', 'rocket',
  'check', 'warning', 'info', 'heavy_check_mark',
];

let database = null;
const cache = new Map();
let initPromise = null;

/**
 * Инициализирует Database и заполняет кэш shortcode → unicode.
 * Можно вызывать несколько раз — повторные вызовы возвращают тот же Promise.
 * @returns {Promise<void>}
 */
export async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    database = new Database({ locale: 'en' });
    await database.ready();
    for (const shortcode of SHORTCODES_TO_PREFILL) {
      try {
        const emoji = await database.getEmojiByShortcode(shortcode);
        if (emoji?.unicode) {
          cache.set(shortcode.toLowerCase(), emoji.unicode);
        }
      } catch (_) {
        // ignore missing shortcodes
      }
    }
  })();
  return initPromise;
}

/**
 * Возвращает unicode-символ эмодзи по shortcode (без двоеточий).
 * Синхронно: использует кэш, заполненный в init().
 * @param {string} shortcode - например "smile", "thumbsup"
 * @returns {string} - unicode эмодзи или пустая строка (тогда вызывающий оставит :shortcode:)
 */
export function getUnicode(shortcode) {
  if (!shortcode || typeof shortcode !== 'string') return '';
  const key = shortcode.toLowerCase();
  return cache.get(key) ?? '';
}
