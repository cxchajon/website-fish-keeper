(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('dev') !== 'true') {
    return;
  }

  const STATUS_LABELS = {
    ok: 'OK',
    warn: 'WARN',
    error: 'ERROR',
  };

  let panel;
  let countsNode;
  let copyButton;
  let latestResults = [];

  function ensurePanel() {
    if (panel) {
      return;
    }

    panel = document.createElement('aside');
    panel.className = 'gear-devtester';

    const title = document.createElement('h3');
    title.textContent = 'Gear Link Validator';
    panel.appendChild(title);

    countsNode = document.createElement('p');
    countsNode.className = 'gear-devtester__counts';
    panel.appendChild(countsNode);

    copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'gear-devtester__copy';
    copyButton.textContent = 'Copy report';
    copyButton.addEventListener('click', () => {
      if (!latestResults.length) {
        return;
      }
      const lines = latestResults
        .map((item) => {
          return `${item.status.toUpperCase()} | ${item.category} | ${item.name} | ${item.asin || '—'} | ${item.href || '—'}`;
        })
        .join('\n');
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(lines).catch(() => {});
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = lines;
        textarea.setAttribute('aria-hidden', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } catch (error) {
          // Ignore copy failures.
        }
        textarea.remove();
      }
    });
    panel.appendChild(copyButton);

    document.body.appendChild(panel);
  }

  function updateCounts(results) {
    ensurePanel();
    const summary = results.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { total: 0, ok: 0, warn: 0, error: 0 }
    );
    countsNode.textContent = `Total: ${summary.total} | OK: ${summary.ok} | WARN: ${summary.warn} | ERROR: ${summary.error}`;
    copyButton.disabled = summary.total === 0;
  }

  function applyHighlights(results) {
    results.forEach((item) => {
      const card = item.card;
      if (!card) {
        return;
      }
      card.classList.remove('gear-devtester--error', 'gear-devtester--warning');
      if (item.status === 'error') {
        card.classList.add('gear-devtester--error');
      } else if (item.status === 'warn') {
        card.classList.add('gear-devtester--warning');
      }
    });
  }

  function logResults(results) {
    if (!results.length) {
      return;
    }
    const table = results.map((item) => ({
      Category: item.category,
      Product_Name: item.name,
      ASIN: item.asin || '—',
      Amazon_Link: item.href || '—',
      Status: STATUS_LABELS[item.status] || item.status,
      Notes: item.message || '',
    }));
    // eslint-disable-next-line no-console
    console.table(table);
  }

  function handleReport(results) {
    latestResults = results;
    updateCounts(results);
    applyHighlights(results);
    logResults(results);
  }

  function handleEvent(event) {
    const results = event?.detail?.results;
    if (!Array.isArray(results)) {
      return;
    }
    handleReport(results);
  }

  document.addEventListener('gear:links-hardened', handleEvent);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    const preload = window.__gearLinkHardenerReport;
    if (Array.isArray(preload)) {
      handleReport(preload);
    }
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      const preload = window.__gearLinkHardenerReport;
      if (Array.isArray(preload)) {
        handleReport(preload);
      }
    });
  }
})();
