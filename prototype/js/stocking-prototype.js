(() => {
  document.documentElement.classList.add('prototype-mode');

  const adSlots = document.querySelectorAll('[data-prototype-ad]');
  adSlots.forEach((slot) => {
    slot.setAttribute('role', 'complementary');
    slot.setAttribute('aria-label', 'Advertisement placeholder');
  });

  window.addEventListener('load', () => {
    const plantedToggle = document.querySelector('#stocking-planted');
    if (!plantedToggle) return;

    const status = document.getElementById('stocking-status');
    if (status) {
      status.setAttribute('aria-live', 'polite');
    }

    plantedToggle.addEventListener('change', () => {
      document.querySelector('main.stocking-page')?.classList.toggle('is-planted', plantedToggle.checked);
    });
  });
})();
