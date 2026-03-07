const $ = (id) => document.getElementById(id);

const STATUS_EL = $('networkStatus');
const RECENTER_BTN = $('recenterBtn');
const OPEN_DOWNLOAD_BTN = $('openDownloadBtn');
const OPEN_NAV_BTN = $('openNavBtn');
const CLOSE_SHEET_BTN = $('closeSheetBtn');
const SHEET = $('sheet');
const SHEET_TITLE = $('sheetTitle');
const DOWNLOAD_PANEL = $('downloadPanel');
const NAV_PANEL = $('navPanel');

const GLOBAL_SEARCH_INPUT = $('globalSearchInput');
const GLOBAL_SEARCH_BTN = $('globalSearchBtn');
const SEARCH_RESULTS = $('searchResults');
const MAP_CONTEXT_MENU = $('mapContextMenu');
const CTX_BUILD_ROUTE_BTN = $('ctxBuildRouteBtn');
const CTX_SET_START_BTN = $('ctxSetStartBtn');
const CTX_SET_END_BTN = $('ctxSetEndBtn');
const CTX_ADD_FAVORITE_BTN = $('ctxAddFavoriteBtn');
const NAV_CARD = $('navCard');
const NAV_CARD_ARROW = $('navCardArrow');
const NAV_CARD_DISTANCE = $('navCardDistance');
const NAV_CARD_TEXT = $('navCardText');
const NAV_CARD_META = $('navCardMeta');
const SPEED_CHIP = $('speedChip');
const PLACE_ACTIONS = $('placeActions');
const PLACE_TITLE = $('placeTitle');
const PLACE_META = $('placeMeta');
const PLACE_DOWNLOAD_BTN = $('placeDownloadBtn');
const PLACE_ROUTE_BTN = $('placeRouteBtn');
const PLACE_CLOSE_BTN = $('placeCloseBtn');

const AUTO_CACHE_TOGGLE = $('autoCacheToggle');
const DOWNLOAD_BTN = $('downloadBtn');
const MIN_ZOOM_INPUT = $('minZoom');
const MAX_ZOOM_INPUT = $('maxZoom');
const STORAGE_INFO = $('storageInfo');
const DOWNLOAD_STATUS = $('downloadStatus');

const SET_START_GPS_BTN = $('setStartGpsBtn');
const SET_START_MAP_BTN = $('setStartMapBtn');
const SET_END_MAP_BTN = $('setEndMapBtn');
const BUILD_ROUTE_BTN = $('buildRouteBtn');
const START_GUIDANCE_BTN = $('startGuidanceBtn');
const STOP_GUIDANCE_BTN = $('stopGuidanceBtn');
const ICON_UPLOAD_INPUT = $('iconUploadInput');
const RESET_USER_ICON_BTN = $('resetUserIconBtn');
const CUSTOM_LAT_INPUT = $('customLat');
const CUSTOM_LON_INPUT = $('customLon');
const APPLY_CUSTOM_POS_BTN = $('applyCustomPosBtn');
const CLEAR_CUSTOM_POS_BTN = $('clearCustomPosBtn');
const ROUTE_SUMMARY = $('routeSummary');
const NEXT_STEP = $('nextStep');
const STEPS_LIST = $('stepsList');

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

let selectedPlace = null;
let currentSearchResults = [];
let sourceTileTemplates = [];
let activeController = null;
let mapTapMode = null;
let contextLngLat = null;
let longPressTimer = null;
let longPressMoved = false;
let favorites = [];

let startPoint = null;
let endPoint = null;
let routeGeoJson = null;
let routeSteps = [];
let guidanceWatchId = null;
let userLocation = null;
let manualPositionOverride = null;
let rerouteInFlight = false;
let lastRerouteAt = 0;
let userIconDataUrl = null;
let userMarker = null;

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE_URL,
  center: [37.6176, 55.7558],
  zoom: 11,
  hash: true,
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

