const $ = (id) => document.getElementById(id);

const STATUS_EL = $('networkStatus');
const RECENTER_BTN = $('recenterBtn');
const OPEN_DOWNLOAD_BTN = $('openDownloadBtn');
const OPEN_SETTINGS_BTN = $('openSettingsBtn');
const OPEN_NAV_BTN = $('openNavBtn');
const CLOSE_SHEET_BTN = $('closeSheetBtn');
const SHEET = $('sheet');
const SHEET_TITLE = $('sheetTitle');
const DOWNLOAD_PANEL = $('downloadPanel');
const NAV_PANEL = $('navPanel');
const SETTINGS_PANEL = $('settingsPanel');

const GLOBAL_SEARCH_INPUT = $('globalSearchInput');
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
const OPEN_OFFLINE_PAGE_BTN = $('openOfflinePageBtn');
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
const ROUTE_VARIANTS = $('routeVariants');
const CONTINUE_LAST_ROUTE_BTN = $('continueLastRouteBtn');
const ROUTE_HISTORY_LIST = $('routeHistoryList');
const NEXT_STEP = $('nextStep');
const STEPS_LIST = $('stepsList');
const PREFER_SERVER_ROUTE_TOGGLE = $('preferServerRouteToggle');
const THEME_SELECT = $('themeSelect');
const VOICE_ENABLED_TOGGLE = $('voiceEnabledToggle');
const VOICE_RATE = $('voiceRate');
const VOICE_VOLUME = $('voiceVolume');
const VOICE_SELECT = $('voiceSelect');
const VOICE_TEST_BTN = $('voiceTestBtn');
const VOICE_PACK_BTN = $('voicePackBtn');
const VOICE_PACK_STATUS = $('voicePackStatus');
const AVOID_TOLLS_TOGGLE = $('avoidTollsToggle');
const AVOID_FERRIES_TOGGLE = $('avoidFerriesToggle');
const AVOID_CITIES_TOGGLE = $('avoidCitiesToggle');
const ROUTE_VARIANTS_COUNT = $('routeVariantsCount');
const REROUTE_THRESHOLD = $('rerouteThreshold');

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const THEME_KEY = 'offlinely_theme';

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
let routeCandidates = [];
let activeRouteIndex = 0;
let routeHistory = [];
let guidanceWatchId = null;
let userLocation = null;
let userHeadingDeg = null;
let gpsFix = null;
let smoothLocation = null;
let trackingRaf = null;
let lastFrameTs = 0;
let orientationListening = false;
let etaMinutes = null;
let manualPositionOverride = null;
let rerouteInFlight = false;
let lastRerouteAt = 0;
let userIconDataUrl = null;
let userMarker = null;
let spokenStepMarks = new Set();
let lastSpokenStepIdx = -1;
let speechVoices = [];
const VOICE_KEY = 'offlinely_voice';
const VOICE_PACK_KEY = 'offlinely_voice_pack_ready_at';
const ACTIVE_TRIP_KEY = 'offlinely_active_trip';

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE_URL,
  center: [37.6176, 55.7558],
  zoom: 11,
  hash: true,
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

function setSheet(mode) {
  const opened = mode === 'download' || mode === 'nav' || mode === 'settings';
  SHEET.classList.toggle('closed', !opened);
  SHEET.setAttribute('aria-hidden', opened ? 'false' : 'true');
  DOWNLOAD_PANEL.classList.toggle('hidden', mode !== 'download');
  NAV_PANEL.classList.toggle('hidden', mode !== 'nav');
  SETTINGS_PANEL.classList.toggle('hidden', mode !== 'settings');
  SHEET_TITLE.textContent = mode === 'download' ? 'Загрузка оффлайн карт' : mode === 'nav' ? 'Навигатор' : mode === 'settings' ? 'Настройки маршрута' : 'Панель';
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

function formatEtaMinutes(mins) {
  if (!Number.isFinite(mins)) return '-';
  const m = Math.max(1, Math.round(mins));
  return `${m} мин`;
}

function trafficMultiplierByHour(hour) {
  if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20)) return 1.45;
  if (hour >= 11 && hour <= 16) return 1.18;
  return 1.0;
}

