(() => {
  const init = () => {
    const form = document.getElementById('tank-feature-form');
    const consent = document.getElementById('consent_feature');
    const submit = document.getElementById('submit_feature');
    const helper = document.getElementById('consent_feature_help');
    const successMessage = document.getElementById('feature-form-success');

    if (!form || !consent || !submit) {
      return;
    }

    const defaultSubmitText = submit.textContent || '';

    const hideSuccess = () => {
      if (successMessage) {
        successMessage.style.display = 'none';
      }
    };

    const showSuccess = () => {
      if (successMessage) {
        successMessage.style.display = 'block';
      }
    };

    const syncState = () => {
      const enabled = consent.checked;
      submit.disabled = !enabled;
      submit.setAttribute('aria-disabled', String(!enabled));
      if (helper) {
        helper.hidden = enabled;
      }
    };

    consent.addEventListener('change', () => {
      hideSuccess();
      syncState();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      hideSuccess();

      const formData = new FormData(form);

      submit.disabled = true;
      submit.setAttribute('aria-disabled', 'true');
      submit.textContent = 'Submitting…';

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: {
            Accept: 'application/json',
          },
        });

        if (response.ok) {
          form.reset();
          if (typeof window.grecaptcha !== 'undefined') {
            window.grecaptcha.reset();
          }
          showSuccess();
        } else {
          alert('❌ There was a problem sending your submission. Please try again.');
        }
      } catch (error) {
        alert('❌ Network error. Please try again.');
      } finally {
        submit.textContent = defaultSubmitText;
        syncState();
      }
    });

    syncState();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
