const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const routeData = {
  a: {
    name: 'Fastest route',
    time: 28,
    walk: '450 m',
    fare: '₹45',
    transfers: '1 transfer',
    status: 'Some stairs',
    detail: [
      ['●', 'Walk to Ameerpet Metro', '4 min · 250 m · Footpath condition unverified', 'green-step'],
      ['M', 'Metro towards Raidurg', '18 min · Platform lift status: verify locally', 'blue-step'],
      ['↗', 'Walk to HITEC City', '6 min · 200 m · Crossing information unavailable', 'red-step'],
    ],
  },
  b: {
    name: 'Step-free journey',
    time: 36,
    walk: '250 m',
    fare: '₹55',
    transfers: '1 transfer',
    status: 'Step-free info available',
    detail: [
      ['●', 'Walk to Ameerpet Metro', '5 min · 150 m · Step-free path reported; verify status', 'green-step'],
      ['↟', 'Station interchange', '7 min · Lift route shown · Last verification unavailable', 'blue-step'],
      ['B', 'Bus towards HITEC City', '24 min · Stop-level accessibility needs confirmation', 'red-step'],
    ],
  },
  c: {
    name: 'Fewer transfers',
    time: 42,
    walk: '700 m',
    fare: '₹38',
    transfers: '0 transfers',
    status: 'Longer walk',
    detail: [
      ['●', 'Walk to bus stop', '9 min · 500 m · Footpath condition unverified', 'green-step'],
      ['B', 'Direct bus towards HITEC City', '27 min · Crowd and ramp status unknown', 'blue-step'],
      ['↗', 'Walk to destination', '6 min · 200 m · Crossing information unavailable', 'red-step'],
    ],
  },
};

let selected = 'a';
let zoom = 1;
let toastTimer;

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function prefs() {
  return {
    stepFree: $('#stepFree').checked,
    fewTransfers: $('#fewTransfers').checked,
    covered: $('#covered').checked,
    clearWayfinding: $('#clearWayfinding').checked,
  };
}

function updateRouteDetails() {
  const route = routeData[selected];
  const detailSteps = route.detail
    .map(([icon, title, description, color]) => `
      <div class="detail-step">
        <span class="step-icon ${color}">${icon}</span>
        <div>
          <strong>${title}</strong>
          <small>${description}</small>
        </div>
      </div>
    `)
    .join('');

  $('#routeDetail').innerHTML = `
    <div class="detail-head">
      <strong>Journey details</strong>
      <span class="detail-status">● Preference match</span>
    </div>
    ${detailSteps}
  `;
  $('#previewTime').textContent = `${route.time} min`;
  $('#previewWalk').textContent = route.walk;
  $('#previewFare').textContent = route.fare;
  $('#journeySummary').textContent = `${$('#origin').value} → ${$('#destination').value}`;
}

function selectRoute(id) {
  selected = id;

  $$('.route-card').forEach((card) => {
    card.classList.toggle('selected', card.dataset.route === id);
  });

  updateRouteDetails();

  $('#routeA').style.opacity = id === 'a' ? 1 : 0.23;
  $('#routeB').style.opacity = id === 'b' ? 1 : 0.23;
  $('#routeC').style.opacity = id === 'c' ? 1 : 0.23;

  toast(`${routeData[id].name} selected`);
}