function estimateEtaWithTraffic(remainingDurationSec, speedKmh) {
  const h = new Date().getHours();
  const base = remainingDurationSec / 60;
  const traffic = trafficMultiplierByHour(h);
  const speedFactor = speedKmh > 1 ? Math.max(0.85, Math.min(1.55, 50 / speedKmh)) : 1.25;
  return base * traffic * speedFactor;
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

function toLocalMeters(coord, refLat) {
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((refLat * Math.PI) / 180);
  return [coord[0] * mPerDegLon, coord[1] * mPerDegLat];
}

function fromLocalMeters(xy, refLat) {
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((refLat * Math.PI) / 180);
  return [xy[0] / mPerDegLon, xy[1] / mPerDegLat];
}

function projectPointToSegment(p, a, b) {
  const refLat = (a[1] + b[1]) / 2;
  const pp = toLocalMeters(p, refLat);
  const aa = toLocalMeters(a, refLat);
  const bb = toLocalMeters(b, refLat);
  const abx = bb[0] - aa[0];
  const aby = bb[1] - aa[1];
  const apx = pp[0] - aa[0];
  const apy = pp[1] - aa[1];
  const denom = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
  const proj = [aa[0] + abx * t, aa[1] + aby * t];
  const dx = pp[0] - proj[0];
  const dy = pp[1] - proj[1];
  return {
    point: fromLocalMeters(proj, refLat),
    dist: Math.hypot(dx, dy),
    t,
  };
}

function snapToRoute(point, coords) {
  if (!coords || coords.length < 2) return { point, dist: Number.POSITIVE_INFINITY, segment: -1 };
  let best = { point, dist: Number.POSITIVE_INFINITY, segment: -1, t: 0 };
  for (let i = 1; i < coords.length; i += 1) {
    const proj = projectPointToSegment(point, coords[i - 1], coords[i]);
    if (proj.dist < best.dist) {
      best = { point: proj.point, dist: proj.dist, segment: i - 1, t: proj.t };
    }
  }
  return best;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpCoord(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

function projectLonLat(coord, bearingDeg, meters) {
  const R = 6378137;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (coord[1] * Math.PI) / 180;
  const lon1 = (coord[0] * Math.PI) / 180;
  const d = meters / R;

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

function metersToDegreesLat(m) {
  return m / 111320;
}

function metersToDegreesLon(m, lat) {
  return m / (111320 * Math.cos((lat * Math.PI) / 180));
}

function coordKey(c) {
  return `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
}

function parseLineCoords(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

function getRoadLayerIds() {
  const layers = map.getStyle()?.layers || [];
  return layers
    .filter((l) => l.type === 'line')
    .map((l) => l.id);
}

function buildRoadGraphFromRendered() {
  const roadLayerIds = getRoadLayerIds();
  const features = roadLayerIds.length ? map.queryRenderedFeatures(undefined, { layers: roadLayerIds }) : [];
  const nodes = new Map();
  const adj = new Map();

  function ensureNode(coord) {
    const key = coordKey(coord);
    if (!nodes.has(key)) nodes.set(key, [coord[0], coord[1]]);
    if (!adj.has(key)) adj.set(key, []);
    return key;
  }

  for (const f of features) {
    const p = f.properties || {};
    const cls = String(p.class || p.type || p.kind || '').toLowerCase();
    const sourceLayer = String(p['source-layer'] || '').toLowerCase();
    const keepByHint =
      /(road|street|motorway|trunk|primary|secondary|tertiary|residential|service)/.test(cls) ||
      /(road|street|transportation)/.test(sourceLayer) ||
      !(cls.includes('water') || cls.includes('river') || cls.includes('rail') || cls.includes('boundary'));
    if (!keepByHint) continue;

    const lines = parseLineCoords(f.geometry);
    for (const line of lines) {
      for (let i = 1; i < line.length; i += 1) {
        const a = line[i - 1];
        const b = line[i];
        const ak = ensureNode(a);
        const bk = ensureNode(b);
        const w = haversineMeters(a, b);
        adj.get(ak).push({ to: bk, w });
        adj.get(bk).push({ to: ak, w });
      }
    }
  }
  return { nodes, adj };
}

function nearestGraphNodeKey(nodes, point) {
  let bestKey = null;
  let best = Number.POSITIVE_INFINITY;
  for (const [k, c] of nodes.entries()) {
    const d = haversineMeters(point, c);
    if (d < best) {
      best = d;
      bestKey = k;
    }
  }
  return { key: bestKey, distance: best };
}

function shortestPath(graph, startKey, endKey) {
  const { adj, nodes } = graph;
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const visited = new Set();

  while (true) {
    let cur = null;
    let curDist = Number.POSITIVE_INFINITY;
    for (const [k, d] of dist.entries()) {
      if (!visited.has(k) && d < curDist) {
        cur = k;
        curDist = d;
      }
    }
    if (!cur) break;
    if (cur === endKey) break;
    visited.add(cur);
    for (const e of adj.get(cur) || []) {
      const nd = curDist + e.w;
      if (nd < (dist.get(e.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(e.to, nd);
        prev.set(e.to, cur);
      }
    }
  }

  if (!dist.has(endKey)) return null;
  const pathKeys = [];
  let p = endKey;
  while (p) {
    pathKeys.push(p);
    p = prev.get(p);
    if (p === startKey) {
      pathKeys.push(startKey);
      break;
    }
  }
  pathKeys.reverse();
  const coords = pathKeys.map((k) => nodes.get(k));
  return coords.length >= 2 ? coords : null;
}

function makeCandidateFromCoords(coords, label = 'Локальный маршрут') {
  let distance = 0;
  for (let i = 1; i < coords.length; i += 1) {
    distance += haversineMeters(coords[i - 1], coords[i]);
  }
  const avgSpeedMps = 13.9; // ~50 км/ч
  const duration = distance / avgSpeedMps;

  const firstStepTarget = coords[Math.min(1, coords.length - 1)];
  const endStepTarget = coords[coords.length - 1];
  const steps = [
    {
      distance: Math.max(distance * 0.7, 1),
      duration: Math.max(duration * 0.7, 1),
      maneuver: {
        instruction: 'Следуйте по дороге',
        arrow: '↑',
        location: firstStepTarget,
      },
      roadName: label,
    },
    {
      distance: Math.max(distance * 0.3, 1),
      duration: Math.max(duration * 0.3, 1),
      maneuver: {
        instruction: 'Прибытие в точку назначения',
        arrow: '▣',
        location: endStepTarget,
      },
      roadName: '',
    },
  ];

  return {
    geometry: { type: 'LineString', coordinates: coords },
    distance,
    duration,
    steps,
  };
}

function buildSoftFallbackCoords(start, end) {
  const midLat = (start[1] + end[1]) / 2;
  const midLon = (start[0] + end[0]) / 2;
  const dLon = Math.abs(end[0] - start[0]);
  const dLat = Math.abs(end[1] - start[1]);
  if (dLon > dLat) {
    return [start, [midLon, start[1]], [midLon, end[1]], end];
  }
  return [start, [start[0], midLat], [end[0], midLat], end];
}

function buildLocalRouteCandidates(start, end, variants) {
  const graph = buildRoadGraphFromRendered();
  const startNode = nearestGraphNodeKey(graph.nodes, start);
  const endNode = nearestGraphNodeKey(graph.nodes, end);

  const canUseGraph =
    graph.nodes.size > 20 &&
    startNode.key &&
    endNode.key &&
    startNode.distance < 1500 &&
    endNode.distance < 1500;

  if (!canUseGraph) {
    return [makeCandidateFromCoords(buildSoftFallbackCoords(start, end), 'Упрощенный локальный (мало данных дорог)')];
  }

  const base = shortestPath(graph, startNode.key, endNode.key);
  if (!base) return [makeCandidateFromCoords(buildSoftFallbackCoords(start, end), 'Упрощенный локальный (маршрут не найден)')];

  const candidates = [makeCandidateFromCoords(base, 'Маршрут по загруженным дорогам')];
  for (let i = 1; i < variants; i += 1) {
    const mid = base[Math.floor((base.length - 1) * (i / (variants + 1)))];
    const off = [mid[0] + metersToDegreesLon(250 * (i % 2 ? -1 : 1), mid[1]), mid[1] + metersToDegreesLat(220 * (i % 2 ? 1 : -1))];
    const via = nearestGraphNodeKey(graph.nodes, off);
    if (!via.key) continue;
    const p1 = shortestPath(graph, startNode.key, via.key);
    const p2 = shortestPath(graph, via.key, endNode.key);
    if (!p1 || !p2) continue;
    const alt = [...p1.slice(0, -1), ...p2];
    candidates.push(makeCandidateFromCoords(alt, 'Альтернативный локальный'));
  }
  return candidates.slice(0, variants);
}

async function buildServerRouteCandidates(start, end, settings) {
  const base = {
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
  };
  const excludes = [];
  if (settings.avoidTolls) excludes.push('toll');
  if (settings.avoidFerries) excludes.push('ferry');

  const attempts = [];
  attempts.push({
    ...base,
    alternatives: settings.variants > 1 ? 'true' : 'false',
    ...(excludes.length ? { exclude: excludes.join(',') } : {}),
  });
  attempts.push({
    ...base,
    alternatives: settings.variants > 1 ? 'true' : 'false',
  });
  attempts.push({
    ...base,
    alternatives: 'false',
  });

  let data = null;
  let lastError = '';
  const baseCandidates = [];
  const seen = new Set();

  function routeFingerprint(r) {
    const c = r?.geometry?.coordinates || [];
    if (c.length < 2) return `${Math.round(r.distance || 0)}:${Math.round(r.duration || 0)}`;
    const a = c[0];
    const b = c[Math.floor(c.length / 2)];
    const d = c[c.length - 1];
    return `${a[0].toFixed(3)},${a[1].toFixed(3)}|${b[0].toFixed(3)},${b[1].toFixed(3)}|${d[0].toFixed(3)},${d[1].toFixed(3)}`;
  }

  function pushUniqueRoutes(routes) {
    for (const r of routes || []) {
      const fp = routeFingerprint(r);
      if (!seen.has(fp)) {
        seen.add(fp);
        baseCandidates.push(r);
      }
      if (baseCandidates.length >= settings.variants) break;
    }
  }
  for (const attempt of attempts) {
    const params = new URLSearchParams(attempt);
    const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      lastError = `HTTP ${res.status}`;
      continue;
    }
    const candidate = await res.json();
    if (candidate?.code === 'Ok' && Array.isArray(candidate.routes) && candidate.routes.length) {
      data = candidate;
      pushUniqueRoutes(candidate.routes);
      break;
    }
    lastError = candidate?.message || 'No routes';
  }
  if (!data) {
    ROUTE_SUMMARY.textContent = `Серверный маршрут недоступен (${lastError || 'no route'}).`;
    return [];
  }

  // If server returned less than requested, ask server again with a via point to force alternatives.
  if (baseCandidates.length < settings.variants) {
    const midLon = (start[0] + end[0]) / 2;
    const midLat = (start[1] + end[1]) / 2;
    const viaOffsets = [
      [metersToDegreesLon(900, midLat), metersToDegreesLat(700)],
      [-metersToDegreesLon(900, midLat), -metersToDegreesLat(700)],
      [metersToDegreesLon(1400, midLat), -metersToDegreesLat(900)],
      [-metersToDegreesLon(1400, midLat), metersToDegreesLat(900)],
    ];
    for (const [dx, dy] of viaOffsets) {
      if (baseCandidates.length >= settings.variants) break;
      const via = [midLon + dx, midLat + dy];
      const p = new URLSearchParams({
        overview: 'full',
        geometries: 'geojson',
        steps: 'true',
        alternatives: 'false',
      });
      const viaUrl = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${via[0]},${via[1]};${end[0]},${end[1]}?${p.toString()}`;
      try {
        const r = await fetch(viaUrl);
        if (!r.ok) continue;
        const j = await r.json();
        if (j?.code === 'Ok' && Array.isArray(j.routes) && j.routes.length) {
          pushUniqueRoutes(j.routes);
        }
      } catch {
        // ignore and keep trying
      }
    }
  }

  return baseCandidates.slice(0, settings.variants).map((r) => {
    const steps = (r.legs ?? []).flatMap((leg) => leg.steps ?? []).map((step) => ({
      distance: step.distance,
      duration: step.duration,
      maneuver: {
        instruction: maneuverText(step.maneuver?.type, step.maneuver?.modifier, step.name || ''),
        arrow: maneuverArrow(step.maneuver?.type, step.maneuver?.modifier),
        location: step.maneuver?.location,
      },
      roadName: step.name || '',
    }));
    return { geometry: r.geometry, distance: r.distance, duration: r.duration, steps };
  });
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
  // Keep car icon direction stable in viewport while map rotates with phone.
  marker.setRotationAlignment('viewport');
  marker.setRotation(0);
  marker.setLngLat(current);
}

function extractHeadingFromEvent(e) {
  if (typeof e.webkitCompassHeading === 'number') return e.webkitCompassHeading;
  if (typeof e.alpha === 'number') return (360 - e.alpha + 360) % 360;
  return null;
}

async function enableOrientationTracking() {
  if (orientationListening) return;
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p !== 'granted') return;
    }
  } catch {
    // ignore permission failure
  }

  const handler = (e) => {
    const heading = extractHeadingFromEvent(e);
    if (!Number.isFinite(heading)) return;
    userHeadingDeg = heading;
    if (guidanceWatchId !== null) {
      map.easeTo({ bearing: heading, duration: 120 });
    }
  };
  window.addEventListener('deviceorientationabsolute', handler, true);
  window.addEventListener('deviceorientation', handler, true);
  orientationListening = true;
}

