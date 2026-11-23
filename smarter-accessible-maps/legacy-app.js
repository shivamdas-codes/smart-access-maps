const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const routeColors = ['#4285f4', '#e6a23c', '#9b8bd8'];
const savedJourneysCacheKey = 'wayfinderSavedOffline';
const preferencesCacheKey = 'wayfinderPreferencesOffline';
let map;
let routeLayers = [];
let placeMarkers = [];
let routes = [];
let selectedRouteIndex = 0;
let toastTimer;
let searchSequence = 0;

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 3000);
}

function initializeMap() {
  if (!window.L) {
    $('#mapToast').textContent = 'Map library unavailable';
    toast('The map could not load. Check your internet connection and reload.');
    return;
  }

  map = L.map('map').setView([17.385, 78.4867], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

async function findPlace(query) {
  const result = await apiRequest(`/api/places?query=${encodeURIComponent(query)}`);
  return { coordinates: result.coordinates, label: result.label };
}

async function findRoadRoutes(origin, destination) {
  const originCoordinates = origin.coordinates.join(',');
  const destinationCoordinates = destination.coordinates.join(',');
  const result = await apiRequest(
    `/api/routes?origin=${encodeURIComponent(originCoordinates)}&destination=${encodeURIComponent(destinationCoordinates)}`,
  );
  if (!result.routes?.length) {
    throw new Error('No drivable route was found between those places.');
  }
  return result.routes;
}

const clientIdKey = 'wayfinderClientId';

function getClientId() {
  let clientId = localStorage.getItem(clientIdKey);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(clientIdKey, clientId);
  }
  return clientId;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(result.detail || `Request failed (${response.status}).`);
  }
  return result;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return hours ? `${hours} h ${remainingMinutes} min` : `${minutes} min`;
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

function updateResultCount() {
  const count = routes.length;
  $('#resultCount').textContent = count
    ? `${count} road route${count === 1 ? '' : 's'} · reports shown`
    : 'No routes yet';
}

let communityReports = [];

function getRouteReports(route) {
  const roadNames = route.legs
    .flatMap((leg) => leg.steps || [])
    .map((step) => step.name?.trim().toLowerCase())
    .filter((name) => name && name.length > 3);

  return communityReports.filter((report) => {
    const place = String(report.place || '').trim().toLowerCase();
    return place.length > 3 && roadNames.some((name) => name.includes(place) || place.includes(name));
  });
}

function etaRange(route) {
  const minimum = Math.max(1, Math.round(route.duration * 0.8 / 60));
  const maximum = Math.max(minimum, Math.round(route.duration * 1.2 / 60));
  return `${minimum}–${maximum} min`;
}

function routeSafetyCount(route) {
  return getRouteReports(route).filter((report) => /unsafe|construction|closed|restricted|hazard|blocked/i.test(report.type)).length;
}

function isAccessibilityReport(report) {
  return /step-free|ramp|lift|footpath|curb|accessibility|slope/i.test(report.type);
}

function routeExplanation(route, index) {
  const reports = getRouteReports(route);
  const hazards = routeSafetyCount(route);
  if (hazards) {
    return `${hazards} locally submitted road warning${hazards === 1 ? '' : 's'} match this route. Reports are unverified.`;
  }
  if (reports.length) {
    return `${reports.length} local report${reports.length === 1 ? '' : 's'} match this route. Road safety and access remain unverified.`;
  }
  return index === 0
    ? 'Shortest estimate from the road router. No live traffic or verified safety data.'
    : 'Alternative from the road router. No live traffic or verified safety data.';
}

function addTextElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderRouteCards() {
  const host = $('#routeCards');
  host.replaceChildren();

  if (!routes.length) {
    addTextElement(
      host,
      'p',
      'route-placeholder',
      'No road routes to show. Check the place names and try again.',
    );
    return;
  }

  routes.forEach((route, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `route-card${index === selectedRouteIndex ? ' selected' : ''}`;
    card.dataset.routeIndex = index;
    card.setAttribute('aria-pressed', String(index === selectedRouteIndex));

    const top = addTextElement(card, 'div', 'route-card-top', '');
    addTextElement(
      top,
      'span',
      'route-name',
      index === 0 ? 'Shortest estimate' : `Alternative route ${index + 1}`,
    );
    const badge = addTextElement(
      top,
      'span',
      'route-badge',
      index === 0 ? 'ROAD ROUTER' : `OPTION ${index + 1}`,
    );
    badge.style.backgroundColor = `${routeColors[index % routeColors.length]}20`;
    badge.style.color = routeColors[index % routeColors.length];

    const time = addTextElement(card, 'div', 'route-time', '');
    const timeValue = addTextElement(time, 'strong', '', formatDuration(route.duration));
    timeValue.style.color = routeColors[index % routeColors.length];
    addTextElement(time, 'span', '', `${formatDistance(route.distance)} · ${etaRange(route)} planning range`);

    const visual = addTextElement(card, 'div', 'route-visual', '');
    const line = addTextElement(visual, 'span', 'route-dash', '');
    line.style.borderTopColor = routeColors[index % routeColors.length];

    const meta = addTextElement(card, 'div', 'route-meta', '');
    addTextElement(meta, 'span', '', 'Driving · no live traffic');
    addTextElement(meta, 'span', 'warning-text', `${routeSafetyCount(route)} matched warnings`);
    addTextElement(card, 'small', 'route-explanation', routeExplanation(route, index));

    card.addEventListener('click', () => selectRoute(index));
    host.append(card);
  });
}

function clearMapRoutes() {
  routeLayers.forEach((layer) => layer.remove());
  placeMarkers.forEach((marker) => marker.remove());
  routeLayers = [];
  placeMarkers = [];
}

function markerPopup(label, kind) {
  const content = document.createElement('div');
  addTextElement(content, 'strong', '', kind);
  addTextElement(content, 'div', '', label);
  return content;
}

function renderMap(origin, destination) {
  if (!map) {
    return;
  }

  clearMapRoutes();
  const bounds = [];

  routes.forEach((route, index) => {
    const path = route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]);
    const layer = L.polyline(path, {
      color: routeColors[index % routeColors.length],
      weight: index === selectedRouteIndex ? 7 : 5,
      opacity: index === selectedRouteIndex ? 0.95 : 0.55,
    }).addTo(map);

    routeLayers.push(layer);
    bounds.push(...path);
  });

  const [originLongitude, originLatitude] = origin.coordinates;
  const [destinationLongitude, destinationLatitude] = destination.coordinates;
  const startMarker = L.circleMarker([originLatitude, originLongitude], {
    radius: 9,
    color: '#fff',
    weight: 3,
    fillColor: '#16865b',
    fillOpacity: 1,
  }).bindPopup(markerPopup(origin.label, 'Start')).addTo(map);
  const endMarker = L.circleMarker([destinationLatitude, destinationLongitude], {
    radius: 9,
    color: '#fff',
    weight: 3,
    fillColor: '#e34b43',
    fillOpacity: 1,
  }).bindPopup(markerPopup(destination.label, 'Destination')).addTo(map);

  placeMarkers = [startMarker, endMarker];
  map.fitBounds(bounds, { padding: [36, 36] });
  $('#mapAreaLabel').textContent = `${origin.label} → ${destination.label}`;
  $('#mapToast').textContent = 'Road route estimates · accessibility not verified';
}