function updatePreferences() {
  const preferences = prefs();
  let order = ['a', 'b', 'c'];

  if (preferences.stepFree) {
    order = ['b', 'a', 'c'];
  }

  if (preferences.fewTransfers) {
    order = ['c', ...order.filter((id) => id !== 'c')];
  }

  if (preferences.covered) {
    order = ['b', ...order.filter((id) => id !== 'b')];
  }

  const cards = $('#routeCards');
  order.forEach((id) => {
    cards.append(cards.querySelector(`[data-route="${id}"]`));
  });

  $('#mapToast').textContent = preferences.stepFree
    ? 'Prioritizing step-free information · verify locally'
    : 'Showing route alternatives around Hyderabad';
  $('#resultCount').textContent = '3 routes · preferences applied';
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

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderSaved() {
  const items = JSON.parse(localStorage.getItem('wayfinderSaved') || '[]');
  const host = $('#savedContent');

  if (!items.length) {
    host.innerHTML = `
      <div class="empty-state">
        <strong>No saved journeys yet</strong>
        Choose a route and use “Preview this journey” → “Save this journey” to keep it here.
      </div>
    `;
    return;
  }

  host.innerHTML = items
    .map((item) => `
      <div class="saved-item">
        <div>
          <strong>${escapeHtml(item.from)} → ${escapeHtml(item.to)}</strong>
          <p>
            ${escapeHtml(item.route)} · ${item.time} min ·
            ${escapeHtml(item.walk)} walk · ${escapeHtml(item.fare)}
          </p>
        </div>
        <button data-remove="${item.id}">Remove</button>
      </div>
    `)
    .join('');

  $$('[data-remove]', host).forEach((button) => {
    button.addEventListener('click', () => {
      const next = items.filter((item) => item.id !== Number(button.dataset.remove));
      localStorage.setItem('wayfinderSaved', JSON.stringify(next));
      renderSaved();
      toast('Saved journey removed');
    });
  });
}

// Route and preference controls
$$('.route-card').forEach((card) => {
  card.addEventListener('click', () => selectRoute(card.dataset.route));
});

$('#findRoutes').addEventListener('click', () => {
  if (!$('#destination').value.trim()) {
    toast('Enter a destination to compare routes');
    $('#destination').focus();
    return;
  }

  updatePreferences();
  toast('Route options updated for your preferences');
});

['stepFree', 'fewTransfers', 'covered', 'clearWayfinding'].forEach((id) => {
  $(`#${id}`).addEventListener('change', updatePreferences);
});

$('#resetPrefs').addEventListener('click', () => {
  ['stepFree', 'fewTransfers', 'covered', 'clearWayfinding'].forEach((id) => {
    $(`#${id}`).checked = id === 'stepFree';
  });

  updatePreferences();
  toast('Preferences reset');
});

$('#swapBtn').addEventListener('click', () => {
  const origin = $('#origin').value;
  $('#origin').value = $('#destination').value;
  $('#destination').value = origin;
  toast('Start and destination swapped');
});

$('#clearDestination').addEventListener('click', () => {
  $('#destination').value = '';
  $('#destination').focus();
});

$$('[data-dest]').forEach((button) => {
  button.addEventListener('click', () => {
    $('#destination').value = button.dataset.dest;
    toast(`Destination set to ${button.dataset.dest}`);
  });
});

// Journey dialogs
$('#startJourney').addEventListener('click', () => {
  updateRouteDetails();
  $('#journeyDialog').showModal();
});

$('#saveJourney').addEventListener('click', () => {
  const route = routeData[selected];
  const item = {
    id: Date.now(),
    from: $('#origin').value,
    to: $('#destination').value,
    route: route.name,
    time: route.time,
    walk: route.walk,
    fare: route.fare,
  };

  const saved = JSON.parse(localStorage.getItem('wayfinderSaved') || '[]');
  saved.unshift(item);
  localStorage.setItem('wayfinderSaved', JSON.stringify(saved));

  $('#journeyDialog').close();
  toast('Journey saved in this browser');
});

// Issue report dialog
$('#reportIssue').addEventListener('click', () => {
  $('#issueDialog').showModal();
});

$('#submitIssue').addEventListener('click', () => {
  const reports = JSON.parse(localStorage.getItem('wayfinderReports') || '[]');

  reports.push({
    type: $('#issueType').value,
    place: $('#issuePlace').value,
    notes: $('#issueNotes').value,
    date: new Date().toISOString(),
  });

  localStorage.setItem('wayfinderReports', JSON.stringify(reports));
  $('#issueDialog').close();
  $('#issueNotes').value = '';
  toast('Thanks — your demo report was saved locally');
});

// Navigation
$$('.nav-link').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

// Map controls
$('#howItWorks').addEventListener('click', () => showView('about'));

$('#layersBtn').addEventListener('click', () => {
  const mapArt = $('.map-art');
  mapArt.style.filter = mapArt.style.filter ? '' : 'grayscale(.75) contrast(.92)';
  toast('Map layer style toggled');
});

$('#locateBtn').addEventListener('click', () => {
  toast('Demo location: Ameerpet Metro Station');
});

$('#zoomIn').addEventListener('click', () => {
  zoom = Math.min(1.35, zoom + 0.08);
  $('.map-art').style.transform = `scale(${zoom})`;
  toast('Map zoomed in');
});

$('#zoomOut').addEventListener('click', () => {
  zoom = Math.max(0.85, zoom - 0.08);
  $('.map-art').style.transform = `scale(${zoom})`;
  toast('Map zoomed out');
});

$('#profileBtn').addEventListener('click', () => {
  toast('Profile settings are not part of this prototype');
});

$('#origin').addEventListener('change', updateRouteDetails);
$('#destination').addEventListener('change', updateRouteDetails);

updateRouteDetails();