function stopTrackingLoop() {
  if (trackingRaf !== null) {
    cancelAnimationFrame(trackingRaf);
    trackingRaf = null;
  }
  lastFrameTs = 0;
}

function navigationFrame(ts) {
  if (guidanceWatchId === null) {
    stopTrackingLoop();
    return;
  }

  const current = getCurrentUserLocation();
  if (!current) {
    trackingRaf = requestAnimationFrame(navigationFrame);
    return;
  }

  if (!lastFrameTs) lastFrameTs = ts;
  const dtSec = Math.max(0.001, Math.min((ts - lastFrameTs) / 1000, 0.2));
  lastFrameTs = ts;

  let predicted = current;
  if (gpsFix && Number.isFinite(gpsFix.speedMps) && gpsFix.speedMps > 0.4) {
    const heading = Number.isFinite(gpsFix.headingDeg) ? gpsFix.headingDeg : (Number.isFinite(userHeadingDeg) ? userHeadingDeg : 0);
    predicted = projectLonLat(current, heading, gpsFix.speedMps * dtSec);
  }

  smoothLocation = smoothLocation ? lerpCoord(smoothLocation, predicted, 0.55) : predicted;
  const snapped = snapToRoute(smoothLocation, routeGeoJson?.coordinates);
  const navPosition = snapped.dist < 80 ? snapped.point : smoothLocation;
  if (!manualPositionOverride) userLocation = snapped.dist < 80 ? navPosition : smoothLocation;
  updateUserLayer();
  updateUserMarker();

  const idx = findClosestStepIndex(navPosition);
  if (idx >= 0) {
    const step = routeSteps[idx];
    const dist = haversineMeters(navPosition, step.maneuver.location);
    const remainingDurationSec = routeSteps.slice(idx).reduce((s, st) => s + (st.duration || 0), 0);
    renderSteps(idx);
    const speedKmh = Number.isFinite(gpsFix?.speedMps) ? Math.max(0, gpsFix.speedMps * 3.6) : 0;
    etaMinutes = estimateEtaWithTraffic(remainingDurationSec, speedKmh);
    ROUTE_SUMMARY.textContent = `Навигация: ETA ${formatEtaMinutes(etaMinutes)} (с учетом пробок).`;
    NEXT_STEP.textContent = `Следующий маневр: ${step.maneuver.instruction} через ${formatDistance(dist)}`;
    showNavCard(
      formatDistance(dist),
      step.maneuver.instruction,
      `ETA: ${formatEtaMinutes(etaMinutes)} • ${step.roadName || 'Следуй указанию'}`,
      step.maneuver.arrow
    );
    maybeSpeakManeuver(idx, dist, step.maneuver.instruction);
  }

  const offRouteDistance = nearestRouteDistanceMeters(navPosition, routeGeoJson?.coordinates);
  const rerouteCooldownMs = 12000;
  const settings = getRouteSettings();
  if (offRouteDistance > settings.rerouteThreshold && !rerouteInFlight && Date.now() - lastRerouteAt > rerouteCooldownMs) {
    rerouteInFlight = true;
    lastRerouteAt = Date.now();
    startPoint = [...navPosition];
    ROUTE_SUMMARY.textContent = 'Перестраиваю маршрут...';
    buildRoute().finally(() => {
      rerouteInFlight = false;
    });
  }

  map.jumpTo({
    center: navPosition,
    zoom: Math.max(map.getZoom(), 14),
    bearing: Number.isFinite(userHeadingDeg) ? userHeadingDeg : map.getBearing(),
  });

  trackingRaf = requestAnimationFrame(navigationFrame);
}

