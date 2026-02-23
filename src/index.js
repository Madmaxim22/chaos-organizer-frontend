import '@/css/style.css';
import ChaosOrganizerApp from '@/app.js';

console.log('Chaos Organizer frontend started');

/**
 * Точка входа: после загрузки DOM создаёт приложение Chaos Organizer в #root.
 * Проверяет поддержку Service Worker и IndexedDB. При ошибке инициализации показывает сообщение и кнопку перезагрузки.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Регистрация Service Worker для офлайн-кеша (Workbox)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(
      (reg) => console.log('Service Worker зарегистрирован', reg.scope),
      (err) => console.warn('Service Worker не зарегистрирован', err)
    );
  }

  const appContainer = document.getElementById('root');
  try {
    const app = new ChaosOrganizerApp(appContainer);
    console.log('Chaos Organizer приложение инициализировано');
  } catch (error) {
    console.error('Ошибка инициализации приложения:', error);
    appContainer.innerHTML = `
      <div style="padding: 2rem; text-align: center;">
        <h2>Ошибка загрузки приложения</h2>
        <p>${error.message}</p>
        <button onclick="location.reload()">Перезагрузить</button>
      </div>
    `;
  }
});