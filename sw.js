const STATIC_CACHE = 'offlinely-static-v2';
const TILE_CACHE = 'offlinely-tiles-v2';
const SETTINGS_DB = 'offlinely-settings';
const SETTINGS_STORE = 'kv';
const AUTO_CACHE_KEY = 'autoCacheEnabled';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
];

let autoCacheEnabled = true;

function openSettingsDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SETTINGS_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(SETTINGS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getSetting(key, fallback) {
  const db = await openSettingsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? fallback);
    req.onerror = () => reject(req.error);
  });
}

async function setSetting(key, value) {
  const db = await openSettingsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => ![STATIC_CACHE, TILE_CACHE].includes(k))
        .map((k) => caches.delete(k))
    );
    autoCacheEnabled = await getSetting(AUTO_CACHE_KEY, true);
    await self.clients.claim();
  })());
});

function isTileLikeRequest(url) {
  return (
    url.pathname.endsWith('.pbf') ||
    url.pathname.includes('/tiles/') ||
    url.pathname.includes('/glyphs/') ||
    url.pathname.includes('/sprite') ||
    url.hostname.includes('openfreemap.org')
  );
}

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'SET_AUTO_CACHE') {
    autoCacheEnabled = Boolean(msg.enabled);
    event.waitUntil(setSetting(AUTO_CACHE_KEY, autoCacheEnabled));
    return;
  }

  if (msg.type === 'CACHE_URL' && typeof msg.url === 'string') {
    event.waitUntil((async () => {
      const cache = await caches.open(TILE_CACHE);
      const req = new Request(msg.url, { mode: 'cors' });
      const existing = await cache.match(req);
      if (existing) return;
      const res = await fetch(req);
      if (res.ok) await cache.put(req, res.clone());
    })());
    return;
  }

  if (msg.type === 'DELETE_URLS' && Array.isArray(msg.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(TILE_CACHE);
      await Promise.all(
        msg.urls
          .filter((u) => typeof u === 'string')
          .map((u) => cache.delete(new Request(u, { mode: 'cors' })))
      );
    })());
    return;
  }

  if (msg.type === 'GET_SETTINGS') {
    event.waitUntil((async () => {
      const enabled = await getSetting(AUTO_CACHE_KEY, true);
      autoCacheEnabled = enabled;
      if (event.source && 'postMessage' in event.source) {
        event.source.postMessage({ type: 'SETTINGS', autoCacheEnabled: enabled });
      }
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        const staticCache = await caches.open(STATIC_CACHE);
        staticCache.put(req, fresh.clone());
        return fresh;
      } catch {
        return caches.match('./index.html');
      }
    })());
    return;
  }

  if (!isTileLikeRequest(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(TILE_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req, { mode: 'cors' });
      if (autoCacheEnabled && fresh.ok) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      if (cached) return cached;
      throw new Error('No network and no cached map tile.');
    }
  })());
});