function clearSearchResults() {
  searchSequence += 1;
  routes = [];
  selectedRouteIndex = 0;
  $('#findRoutes').disabled = false;
  $('#findRoutes').removeAttribute('aria-busy');
  renderRouteCards();
  updateResultCount();
  clearMapRoutes();
  $('#mapAreaLabel').textContent = 'PLACE SEARCH';
  $('#mapToast').textContent = 'Enter two places to find road routes';
  $('#routeDetail').innerHTML = `
    <div class="detail-head">
      <strong>Route details</strong>
      <span class="detail-status">Accessibility not verified</span>
    </div>
    <p class="route-placeholder">Route details will appear here after a search.</p>
  `;
}

function updateRouteDetails() {
  const route = routes[selectedRouteIndex];
  if (!route) {
    return;
  }

  const detail = $('#routeDetail');
  detail.replaceChildren();
  const heading = addTextElement(detail, 'div', 'detail-head', '');
  addTextElement(heading, 'strong', '', 'Road route details');
  addTextElement(heading, 'span', 'detail-status', 'Safety & access unverified');

  const routeReports = getRouteReports(route);
  const safetyReports = routeReports.filter((report) => /unsafe|construction|closed|restricted|hazard|blocked/i.test(report.type));
  const accessibilityReports = routeReports.filter(isAccessibilityReport);
  addTextElement(detail, 'p', 'route-explanation', routeExplanation(route, selectedRouteIndex));
  addTextElement(
    detail,
    'p',
    'route-explanation',
    `Step-free access, ramps, lifts and pavement conditions: unknown. ${accessibilityReports.length} matching local accessibility report${accessibilityReports.length === 1 ? '' : 's'}.`,
  );
  if (safetyReports.length) {
    const warning = addTextElement(detail, 'div', 'route-warning', '');
    addTextElement(warning, 'strong', '', 'Check reported road warnings');
    safetyReports.forEach((report) => {
      addTextElement(warning, 'p', '', `${report.type} · ${report.place} · user report, not verified`);
    });
  }
  addTextElement(detail, 'p', 'eta-note', `Planning range: ${etaRange(route)}. This is an illustrative range, not a live or historical traffic prediction.`);

  const speechControls = addTextElement(detail, 'div', 'voice-controls', '');
  const languageLabel = addTextElement(speechControls, 'label', 'voice-label', 'Voice language');
  languageLabel.htmlFor = 'voiceLanguage';
  const languageSelect = document.createElement('select');
  languageSelect.id = 'voiceLanguage';
  [
    ['en-IN', 'English (India)'],
    ['hi-IN', 'हिन्दी'],
    ['te-IN', 'తెలుగు'],
    ['ta-IN', 'தமிழ்'],
    ['bn-IN', 'বাংলা'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    languageSelect.append(option);
  });
  speechControls.append(languageSelect);
  const speakButton = addTextElement(speechControls, 'button', 'map-tool', 'Speak directions');
  speakButton.type = 'button';
  speakButton.addEventListener('click', () => speakRoute(route, languageSelect.value));

  const steps = route.legs.flatMap((leg) => leg.steps || []);
  const visibleSteps = steps.slice(0, 8);

  if (!visibleSteps.length) {
    addTextElement(
      detail,
      'p',
      'route-placeholder',
      'Road directions are unavailable for this route.',
    );
  }

  visibleSteps.forEach((step, index) => {
    const maneuver = step.maneuver || {};
    const instruction = [maneuver.type, maneuver.modifier].filter(Boolean).join(' ');
    const title = step.name || (index === 0 ? 'Start route' : 'Continue on road');
    const description = [
      instruction,
      step.distance ? formatDistance(step.distance) : '',
      step.duration ? formatDuration(step.duration) : '',
    ].filter(Boolean).join(' · ');

    const row = addTextElement(detail, 'div', 'detail-step', '');
    addTextElement(
      row,
      'span',
      `step-icon ${index === 0 ? 'green-step' : 'blue-step'}`,
      index === 0 ? '●' : String(index + 1),
    );
    const text = addTextElement(row, 'div', '', '');
    addTextElement(text, 'strong', '', title);
    addTextElement(text, 'small', '', description || 'Road segment');
  });

  if (steps.length > visibleSteps.length) {
    addTextElement(
      detail,
      'p',
      'route-placeholder',
      `Showing ${visibleSteps.length} of ${steps.length} road instructions.`,
    );
  }

  $('#previewTime').textContent = formatDuration(route.duration);
  $('#previewDistance').textContent = formatDistance(route.distance);
  $('#previewRange').textContent = etaRange(route);
  $('#journeySummary').textContent = `${$('#origin').value.trim()} → ${$('#destination').value.trim()}`;
}