function startTrackingLoop() {
  if (trackingRaf !== null) return;
  trackingRaf = requestAnimationFrame(navigationFrame);
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

function loadRouteSettings() {
  try {
    const raw = localStorage.getItem('offlinely_route_settings');
    if (!raw) return;
    const s = JSON.parse(raw);
    PREFER_SERVER_ROUTE_TOGGLE.checked = s.preferServerRoute !== false;
    AVOID_TOLLS_TOGGLE.checked = Boolean(s.avoidTolls);
    AVOID_FERRIES_TOGGLE.checked = Boolean(s.avoidFerries);
    AVOID_CITIES_TOGGLE.checked = Boolean(s.avoidCities);
    ROUTE_VARIANTS_COUNT.value = String(clamp(Number(s.variants) || 3, 1, 3));
    REROUTE_THRESHOLD.value = String(clamp(Number(s.rerouteThreshold) || 55, 20, 300));
  } catch {
    // ignore
  }
}

function getRouteSettings() {
  return {
    preferServerRoute: PREFER_SERVER_ROUTE_TOGGLE.checked,
    avoidTolls: AVOID_TOLLS_TOGGLE.checked,
    avoidFerries: AVOID_FERRIES_TOGGLE.checked,
    avoidCities: AVOID_CITIES_TOGGLE.checked,
    variants: clamp(Number(ROUTE_VARIANTS_COUNT.value) || 3, 1, 3),
    rerouteThreshold: clamp(Number(REROUTE_THRESHOLD.value) || 55, 20, 300),
  };
}

function saveRouteSettings() {
  localStorage.setItem('offlinely_route_settings', JSON.stringify(getRouteSettings()));
}

function applyTheme(mode) {
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme');
    return;
  }
  document.documentElement.setAttribute('data-theme', mode);
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'system';
  THEME_SELECT.value = saved;
  applyTheme(saved);
}

