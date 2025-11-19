(function() {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function() {
    const form = document.querySelector('[data-testid="contact-form"]');
    if (!form) return;

    const nameInput = form.querySelector('#contact-name');
    const emailInput = form.querySelector('#contact-email');
    const subjectSelect = form.querySelector('#contact-subject');
    const messageInput = form.querySelector('#contact-message');
    const honeypotInput = form.querySelector('[name="hp_website"]');
    const successBanner = document.querySelector('[data-testid="contact-success"]');
    const errorSummary = document.querySelector('[data-testid="contact-errors"]');
    const errorList = errorSummary ? errorSummary.querySelector('ul') : null;
    const submitButton = form.querySelector('[data-testid="contact-submit"]');

    const helpName = document.getElementById('help-name');
    const helpEmail = document.getElementById('help-email');
    const helpSubject = document.getElementById('help-subject');
    const helpMessage = document.getElementById('help-message');

    const defaultHelpText = {
      name: helpName ? helpName.textContent : '',
      email: helpEmail ? helpEmail.textContent : '',
      subject: helpSubject ? helpSubject.textContent : '',
      message: helpMessage ? helpMessage.textContent : ''
    };

    if (errorSummary && !errorSummary.hasAttribute('tabindex')) {
      errorSummary.setAttribute('tabindex', '-1');
    }

    function resetState() {
      if (successBanner) {
        successBanner.classList.remove('visible');
      }
      if (errorSummary) {
        errorSummary.classList.remove('visible');
      }
      if (errorList) {
        errorList.innerHTML = '';
      }

      [nameInput, emailInput, subjectSelect, messageInput].forEach(function(field) {
        if (field) {
          field.classList.remove('has-error');
        }
      });

      if (helpName) {
        helpName.textContent = defaultHelpText.name;
        helpName.classList.remove('visible');
      }
      if (helpEmail) {
        helpEmail.textContent = defaultHelpText.email;
        helpEmail.classList.remove('visible');
      }
      if (helpSubject) {
        helpSubject.textContent = defaultHelpText.subject;
        helpSubject.classList.remove('visible');
      }
      if (helpMessage) {
        helpMessage.textContent = defaultHelpText.message;
        helpMessage.classList.remove('visible');
      }
    }

    function addError(field, helpEl, message) {
      if (helpEl) {
        helpEl.textContent = message;
        helpEl.classList.add('visible');
      }
      if (field) {
        field.classList.add('has-error');
      }
      if (errorList) {
        const li = document.createElement('li');
        li.textContent = message;
        errorList.appendChild(li);
      }
    }

    function validateEmail(value) {
      return /.+@.+\..+/.test(value);
    }

    function setSubmitting(isSubmitting) {
      if (!submitButton) return;
      if (isSubmitting) {
        submitButton.setAttribute('aria-disabled', 'true');
        if (!submitButton.dataset.originalText) {
          submitButton.dataset.originalText = submitButton.textContent;
        }
        submitButton.textContent = 'Sending…';
      } else {
        submitButton.removeAttribute('aria-disabled');
        if (submitButton.dataset.originalText) {
          submitButton.textContent = submitButton.dataset.originalText;
        }
      }
    }

    function showSuccess() {
      if (successBanner) {
        successBanner.classList.add('visible');
        successBanner.focus();
      }
      if (errorSummary) {
        errorSummary.classList.remove('visible');
      }
    }

    function showErrorSummary(message) {
      if (errorList && message) {
        const li = document.createElement('li');
        li.textContent = message;
        errorList.appendChild(li);
      }
      if (errorSummary) {
        errorSummary.classList.add('visible');
        errorSummary.focus();
      }
      if (successBanner) {
        successBanner.classList.remove('visible');
      }
    }

    form.addEventListener('submit', function(event) {
      event.preventDefault();
      resetState();

      const errors = [];
      const nameValue = nameInput ? nameInput.value.trim() : '';
      const emailValue = emailInput ? emailInput.value.trim() : '';
      const subjectValue = subjectSelect ? subjectSelect.value.trim() : '';
      const messageValue = messageInput ? messageInput.value.trim() : '';

      if (!nameValue) {
        errors.push({ field: nameInput, help: helpName, message: 'Enter your name' });
      }

      if (!emailValue) {
        errors.push({ field: emailInput, help: helpEmail, message: 'Enter your email address' });
      } else if (!validateEmail(emailValue)) {
        errors.push({ field: emailInput, help: helpEmail, message: 'Enter an email in the format name@example.com' });
      }

      if (!subjectValue) {
        errors.push({ field: subjectSelect, help: helpSubject, message: 'Choose a subject' });
      }

      if (!messageValue) {
        errors.push({ field: messageInput, help: helpMessage, message: 'Add a message so we can help' });
      }

      if (errors.length && errorSummary) {
        errors.forEach(function(err) {
          addError(err.field, err.help, err.message);
        });
        errorSummary.classList.add('visible');
        errorSummary.focus();
        return;
      }

      if (honeypotInput && honeypotInput.value.trim() !== '') {
        console.log('Honeypot triggered, skipping submission.');
        if (form.reset) {
          form.reset();
        }
        showSuccess();
        return;
      }

      setSubmitting(true);

      const payload = {
        name: nameValue,
        email: emailValue,
        subject: subjectValue,
        message: messageValue,
        page: 'The Tank Guide Contact & Feedback'
      };

      fetch('https://formspree.io/f/xnngnwld', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          if (form.reset) {
            form.reset();
          }
          setSubmitting(false);
          showSuccess();
        })
        .catch(function(error) {
          console.error('Form submission failed', error);
          setSubmitting(false);
          resetState();
          showErrorSummary('Something went wrong sending your message. Please try again.');
        });
    });
  });
})();
