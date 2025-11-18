(function() {
  function toggleFaq(activeToggle, togglePairs) {
    const activeEntry = togglePairs.find(({ toggle }) => toggle === activeToggle);

    if (!activeEntry || !activeEntry.answer) return;

    const isExpanded = activeToggle.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;

    if (nextState) {
      togglePairs.forEach(({ toggle, answer }) => {
        if (toggle === activeToggle || !answer) return;
        toggle.setAttribute('aria-expanded', 'false');
        answer.hidden = true;
      });
    }

    activeToggle.setAttribute('aria-expanded', String(nextState));
    activeEntry.answer.hidden = !nextState;
  }

  function initFaqAccordions() {
    const togglePairs = Array.from(document.querySelectorAll('.faq-toggle')).map((toggle) => {
      const targetId = toggle.getAttribute('aria-controls');
      const answer = targetId ? document.getElementById(targetId) : null;

      toggle.setAttribute('aria-expanded', 'false');

      if (answer) {
        answer.hidden = true;
      }

      return { toggle, answer };
    });

    if (!togglePairs.length) return;

    togglePairs.forEach(({ toggle }) => {
      toggle.addEventListener('click', function() {
        toggleFaq(toggle, togglePairs);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFaqAccordions);
  } else {
    initFaqAccordions();
  }
})();