function getVoiceSettings() {
  return {
    enabled: VOICE_ENABLED_TOGGLE.checked,
    rate: clamp(Number(VOICE_RATE.value) || 1, 0.7, 1.3),
    volume: clamp(Number(VOICE_VOLUME.value) || 1, 0.2, 1),
    voiceURI: VOICE_SELECT.value || '',
  };
}

function saveVoiceSettings() {
  localStorage.setItem(VOICE_KEY, JSON.stringify(getVoiceSettings()));
}

function loadVoiceSettings() {
  try {
    const raw = localStorage.getItem(VOICE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (!v) return;
    VOICE_ENABLED_TOGGLE.checked = v.enabled !== false;
    VOICE_RATE.value = String(clamp(Number(v.rate) || 1, 0.7, 1.3));
    VOICE_VOLUME.value = String(clamp(Number(v.volume) || 1, 0.2, 1));
  } catch {
    // ignore
  }
}

function pickDefaultVoice(voices) {
  return (
    voices.find((v) => v.localService && /^ru/i.test(v.lang)) ||
    voices.find((v) => /^ru/i.test(v.lang)) ||
    voices.find((v) => v.localService) ||
    voices[0] ||
    null
  );
}

function refreshVoiceList() {
  if (!('speechSynthesis' in window)) return;
  speechVoices = window.speechSynthesis.getVoices();
  VOICE_SELECT.innerHTML = '';
  speechVoices.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})${v.localService ? ' • offline' : ''}`;
    VOICE_SELECT.appendChild(opt);
  });
  const settings = (() => {
    try { return JSON.parse(localStorage.getItem(VOICE_KEY) || '{}'); } catch { return {}; }
  })();
  const defaultVoice = settings.voiceURI || pickDefaultVoice(speechVoices)?.voiceURI || '';
  if (defaultVoice) VOICE_SELECT.value = defaultVoice;
}

function speak(text, priority = false) {
  const s = getVoiceSettings();
  if (!s.enabled || !('speechSynthesis' in window) || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = speechVoices.find((v) => v.voiceURI === s.voiceURI) || pickDefaultVoice(speechVoices);
  if (voice) u.voice = voice;
  u.lang = (voice && voice.lang) || 'ru-RU';
  u.rate = s.rate;
  u.volume = s.volume;
  if (priority) window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function speakAsync(text, volumeOverride = null) {
  return new Promise((resolve) => {
    const s = getVoiceSettings();
    if (!s.enabled || !('speechSynthesis' in window) || !text) {
      resolve();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    const voice = speechVoices.find((v) => v.voiceURI === s.voiceURI) || pickDefaultVoice(speechVoices);
    if (voice) u.voice = voice;
    u.lang = (voice && voice.lang) || 'ru-RU';
    u.rate = s.rate;
    u.volume = volumeOverride === null ? s.volume : volumeOverride;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

function normalizeDistanceBucket(distMeters) {
  const buckets = [50, 70, 100, 150, 200, 300, 400, 500, 700, 800, 1000];
  let best = buckets[0];
  let err = Math.abs(distMeters - best);
  for (const b of buckets) {
    const e = Math.abs(distMeters - b);
    if (e < err) {
      err = e;
      best = b;
    }
  }
  return best;
}

function instructionChunk(instruction) {
  const t = (instruction || '').toLowerCase();
  if (t.includes('налево')) return 'поверните налево';
  if (t.includes('направо')) return 'поверните направо';
  if (t.includes('развер')) return 'выполните разворот';
  if (t.includes('круг')) return 'на круговом движении выберите съезд';
  if (t.includes('держитесь лев')) return 'держитесь левее';
  if (t.includes('держитесь прав')) return 'держитесь правее';
  if (t.includes('прибыт')) return 'пункт назначения впереди';
  return 'двигайтесь прямо';
}

function composeManeuverPhrase(distMeters, instruction) {
  const d = normalizeDistanceBucket(distMeters);
  return `Через ${d} метров ${instructionChunk(instruction)}.`;
}

async function warmupVoicePack() {
  if (!('speechSynthesis' in window)) {
    VOICE_PACK_STATUS.textContent = 'TTS недоступен в этом браузере.';
    return;
  }
  const phrases = [
    'Через 50 метров поверните направо.',
    'Через 100 метров поверните налево.',
    'Через 200 метров держитесь правее.',
    'Через 300 метров держитесь левее.',
    'Через 500 метров выполните разворот.',
    'Через 800 метров на круговом движении выберите съезд.',
    'Пункт назначения впереди.',
  ];

  VOICE_PACK_BTN.disabled = true;
  VOICE_PACK_STATUS.textContent = 'Подготовка голосового пакета...';
  window.speechSynthesis.cancel();
  for (let i = 0; i < phrases.length; i += 1) {
    VOICE_PACK_STATUS.textContent = `Подготовка фраз: ${i + 1}/${phrases.length}`;
    // Very low volume warmup to initialize local TTS internals.
    // Browser does not allow exporting built voice audio chunks.
    await speakAsync(phrases[i], 0.01);
  }
  localStorage.setItem(VOICE_PACK_KEY, String(Date.now()));
  VOICE_PACK_STATUS.textContent = 'Голосовой пакет подготовлен для оффлайн-подсказок.';
  VOICE_PACK_BTN.disabled = false;
}

function maybeSpeakManeuver(stepIdx, distMeters, instruction) {
  const marks = [800, 500, 300, 150, 70];
  if (stepIdx !== lastSpokenStepIdx) {
    lastSpokenStepIdx = stepIdx;
  }
  for (const m of marks) {
    const key = `${stepIdx}:${m}`;
    if (distMeters <= m && !spokenStepMarks.has(key)) {
      spokenStepMarks.add(key);
      speak(composeManeuverPhrase(m, instruction));
      break;
    }
  }
}

function loadRouteHistory() {
  try {
    const raw = localStorage.getItem('offlinely_route_history');
    const parsed = raw ? JSON.parse(raw) : [];
    routeHistory = Array.isArray(parsed) ? parsed : [];
  } catch {
    routeHistory = [];
  }
}

function saveRouteHistory() {
  localStorage.setItem('offlinely_route_history', JSON.stringify(routeHistory.slice(0, 20)));
}

function renderRouteHistory() {
  ROUTE_HISTORY_LIST.innerHTML = '';
  routeHistory.slice(0, 8).forEach((h) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'variant-btn tonal';
    b.textContent = `${new Date(h.ts).toLocaleString()} • ${formatDistance(h.distance)}`;
    b.addEventListener('click', () => {
      routeCandidates = [h.route];
      applyRouteCandidate(0);
      setSheet('nav');
      ROUTE_SUMMARY.textContent = `История: ${formatDistance(h.distance)}, ${formatDuration(h.duration)}.`;
    });
    ROUTE_HISTORY_LIST.appendChild(b);
  });
}

function saveCurrentRouteToHistory(sourceLabel) {
  if (!routeCandidates.length) return;
  const r = routeCandidates[activeRouteIndex] || routeCandidates[0];
  routeHistory.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    source: sourceLabel,
    distance: r.distance,
    duration: r.duration,
    route: r,
  });
  routeHistory = routeHistory.slice(0, 20);
  saveRouteHistory();
  renderRouteHistory();
}

function saveActiveTrip() {
  try {
    if (!routeCandidates.length || !startPoint || !endPoint) {
      localStorage.removeItem(ACTIVE_TRIP_KEY);
      return;
    }
    const payload = {
      ts: Date.now(),
      startPoint,
      endPoint,
      activeRouteIndex,
      routeCandidates,
      guidanceActive: guidanceWatchId !== null,
    };
    localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function loadActiveTrip() {
  try {
    const raw = localStorage.getItem(ACTIVE_TRIP_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t || !Array.isArray(t.routeCandidates) || !t.routeCandidates.length) return null;
    return t;
  } catch {
    return null;
  }
}

function findBestHistoryRouteFor(start, end) {
  if (!routeHistory.length) return null;
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const h of routeHistory) {
    const coords = h?.route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const histStart = coords[0];
    const histEnd = coords[coords.length - 1];
    const startErr = haversineMeters(start, histStart);
    const endErr = haversineMeters(end, histEnd);
    const score = endErr * 2 + startErr;
    if (score < bestScore) {
      bestScore = score;
      best = h.route;
    }
  }

  // Требуем близкое совпадение старта и финиша
  if (!best) return null;
  const bestStart = best.geometry.coordinates[0];
  const bestEnd = best.geometry.coordinates[best.geometry.coordinates.length - 1];
  if (haversineMeters(start, bestStart) > 3000) return null;
  if (haversineMeters(end, bestEnd) > 3000) return null;
  return best;
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

function applyRouteCandidate(index) {
  if (!routeCandidates.length) return;
  activeRouteIndex = clamp(index, 0, routeCandidates.length - 1);
  const selected = routeCandidates[activeRouteIndex];
  routeGeoJson = selected.geometry;
  routeSteps = selected.steps;
  spokenStepMarks = new Set();
  lastSpokenStepIdx = -1;
  updateRouteLayer();
  renderSteps();
  ROUTE_SUMMARY.textContent = `Локальный маршрут ${activeRouteIndex + 1}: ${formatDistance(selected.distance)}, ${formatDuration(selected.duration)}.`;
  NEXT_STEP.textContent = routeSteps.length ? `Следующий маневр: ${routeSteps[0].maneuver.instruction}` : 'Следующий маневр: -';
  showNavCard(
    routeSteps.length ? formatDistance(routeSteps[0].distance) : '-',
    routeSteps.length ? routeSteps[0].maneuver.instruction : 'Маршрут построен',
    routeSteps.length ? (routeSteps[0].roadName || 'Держись маршрута') : '',
    routeSteps.length ? routeSteps[0].maneuver.arrow : '↑'
  );

  ROUTE_VARIANTS.innerHTML = '';
  routeCandidates.forEach((r, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `variant-btn tonal${i === activeRouteIndex ? ' active' : ''}`;
    b.textContent = `${i + 1}: ${formatDuration(r.duration)}`;
    b.addEventListener('click', () => applyRouteCandidate(i));
    ROUTE_VARIANTS.appendChild(b);
  });
  saveActiveTrip();
}

async function buildRoute() {
  if (!startPoint || !endPoint) {
    ROUTE_SUMMARY.textContent = 'Укажи старт и финиш.';
    return;
  }
  const settings = getRouteSettings();
  routeCandidates = [];
  let sourceLabel = 'history';
  if (!navigator.onLine) {
    const fromHistory = findBestHistoryRouteFor(startPoint, endPoint);
    if (!fromHistory) {
      ROUTE_SUMMARY.textContent = 'Оффлайн-маршрут недоступен: сначала построй этот маршрут онлайн.';
      return;
    }
    routeCandidates = [fromHistory];
    sourceLabel = 'history';
  } else if (settings.preferServerRoute) {
    try {
      routeCandidates = await buildServerRouteCandidates(startPoint, endPoint, settings);
      sourceLabel = 'server';
    } catch {
      routeCandidates = [];
    }
  }
  if (!routeCandidates.length && navigator.onLine && !settings.preferServerRoute) {
    routeCandidates = buildLocalRouteCandidates(startPoint, endPoint, settings.variants);
    sourceLabel = 'local';
  }
  if (!routeCandidates.length && navigator.onLine) {
    const fromHistory = findBestHistoryRouteFor(startPoint, endPoint);
    if (fromHistory) {
      routeCandidates = [fromHistory];
      sourceLabel = 'history';
    }
  }
  if (!routeCandidates.length) {
    ROUTE_SUMMARY.textContent = 'Серверный маршрут не получен. Попробуй еще раз онлайн или используй историю.';
    return;
  }
  if (settings.avoidCities || settings.avoidTolls || settings.avoidFerries) {
    routeCandidates.sort((a, b) => (a.steps.length * 14 + a.duration) - (b.steps.length * 14 + b.duration));
  }
  applyRouteCandidate(0);
  saveCurrentRouteToHistory(sourceLabel);

  const coords = routeCandidates[0].geometry.coordinates;
  const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(bounds, { padding: 40, duration: 700 });
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
  enableOrientationTracking();
  speak('Навигация запущена.', true);

  guidanceWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      if (!manualPositionOverride) {
        userLocation = [pos.coords.longitude, pos.coords.latitude];
      }
      const speedKmh = Number.isFinite(pos.coords.speed) ? Math.max(0, pos.coords.speed * 3.6) : 0;
      SPEED_CHIP.textContent = `${Math.round(speedKmh)} км/ч`;
      gpsFix = {
        speedMps: Number.isFinite(pos.coords.speed) ? Math.max(0, pos.coords.speed) : 0,
        headingDeg: Number.isFinite(pos.coords.heading) ? pos.coords.heading : userHeadingDeg,
        ts: Date.now(),
      };
    },
    (err) => {
      ROUTE_SUMMARY.textContent = `Ошибка GPS: ${err.message}`;
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 }
  );

  startTrackingLoop();
  ROUTE_SUMMARY.textContent = 'Ведение запущено.';
  saveActiveTrip();
}

function stopGuidance() {
  if (guidanceWatchId !== null) {
    navigator.geolocation.clearWatch(guidanceWatchId);
    guidanceWatchId = null;
  }
  NEXT_STEP.textContent = 'Следующий маневр: -';
  ROUTE_SUMMARY.textContent = 'Ведение остановлено.';
  etaMinutes = null;
  gpsFix = null;
  smoothLocation = null;
  stopTrackingLoop();
  speak('Навигация остановлена.', true);
  hideNavCard();
  saveActiveTrip();
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
  OPEN_OFFLINE_PAGE_BTN.addEventListener('click', () => {
    window.location.href = './offline.html';
  });
  OPEN_SETTINGS_BTN.addEventListener('click', () => setSheet('settings'));
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

  let searchTimer = null;
  GLOBAL_SEARCH_INPUT.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchPlaces().catch(() => renderSearchResults([]));
    }
  });
  GLOBAL_SEARCH_INPUT.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (GLOBAL_SEARCH_INPUT.value.trim().length < 2) {
        renderSearchResults([]);
        return;
      }
      searchPlaces().catch(() => renderSearchResults([]));
    }, 260);
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
  AVOID_TOLLS_TOGGLE.addEventListener('change', saveRouteSettings);
  AVOID_FERRIES_TOGGLE.addEventListener('change', saveRouteSettings);
  AVOID_CITIES_TOGGLE.addEventListener('change', saveRouteSettings);
  PREFER_SERVER_ROUTE_TOGGLE.addEventListener('change', saveRouteSettings);
  ROUTE_VARIANTS_COUNT.addEventListener('change', saveRouteSettings);
  REROUTE_THRESHOLD.addEventListener('change', saveRouteSettings);
  CONTINUE_LAST_ROUTE_BTN.addEventListener('click', () => {
    if (!routeHistory.length) {
      ROUTE_SUMMARY.textContent = 'История пуста.';
      return;
    }
    const h = routeHistory[0];
    routeCandidates = [h.route];
    applyRouteCandidate(0);
    setSheet('nav');
    ROUTE_SUMMARY.textContent = `Продолжен маршрут из истории: ${formatDistance(h.distance)}.`;
  });
  THEME_SELECT.addEventListener('change', () => {
    const mode = THEME_SELECT.value;
    localStorage.setItem(THEME_KEY, mode);
    applyTheme(mode);
  });
  VOICE_ENABLED_TOGGLE.addEventListener('change', saveVoiceSettings);
  VOICE_RATE.addEventListener('change', saveVoiceSettings);
  VOICE_VOLUME.addEventListener('change', saveVoiceSettings);
  VOICE_SELECT.addEventListener('change', saveVoiceSettings);
  VOICE_TEST_BTN.addEventListener('click', () => {
    saveVoiceSettings();
    speak('Проверка голосовых подсказок. Через двести метров поверните направо.', true);
  });
  VOICE_PACK_BTN.addEventListener('click', () => {
    saveVoiceSettings();
    warmupVoicePack();
  });

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
  loadRouteSettings();
  loadRouteHistory();
  loadTheme();
  loadVoiceSettings();
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
    renderRouteHistory();
    sourceTileTemplates = await resolveVectorTileTemplates();
    DOWNLOAD_STATUS.textContent = sourceTileTemplates.length ? 'Готово к загрузке области.' : 'Не найдены шаблоны векторных тайлов.';

    const trip = loadActiveTrip();
    if (trip) {
      startPoint = trip.startPoint || null;
      endPoint = trip.endPoint || null;
      routeCandidates = trip.routeCandidates || [];
      updateMarkersLayer();
      if (routeCandidates.length) {
        applyRouteCandidate(clamp(Number(trip.activeRouteIndex) || 0, 0, routeCandidates.length - 1));
        ROUTE_SUMMARY.textContent = 'Восстановлен последний маршрут.';
      }
      if (trip.guidanceActive && routeCandidates.length) {
        startGuidance();
      }
    }
  });

  if ('speechSynthesis' in window) {
    refreshVoiceList();
    window.speechSynthesis.onvoiceschanged = refreshVoiceList;
    const readyAt = Number(localStorage.getItem(VOICE_PACK_KEY) || 0);
    if (readyAt) {
      VOICE_PACK_STATUS.textContent = `Пакет готов: ${new Date(readyAt).toLocaleString()}`;
    }
  }
}

init();
