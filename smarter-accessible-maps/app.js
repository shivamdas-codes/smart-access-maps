const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const routeColors = ['#4285f4', '#e6a23c', '#9b8bd8'];
const savedJourneysKey = 'wayfinderSaved';
const savedReportsKey = 'wayfinderReports';

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

function placeLabel(feature) {
  const properties = feature.properties;
  const parts = [
    properties.name,
    properties.street,
    properties.city || properties.locality,
    properties.state,
    properties.country,
  ].filter(Boolean);

  return [...new Set(parts)].join(', ');
}

async function findPlace(query) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');
  url.searchParams.set('lang', 'en');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Place search failed (${response.status}). Please try again.`);
  }

  const result = await response.json();
  const feature = result.features?.[0];
  if (!feature) {
    throw new Error(`Couldn't find “${query}”. Check the spelling or add a city or country.`);
  }

  return {
    coordinates: feature.geometry.coordinates,
    label: placeLabel(feature) || query,
  };
}

async function findRoadRoutes(origin, destination) {
  const [originLongitude, originLatitude] = origin.coordinates;
  const [destinationLongitude, destinationLatitude] = destination.coordinates;
  const coordinates = [
    `${originLongitude},${originLatitude}`,
    `${destinationLongitude},${destinationLatitude}`,
  ].join(';');
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinates}`);
  url.searchParams.set('alternatives', '3');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Road routing failed (${response.status}). Please try again.`);
  }

  const result = await response.json();
  if (result.code !== 'Ok' || !result.routes?.length) {
    throw new Error('No drivable route was found between those places.');
  }

  return result.routes;
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
    ? `${count} road route${count === 1 ? '' : 's'} · access unknown`
    : 'No routes yet';
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
      index === 0 ? 'Fastest road route' : `Alternative road route ${index + 1}`,
    );
    const badge = addTextElement(
      top,
      'span',
      'route-badge',
      index === 0 ? 'FASTEST' : `OPTION ${index + 1}`,
    );
    badge.style.backgroundColor = `${routeColors[index % routeColors.length]}20`;
    badge.style.color = routeColors[index % routeColors.length];

    const time = addTextElement(card, 'div', 'route-time', '');
    const timeValue = addTextElement(time, 'strong', '', formatDuration(route.duration));
    timeValue.style.color = routeColors[index % routeColors.length];
    addTextElement(time, 'span', '', `${formatDistance(route.distance)} · Driving`);

    const visual = addTextElement(card, 'div', 'route-visual', '');
    const line = addTextElement(visual, 'span', 'route-dash', '');
    line.style.borderTopColor = routeColors[index % routeColors.length];

    const meta = addTextElement(card, 'div', 'route-meta', '');
    addTextElement(meta, 'span', '', 'Road route');
    addTextElement(meta, 'span', 'warning-text', 'Access not verified');

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
  addTextElement(heading, 'span', 'detail-status', 'Accessibility not verified');

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
  $('#journeySummary').textContent = `${$('#origin').value.trim()} → ${$('#destination').value.trim()}`;
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

function updatePreferences() {
  $('#resultCount').textContent = routes.length
    ? `${routes.length} road route${routes.length === 1 ? '' : 's'} · access unknown`
    : 'No routes yet';
  $('#mapToast').textContent = 'Driving routes only · accessibility preferences are not applied';
  toast('The road-routing service cannot verify or apply accessibility preferences.');
}

function showView(name) {
  $$('.view').forEach((view) => view.classList.remove('active-view'));
  $(`#${name}View`).classList.add('active-view');
  $$('.nav-link').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === name);
  });

  if (name === 'saved') {
    renderSaved();
  }

  if (name === 'explore' && map) {
    map.invalidateSize();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderSaved() {
  const items = JSON.parse(localStorage.getItem(savedJourneysKey) || '[]');
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
      `${item.route} · ${duration} · ${distance} · Driving`,
    );

    const removeButton = addTextElement(savedItem, 'button', '', 'Remove');
    removeButton.type = 'button';
    removeButton.addEventListener('click', () => {
      const next = items.filter((savedItem) => savedItem.id !== item.id);
      localStorage.setItem(savedJourneysKey, JSON.stringify(next));
      renderSaved();
      toast('Saved journey removed');
    });
  });
}

function saveJourney() {
  const route = routes[selectedRouteIndex];
  if (!route) {
    toast('Find a road route before saving a journey.');
    return;
  }

  const saved = JSON.parse(localStorage.getItem(savedJourneysKey) || '[]');
  saved.unshift({
    id: Date.now(),
    from: $('#origin').value.trim(),
    to: $('#destination').value.trim(),
    route: selectedRouteIndex === 0 ? 'Fastest road route' : `Alternative road route ${selectedRouteIndex + 1}`,
    time: formatDuration(route.duration),
    distance: formatDistance(route.distance),
  });
  localStorage.setItem(savedJourneysKey, JSON.stringify(saved));
  $('#journeyDialog').close();
  toast('Journey saved in this browser');
}

function submitIssue() {
  const reports = JSON.parse(localStorage.getItem(savedReportsKey) || '[]');
  reports.push({
    type: $('#issueType').value,
    place: $('#issuePlace').value,
    notes: $('#issueNotes').value,
    date: new Date().toISOString(),
  });
  localStorage.setItem(savedReportsKey, JSON.stringify(reports));
  $('#issueDialog').close();
  $('#issueNotes').value = '';
  toast('Thanks — your demo report was saved locally');
}

initializeMap();

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
  $(`#${id}`).addEventListener('change', updatePreferences);
});

$('#resetPrefs').addEventListener('click', () => {
  ['stepFree', 'fewTransfers', 'covered', 'clearWayfinding'].forEach((id) => {
    $(`#${id}`).checked = id === 'stepFree';
  });
  updatePreferences();
});

$('#startJourney').addEventListener('click', () => {
  if (!routes.length) {
    toast('Find a road route before previewing a journey.');
    return;
  }
  updateRouteDetails();
  $('#journeyDialog').showModal();
});

$('#saveJourney').addEventListener('click', saveJourney);
$('#reportIssue').addEventListener('click', () => $('#issueDialog').showModal());
$('#submitIssue').addEventListener('click', submitIssue);
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

searchRoutes();