function setSheet(mode) {
  const opened = mode === 'download' || mode === 'nav';
  SHEET.classList.toggle('closed', !opened);
  SHEET.setAttribute('aria-hidden', opened ? 'false' : 'true');
  DOWNLOAD_PANEL.classList.toggle('hidden', mode !== 'download');
  NAV_PANEL.classList.toggle('hidden', mode !== 'nav');
  SHEET_TITLE.textContent = mode === 'download' ? 'Загрузка оффлайн карт' : mode === 'nav' ? 'Навигатор' : 'Панель';
}

function showPlaceActions(place) {
  selectedPlace = place;
  PLACE_TITLE.textContent = place.name || 'Точка';
  PLACE_META.textContent = place.display;
  PLACE_ACTIONS.classList.remove('hidden');
  PLACE_ACTIONS.setAttribute('aria-hidden', 'false');
}

function hidePlaceActions() {
  PLACE_ACTIONS.classList.add('hidden');
  PLACE_ACTIONS.setAttribute('aria-hidden', 'true');
}

function renderSearchResults(items) {
  SEARCH_RESULTS.innerHTML = '';
  if (!items.length) {
    SEARCH_RESULTS.classList.add('hidden');
    return;
  }

  items.forEach((item, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-item';
    btn.dataset.index = String(idx);
    btn.innerHTML = `<div class="search-item-title">${item.name}</div><div class="search-item-sub">${item.display}</div>`;
    SEARCH_RESULTS.appendChild(btn);
  });

  SEARCH_RESULTS.classList.remove('hidden');
}

function hideSearchResults() {
  SEARCH_RESULTS.classList.add('hidden');
}

function maneuverArrow(type, modifier) {
  if (type === 'arrive') return '▣';
  if (type === 'roundabout') return '⟳';
  if (modifier === 'left' || modifier === 'slight left' || modifier === 'sharp left') return '↰';
  if (modifier === 'right' || modifier === 'slight right' || modifier === 'sharp right') return '↱';
  if (modifier === 'uturn' || modifier === 'uturn left' || modifier === 'uturn right') return '⤺';
  return '↑';
}

function maneuverText(type, modifier, roadName = '') {
  if (type === 'depart') return 'Начните движение прямо';
  if (type === 'arrive') return 'Прибытие в точку назначения';
  if (type === 'roundabout') return 'На круговом движении выберите съезд';
  if (type === 'merge') return 'Перестройтесь и продолжайте';
  if (type === 'fork') return modifier?.includes('left') ? 'Держитесь левее' : 'Держитесь правее';
  if (modifier === 'left') return 'Поверните налево';
  if (modifier === 'right') return 'Поверните направо';
  if (modifier === 'slight left') return 'Плавно поверните налево';
  if (modifier === 'slight right') return 'Плавно поверните направо';
  if (modifier === 'sharp left') return 'Резко поверните налево';
  if (modifier === 'sharp right') return 'Резко поверните направо';
  if (modifier === 'uturn' || modifier === 'uturn left' || modifier === 'uturn right') return 'Развернитесь';
  return 'Двигайтесь прямо';
}

function showNavCard(distanceText, text, meta = '', arrow = '↑') {
  NAV_CARD_ARROW.textContent = arrow;
  NAV_CARD_DISTANCE.textContent = distanceText || '-';
  NAV_CARD_TEXT.textContent = text || '-';
  NAV_CARD_META.textContent = meta;
  NAV_CARD.classList.remove('hidden');
}

function hideNavCard() {
  NAV_CARD.classList.add('hidden');
}

function getCurrentUserLocation() {
  return manualPositionOverride || userLocation;
}

function nearestRouteDistanceMeters(point, lineCoords) {
  if (!lineCoords || lineCoords.length === 0 || !point) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const c of lineCoords) {
    const d = haversineMeters(point, c);
    if (d < best) best = d;
  }
  return best;
}

function showContextMenu(lngLat, point) {
  contextLngLat = [lngLat.lng, lngLat.lat];
  const menuWidth = 230;
  const menuHeight = 210;
  const left = clamp(point.x, 10, window.innerWidth - menuWidth - 10);
  const top = clamp(point.y, 10, window.innerHeight - menuHeight - 10);
  MAP_CONTEXT_MENU.style.left = `${left}px`;
  MAP_CONTEXT_MENU.style.top = `${top}px`;
  MAP_CONTEXT_MENU.classList.remove('hidden');
  MAP_CONTEXT_MENU.setAttribute('aria-hidden', 'false');
}

