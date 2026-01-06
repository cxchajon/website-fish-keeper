document.addEventListener('DOMContentLoaded', function () {
  var form = document.querySelector('[data-snail-form]');
  var tankInput = document.getElementById('snail-tank-size');
  var varietySelect = document.getElementById('snail-variety');
  var errorEl = document.getElementById('snail-error');
  var resultCard = document.getElementById('snail-result');
  var rangeEl = document.getElementById('snail-range');
  var noteEl = document.getElementById('snail-note');
  if (!form || !tankInput || !varietySelect || !resultCard || !rangeEl || !noteEl) return;

  var notes = {
    nerite: 'Nerites rely on established algae and biofilm; supplement wafers if surfaces are spotless.',
    mystery: 'Mystery snails need stable calcium and gentle flow; target steady feedings without overfeeding the tank.',
    apple: 'Large apple snails are heavy waste producers; keep minerals high and water changes routine.',
    ramshorn: 'Ramshorn and bladder snails often self-regulate to available food; watch for overfeeding signals.',
    assassin: 'Assassin snails are carnivores; ensure a steady pest-snail supply or offer protein-rich foods.'
  };

  function computeBaseline(gallons, variety) {
    if (variety === 'ramshorn') return Math.floor(gallons * 2);
    if (variety === 'apple') return Math.floor(gallons / 15);
    return Math.floor(gallons / 5);
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('is-visible');
    errorEl.removeAttribute('hidden');
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.classList.remove('is-visible');
    errorEl.setAttribute('hidden', 'true');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var gallons = parseFloat(tankInput.value);
    var variety = varietySelect.value;

    if (!Number.isFinite(gallons) || gallons < 1) {
      showError('Enter a tank size of at least 1 gallon to start.');
      tankInput.focus();
      resultCard.classList.remove('is-visible');
      resultCard.setAttribute('aria-hidden', 'true');
      return;
    }

    clearError();

    var baseline = computeBaseline(gallons, variety);
    var recommendation = baseline >= 2 ? "Start with 1–" + baseline : 'Start with 1 and monitor closely';
    var note = notes[variety] || '';

    if (variety === 'apple' && gallons < 15) {
      note += ' Tanks under 15 gallons are not recommended for large apple snails.';
    }

    rangeEl.textContent = recommendation;
    noteEl.textContent = note;

    resultCard.classList.add('is-visible');
    resultCard.setAttribute('aria-hidden', 'false');
  });
});
