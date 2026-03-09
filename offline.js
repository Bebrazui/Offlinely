const COUNTRY_SEARCH = document.getElementById('countrySearch');
const COUNTRY_LIST = document.getElementById('countryList');
const STORAGE_INFO = document.getElementById('storageInfo');
const QUALITY_PRESET = document.getElementById('qualityPreset');

const SETTINGS_KEY = 'offlinely_country_downloads';
const TILE_CACHE = 'offlinely-tiles-v2';

const COUNTRIES = [
  { code: 'kz', flag: '🇰🇿', name: 'Казахстан', sizeMb: 980, bbox: [46.5, 40.5, 87.5, 55.5] },
  { code: 'ru', flag: '🇷🇺', name: 'Россия (Европа + Урал)', sizeMb: 1900, bbox: [20.0, 50.0, 75.0, 66.0] },
  { code: 'ua', flag: '🇺🇦', name: 'Украина', sizeMb: 620, bbox: [22.0, 44.0, 41.0, 53.0] },
  { code: 'tr', flag: '🇹🇷', name: 'Турция', sizeMb: 780, bbox: [26.0, 35.5, 45.0, 42.5] },
  { code: 'de', flag: '🇩🇪', name: 'Германия', sizeMb: 690, bbox: [5.5, 47.0, 15.5, 55.2] },
  { code: 'fr', flag: '🇫🇷', name: 'Франция', sizeMb: 840, bbox: [-5.5, 42.0, 9.7, 51.5] },
  { code: 'it', flag: '🇮🇹', name: 'Италия', sizeMb: 700, bbox: [6.5, 36.5, 18.8, 47.2] },
  { code: 'es', flag: '🇪🇸', name: 'Испания', sizeMb: 760, bbox: [-9.6, 36.0, 3.5, 43.9] },
  { code: 'us', flag: '🇺🇸', name: 'США (континентальная часть)', sizeMb: 2400, bbox: [-125.0, 24.0, -66.0, 49.5] },
  { code: 'ca', flag: '🇨🇦', name: 'Канада (юг)', sizeMb: 1500, bbox: [-141.0, 42.0, -52.0, 63.0] },
];

const QUALITY_PRESETS = {
  base: { minZoom: 6, maxZoom: 9, avgKb: 28 },
  roads: { minZoom: 6, maxZoom: 11, avgKb: 40 },
  detailed: { minZoom: 6, maxZoom: 12, avgKb: 52 },
};

function getSelectedQuality() {
  const key = QUALITY_PRESET?.value || 'roads';
  return QUALITY_PRESETS[key] || QUALITY_PRESETS.roads;
}

let downloads = loadDownloads();
let tileTemplates = [];
let styleAssetUrls = [];
let activeJobs = new Map();

function loadDownloads() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveDownloads() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(downloads));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function formatBytes(v) {
  if (!Number.isFinite(v)) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = v;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
}

async function refreshStorageInfo() {
  if (!navigator.storage?.estimate) {
    STORAGE_INFO.textContent = 'Storage API недоступен';
    return;
  }
  const e = await navigator.storage.estimate();
  STORAGE_INFO.textContent = `Использовано: ${formatBytes(e.usage || 0)} / Квота: ${formatBytes(e.quota || 0)}`;
}

function latLonToTile(lat, lon, z) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function buildTileUrls(bbox, minZoom, maxZoom) {
  const [west, south, east, north] = bbox;
  const out = [];
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const p1 = latLonToTile(north, west, z);
    const p2 = latLonToTile(south, east, z);
    const xMin = clamp(Math.min(p1.x, p2.x), 0, 2 ** z - 1);
    const xMax = clamp(Math.max(p1.x, p2.x), 0, 2 ** z - 1);
    const yMin = clamp(Math.min(p1.y, p2.y), 0, 2 ** z - 1);
    const yMax = clamp(Math.max(p1.y, p2.y), 0, 2 ** z - 1);
    for (let x = xMin; x <= xMax; x += 1) {
      for (let y = yMin; y <= yMax; y += 1) {
        for (const tpl of tileTemplates) {
          out.push(tpl.replace('{z}', `${z}`).replace('{x}', `${x}`).replace('{y}', `${y}`));
        }
      }
    }
  }
  return Array.from(new Set(out));
}

async function resolveTileTemplates() {
  // Static style in app uses OpenFreeMap liberty.
  const styleRes = await fetch('https://tiles.openfreemap.org/styles/liberty');
  if (!styleRes.ok) return [];
  const style = await styleRes.json();
  const templates = [];
  for (const source of Object.values(style.sources || {})) {
    if (!source || source.type !== 'vector') continue;
    if (Array.isArray(source.tiles)) {
      templates.push(...source.tiles);
      continue;
    }
    if (source.url) {
      try {
        const tr = await fetch(source.url);
        if (!tr.ok) continue;
        const tj = await tr.json();
        if (Array.isArray(tj.tiles)) templates.push(...tj.tiles);
      } catch {
        // ignore
      }
    }
  }
  const assets = [];
  if (typeof style.sprite === 'string') {
    assets.push(`${style.sprite}.json`, `${style.sprite}.png`, `${style.sprite}@2x.json`, `${style.sprite}@2x.png`);
  }
  if (typeof style.glyphs === 'string') {
    const base = style.glyphs;
    const ranges = ['0-255', '256-511', '512-767', '768-1023', '1024-1279', '1280-1535'];
    for (const r of ranges) {
      assets.push(base.replace('{fontstack}', 'Noto Sans Regular').replace('{range}', r));
      assets.push(base.replace('{fontstack}', 'Noto Sans Bold').replace('{range}', r));
    }
  }
  styleAssetUrls = Array.from(new Set(assets));
  return Array.from(new Set(templates));
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
}

