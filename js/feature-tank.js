(() => {
  const init = () => {
    const consent = document.getElementById('consent_feature');
    const submit = document.getElementById('submit_feature');
    const helper = document.getElementById('consent_feature_help');

    if (!consent || !submit) {
      return;
    }

    const syncState = () => {
      const enabled = consent.checked;
      submit.disabled = !enabled;
      submit.setAttribute('aria-disabled', String(!enabled));
      if (helper) {
        helper.hidden = enabled;
      }
    };

    consent.addEventListener('change', syncState);
    syncState();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
