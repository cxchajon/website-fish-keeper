(function () {
  const initQuickAnswerAccordions = () => {
    const triggers = Array.from(document.querySelectorAll('#quick-answers .qa-card__trigger'));

    if (!triggers.length) {
      return;
    }

    const panels = new Map();
    triggers.forEach((trigger) => {
      const panelId = trigger.getAttribute('aria-controls');
      if (panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
          panels.set(trigger, panel);
        }
      }
    });

    const closeTrigger = (trigger) => {
      const panel = panels.get(trigger);
      if (!panel) {
        return;
      }

      trigger.setAttribute('aria-expanded', 'false');
      panel.setAttribute('aria-hidden', 'true');
      panel.setAttribute('hidden', '');
      trigger.parentElement?.classList.remove('qa-card--open');
    };

    const openTrigger = (trigger) => {
      const panel = panels.get(trigger);
      if (!panel) {
        return;
      }

      trigger.setAttribute('aria-expanded', 'true');
      panel.setAttribute('aria-hidden', 'false');
      panel.removeAttribute('hidden');
      trigger.parentElement?.classList.add('qa-card--open');
    };

    const handleToggle = (event) => {
      const trigger = event.currentTarget;
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';

      triggers.forEach((btn) => {
        if (btn !== trigger) {
          closeTrigger(btn);
        }
      });

      if (isExpanded) {
        closeTrigger(trigger);
      } else {
        openTrigger(trigger);
      }
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', handleToggle);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuickAnswerAccordions);
  } else {
    initQuickAnswerAccordions();
  }
})();
