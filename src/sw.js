/**
 * Service Worker: кеширование API сообщений и медиа (Workbox Network First).
 * Собирается через InjectManifest (workbox-webpack-plugin).
 */
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// Точка инъекции манифеста для InjectManifest (precache не используется, массив пустой или от сборки)
precacheAndRoute(self.__WB_MANIFEST || []);

const FROM_CACHE_HEADER = 'X-From-Cache';

/** Плагин: при ответе из кеша добавляет заголовок X-From-Cache для индикации в приложении. */
const addFromCacheHeaderPlugin = {
  cachedResponseWillBeUsed: async ({ cachedResponse }) => {
    if (!cachedResponse) return null;
    const newHeaders = new Headers(cachedResponse.headers);
    newHeaders.set(FROM_CACHE_HEADER, '1');
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: newHeaders,
    });
  },
};

// GET /api/messages — список сообщений
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' && url.pathname.includes('/api/messages') && !url.pathname.includes('/api/search/'),
  new NetworkFirst({
    cacheName: 'chaos-messages-api',
    networkTimeoutSeconds: 10,
    plugins: [ addFromCacheHeaderPlugin ],
  })
);

// Медиа и карты: /api/files/* (images, videos, audio, скачивание), /api/static-map
const isMediaOrMap = ({ request, url }) => {
  if (request.method !== 'GET') return false;
  const p = url.pathname;
  return p.includes('/api/files/') || p.includes('/api/static-map');
};
registerRoute(
  isMediaOrMap,
  new NetworkFirst({
    cacheName: 'chaos-media-api',
    networkTimeoutSeconds: 10,
  })
);
