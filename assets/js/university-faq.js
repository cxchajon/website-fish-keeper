(function() {
  function toggleFaq(button, allToggles) {
    const targetId = button.getAttribute('aria-controls');
    const answer = targetId ? document.getElementById(targetId) : null;

    if (!answer) return;

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;

    if (nextState) {
      allToggles.forEach((other) => {
        if (other === button) return;
        const otherAnswerId = other.getAttribute('aria-controls');
        const otherAnswer = otherAnswerId ? document.getElementById(otherAnswerId) : null;
        other.setAttribute('aria-expanded', 'false');
        if (otherAnswer) {
          otherAnswer.hidden = true;
        }
      });
    }

    button.setAttribute('aria-expanded', String(nextState));
    answer.hidden = !nextState;
  }

  function initFaqAccordions() {
    const toggles = Array.from(document.querySelectorAll('.faq-toggle'));
    if (!toggles.length) return;

    toggles.forEach((toggle) => {
      const targetId = toggle.getAttribute('aria-controls');
      const answer = targetId ? document.getElementById(targetId) : null;

      toggle.setAttribute('aria-expanded', 'false');

      if (answer) {
        answer.hidden = true;
      }
    });

    toggles.forEach((toggle) => {
      toggle.addEventListener('click', function() {
        toggleFaq(toggle, toggles);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFaqAccordions);
  } else {
    initFaqAccordions();
  }
})();
