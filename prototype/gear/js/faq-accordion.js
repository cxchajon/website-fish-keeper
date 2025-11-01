(function () {
  const initFaqAccordion = () => {
    const container = document.getElementById('faq-accordion');
    if (!container) {
      return;
    }

    const triggers = Array.from(container.querySelectorAll('[data-accordion="toggle"]'));
    if (!triggers.length) {
      return;
    }

    const closeOthers = (activeTrigger) => {
      triggers.forEach((trigger) => {
        if (trigger !== activeTrigger && typeof trigger.__setExpanded === 'function') {
          trigger.__setExpanded(false);
        }
      });
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const target = mutation.target;
        if (target.getAttribute('aria-expanded') === 'true') {
          closeOthers(target);
        }
      });
    });

    triggers.forEach((trigger) => {
      observer.observe(trigger, { attributes: true, attributeFilter: ['aria-expanded'] });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFaqAccordion);
  } else {
    initFaqAccordion();
  }
})();
