(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('dev') !== 'true') {
    return;
  }

  const AMAZON_PATTERN = /^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}\/\?tag=fishkeepingli-20$/;
  let panel;
  let countsNode;
  let copyButton;
  let reportData = [];

  function ensurePanel() {
    if (panel) {
      return;
    }
    panel = document.createElement('aside');
    panel.className = 'gear-devtester';

    const title = document.createElement('h3');
    title.textContent = 'Gear Dev Tester';
    panel.appendChild(title);

    countsNode = document.createElement('p');
    countsNode.className = 'gear-devtester__counts';
    panel.appendChild(countsNode);

    copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'gear-devtester__copy';
    copyButton.textContent = 'Copy report';
    copyButton.addEventListener('click', () => {
      if (!reportData.length) {
        return;
      }
      const lines = reportData
        .map((item) => `${item.Category} | ${item.Product_Name} | ${item.ASIN} | ${item.Issue}`)
        .join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
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
          // no-op
        }
        textarea.remove();
      }
    });
    panel.appendChild(copyButton);

    document.body.appendChild(panel);
  }

  function updateCounts(summary) {
    if (!countsNode) {
      return;
    }
    countsNode.textContent = `Total: ${summary.total} | OK: ${summary.ok} | Warnings: ${summary.warnings} | Errors: ${summary.errors}`;
    copyButton.disabled = summary.total === 0;
  }

  function evaluate(cards) {
    ensurePanel();
    const cardArray = Array.isArray(cards) ? cards : Array.from(cards || []);
    const summary = { total: cardArray.length, ok: 0, warnings: 0, errors: 0 };
    reportData = [];

    cardArray.forEach((card) => {
      card.classList.remove('gear-devtester--error', 'gear-devtester--warning');
      const category = card.dataset.category || 'Unknown';
      const name = card.querySelector('h3')?.textContent?.trim() || 'Unnamed';
      const asin = card.dataset.asin || '';
      const link = card.querySelector('.gear-card__cta');
      const href = link ? link.getAttribute('href') || '' : '';

      const issues = [];
      let hasError = false;
      let hasWarning = false;

      if (!asin) {
        issues.push('Missing ASIN');
        hasError = true;
      }

      if (!href) {
        issues.push('Missing Amazon link');
        hasError = true;
      } else if (!AMAZON_PATTERN.test(href)) {
        issues.push('Non-canonical Amazon link');
        hasWarning = true;
      }

      if (hasError) {
        card.classList.add('gear-devtester--error');
        summary.errors += 1;
      } else if (hasWarning) {
        card.classList.add('gear-devtester--warning');
        summary.warnings += 1;
      } else {
        summary.ok += 1;
      }

      reportData.push({
        Category: category,
        Product_Name: name,
        ASIN: asin || '—',
        Amazon_Link: href || '—',
        Issue: issues.length ? issues.join('; ') : 'OK',
      });
    });

    updateCounts(summary);
    if (reportData.length) {
      // eslint-disable-next-line no-console
      console.table(reportData, ['Category', 'Product_Name', 'ASIN', 'Amazon_Link', 'Issue']);
    }
  }

  function handleRender(event) {
    const detailCards = event?.detail?.cards;
    evaluate(detailCards || document.querySelectorAll('[data-testid="gear-card"]'));
  }

  document.addEventListener('gear:rendered', handleRender);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
      evaluate(document.querySelectorAll('[data-testid="gear-card"]'));
    }, 0);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      evaluate(document.querySelectorAll('[data-testid="gear-card"]'));
    });
  }
})();
