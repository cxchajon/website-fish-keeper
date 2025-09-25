const form = document.getElementById('coach-form');
const ammoniaInput = document.getElementById('ammonia');
const nitriteInput = document.getElementById('nitrite');
const nitrateInput = document.getElementById('nitrate');
const methodSelect = document.getElementById('cycle-method');
const plantedCheckbox = document.getElementById('planted');
const checkBtn = document.getElementById('check');
const clearBtn = document.getElementById('clear');
const statusBadge = document.getElementById('status-badge');
const summaryLine = document.getElementById('summary');
const actionsContainer = document.getElementById('actions-container');
const actionList = document.getElementById('action-list');
const challengePanel = document.getElementById('challenge-panel');
const challengeToggle = document.getElementById('challenge-toggle');
const challengeContent = document.getElementById('challenge-content');
const challengeStartBtn = document.getElementById('challenge-start');
const challengeForm = document.getElementById('challenge-form');
const challengeCheckBtn = document.getElementById('challenge-check');
const challengeResult = document.getElementById('challenge-result');
const challengeStatus = document.getElementById('challenge-status');
const challengeActions = document.getElementById('challenge-actions');
const challengeAmmonia = document.getElementById('challenge-ammonia');
const challengeNitrite = document.getElementById('challenge-nitrite');
const coachLeaf = document.getElementById('coach-leaf');
const advancedToggle = document.getElementById('advanced-toggle');
const advancedContent = document.getElementById('advanced-content');
const phInput = document.getElementById('ph');
const tempInput = document.getElementById('temperature');
const tempUnitBtn = document.getElementById('temp-unit');
const nh3Value = document.getElementById('nh3-value');
const nh3Badge = document.getElementById('nh3-badge');

const STATUS = {
  INCOMPLETE: 'Incomplete',
  IN_PROGRESS: 'In Progress',
  URGENT: 'Urgent',
  CYCLED: 'Cycled (likely)',
  MIXED: 'Mixed',
};

const STATUS_ICON = {
  [STATUS.CYCLED]: '🟢',
  [STATUS.IN_PROGRESS]: '🟡',
  [STATUS.URGENT]: '🔴',
  [STATUS.INCOMPLETE]: '⚪',
  [STATUS.MIXED]: '⚪',
};

const ACTION_SETS = {
  fishless: {
    inProgress: {
      early: [
        'Keep ammonia at ~1–2 ppm to feed bacteria',
        'Test daily or every other day',
        'Watch for nitrite to start appearing',
        'Maintain good aeration and stable temperature',
      ],
      spike: [
        'Keep ammonia at ~1–2 ppm',
        'Test daily or every other day',
        'Expect nitrite to stay high for a while — this is normal',
        'Nitrates will begin to appear; keep them under 40 ppm with water changes',
      ],
      nearly: [
        'Keep ammonia at ~1–2 ppm',
        'Test daily or every other day',
        'Watch for nitrite to drop to 0',
        'Keep nitrates under 40 ppm with water changes',
      ],
    },
    cycled: [
      'Dose ammonia up to ~2 ppm',
      'Start the 24-hour challenge below',
      'Do not add fish yet',
      'Keep nitrates under 40 ppm with a large water change before stocking',
    ],
    challenge: {
      pass: [
        'Your tank processed 2 ppm of ammonia in 24 hours (ammonia and nitrite both 0)',
        'Do a large water change to reduce nitrates under 40 ppm',
        'You are ready to begin stocking responsibly — congratulations on building a stable cycle',
      ],
      fail: [
        'Ammonia or nitrite did not drop to 0 in 24 hours',
        'Keep dosing ammonia at ~1–2 ppm',
        'Test daily or every other day',
        'Don’t worry — this is normal, try the challenge again in a few days',
      ],
    },
  },
  fishIn: {
    inProgress: [
      'Test ammonia and nitrite daily',
      'Feed lightly — don’t overfeed during cycling',
      'Hold off on adding new fish until cycle is complete',
      'Keep nitrates under 40 ppm with regular water changes',
      'You may use a water conditioner that temporarily detoxifies ammonia/nitrite (supportive, not a substitute for water changes)',
    ],
    urgent: [
      'Do a 25–50% water change now',
      'Recommended: test every 12 hours, especially after water changes',
      'Feed lightly until levels improve',
      'Pause adding new fish until cycle is stable',
      'Keep nitrates under 40 ppm with regular water changes',
      'Optionally dose a water conditioner to temporarily detoxify ammonia/nitrite — still perform water changes as the main fix',
    ],
  },
};