function speakRoute(route, language) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    toast('Spoken directions are not supported by this browser.');
    return;
  }

  const steps = route.legs.flatMap((leg) => leg.steps || []).slice(0, 8);
  if (!steps.length) {
    toast('No road instructions are available to speak.');
    return;
  }

  window.speechSynthesis.cancel();
  const directions = steps.map((step, index) => {
    const maneuver = step.maneuver || {};
    const action = [maneuver.type, maneuver.modifier].filter(Boolean).join(' ');
    const landmark = step.name ? ` onto ${step.name}` : '';
    return `${index === 0 ? 'Start' : `Then ${action || 'continue'}`}${landmark}.`;
  }).join(' ');
  const utterance = new SpeechSynthesisUtterance(directions);
  utterance.lang = language;
  window.speechSynthesis.speak(utterance);
}

function selectRoute(index) {
  selectedRouteIndex = index;

  $$('.route-card').forEach((card) => {
    const isSelected = Number(card.dataset.routeIndex) === index;
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-pressed', String(isSelected));
  });

  routeLayers.forEach((layer, routeIndex) => {
    layer.setStyle({
      weight: routeIndex === index ? 7 : 5,
      opacity: routeIndex === index ? 0.95 : 0.55,
    });
  });

  updateRouteDetails();
}

