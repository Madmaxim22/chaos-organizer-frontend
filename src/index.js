import './css/style.css';

console.log('Chaos Organizer frontend started');

// Простой демонстрационный код
document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('demo-button');
  const output = document.getElementById('demo-output');

  if (button && output) {
    button.addEventListener('click', () => {
      output.textContent = 'Привет! Среда разработки настроена успешно.';
      button.disabled = true;
      setTimeout(() => {
        output.textContent = '';
        button.disabled = false;
      }, 2000);
    });
  }

  // Проверка поддержки современных возможностей
  if ('serviceWorker' in navigator) {
    console.log('Service Worker поддерживается');
  }
  if ('indexedDB' in window) {
    console.log('IndexedDB поддерживается');
  }
});