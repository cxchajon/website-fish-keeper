(() => {
  const initializeAccordion = (accordion) => {
    const items = Array.from(accordion.querySelectorAll('.faq-item'));

    const syncItem = (item) => {
      const trigger = item.querySelector('.faq-trigger');
      const panel = item.querySelector('.faq-panel');
      const isOpen = item.open;

      if (trigger) {
        trigger.setAttribute('aria-expanded', String(isOpen));
      }

      if (panel) {
        panel.hidden = !isOpen;
      }
    };

    items.forEach((item) => {
      syncItem(item);

      item.addEventListener('toggle', () => {
        syncItem(item);

        if (!item.open) return;

        items.forEach((otherItem) => {
          if (otherItem === item || !otherItem.open) return;
          otherItem.open = false;
        });
      });
    });
  };

  const initialize = () => {
    document.querySelectorAll('[data-faq-accordion]').forEach(initializeAccordion);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