async function searchRoutes(showValidation = true) {
  const originQuery = $('#origin').value.trim();
  const destinationQuery = $('#destination').value.trim();
  const button = $('#findRoutes');

  if (!originQuery || !destinationQuery) {
    clearSearchResults();
    if (showValidation) {
      toast('Enter both a starting point and a destination.');
      (!originQuery ? $('#origin') : $('#destination')).focus();
    }
    return;
  }

  if (!map) {
    toast('The map is unavailable. Check your internet connection and reload.');
    return;
  }

  clearSearchResults();
  const searchId = ++searchSequence;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  $('#mapToast').textContent = 'Finding places and road routes…';
  $('#resultCount').textContent = 'Searching…';

  try {
    const [origin, destination] = await Promise.all([
      findPlace(originQuery),
      findPlace(destinationQuery),
    ]);
    const foundRoutes = await findRoadRoutes(origin, destination);
    if (searchId !== searchSequence) {
      return;
    }

    routes = foundRoutes;
    selectedRouteIndex = 0;
    renderRouteCards();
    updateResultCount();
    renderMap(origin, destination);
    updateRouteDetails();
    toast(`Found road routes from ${origin.label} to ${destination.label}`);
  } catch (error) {
    if (searchId !== searchSequence) {
      return;
    }
    console.error('Unable to find road routes:', error);
    $('#resultCount').textContent = 'Search failed';
    $('#mapToast').textContent = 'Could not find these places or a road route';
    toast(error instanceof Error ? error.message : 'Unable to find road routes. Please try again.');
  } finally {
    if (searchId === searchSequence) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
}

async function updatePreferences() {
  const preferences = ['stepFree', 'fewTransfers', 'covered', 'clearWayfinding']
    .reduce((selected, id) => {
      selected[id] = $(`#${id}`).checked;
      return selected;
    }, {});
  localStorage.setItem(preferencesCacheKey, JSON.stringify(preferences));
  await apiRequest(`/api/preferences/${getClientId()}`, {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
  updateResultCount();
  if (routes.length) {
    updateRouteDetails();
  }
  toast('Preferences saved. This driving-only service cannot verify or filter for accessibility.');
}

function showView(name) {
  $$('.view').forEach((view) => view.classList.remove('active-view'));
  $(`#${name}View`).classList.add('active-view');
  $$('.nav-link').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === name);
  });

  if (name === 'saved') {
    renderSaved().catch((error) => toast(`Could not load journeys: ${error.message}`));
  }

  if (name === 'explore' && map) {
    map.invalidateSize();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function renderSaved() {
  let items;
  const cachedJourneys = JSON.parse(localStorage.getItem(savedJourneysCacheKey) || '[]');
  try {
    const storedJourneys = await apiRequest(`/api/journeys?client_id=${encodeURIComponent(getClientId())}`);
    const storedIds = new Set(storedJourneys.map((journey) => journey.id));
    items = [
      ...storedJourneys,
      ...cachedJourneys.filter((journey) => journey.offlineOnly && !storedIds.has(journey.id)),
    ];
    localStorage.setItem(savedJourneysCacheKey, JSON.stringify(items));
  } catch (error) {
    if (!cachedJourneys.length) {
      throw error;
    }
    items = cachedJourneys;
    toast(`Offline: showing previously synced journeys. ${error.message}`);
  }
  const host = $('#savedContent');
  host.replaceChildren();

  if (!items.length) {
    const emptyState = addTextElement(host, 'div', 'empty-state', '');
    addTextElement(emptyState, 'strong', '', 'No saved journeys yet');
    emptyState.append(
      document.createTextNode('Search for places, choose a road route, and save it from the preview.'),
    );
    return;
  }

  items.forEach((item) => {
    const savedItem = addTextElement(host, 'div', 'saved-item', '');
    const summary = addTextElement(savedItem, 'div', '', '');
    addTextElement(summary, 'strong', '', `${item.from} → ${item.to}`);
    const distance = item.distance || item.walk || 'Distance unavailable';
    const duration = typeof item.time === 'number' ? `${item.time} min` : item.time;
    addTextElement(
      summary,
      'p',
      '',
      `${item.route} · ${duration} · ${distance} · Driving${item.offlineSaved ? ' · Offline details saved' : ''}`,
    );
    if (item.steps?.length) {
      const details = addTextElement(savedItem, 'details', 'saved-directions', '');
      addTextElement(details, 'summary', '', 'Offline journey details');
      item.steps.forEach((step, index) => {
        addTextElement(details, 'p', '', `${index + 1}. ${step}`);
      });
    }

    const removeButton = addTextElement(savedItem, 'button', '', 'Remove');
    removeButton.type = 'button';
    removeButton.addEventListener('click', () => {
      if (item.offlineOnly) {
        const remaining = JSON.parse(localStorage.getItem(savedJourneysCacheKey) || '[]')
          .filter((journey) => journey.id !== item.id);
        localStorage.setItem(savedJourneysCacheKey, JSON.stringify(remaining));
        renderSaved().catch((error) => toast(`Could not refresh journeys: ${error.message}`));
        return;
      }
      apiRequest(`/api/journeys/${item.id}?client_id=${encodeURIComponent(getClientId())}`, {
        method: 'DELETE',
      }).then(() => {
        const cached = JSON.parse(localStorage.getItem(savedJourneysCacheKey) || '[]')
          .filter((journey) => journey.id !== item.id);
        localStorage.setItem(savedJourneysCacheKey, JSON.stringify(cached));
        renderSaved().catch((error) => toast(`Could not refresh journeys: ${error.message}`));
        toast('Saved journey removed');
      }).catch((error) => toast(`Could not remove journey: ${error.message}`));
    });
  });
}

async function renderCommunityReports() {
  const host = $('#communityReports');
  communityReports = await apiRequest('/api/reports?limit=100');
  const reports = communityReports.slice(0, 5);
  host.replaceChildren();

  if (!reports.length) {
    addTextElement(host, 'p', 'report-feed-empty', 'No local reports yet.');
    return;
  }

  reports.forEach((report) => {
    const item = addTextElement(host, 'div', 'report-feed-item', '');
    addTextElement(item, 'strong', '', report.type);
    addTextElement(
      item,
      'small',
      '',
      `${report.place} · ${report.type.toLowerCase().includes('business') ? 'Needs confirmation' : 'Unverified community report'} · ${new Date(report.created_at).toLocaleDateString()}`,
    );
  });
}

async function saveJourney() {
  const route = routes[selectedRouteIndex];
  if (!route) {
    toast('Find a road route before saving a journey.');
    return;
  }

  const steps = route.legs.flatMap((leg) => leg.steps || []).slice(0, 50).map((step, index) => {
    const maneuver = step.maneuver || {};
    const action = [maneuver.type, maneuver.modifier].filter(Boolean).join(' ');
    return `${index === 0 ? 'Start' : action || 'Continue'}${step.name ? ` on ${step.name}` : ''}${step.distance ? ` for ${formatDistance(step.distance)}` : ''}`;
  });
  const journeyData = {
    client_id: getClientId(),
    from: $('#origin').value.trim(),
    to: $('#destination').value.trim(),
    route: selectedRouteIndex === 0 ? 'Shortest estimate' : `Alternative road route ${selectedRouteIndex + 1}`,
    time: formatDuration(route.duration),
    distance: formatDistance(route.distance),
    etaRange: etaRange(route),
    steps,
    offlineSaved: true,
    savedAt: new Date().toISOString(),
  };
  let savedJourney;
  try {
    savedJourney = await apiRequest('/api/journeys', {
      method: 'POST',
      body: JSON.stringify(journeyData),
    });
  } catch (error) {
    savedJourney = {
      ...journeyData,
      id: -Date.now(),
      offlineOnly: true,
    };
    $('#journeyDialog').close();
    const cachedJourneys = JSON.parse(localStorage.getItem(savedJourneysCacheKey) || '[]');
    cachedJourneys.unshift(savedJourney);
    localStorage.setItem(savedJourneysCacheKey, JSON.stringify(cachedJourneys));
    toast(`Saved on this device only; not synced. ${error.message}`);
    return;
  }
  const cachedJourneys = JSON.parse(localStorage.getItem(savedJourneysCacheKey) || '[]');
  cachedJourneys.unshift(savedJourney);
  localStorage.setItem(savedJourneysCacheKey, JSON.stringify(cachedJourneys));
  $('#journeyDialog').close();
  toast('Journey saved to your Wayfinder database');
}

async function submitIssue() {
  const place = $('#issuePlace').value.trim();
  if (!place) {
    toast('Enter a road, station, crossing or business name for the report.');
    $('#issuePlace').focus();
    return;
  }
  await apiRequest('/api/reports', {
    method: 'POST',
    body: JSON.stringify({
      type: $('#issueType').value,
      place,
      notes: $('#issueNotes').value.trim(),
    }),
  });
  $('#issueDialog').close();
  $('#issueNotes').value = '';
  await renderCommunityReports();
  toast('Thanks — your report was saved as an unverified community report');
  if (routes.length) {
    renderRouteCards();
    updateRouteDetails();
  }
}

initializeMap();
renderCommunityReports().catch((error) => toast(`Could not load reports: ${error.message}`));

$$('.nav-link').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

$('#findRoutes').addEventListener('click', searchRoutes);
$('#origin').addEventListener('change', () => searchRoutes(false));
$('#destination').addEventListener('change', () => searchRoutes(false));

$('#swapBtn').addEventListener('click', () => {
  const origin = $('#origin').value;
  $('#origin').value = $('#destination').value;
  $('#destination').value = origin;
  searchRoutes();
});

$('#clearDestination').addEventListener('click', () => {
  $('#destination').value = '';
  clearSearchResults();
  $('#destination').focus();
});

$$('[data-dest]').forEach((button) => {
  button.addEventListener('click', () => {
    $('#destination').value = button.dataset.dest;
    searchRoutes();
  });
});

['stepFree', 'fewTransfers', 'covered', 'clearWayfinding'].forEach((id) => {
  $(`#${id}`).addEventListener('change', () => {
    updatePreferences().catch((error) => toast(`Could not save preferences: ${error.message}`));
  });
});

$('#resetPrefs').addEventListener('click', () => {
  ['stepFree', 'fewTransfers', 'covered', 'clearWayfinding'].forEach((id) => {
    $(`#${id}`).checked = id === 'stepFree';
  });
  updatePreferences().catch((error) => toast(`Could not save preferences: ${error.message}`));
});

$('#startJourney').addEventListener('click', () => {
  if (!routes.length) {
    toast('Find a road route before previewing a journey.');
    return;
  }
  updateRouteDetails();
  $('#journeyDialog').showModal();
});

$('#saveJourney').addEventListener('click', () => {
  saveJourney().catch((error) => toast(`Could not save journey: ${error.message}`));
});
$('#reportIssue').addEventListener('click', () => $('#issueDialog').showModal());
$('#submitIssue').addEventListener('click', () => {
  submitIssue().catch((error) => toast(`Could not submit report: ${error.message}`));
});
$('#howItWorks').addEventListener('click', () => showView('about'));

$('#layersBtn').addEventListener('click', () => {
  const tilePane = $('#map .leaflet-tile-pane');
  if (tilePane) {
    tilePane.classList.toggle('grayscale-map');
    toast('Map layer style toggled');
  }
});

$('#locateBtn').addEventListener('click', () => {
  if (routes.length && routeLayers[selectedRouteIndex]) {
    map.fitBounds(routeLayers[selectedRouteIndex].getBounds(), { padding: [36, 36] });
  } else {
    toast('Search for a route to show its locations on the map.');
  }
});

$('#zoomIn').addEventListener('click', () => map?.zoomIn());
$('#zoomOut').addEventListener('click', () => map?.zoomOut());
$('#profileBtn').addEventListener('click', () => {
  toast('Profile settings are not part of this prototype');
});

apiRequest(`/api/preferences/${getClientId()}`).then((preferences) => {
  localStorage.setItem(preferencesCacheKey, JSON.stringify(preferences));
  ['stepFree', 'fewTransfers', 'covered', 'clearWayfinding'].forEach((id) => {
    if (typeof preferences[id] === 'boolean') {
      $(`#${id}`).checked = preferences[id];
    }
  });
}).catch((error) => {
  const cachedPreferences = localStorage.getItem(preferencesCacheKey);
  if (cachedPreferences) {
    const preferences = JSON.parse(cachedPreferences);
    ['stepFree', 'fewTransfers', 'covered', 'clearWayfinding'].forEach((id) => {
      if (typeof preferences[id] === 'boolean') {
        $(`#${id}`).checked = preferences[id];
      }
    });
    toast(`Offline: loaded saved preferences. ${error.message}`);
  } else {
    toast(`Could not load preferences: ${error.message}`);
  }
});

$('#acceptRouteChange').addEventListener('click', () => {
  const nextIndex = Number($('#suggestedRoute').value);
  if (Number.isInteger(nextIndex) && routes[nextIndex]) {
    selectRoute(nextIndex);
    $('#routeChangeDialog').close();
    toast(`Route ${nextIndex + 1} selected after your confirmation.`);
  }
});

$('#reviewRouteChange').addEventListener('click', () => {
  if (routes.length < 2) {
    toast('Find alternative routes before reviewing a route change.');
    return;
  }
  const suggestedIndex = routes.findIndex((route, index) =>
    index !== selectedRouteIndex && routeSafetyCount(route) < routeSafetyCount(routes[selectedRouteIndex]),
  );
  const nextIndex = suggestedIndex >= 0 ? suggestedIndex : (selectedRouteIndex + 1) % routes.length;
  $('#suggestedRoute').value = String(nextIndex);
  $('#routeChangeExplanation').textContent = `Route ${nextIndex + 1}: ${routeExplanation(routes[nextIndex], nextIndex)} Review the details, then choose whether to apply it. No route changes automatically.`;
  $('#routeChangeDialog').showModal();
});

searchRoutes();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/service-worker.js').catch((error) => {
    console.error('Unable to register offline app support:', error);
  });
}
