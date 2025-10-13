// Tooltip interactions for Cycling Coach
(function () {
  const ACTIVE_CLASS = 'tt--open';
  let openTooltip = null;
  let openTrigger = null;

  function ensureFocusable(tip) {
    if (!tip) return;
    if (!tip.hasAttribute('tabindex')) {
      tip.setAttribute('tabindex', '-1');
    }
  }

  function posTooltip(trigger, tip) {
    if (!trigger || !tip) return;
    const triggerRect = trigger.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
    const viewportWidth = document.documentElement.clientWidth;

    const maxWidth = Math.min(320, Math.max(180, viewportWidth - 24));
    tip.style.maxWidth = `${maxWidth}px`;

    const top = triggerRect.bottom + 8 + scrollY;
    let left = triggerRect.left + scrollX;

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;

    const tipWidth = tip.offsetWidth || maxWidth;
    const minLeft = scrollX + 12;
    const maxLeft = scrollX + viewportWidth - tipWidth - 12;
    if (maxLeft < minLeft) {
      left = minLeft;
    } else {
      left = Math.min(Math.max(left, minLeft), maxLeft);
    }

    tip.style.left = `${left}px`;
  }

  function makeFromData(trigger, id) {
    const text = trigger.getAttribute('data-tt');
    if (!text) return null;
    const tip = document.createElement('div');
    tip.id = id;
    tip.className = 'tt';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('tabindex', '-1');
    tip.hidden = true;
    tip.textContent = text;
    document.body.appendChild(tip);
    return tip;
  }

  function closeTooltip(options = {}) {
    if (!openTooltip || !openTrigger) return;
    const { focusTrigger = false } = options;
    const tip = openTooltip;
    const trigger = openTrigger;

    tip.hidden = true;
    tip.classList.remove(ACTIVE_CLASS);
    trigger.setAttribute('aria-expanded', 'false');

    openTooltip = null;
    openTrigger = null;

    if (focusTrigger && typeof trigger.focus === 'function') {
      try {
        trigger.focus({ preventScroll: true });
      } catch (err) {
        trigger.focus();
      }
    }
  }

  function openFor(trigger) {
    const id = trigger.getAttribute('aria-controls');
    if (!id) return;
    const tip = document.getElementById(id) || makeFromData(trigger, id);
    if (!tip) return;

    ensureFocusable(tip);

    if (openTooltip && openTooltip !== tip) {
      closeTooltip();
    }

    tip.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    posTooltip(trigger, tip);
    tip.classList.add(ACTIVE_CLASS);

    openTooltip = tip;
    openTrigger = trigger;

    if (typeof tip.focus === 'function') {
      try {
        tip.focus({ preventScroll: true });
      } catch (err) {
        tip.focus();
      }
    }
  }

  function toggleFor(trigger) {
    if (!trigger) return;
    if (openTrigger === trigger) {
      closeTooltip({ focusTrigger: true });
    } else {
      openFor(trigger);
    }
  }

  function onTrigger(event) {
    event.preventDefault();
    toggleFor(event.currentTarget);
  }

  function onTriggerKey(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleFor(event.currentTarget);
    }
  }

  function onDocClick(event) {
    if (!openTooltip) return;
    if (openTooltip.contains(event.target)) {
      return;
    }
    const trigger = event.target.closest('.tt-trigger');
    if (trigger) {
      return;
    }
    closeTooltip();
  }

  function onDocKeydown(event) {
    if (event.key === 'Escape' && openTooltip) {
      closeTooltip({ focusTrigger: true });
    }
  }

  function onScroll() {
    if (openTooltip) {
      closeTooltip();
    }
  }

  function onResize() {
    if (openTooltip && openTrigger) {
      posTooltip(openTrigger, openTooltip);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const triggers = document.querySelectorAll('.tt-trigger');
    if (!triggers.length) {
      return;
    }

    triggers.forEach((trigger) => {
      const id = trigger.getAttribute('aria-controls');
      trigger.addEventListener('click', onTrigger);
      trigger.addEventListener('keydown', onTriggerKey);
      trigger.setAttribute('aria-expanded', trigger.getAttribute('aria-expanded') === 'true' ? 'true' : 'false');
      if (id) {
        const tip = document.getElementById(id);
        if (tip) {
          ensureFocusable(tip);
          tip.hidden = true;
        } else {
          ensureFocusable(makeFromData(trigger, id));
        }
      }
    });

    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onDocKeydown);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
  });
})();

