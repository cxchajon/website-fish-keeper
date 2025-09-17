// js/aggression.js

/**
 * Very small starter: checks ONLY the "2+ male bettas" rule.
 * Also warns if 2+ bettas are selected but sex is unknown.
 *
 * selections = [
 *   { fishId: 'betta_splendens', qty: 1, sex: 'male' },
 *   { fishId: 'betta_splendens', qty: 1, sex: 'male' },
 * ]
 */
(function (global) {
  const DEFAULT_BETTA_IDS = ['betta_splendens', 'betta']; // adjust if your IDs differ

  function checkAggressionBasic(selections, bettaIds = DEFAULT_BETTA_IDS) {
    const issues = [];

    let totalBettas = 0;
    let maleBettas = 0;
    let femaleBettas = 0;

    (selections || []).forEach(sel => {
      const id = (sel && sel.fishId) || '';
      const qty = Number((sel && sel.qty) || 0);
      const sex = sel && sel.sex;

      if (!bettaIds.includes(id)) return;
      totalBettas += qty;
      if (sex === 'male') maleBettas += qty;
      if (sex === 'female') femaleBettas += qty;
    });

    // Hard rule: 2+ male bettas
    if (maleBettas >= 2) {
      issues.push({
        id: 'multi-male-betta',
        severity: 'danger',
        message:
          'Multiple male Bettas selected — extremely high aggression risk (fighting until serious injury or death). Keep exactly one male Betta per tank.',
        affectedFishIds: bettaIds
      });
    }

    // Fallback when sex isn’t provided
    if (maleBettas === 0 && femaleBettas === 0 && totalBettas >= 2) {
      issues.push({
        id: 'multi-betta-unknown-sex',
        severity: 'warning',
        message:
          '2 or more Bettas selected but sex is unknown — if males are included, they will fight. Confirm sexes or reduce to one Betta.',
        affectedFishIds: bettaIds
      });
    }

    return issues;
  }

  // Simple renderer you can call to show messages in the page
  function renderAggressionMessages(issues, targetEl) {
    if (!targetEl) return;
    targetEl.innerHTML = ''; // clear old

    issues.forEach(issue => {
      const box = document.createElement('div');
      box.style.border = issue.severity === 'danger' ? '2px solid #d00' : '1px solid #c90';
      box.style.background = issue.severity === 'danger' ? '#ffe6e6' : '#fff8e6';
      box.style.padding = '10px';
      box.style.margin = '8px 0';
      box.style.borderRadius = '6px';
      box.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';

      const strong = document.createElement('strong');
      strong.textContent = (issue.severity || 'warning').toUpperCase() + ': ';
      box.appendChild(strong);

      const msg = document.createElement('span');
      msg.textContent = issue.message;
      box.appendChild(msg);

      targetEl.appendChild(box);
    });
  }

  // Expose to window
  global.FishKeeperAggression = {
    checkAggressionBasic,
    renderAggressionMessages
  };
})(window);