const NITRATE_HYGIENE = {
  planted: 'Keep nitrates under 40 ppm for fish safety, but don’t chase zero — plants need some nitrate to grow.',
  standard: 'Keep nitrates under 40 ppm with regular water changes. Many aquarists aim for 20 ppm or less for extra safety.',
};

const challengeState = {
  active: false,
  result: null,
};

let tempUnit = 'F';

function clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) {
  if (Number.isNaN(value)) return Number.NaN;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function parseInput(input, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  if (!input) return Number.NaN;
  const raw = parseFloat(input.value);
  if (Number.isNaN(raw)) return Number.NaN;
  const value = clampNumber(raw, min, max);
  return Number.isFinite(value) ? value : Number.NaN;
}

function formatNumber(value, decimals) {
  if (Number.isNaN(value)) return '—';
  return Number(value.toFixed(decimals)).toString();
}

function getInputs() {
  return {
    ammonia: parseInput(ammoniaInput, { max: 8 }),
    nitrite: parseInput(nitriteInput, { max: 5 }),
    nitrate: parseInput(nitrateInput, { max: 200 }),
    method: methodSelect.value === 'fish-in' ? 'fishIn' : 'fishless',
    planted: plantedCheckbox.checked,
  };
}

function allProvided({ ammonia, nitrite, nitrate }) {
  return ![ammonia, nitrite, nitrate].some((value) => Number.isNaN(value));
}

function isZero(value) {
  return Math.abs(value) < 0.00001;
}

function determineStatus(inputs) {
  if (!allProvided(inputs)) {
    return STATUS.INCOMPLETE;
  }

  const { ammonia, nitrite, nitrate, method } = inputs;

  if (method === 'fishIn' && (ammonia >= 0.25 || nitrite >= 0.25)) {
    return STATUS.URGENT;
  }

  if (method === 'fishless' && isZero(ammonia) && isZero(nitrite) && nitrate > 0) {
    return STATUS.CYCLED;
  }

  if (isZero(ammonia) && isZero(nitrite) && isZero(nitrate)) {
    return STATUS.MIXED;
  }

  return STATUS.IN_PROGRESS;
}

function fishlessStage({ ammonia, nitrite, nitrate }) {
  if (nitrite >= 1 || nitrate >= 80) {
    return 'spike';
  }
  if (nitrite > 0) {
    return 'nearly';
  }
  return 'early';
}

function buildActions(inputs, status) {
  const { method, planted } = inputs;
  const nitrateLine = planted ? NITRATE_HYGIENE.planted : NITRATE_HYGIENE.standard;
  let items = [];

  if (status === STATUS.IN_PROGRESS) {
    if (method === 'fishless') {
      const stage = fishlessStage(inputs);
      items = ACTION_SETS.fishless.inProgress[stage];
    } else {
      items = ACTION_SETS.fishIn.inProgress;
    }
  } else if (status === STATUS.URGENT) {
    items = ACTION_SETS.fishIn.urgent;
  } else if (status === STATUS.CYCLED && method === 'fishless') {
    items = ACTION_SETS.fishless.cycled;
  } else {
    items = [];
  }

  return [...items, nitrateLine];
}

function renderActions(items) {
  actionList.innerHTML = '';
  if (!items.length) {
    actionsContainer.hidden = true;
    return;
  }
  const fragment = document.createDocumentFragment();
  items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    fragment.appendChild(li);
  });
  actionList.appendChild(fragment);
  actionsContainer.hidden = false;
}

function updateSummary(inputs) {
  const ammoniaText = formatNumber(inputs.ammonia, 2);
  const nitriteText = formatNumber(inputs.nitrite, 2);
  const nitrateText = formatNumber(inputs.nitrate, 1);
  const methodText = inputs.method === 'fishless' ? 'Fishless' : 'Fish-in';
  const plantedText = inputs.planted ? 'Yes' : 'No';
  summaryLine.textContent = `Ammonia: ${ammoniaText} ppm • Nitrite: ${nitriteText} ppm • Nitrate: ${nitrateText} ppm • Method: ${methodText} • Planted: ${plantedText}`;
}