const ZERO_EPS = 0.02;
const FIELD_SETTINGS = {
  ammonia: { max: 8, decimals: 2 },
  nitrite: { max: 5, decimals: 2 },
  nitrate: { max: 200, decimals: 1 },
};

const ACTION_SETS = {
  fishlessEarly: [
    'Keep ammonia at ~1–2 ppm to feed bacteria',
    'Test daily or every other day',
    'Watch for nitrite to start appearing',
    'Maintain good aeration and stable temperature',
  ],
  fishlessSpike: [
    'Keep ammonia at ~1–2 ppm',
    'Test daily or every other day',
    'Expect nitrite to stay high for a while — this is normal',
    'Nitrates will begin to appear; keep them under 40 ppm with water changes',
  ],
  fishlessNearly: [
    'Keep ammonia at ~1–2 ppm',
    'Test daily or every other day',
    'Watch for nitrite to drop to 0',
    'Keep nitrates under 40 ppm with water changes',
  ],
  fishlessCycled: [
    'Dose ammonia up to ~2 ppm',
    'Start the 24-hour challenge below',
    'Do not add fish yet',
    'Keep nitrates under 40 ppm with a large water change before stocking',
  ],
  fishinProgress: [
    'Test ammonia and nitrite daily',
    'Feed lightly — don’t overfeed during cycling',
    'Hold off on adding new fish until cycle is complete',
    'Keep nitrates under 40 ppm with regular water changes',
    'You may use a water conditioner that temporarily detoxifies ammonia/nitrite (supportive, not a substitute for water changes)',
  ],
  fishinUrgent: [
    'Do a 25–50% water change now',
    'Recommended: test every 12 hours, especially after water changes',
    'Feed lightly until levels improve',
    'Pause adding new fish until cycle is stable',
    'Keep nitrates under 40 ppm with regular water changes',
    'Optionally dose a water conditioner to temporarily detoxify ammonia/nitrite — still perform water changes as the main fix',
  ],
  challengePass: [
    'Your tank processed 2 ppm of ammonia in 24 hours (ammonia and nitrite both 0)',
    'Do a large water change to reduce nitrates under 40 ppm',
    'You are ready to begin stocking responsibly — congratulations on building a stable cycle',
  ],
  challengeFail: [
    'Ammonia or nitrite did not drop to 0 in 24 hours',
    'Keep dosing ammonia at ~1–2 ppm',
    'Test daily or every other day',
    'Don’t worry — this is normal, try the challenge again in a few days',
  ],
};

const NITRATE_LINES = {
  planted: 'Keep nitrates under 40 ppm for fish safety, but don’t chase zero — plants need some nitrate to grow.',
  notPlanted: 'Keep nitrates under 40 ppm with regular water changes. Many aquarists aim for 20 ppm or less for extra safety.',
};