function hideContextMenu() {
  MAP_CONTEXT_MENU.classList.add('hidden');
  MAP_CONTEXT_MENU.setAttribute('aria-hidden', 'true');
}

function closeTransientUi() {
  setSheet(null);
  hideSearchResults();
  hidePlaceActions();
  hideContextMenu();
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  STATUS_EL.textContent = online ? 'Онлайн' : 'Оффлайн';
  STATUS_EL.classList.toggle('online', online);
  STATUS_EL.classList.toggle('offline', !online);
}

function formatBytes(v) {
  if (!Number.isFinite(v)) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = v;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx > 1 ? 2 : 0)} ${units[idx]}`;
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '-';
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

function formatDuration(sec) {
  if (!Number.isFinite(sec)) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function refreshStorageInfo() {
  if (!navigator.storage?.estimate) {
    STORAGE_INFO.textContent = 'Storage API недоступен в этом браузере.';
    return;
  }
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  STORAGE_INFO.textContent = `Использовано: ${formatBytes(usage)} / Квота: ${formatBytes(quota)}`;
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try {
    await navigator.storage.persist();
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

function latLonToTile(lat, lon, z) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function buildTileRequestsForBbox(bbox, minZoom, maxZoom, templates) {
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
        for (const tpl of templates) {
          out.push(tpl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
        }
      }
    }
  }

  return Array.from(new Set(out));
}

async function resolveVectorTileTemplates() {
  const style = map.getStyle();
  if (!style?.sources) return [];
  const templates = [];

  for (const source of Object.values(style.sources)) {
    if (!source || source.type !== 'vector') continue;
    if (Array.isArray(source.tiles)) {
      templates.push(...source.tiles);
      continue;
    }

    if (source.url && typeof source.url === 'string') {
      try {
        const response = await fetch(source.url);
        if (!response.ok) continue;
        const tileJson = await response.json();
        if (Array.isArray(tileJson.tiles)) templates.push(...tileJson.tiles);
      } catch {
        // ignore
      }
    }
  }

  return Array.from(new Set(templates)).filter((u) => u.includes('{z}') && u.includes('{x}') && u.includes('{y}'));
}

function toPlaceFromNominatim(item) {
  const b = item.boundingbox?.map(Number);
  const south = b ? b[0] : Number(item.lat) - 0.02;
  const north = b ? b[1] : Number(item.lat) + 0.02;
  const west = b ? b[2] : Number(item.lon) - 0.02;
  const east = b ? b[3] : Number(item.lon) + 0.02;

  return {
    name: (item.name || item.display_name || 'Точка').split(',')[0],
    display: item.display_name || `${item.lat}, ${item.lon}`,
    center: [Number(item.lon), Number(item.lat)],
    bbox: [west, south, east, north],
  };
}

async function searchPlaces() {
  const q = GLOBAL_SEARCH_INPUT.value.trim();
  if (!q) return;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&extratags=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    renderSearchResults([]);
    return;
  }

  const arr = await res.json();
  const onlineResults = (Array.isArray(arr) ? arr : []).map(toPlaceFromNominatim);
  const qLow = q.toLowerCase();
  const favResults = favorites
    .filter((f) => (f.name || '').toLowerCase().includes(qLow))
    .map((f) => ({
      name: `★ ${f.name}`,
      display: 'Избранное',
      center: f.center,
      bbox: [f.center[0] - 0.01, f.center[1] - 0.01, f.center[0] + 0.01, f.center[1] + 0.01],
    }));
  currentSearchResults = [...favResults, ...onlineResults].slice(0, 12);
  renderSearchResults(currentSearchResults);
}

function onPlacePicked(place) {
  map.flyTo({ center: place.center, zoom: 14, essential: true });
  map.fitBounds([[place.bbox[0], place.bbox[1]], [place.bbox[2], place.bbox[3]]], { padding: 30, duration: 600, maxZoom: 14 });
  showPlaceActions(place);
  hideSearchResults();
}

async function preloadSelectedArea() {
  if (!selectedPlace) {
    DOWNLOAD_STATUS.textContent = 'Сначала выбери точку через поиск.';
    return;
  }

  const minZoom = clamp(Number(MIN_ZOOM_INPUT.value) || 8, 0, 22);
  const maxZoom = clamp(Number(MAX_ZOOM_INPUT.value) || 12, minZoom, 22);
  MIN_ZOOM_INPUT.value = String(minZoom);
  MAX_ZOOM_INPUT.value = String(maxZoom);

  if (!sourceTileTemplates.length) {
    DOWNLOAD_STATUS.textContent = 'Не удалось получить шаблоны тайлов.';
    return;
  }

  const tileUrls = buildTileRequestsForBbox(selectedPlace.bbox, minZoom, maxZoom, sourceTileTemplates);
  const hardLimit = 50000;
  if (tileUrls.length > hardLimit) {
    DOWNLOAD_STATUS.textContent = `Слишком большая область: ${tileUrls.length} тайлов (лимит ${hardLimit}).`;
    return;
  }

  DOWNLOAD_BTN.disabled = true;
  activeController = new AbortController();

  try {
    let done = 0;
    const total = tileUrls.length;
    const concurrency = 8;

    async function worker() {
      while (tileUrls.length) {
        const url = tileUrls.pop();
        if (!url) break;
        await fetch(url, { mode: 'cors', signal: activeController.signal });
        await postToSw({ type: 'CACHE_URL', url });
        done += 1;
        if (done % 20 === 0 || done === total) {
          DOWNLOAD_STATUS.textContent = `Скачивание: ${done}/${total}`;
          if (done % 100 === 0 || done === total) await refreshStorageInfo();
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    DOWNLOAD_STATUS.textContent = `Готово: ${selectedPlace.name}, тайлов: ${total}`;
  } catch (e) {
    DOWNLOAD_STATUS.textContent = e.name === 'AbortError' ? 'Скачивание остановлено.' : `Ошибка: ${e.message}`;
  } finally {
    activeController = null;
    DOWNLOAD_BTN.disabled = false;
    await refreshStorageInfo();
  }
}

function ensureNavLayers() {
  if (map.getSource('route')) return;

  map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#00639b', 'line-width': 6, 'line-opacity': 0.9 } });

  map.addSource('markers', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'markers-layer',
    type: 'circle',
    source: 'markers',
    paint: {
      'circle-radius': 8,
      'circle-color': ['match', ['get', 'kind'], 'start', '#0f9d58', 'end', '#db4437', '#fbbc04'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  map.addSource('user', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'user-layer',
    type: 'circle',
    source: 'user',
    paint: { 'circle-radius': 7, 'circle-color': '#1a73e8', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
  });

  map.addSource('favorites', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'favorites-layer',
    type: 'circle',
    source: 'favorites',
    paint: {
      'circle-radius': 6,
      'circle-color': '#f59e0b',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
}

function updateRouteLayer() {
  const src = map.getSource('route');
  if (!src) return;
  const data = routeGeoJson
    ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: routeGeoJson, properties: {} }] }
    : { type: 'FeatureCollection', features: [] };
  src.setData(data);
}

function updateMarkersLayer() {
  const src = map.getSource('markers');
  if (!src) return;
  const features = [];
  if (startPoint) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: startPoint }, properties: { kind: 'start' } });
  if (endPoint) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: endPoint }, properties: { kind: 'end' } });
  src.setData({ type: 'FeatureCollection', features });
}

function updateUserLayer() {
  const src = map.getSource('user');
  if (!src) return;
  const current = getCurrentUserLocation();
  const features = current ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: current }, properties: { kind: 'user' } }] : [];
  src.setData({ type: 'FeatureCollection', features });
}

function applyUserMarkerStyle(el) {
  if (userIconDataUrl) {
    el.style.backgroundImage = `url(${userIconDataUrl})`;
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    el.style.width = '42px';
    el.style.height = '42px';
    el.style.border = '0';
    el.style.borderRadius = '0';
    el.style.backgroundColor = 'transparent';
  } else {
    el.style.backgroundImage = '';
    el.style.width = '16px';
    el.style.height = '16px';
    el.style.border = '2px solid #fff';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#1a73e8';
    el.style.boxShadow = '0 0 0 3px rgba(26,115,232,0.2)';
  }
}

function ensureUserMarker() {
  if (userMarker) return userMarker;
  const el = document.createElement('div');
  applyUserMarkerStyle(el);
  userMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([37.6176, 55.7558])
    .addTo(map);
  return userMarker;
}

function updateUserMarker() {
  const current = getCurrentUserLocation();
  if (!current) return;
  const marker = ensureUserMarker();
  applyUserMarkerStyle(marker.getElement());
  marker.setLngLat(current);
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem('offlinely_favorites');
    const parsed = raw ? JSON.parse(raw) : [];
    favorites = Array.isArray(parsed) ? parsed : [];
  } catch {
    favorites = [];
  }
}

function loadUserSettings() {
  try {
    userIconDataUrl = localStorage.getItem('offlinely_user_icon') || null;
    const rawPos = localStorage.getItem('offlinely_manual_pos');
    manualPositionOverride = rawPos ? JSON.parse(rawPos) : null;
    if (manualPositionOverride) {
      CUSTOM_LAT_INPUT.value = String(manualPositionOverride[1]);
      CUSTOM_LON_INPUT.value = String(manualPositionOverride[0]);
    }
  } catch {
    userIconDataUrl = null;
    manualPositionOverride = null;
  }
}

function saveUserIcon(dataUrl) {
  userIconDataUrl = dataUrl;
  if (dataUrl) {
    localStorage.setItem('offlinely_user_icon', dataUrl);
  } else {
    localStorage.removeItem('offlinely_user_icon');
  }
  updateUserMarker();
}

function saveManualPosition(pos) {
  manualPositionOverride = pos;
  if (pos) {
    localStorage.setItem('offlinely_manual_pos', JSON.stringify(pos));
  } else {
    localStorage.removeItem('offlinely_manual_pos');
  }
  updateUserLayer();
  updateUserMarker();
}

function saveFavorites() {
  localStorage.setItem('offlinely_favorites', JSON.stringify(favorites));
}

function updateFavoritesLayer() {
  const src = map.getSource('favorites');
  if (!src) return;
  src.setData({
    type: 'FeatureCollection',
    features: favorites.map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: f.center },
      properties: { name: f.name },
    })),
  });
}

function renderSteps(activeIndex = -1) {
  STEPS_LIST.innerHTML = '';
  routeSteps.forEach((step, i) => {
    const el = document.createElement('div');
    el.className = `step-item${i === activeIndex ? ' active' : ''}`;
    el.textContent = `${i + 1}. ${step.maneuver.arrow} ${step.maneuver.instruction} (${formatDistance(step.distance)})`;
    STEPS_LIST.appendChild(el);
  });
}

async function buildRoute() {
  if (!startPoint || !endPoint) {
    ROUTE_SUMMARY.textContent = 'Укажи старт и финиш.';
    return;
  }
  if (!navigator.onLine) {
    ROUTE_SUMMARY.textContent = 'Для построения маршрута нужен интернет.';
    return;
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${startPoint[0]},${startPoint[1]};${endPoint[0]},${endPoint[1]}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) {
    ROUTE_SUMMARY.textContent = 'Маршрут не построен (ошибка сервера).';
    return;
  }

  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) {
    ROUTE_SUMMARY.textContent = 'Маршрут не найден.';
    return;
  }

  routeGeoJson = route.geometry;
  routeSteps = (route.legs ?? []).flatMap((leg) => leg.steps ?? []).map((step) => ({
    distance: step.distance,
    duration: step.duration,
    maneuver: {
      instruction: maneuverText(step.maneuver?.type, step.maneuver?.modifier, step.name || ''),
      arrow: maneuverArrow(step.maneuver?.type, step.maneuver?.modifier),
      location: step.maneuver?.location,
    },
    roadName: step.name || '',
  }));

  updateRouteLayer();
  renderSteps();

  const coords = route.geometry.coordinates;
  const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(bounds, { padding: 40, duration: 700 });

  ROUTE_SUMMARY.textContent = `Маршрут: ${formatDistance(route.distance)}, ${formatDuration(route.duration)}.`;
  NEXT_STEP.textContent = routeSteps.length ? `Следующий маневр: ${routeSteps[0].maneuver.instruction}` : 'Следующий маневр: -';
  showNavCard(
    routeSteps.length ? formatDistance(routeSteps[0].distance) : '-',
    routeSteps.length ? routeSteps[0].maneuver.instruction : 'Маршрут построен',
    routeSteps.length ? (routeSteps[0].roadName || 'Держись маршрута') : '',
    routeSteps.length ? routeSteps[0].maneuver.arrow : '↑'
  );
}

function findClosestStepIndex(lngLat) {
  if (!routeSteps.length) return -1;
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  routeSteps.forEach((step, i) => {
    const loc = step.maneuver?.location;
    if (!Array.isArray(loc)) return;
    const d = haversineMeters(lngLat, loc);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function startGuidance() {
  if (!routeGeoJson || !routeSteps.length) {
    ROUTE_SUMMARY.textContent = 'Сначала построй маршрут.';
    return;
  }
  if (!navigator.geolocation) {
    ROUTE_SUMMARY.textContent = 'Геолокация недоступна.';
    return;
  }
  if (guidanceWatchId !== null) return;

  guidanceWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      if (!manualPositionOverride) {
        userLocation = [pos.coords.longitude, pos.coords.latitude];
      }
      updateUserLayer();
      updateUserMarker();

      const current = getCurrentUserLocation();
      const idx = findClosestStepIndex(current);
      if (idx >= 0) {
        const step = routeSteps[idx];
        const dist = haversineMeters(current, step.maneuver.location);
        NEXT_STEP.textContent = `Следующий маневр: ${step.maneuver.instruction} через ${formatDistance(dist)}`;
        renderSteps(idx);
        showNavCard(formatDistance(dist), step.maneuver.instruction, step.roadName || 'Следуй указанию', step.maneuver.arrow);
      }

      const speedKmh = Number.isFinite(pos.coords.speed) ? Math.max(0, pos.coords.speed * 3.6) : 0;
      SPEED_CHIP.textContent = `${Math.round(speedKmh)} км/ч`;

      const offRouteDistance = nearestRouteDistanceMeters(current, routeGeoJson?.coordinates);
      const rerouteCooldownMs = 12000;
      if (offRouteDistance > 55 && !rerouteInFlight && Date.now() - lastRerouteAt > rerouteCooldownMs) {
        rerouteInFlight = true;
        lastRerouteAt = Date.now();
        startPoint = [...current];
        ROUTE_SUMMARY.textContent = 'Перестраиваю маршрут...';
        await buildRoute().catch(() => {
          ROUTE_SUMMARY.textContent = 'Не удалось перестроить маршрут.';
        });
        rerouteInFlight = false;
      }

      map.easeTo({ center: current, duration: 350, zoom: Math.max(map.getZoom(), 14) });
    },
    (err) => {
      ROUTE_SUMMARY.textContent = `Ошибка GPS: ${err.message}`;
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 9000 }
  );

  ROUTE_SUMMARY.textContent = 'Ведение запущено.';
}

function stopGuidance() {
  if (guidanceWatchId !== null) {
    navigator.geolocation.clearWatch(guidanceWatchId);
    guidanceWatchId = null;
  }
  NEXT_STEP.textContent = 'Следующий маневр: -';
  ROUTE_SUMMARY.textContent = 'Ведение остановлено.';
  hideNavCard();
}

async function ensureStartByGps() {
  if (startPoint) return true;
  if (manualPositionOverride) {
    startPoint = [...manualPositionOverride];
    userLocation = [...manualPositionOverride];
    updateMarkersLayer();
    updateUserLayer();
    updateUserMarker();
    return true;
  }
  if (!navigator.geolocation) return false;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startPoint = [pos.coords.longitude, pos.coords.latitude];
        userLocation = startPoint;
        updateMarkersLayer();
        updateUserLayer();
        updateUserMarker();
        resolve(true);
      },
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function ensureStartFallbackFromMap() {
  if (startPoint) return true;
  const c = map.getCenter();
  if (!c) return false;
  startPoint = [c.lng, c.lat];
  updateMarkersLayer();
  return true;
}

function setupEvents() {
  OPEN_DOWNLOAD_BTN.addEventListener('click', () => setSheet('download'));
  OPEN_NAV_BTN.addEventListener('click', () => setSheet('nav'));
  CLOSE_SHEET_BTN.addEventListener('click', () => setSheet(null));

  RECENTER_BTN.addEventListener('click', () => {
    if (manualPositionOverride) {
      updateUserLayer();
      updateUserMarker();
      map.flyTo({ center: manualPositionOverride, zoom: 14, essential: true });
      return;
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = [pos.coords.longitude, pos.coords.latitude];
        userLocation = p;
        updateUserLayer();
        updateUserMarker();
        map.flyTo({ center: p, zoom: 14, essential: true });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  GLOBAL_SEARCH_BTN.addEventListener('click', () => searchPlaces().catch(() => renderSearchResults([])));
  GLOBAL_SEARCH_INPUT.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      GLOBAL_SEARCH_BTN.click();
    }
  });

  SEARCH_RESULTS.addEventListener('click', (e) => {
    const target = e.target.closest('.search-item');
    if (!target) return;
    const idx = Number(target.dataset.index);
    const place = currentSearchResults[idx];
    if (place) onPlacePicked(place);
  });

  PLACE_CLOSE_BTN.addEventListener('click', () => hidePlaceActions());
  PLACE_DOWNLOAD_BTN.addEventListener('click', async () => {
    if (!selectedPlace) return;
    setSheet('download');
    await preloadSelectedArea();
  });

  PLACE_ROUTE_BTN.addEventListener('click', async () => {
    if (!selectedPlace) return;
    endPoint = selectedPlace.center;
    updateMarkersLayer();
    setSheet('nav');
    let ok = await ensureStartByGps();
    if (!ok) {
      ok = ensureStartFallbackFromMap();
    }
    if (!ok) {
      ROUTE_SUMMARY.textContent = 'Не удалось определить старт (GPS или центр карты).';
      return;
    }
    await buildRoute().catch((e) => {
      ROUTE_SUMMARY.textContent = `Ошибка маршрута: ${e.message}`;
    });
  });

  DOWNLOAD_BTN.addEventListener('click', () => preloadSelectedArea());
  AUTO_CACHE_TOGGLE.addEventListener('change', () => postToSw({ type: 'SET_AUTO_CACHE', enabled: AUTO_CACHE_TOGGLE.checked }));

  SET_START_GPS_BTN.addEventListener('click', () => {
    ensureStartByGps().then((ok) => {
      ROUTE_SUMMARY.textContent = ok ? 'Старт установлен по GPS.' : 'Не удалось получить GPS.';
    });
  });

  SET_START_MAP_BTN.addEventListener('click', () => {
    mapTapMode = 'start';
    ROUTE_SUMMARY.textContent = 'Тапни по карте для установки старта.';
  });

  SET_END_MAP_BTN.addEventListener('click', () => {
    mapTapMode = 'end';
    ROUTE_SUMMARY.textContent = 'Тапни по карте для установки финиша.';
  });

  BUILD_ROUTE_BTN.addEventListener('click', () => buildRoute().catch((e) => {
    ROUTE_SUMMARY.textContent = `Ошибка маршрута: ${e.message}`;
  }));

  START_GUIDANCE_BTN.addEventListener('click', () => startGuidance());
  STOP_GUIDANCE_BTN.addEventListener('click', () => stopGuidance());
  ICON_UPLOAD_INPUT.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
      reader.readAsDataURL(file);
    });
    saveUserIcon(String(dataUrl));
  });

  RESET_USER_ICON_BTN.addEventListener('click', () => {
    ICON_UPLOAD_INPUT.value = '';
    saveUserIcon(null);
  });

  APPLY_CUSTOM_POS_BTN.addEventListener('click', () => {
    const lat = Number(CUSTOM_LAT_INPUT.value);
    const lon = Number(CUSTOM_LON_INPUT.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      ROUTE_SUMMARY.textContent = 'Введите корректные lat/lon.';
      return;
    }
    saveManualPosition([lon, lat]);
    map.flyTo({ center: [lon, lat], zoom: 14, essential: true });
    ROUTE_SUMMARY.textContent = 'Ручная позиция применена.';
  });

  CLEAR_CUSTOM_POS_BTN.addEventListener('click', () => {
    saveManualPosition(null);
    CUSTOM_LAT_INPUT.value = '';
    CUSTOM_LON_INPUT.value = '';
    ROUTE_SUMMARY.textContent = 'Возврат к GPS.';
  });
  CTX_SET_START_BTN.addEventListener('click', () => {
    if (!contextLngLat) return;
    startPoint = [...contextLngLat];
    updateMarkersLayer();
    ROUTE_SUMMARY.textContent = 'Старт установлен из точки на карте.';
    hideContextMenu();
  });

  CTX_SET_END_BTN.addEventListener('click', () => {
    if (!contextLngLat) return;
    endPoint = [...contextLngLat];
    updateMarkersLayer();
    ROUTE_SUMMARY.textContent = 'Финиш установлен из точки на карте.';
    hideContextMenu();
  });

  CTX_BUILD_ROUTE_BTN.addEventListener('click', async () => {
    if (!contextLngLat) return;
    endPoint = [...contextLngLat];
    updateMarkersLayer();
    let ok = await ensureStartByGps();
    if (!ok) ok = ensureStartFallbackFromMap();
    if (!ok) {
      ROUTE_SUMMARY.textContent = 'Не удалось определить старт.';
      return;
    }
    setSheet('nav');
    hideContextMenu();
    await buildRoute().catch((e) => {
      ROUTE_SUMMARY.textContent = `Ошибка маршрута: ${e.message}`;
    });
  });

  CTX_ADD_FAVORITE_BTN.addEventListener('click', () => {
    if (!contextLngLat) return;
    const name = prompt('Название точки в избранном:', 'Точка');
    if (!name || !name.trim()) return;
    favorites.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      center: [...contextLngLat],
    });
    saveFavorites();
    updateFavoritesLayer();
    hideContextMenu();
  });

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  map.on('click', (e) => {
    if (mapTapMode) {
      const p = [e.lngLat.lng, e.lngLat.lat];
      if (mapTapMode === 'start') {
        startPoint = p;
        ROUTE_SUMMARY.textContent = 'Старт установлен.';
      } else {
        endPoint = p;
        ROUTE_SUMMARY.textContent = 'Финиш установлен.';
      }
      mapTapMode = null;
      updateMarkersLayer();
      return;
    }
    closeTransientUi();
  });

  map.on('mousedown', (e) => {
    longPressMoved = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (!longPressMoved) {
        closeTransientUi();
        showContextMenu(e.lngLat, e.point);
      }
    }, 520);
  });

  map.on('touchstart', (e) => {
    if (!e.points || !e.points[0]) return;
    longPressMoved = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (!longPressMoved) {
        closeTransientUi();
        showContextMenu(e.lngLat, e.point);
      }
    }, 520);
  });

  map.on('mouseup', () => clearTimeout(longPressTimer));
  map.on('touchend', () => clearTimeout(longPressTimer));
  map.on('dragstart', () => {
    longPressMoved = true;
    clearTimeout(longPressTimer);
  });
}

function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg?.type === 'SETTINGS') AUTO_CACHE_TOGGLE.checked = Boolean(msg.autoCacheEnabled);
  });

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
      await postToSw({ type: 'GET_SETTINGS' });
    } catch (error) {
      console.error('SW registration failed', error);
    }
  });
}

async function init() {
  setSheet(null);
  hidePlaceActions();
  hideSearchResults();
  hideContextMenu();
  hideNavCard();
  loadFavorites();
  loadUserSettings();
  updateNetworkStatus();
  setupEvents();
  setupServiceWorker();
  await requestPersistentStorage();
  await refreshStorageInfo();

  map.on('load', async () => {
    ensureNavLayers();
    updateFavoritesLayer();
    updateUserLayer();
    updateUserMarker();
    sourceTileTemplates = await resolveVectorTileTemplates();
    DOWNLOAD_STATUS.textContent = sourceTileTemplates.length ? 'Готово к загрузке области.' : 'Не найдены шаблоны векторных тайлов.';
  });
}

init();