function updateStatusBadge(status) {
  statusBadge.textContent = `${STATUS_ICON[status] ?? '⚪'} ${status}`;
  statusBadge.dataset.state = '';
  if (status === STATUS.CYCLED) {
    statusBadge.dataset.state = 'good';
  } else if (status === STATUS.URGENT) {
    statusBadge.dataset.state = 'bad';
  } else if (status === STATUS.IN_PROGRESS) {
    statusBadge.dataset.state = 'warn';
  } else {
    statusBadge.dataset.state = 'neutral';
  }
}

function resetChallenge() {
  challengeState.active = false;
  challengeState.result = null;
  challengeForm.hidden = true;
  challengeResult.hidden = true;
  if (challengeStartBtn) {
    challengeStartBtn.hidden = false;
  }
  challengeStatus.textContent = '';
  challengeActions.innerHTML = '';
  if (challengeAmmonia) challengeAmmonia.value = '';
  if (challengeNitrite) challengeNitrite.value = '';
}

function setSectionExpanded(button, content, expanded) {
  if (!button || !content) return;
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  button.textContent = expanded ? 'Close' : 'Open';
  content.hidden = !expanded;
}

function toggleChallenge(visible) {
  if (!challengePanel) return;
  if (!visible) {
    challengePanel.hidden = true;
    resetChallenge();
    setSectionExpanded(challengeToggle, challengeContent, false);
    return;
  }
  challengePanel.hidden = false;
  setSectionExpanded(challengeToggle, challengeContent, false);
}

function setChallengeResult(passed, planted) {
  const entries = passed ? ACTION_SETS.fishless.challenge.pass : ACTION_SETS.fishless.challenge.fail;
  const nitrateLine = planted ? NITRATE_HYGIENE.planted : NITRATE_HYGIENE.standard;
  challengeStatus.textContent = passed ? 'PASS' : 'FAIL';
  challengeActions.innerHTML = '';
  const fragment = document.createDocumentFragment();
  entries.concat([nitrateLine]).forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    fragment.appendChild(li);
  });
  challengeActions.appendChild(fragment);
  challengeResult.hidden = false;
}

function calculateNh3(ammonia, ph, tempC) {
  if (Number.isNaN(ammonia) || Number.isNaN(ph) || Number.isNaN(tempC)) {
    return Number.NaN;
  }
  const pKa = 0.0901821 + 2729.92 / (273.15 + tempC);
  const fraction = 1 / (Math.pow(10, pKa - ph) + 1);
  return ammonia * fraction;
}

function updateAdvanced() {
  const ammonia = parseInput(ammoniaInput, { max: 8 });
  const ph = parseInput(phInput, { min: 0, max: 14 });
  const temperatureRaw = parseInput(tempInput, { min: 0 });
  if (Number.isNaN(temperatureRaw)) {
    nh3Value.textContent = '—';
    nh3Badge.textContent = '';
    nh3Badge.className = 'advanced__badge';
    return;
  }
  const tempC = tempUnit === 'F' ? ((temperatureRaw - 32) * 5) / 9 : temperatureRaw;
  const nh3 = calculateNh3(ammonia, ph, tempC);
  if (Number.isNaN(nh3)) {
    nh3Value.textContent = '—';
    nh3Badge.textContent = '';
    nh3Badge.className = 'advanced__badge';
    return;
  }
  nh3Value.textContent = Number(nh3.toFixed(3)).toString();
  if (nh3 >= 0.02) {
    nh3Badge.textContent = 'Caution';
    nh3Badge.className = 'advanced__badge advanced__badge--warn';
  } else {
    nh3Badge.textContent = '';
    nh3Badge.className = 'advanced__badge';
  }
}

function handleCheck() {
  const inputs = getInputs();
  updateSummary(inputs);
  const status = determineStatus(inputs);
  updateStatusBadge(status);

  if (status === STATUS.INCOMPLETE) {
    renderActions([]);
    toggleChallenge(false);
    return;
  }

  const actions = buildActions(inputs, status);
  renderActions(actions);

  const showChallenge = status === STATUS.CYCLED && inputs.method === 'fishless';
  toggleChallenge(showChallenge);
  if (!showChallenge) {
    resetChallenge();
  }
}