function ensureNavClosed() {
  const drawerSelectors = ['#ttg-drawer', '#sidebar', '.sidenav', '.nav-drawer', '[data-drawer]'];
  const classNames = ['open', 'active', 'is-open', 'is-visible'];

  drawerSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((drawer) => {
      classNames.forEach((cls) => drawer.classList.remove(cls));
      if (drawer.hasAttribute('aria-hidden')) {
        drawer.setAttribute('aria-hidden', 'true');
      }
    });
  });

  document.body.classList.remove('drawer-open', 'has-drawer', 'app--with-drawer');

  const toggles = document.querySelectorAll('[aria-controls], [data-drawer-toggle], #ttg-nav-open, #ttg-nav-close');
  toggles.forEach((toggle) => {
    if (toggle instanceof HTMLElement && toggle.hasAttribute('aria-expanded')) {
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function sanitizeField(input, settings) {
  const raw = parseFloat(input.value);
  if (Number.isNaN(raw)) {
    return null;
  }
  let value = Math.max(0, raw);
  if (typeof settings.max === 'number') {
    value = Math.min(value, settings.max);
  }
  if (typeof settings.decimals === 'number') {
    const formatted = parseFloat(value.toFixed(settings.decimals));
    input.value = Number.isNaN(formatted) ? '' : formatted.toString();
    return formatted;
  }
  input.value = value.toString();
  return value;
}

function readClampedValue(input, settings) {
  const raw = parseFloat(input.value);
  if (Number.isNaN(raw)) {
    return null;
  }
  let value = Math.max(0, raw);
  if (typeof settings.max === 'number') {
    value = Math.min(value, settings.max);
  }
  return value;
}

function formatNumber(value, decimals) {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  const precision = typeof decimals === 'number' ? decimals : value >= 10 ? 1 : 2;
  const fixed = value.toFixed(precision);
  return fixed.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function isZero(value) {
  return Math.abs(value) <= ZERO_EPS;
}

function renderList(listEl, items) {
  listEl.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    listEl.appendChild(li);
  });
}

let challengeActive = false;
let defaultChallengeInstruction = '';

function resetChallenge({ soft }) {
  const a = document.getElementById('challengeAmmonia');
  const n = document.getElementById('challengeNitrite');
  const msg = document.getElementById('challengeMessage');
  const tip = document.getElementById('challengeInstruction');
  const start = document.getElementById('challenge-start');
  const form = document.getElementById('challenge-form');
  const check = document.getElementById('challenge-check');
  const results = document.getElementById('challenge-results');
  const list = document.getElementById('challenge-list');
  const ammoniaError = document.getElementById('challenge-ammonia-error');
  const nitriteError = document.getElementById('challenge-nitrite-error');

  if (!soft) {
    challengeActive = false;
    if (a) a.value = '';
    if (n) n.value = '';
    if (start) start.disabled = false;
    if (form) form.hidden = true;
    if (check) {
      check.hidden = true;
      check.disabled = false;
    }
    if (results) results.hidden = true;
    if (list) list.innerHTML = '';
    if (ammoniaError) {
      ammoniaError.textContent = '';
      ammoniaError.hidden = true;
    }
    if (nitriteError) {
      nitriteError.textContent = '';
      nitriteError.hidden = true;
    }
    if (tip) {
      tip.textContent = defaultChallengeInstruction;
    }
  }

  if (msg) msg.textContent = '';
  if (tip) tip.classList.remove('is-warning', 'is-success');
}

function updateChallengeVisibility({ method, status }) {
  const card = document.getElementById('challengeCard');
  if (!card) return;
  const ready = method === 'Fishless' && status === 'Cycled (likely)';
  if (ready) {
    card.removeAttribute('hidden');
    resetChallenge({ soft: true });
  } else {
    card.setAttribute('hidden', '');
    resetChallenge({ soft: false });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ensureNavClosed();

  const form = document.getElementById('coach-form');
  const ammoniaInput = document.getElementById('ammonia');
  const nitriteInput = document.getElementById('nitrite');
  const nitrateInput = document.getElementById('nitrate');
  const methodSelect = document.getElementById('method') || document.getElementById('cycle-method');
  const plantedCheckbox = document.getElementById('planted');
  const checkButton = document.getElementById('check-button');
  const clearButton = document.getElementById('clear-button');
  const statusBadge = document.getElementById('status-badge');
  const resultsSummary = document.getElementById('results-summary');
  const actionsBlock = document.getElementById('actions-block');
  const actionsList = document.getElementById('actions-list');
  const challengeCard = document.getElementById('challengeCard');
  const challengeStart = document.getElementById('challenge-start');
  const challengeForm = document.getElementById('challenge-form');
  const challengeCheck = document.getElementById('challenge-check');
  const challengeResults = document.getElementById('challenge-results');
  const challengeList = document.getElementById('challenge-list');
  const challengeAmmonia = document.getElementById('challengeAmmonia');
  const challengeNitrite = document.getElementById('challengeNitrite');
  const challengeAmmoniaError = document.getElementById('challenge-ammonia-error');
  const challengeNitriteError = document.getElementById('challenge-nitrite-error');
  const challengeInstruction = document.getElementById('challengeInstruction');
  const challengeMessage = document.getElementById('challengeMessage');
  if (challengeInstruction && !defaultChallengeInstruction) {
    defaultChallengeInstruction = challengeInstruction.textContent || '';
  }
  if (challengeCard) {
    challengeCard.setAttribute('hidden', '');
  }
  const advancedPanel = document.getElementById('advanced-panel');
  const advancedSummary = advancedPanel ? advancedPanel.querySelector('summary') : null;
  const phInput = document.getElementById('ph');
  const tempInput = document.getElementById('temperature');
  const tempToggle = document.getElementById('temp-toggle');
  const nh3Value = document.getElementById('nh3-value');
  const nh3Badge = document.getElementById('nh3-badge');

  let hasAssessed = false;
  let tempUnit = 'F';
  let currentAmmonia = null;

  function updatePlantedVisual() {
    document.body.classList.toggle('planted-active', plantedCheckbox.checked);
  }

  function hideFieldError(element) {
    if (element) {
      element.textContent = '';
      element.hidden = true;
    }
  }

  function showFieldError(element, message) {
    if (element) {
      element.textContent = message;
      element.hidden = false;
    }
  }

  function updateSummary(ammonia, nitrite, nitrate, methodLabel, planted) {
    const summary = `Ammonia: ${formatNumber(ammonia, 2)} ppm • Nitrite: ${formatNumber(nitrite, 2)} ppm • Nitrate: ${formatNumber(nitrate, 1)} ppm • Method: ${methodLabel} • Planted: ${planted ? 'Yes' : 'No'}`;
    resultsSummary.textContent = summary;
  }

  function getMethodValue() {
    if (!methodSelect) {
      return 'fishless';
    }
    return methodSelect.value === 'fish-in' ? 'fish-in' : 'fishless';
  }

  function getMethodLabelFromValue(value) {
    return value === 'fish-in' ? 'Fish-in' : 'Fishless';
  }

  function getCurrentStatusLabel() {
    const raw = statusBadge.textContent || '';
    const cleaned = raw.replace(/^[^A-Za-z0-9]+\s*/, '').trim();
    return cleaned || 'Incomplete';
  }

  function updateActions(statusKey, planted, forceShow = false) {
    const nitrateLine = planted ? NITRATE_LINES.planted : NITRATE_LINES.notPlanted;
    const actions = [];

    if (statusKey && ACTION_SETS[statusKey]) {
      actions.push(...ACTION_SETS[statusKey]);
    }

    if (forceShow || actions.length > 0) {
      if (!actions.includes(nitrateLine)) {
        actions.push(nitrateLine);
      }
      renderList(actionsList, actions);
      actionsBlock.hidden = false;
    } else {
      actionsBlock.hidden = true;
      actionsList.innerHTML = '';
    }
  }

  function updateStatus(ammonia, nitrite, nitrate, methodValue, methodLabel, planted) {
    const missing = ammonia === null || nitrite === null || nitrate === null;
    let status = 'Incomplete';
    let symbol = '⚪';
    let actionKey = null;
    let showActions = false;

    if (!missing) {
      if (methodValue === 'fish-in' && (ammonia >= 0.25 || nitrite >= 0.25)) {
        status = 'Urgent';
        symbol = '🔴';
        actionKey = 'fishinUrgent';
        showActions = true;
      } else if (isZero(ammonia) && isZero(nitrite) && nitrate > 0) {
        status = 'Cycled (likely)';
        symbol = '🟢';
        actionKey = 'fishlessCycled';
        showActions = true;
      } else if (methodValue === 'fishless') {
        if (isZero(nitrite) && isZero(nitrate)) {
          status = 'In Progress';
          symbol = '🟡';
          actionKey = 'fishlessEarly';
          showActions = true;
        } else if (!isZero(nitrite) && !isZero(ammonia)) {
          status = 'In Progress';
          symbol = '🟡';
          actionKey = 'fishlessSpike';
          showActions = true;
        } else if (!isZero(nitrite) && isZero(ammonia)) {
          status = 'In Progress';
          symbol = '🟡';
          actionKey = 'fishlessNearly';
          showActions = true;
        } else {
          status = 'Mixed';
          symbol = '⚪';
          showActions = true;
        }
      } else {
        status = 'In Progress';
        symbol = '🟡';
        actionKey = 'fishinProgress';
        showActions = true;
      }
    }

    statusBadge.textContent = `${symbol} ${status}`;
    updateActions(actionKey, planted, showActions);
    updateChallengeVisibility({ method: methodLabel, status });
    return status;
  }

  function computeNH3Estimate(tan, ph, tempCelsius) {
    if (tan === null || tan === undefined || Number.isNaN(tan)) {
      return null;
    }
    if (ph === null || Number.isNaN(ph)) {
      return null;
    }
    if (tempCelsius === null || Number.isNaN(tempCelsius)) {
      return null;
    }
    const pKa = 0.0901821 + 2729.92 / (273.15 + tempCelsius);
    const fraction = 1 / (Math.pow(10, pKa - ph) + 1);
    const estimate = tan * fraction;
    return Number.isFinite(estimate) ? estimate : null;
  }

  function updateNH3Estimate() {
    const tan = currentAmmonia;
    const phRaw = parseFloat(phInput.value);
    const phValue = Number.isNaN(phRaw) ? null : phRaw;
    const tempRaw = parseFloat(tempInput.value);
    const tempValue = Number.isNaN(tempRaw) ? null : tempRaw;

    let tempC = null;
    if (tempValue !== null) {
      tempC = tempUnit === 'F' ? ((tempValue - 32) * 5) / 9 : tempValue;
    }

    const estimate = computeNH3Estimate(tan, phValue, tempC);
    if (estimate === null) {
      nh3Value.textContent = '—';
      nh3Badge.hidden = true;
      return;
    }

    const display = estimate >= 1 ? estimate.toFixed(2) : estimate >= 0.1 ? estimate.toFixed(3) : estimate.toFixed(4);
    nh3Value.textContent = display.replace(/\.0+$/, '').replace(/(?<=\.[0-9]*?)0+$/, '').replace(/\.$/, '') + ' ppm';
    if (estimate >= 0.02) {
      nh3Badge.hidden = false;
    } else {
      nh3Badge.hidden = true;
    }
  }

  function handleAssessment() {
    const ammonia = sanitizeField(ammoniaInput, FIELD_SETTINGS.ammonia);
    const nitrite = sanitizeField(nitriteInput, FIELD_SETTINGS.nitrite);
    const nitrate = sanitizeField(nitrateInput, FIELD_SETTINGS.nitrate);
    const methodValue = getMethodValue();
    const methodLabel = getMethodLabelFromValue(methodValue);
    const planted = plantedCheckbox.checked;

    currentAmmonia = ammonia;
    updateSummary(ammonia, nitrite, nitrate, methodLabel, planted);
    updateStatus(ammonia, nitrite, nitrate, methodValue, methodLabel, planted);
    updateNH3Estimate();
  }

  function resetOutputs() {
    statusBadge.textContent = '⚪ Incomplete';
    resultsSummary.textContent = 'Ammonia: — ppm • Nitrite: — ppm • Nitrate: — ppm • Method: Fishless • Planted: No';
    actionsBlock.hidden = true;
    actionsList.innerHTML = '';
    updateChallengeVisibility({
      method: getMethodLabelFromValue(getMethodValue()),
      status: 'Incomplete',
    });
    currentAmmonia = null;
    updateNH3Estimate();
  }

  updatePlantedVisual();

  checkButton.addEventListener('click', () => {
    hasAssessed = true;
    handleAssessment();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    hasAssessed = true;
    handleAssessment();
  });

  clearButton.addEventListener('click', () => {
    form.reset();
    methodSelect.value = 'fishless';
    hasAssessed = false;
    updatePlantedVisual();
    resetOutputs();
  });

  plantedCheckbox.addEventListener('change', () => {
    updatePlantedVisual();
    if (hasAssessed) {
      handleAssessment();
    }
  });

  methodSelect.addEventListener('change', () => {
    const methodValue = getMethodValue();
    const methodLabel = getMethodLabelFromValue(methodValue);
    const statusNow = hasAssessed ? getCurrentStatusLabel() : 'Incomplete';
    updateChallengeVisibility({ method: methodLabel, status: statusNow });
    if (hasAssessed) {
      handleAssessment();
    }
  });

  ammoniaInput.addEventListener('input', () => {
    currentAmmonia = readClampedValue(ammoniaInput, FIELD_SETTINGS.ammonia);
    updateNH3Estimate();
  });

  phInput.addEventListener('input', () => {
    updateNH3Estimate();
  });

  tempInput.addEventListener('input', () => {
    updateNH3Estimate();
  });

  tempToggle.addEventListener('click', () => {
    const raw = parseFloat(tempInput.value);
    if (!Number.isNaN(raw)) {
      if (tempUnit === 'F') {
        const converted = ((raw - 32) * 5) / 9;
        tempInput.value = parseFloat(converted.toFixed(1)).toString();
      } else {
        const converted = raw * 9 / 5 + 32;
        tempInput.value = parseFloat(converted.toFixed(1)).toString();
      }
    }
    tempUnit = tempUnit === 'F' ? 'C' : 'F';
    tempToggle.textContent = `°${tempUnit}`;
    updateNH3Estimate();
  });

  challengeStart.addEventListener('click', () => {
    challengeActive = true;
    challengeForm.hidden = false;
    challengeCheck.hidden = false;
    challengeResults.hidden = true;
    challengeList.innerHTML = '';
    hideFieldError(challengeAmmoniaError);
    hideFieldError(challengeNitriteError);
    if (challengeMessage) {
      challengeMessage.textContent = '';
    }
    if (challengeInstruction) {
      challengeInstruction.classList.remove('is-warning', 'is-success');
    }
    if (challengeAmmonia) {
      challengeAmmonia.focus();
    }
  });

  function readChallengeValue(input, settings, errorElement) {
    const raw = input.value.trim();
    if (raw === '') {
      showFieldError(errorElement, 'Enter a value.');
      return null;
    }
    const sanitized = sanitizeField(input, settings);
    if (sanitized === null) {
      showFieldError(errorElement, 'Enter a number.');
      return null;
    }
    hideFieldError(errorElement);
    return sanitized;
  }

  challengeCheck.addEventListener('click', () => {
    if (!challengeActive) {
      return;
    }

    const ammonia = readChallengeValue(challengeAmmonia, FIELD_SETTINGS.ammonia, challengeAmmoniaError);
    const nitrite = readChallengeValue(challengeNitrite, FIELD_SETTINGS.nitrite, challengeNitriteError);

    if (ammonia === null || nitrite === null) {
      challengeResults.hidden = true;
      challengeList.innerHTML = '';
      if (challengeMessage) {
        challengeMessage.textContent = '';
      }
      return;
    }

    const outcome = isZero(ammonia) && isZero(nitrite) ? 'challengePass' : 'challengeFail';
    renderList(challengeList, ACTION_SETS[outcome]);
    if (challengeMessage) {
      challengeMessage.textContent =
        outcome === 'challengePass'
          ? 'PASS — ammonia and nitrite both reached 0 within 24 hours.'
          : 'Keep cycling — ammonia or nitrite is still above 0 after 24 hours.';
    }
    challengeResults.hidden = false;
  });

  if (advancedPanel) {
    advancedPanel.addEventListener('toggle', () => {
      if (advancedSummary) {
        advancedSummary.setAttribute('aria-expanded', advancedPanel.open ? 'true' : 'false');
      }
    });
  }

  updatePlantedVisual();
  resetOutputs();
});
