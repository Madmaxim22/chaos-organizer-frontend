import './css/style.css';

console.log('Chaos Organizer frontend started');

// Простой демонстрационный код
document.addEventListener('DOMContentLoaded', () => {
  // Проверка поддержки современных возможностей
  if ('serviceWorker' in navigator) {
    console.log('Service Worker поддерживается');
  }
  if ('indexedDB' in window) {
    console.log('IndexedDB поддерживается');
  }
});