function handleClear() {
  form.reset();
  plantedCheckbox.dispatchEvent(new Event('change'));
  summaryLine.textContent = 'Ammonia: — ppm • Nitrite: — ppm • Nitrate: — ppm • Method: Fishless • Planted: No';
  updateStatusBadge(STATUS.INCOMPLETE);
  renderActions([]);
  toggleChallenge(false);
  nh3Value.textContent = '—';
  nh3Badge.textContent = '';
  nh3Badge.className = 'advanced__badge';
}

function handlePlantedToggle() {
  const planted = plantedCheckbox.checked;
  document.body.classList.toggle('planted-mode', planted);
  if (coachLeaf) {
    coachLeaf.style.display = '';
  }
}

function handleAdvancedToggle() {
  const isOpen = advancedToggle.getAttribute('aria-expanded') === 'true';
  setSectionExpanded(advancedToggle, advancedContent, !isOpen);
}

function handleChallengeToggle() {
  const isOpen = challengeToggle.getAttribute('aria-expanded') === 'true';
  const nextState = !isOpen;
  setSectionExpanded(challengeToggle, challengeContent, nextState);
  if (!nextState) {
    resetChallenge();
  }
}

function handleTempUnitToggle() {
  const current = parseInput(tempInput);
  if (tempUnit === 'F') {
    tempUnit = 'C';
    tempUnitBtn.textContent = '°C';
    if (!Number.isNaN(current)) {
      const converted = ((current - 32) * 5) / 9;
      tempInput.value = Number(converted.toFixed(2));
    }
  } else {
    tempUnit = 'F';
    tempUnitBtn.textContent = '°F';
    if (!Number.isNaN(current)) {
      const converted = current * (9 / 5) + 32;
      tempInput.value = Number(converted.toFixed(2));
    }
  }
  updateAdvanced();
}

function handleChallengeStart() {
  challengeState.active = true;
  if (challengeStartBtn) {
    challengeStartBtn.hidden = true;
  }
  challengeForm.hidden = false;
  challengeResult.hidden = true;
  challengeStatus.textContent = '';
  challengeActions.innerHTML = '';
  if (challengeAmmonia) {
    challengeAmmonia.focus();
  }
}

function handleChallengeCheck() {
  if (!challengeState.active) {
    return;
  }
  const ammonia = parseInput(challengeAmmonia, { max: 8 });
  const nitrite = parseInput(challengeNitrite, { max: 5 });
  if (Number.isNaN(ammonia) || Number.isNaN(nitrite)) {
    challengeStatus.textContent = 'Please enter both readings to continue.';
    challengeResult.hidden = false;
    challengeActions.innerHTML = '';
    return;
  }
  const passed = isZero(ammonia) && isZero(nitrite);
  challengeState.result = passed ? 'pass' : 'fail';
  const mainInputs = getInputs();
  setChallengeResult(passed, mainInputs.planted);
}

if (checkBtn) {
  checkBtn.addEventListener('click', handleCheck);
}
if (clearBtn) {
  clearBtn.addEventListener('click', handleClear);
}
plantedCheckbox.addEventListener('change', handlePlantedToggle);
if (advancedToggle) {
  advancedToggle.addEventListener('click', handleAdvancedToggle);
}
if (challengeToggle) {
  challengeToggle.addEventListener('click', handleChallengeToggle);
}
if (tempUnitBtn) {
  tempUnitBtn.addEventListener('click', handleTempUnitToggle);
}
[ammoniaInput, phInput, tempInput].forEach((input) => {
  input?.addEventListener('input', updateAdvanced);
});
if (challengeStartBtn) {
  challengeStartBtn.addEventListener('click', handleChallengeStart);
}
if (challengeCheckBtn) {
  challengeCheckBtn.addEventListener('click', handleChallengeCheck);
}

handlePlantedToggle();
updateAdvanced();
updateStatusBadge(STATUS.INCOMPLETE);
setSectionExpanded(advancedToggle, advancedContent, false);
setSectionExpanded(challengeToggle, challengeContent, false);
toggleChallenge(false);
