/**
 * По имени файла (например "photo.png" или "photo.png.enc") возвращает MIME для превью.
 * @param {string} fileName - имя файла
 * @returns {string} MIME-тип
 */
export function getMimeFromExtension(fileName) {
  const name = (fileName || '').endsWith('.enc') ? fileName.slice(0, -4) : fileName;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
  };
  return map[ext] || 'application/octet-stream';
}