async function postToSw(msg) {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const target = navigator.serviceWorker.controller ?? reg.active ?? reg.waiting ?? reg.installing;
  if (target) target.postMessage(msg);
}

async function downloadCountry(country, progressEl, buttonEl) {
  if (!tileTemplates.length) {
    progressEl.textContent = 'Не удалось получить шаблоны тайлов.';
    return;
  }

  const preset = getSelectedQuality();
  const urls = [...buildTileUrls(country.bbox, preset.minZoom, preset.maxZoom), ...styleAssetUrls];
  if (!urls.length) {
    progressEl.textContent = 'Нет тайлов для скачивания.';
    return;
  }

  const controller = new AbortController();
  activeJobs.set(country.code, controller);
  buttonEl.disabled = true;

  try {
    let done = 0;
    let cachedCount = 0;
    let failedCount = 0;
    const total = urls.length;
    const queue = urls.slice();
    const concurrency = 8;
    const cache = await caches.open(TILE_CACHE);

    async function worker() {
      while (queue.length) {
        const url = queue.pop();
        if (!url) break;
        try {
          const req = new Request(url, { mode: 'cors' });
          const cached = await cache.match(req);
          if (cached) {
            cachedCount += 1;
          } else {
            const res = await fetch(req, { signal: controller.signal });
            if (res.ok || res.type === 'opaque') {
              await cache.put(req, res.clone());
              cachedCount += 1;
            } else {
              failedCount += 1;
            }
          }
        } catch {
          failedCount += 1;
        }
        done += 1;
        if (done % 20 === 0 || done === total) {
          progressEl.textContent = `Скачивание: ${done}/${total} • В кэше: ${cachedCount} • Ошибок: ${failedCount}`;
        }
        if (done % 120 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    downloads[country.code] = { downloaded: true, at: Date.now(), urls, preset: QUALITY_PRESET?.value || 'roads' };
    saveDownloads();
    progressEl.textContent = `Готово: ${cachedCount}/${total} (ошибок: ${failedCount}), z${preset.minZoom}-${preset.maxZoom}.`;
  } catch (e) {
    progressEl.textContent = e.name === 'AbortError' ? 'Остановлено.' : `Ошибка: ${e.message}`;
  } finally {
    activeJobs.delete(country.code);
    buttonEl.disabled = false;
    render();
    refreshStorageInfo();
  }
}

async function deleteCountry(country, progressEl) {
  const item = downloads[country.code];
  if (item?.urls?.length) {
    await postToSw({ type: 'DELETE_URLS', urls: item.urls });
  }
  delete downloads[country.code];
  saveDownloads();
  progressEl.textContent = 'Удалено.';
  render();
  refreshStorageInfo();
}

function render() {
  const q = COUNTRY_SEARCH.value.trim().toLowerCase();
  const items = COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));

  COUNTRY_LIST.innerHTML = '';
  for (const c of items) {
    const state = downloads[c.code];
    const preset = getSelectedQuality();
    const estimatedTiles = buildTileUrls(c.bbox, preset.minZoom, preset.maxZoom).length;
    const estimatedGb = (estimatedTiles * preset.avgKb) / 1024 / 1024;
    const card = document.createElement('article');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'row';
    title.innerHTML = `<div><div class="name">${c.flag} ${c.name}</div><div class="meta">Оценка: ~${estimatedGb.toFixed(2)} GB (${estimatedTiles} тайлов, z${preset.minZoom}-${preset.maxZoom})</div></div><div class="meta">${state?.downloaded ? `Скачано (${state.preset || 'base'})` : 'Не скачано'}</div>`;

    const actions = document.createElement('div');
    actions.className = 'actions';
    const dlBtn = document.createElement('button');
    dlBtn.className = 'primary';
    dlBtn.textContent = state?.downloaded ? 'Перескачать' : 'Скачать';

    const delBtn = document.createElement('button');
    delBtn.className = 'tonal';
    delBtn.textContent = 'Удалить';
    delBtn.disabled = !state?.downloaded;

    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.textContent = '';

    dlBtn.addEventListener('click', () => downloadCountry(c, progress, dlBtn));
    delBtn.addEventListener('click', () => deleteCountry(c, progress));

    actions.appendChild(dlBtn);
    actions.appendChild(delBtn);

    card.appendChild(title);
    card.appendChild(actions);
    card.appendChild(progress);
    COUNTRY_LIST.appendChild(card);
  }
}

async function init() {
  COUNTRY_SEARCH.addEventListener('input', render);
  QUALITY_PRESET?.addEventListener('change', render);
  await requestPersistentStorage();
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
  }
  tileTemplates = await resolveTileTemplates();
  await refreshStorageInfo();
  render();
}

init();
