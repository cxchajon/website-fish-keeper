/**
 * Feature Your Tank wizard controller
 * --------------------------------------------------------------
 * Drives the 6-step submission flow, validates inputs inline,
 * computes pricing, and prepares a Stripe-ready placeholder.
 * The markup is the canonical submission path for the site.
 */

(function() {
  document.documentElement.classList.add('js-feature-wizard');

  const form = document.getElementById('featureForm');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('.ft-step'));
  const stepIndicators = Array.from(document.querySelectorAll('.step'));
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const errorBox = document.getElementById('errorMessage');
  const duplicateWarning = document.getElementById('duplicateWarning');
  const pricingList = document.getElementById('pricingBreakdown');
  const reviewList = document.getElementById('reviewList');
  const totalDisplay = document.getElementById('totalPriceDisplay');
  const pricingHidden = document.getElementById('pricingHidden');
  const totalPrice = document.getElementById('totalPrice');
  const duplicateFlag = document.getElementById('duplicateFlag');
  const creditSummary = document.getElementById('creditSummary');
  const photoUpload = document.getElementById('photoUpload');
  const photoUploadTrigger = document.getElementById('photoUploadTrigger');
  const selectedFiles = document.getElementById('selectedFiles');
  const extraPhotos = document.getElementById('extraPhotos');
  const extraPhotosAdditional = document.getElementById('extraPhotosAdditional');
  const additionalTanks = document.getElementById('additionalTanks');
  const checkoutMessage = document.getElementById('checkoutMessage');
  const confirmationDetails = document.getElementById('confirmationDetails');

  let currentStep = 1;

  function updateNextButtonState(stepNumber = currentStep) {
    if (!nextBtn || !prevBtn) return;

    nextBtn.textContent = stepNumber === 5 ? 'Submit & Pay' : 'Next';

    const isFinalStep = stepNumber === 6;
    prevBtn.disabled = stepNumber === 1 || isFinalStep;

    if (isFinalStep) {
      nextBtn.disabled = true;
      return;
    }

    nextBtn.disabled = false;
  }

  function formatEnvironment(value) {
    if (value === 'planted') return 'Planted';
    if (value === 'unplanted') return 'Unplanted';
    return value || '—';
  }

  function setStepVisibility(stepNumber) {
    steps.forEach((section) => {
      const isActive = Number(section.dataset.step) === stepNumber;
      section.hidden = !isActive;
      section.style.display = isActive ? 'block' : 'none';
      section.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    stepIndicators.forEach((chip) => {
      const matches = Number(chip.dataset.step) === stepNumber;
      chip.classList.toggle('active', matches);
      chip.setAttribute('aria-current', matches ? 'step' : 'false');
    });

    updateNextButtonState(stepNumber);
  }

  function setError(message) {
    if (!errorBox) return;
    if (message) {
      errorBox.textContent = message;
      errorBox.style.display = 'block';
    } else {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    const s1 = a.toLowerCase();
    const s2 = b.toLowerCase();
    const pairs = (str) => {
      const arr = [];
      for (let i = 0; i < str.length - 1; i += 1) arr.push(str.slice(i, i + 2));
      return arr;
    };
    const p1 = pairs(s1);
    const p2 = pairs(s2);
    const map = new Map();
    p1.forEach((p) => map.set(p, (map.get(p) || 0) + 1));
    let intersection = 0;
    p2.forEach((p) => {
      const count = map.get(p) || 0;
      if (count > 0) {
        map.set(p, count - 1);
        intersection += 1;
      }
    });
    return (2 * intersection) / ((p1.length + p2.length) || 1);
  }

  function checkDuplicates() {
    const email = form.email.value.trim();
    const tankName = form.tank_name.value.trim();
    const size = form.tank_size.value.trim();
    const stored = JSON.parse(localStorage.getItem('ttg-feature-submissions') || '[]');
    const hit = stored.find(
      (entry) => entry.email === email && (similarity(entry.tank, tankName) > 0.8 || entry.size === size)
    );
    if (hit) {
      duplicateWarning.style.display = 'block';
      duplicateWarning.textContent = 'Heads up: this looks similar to a previous submission. We will flag it for review.';
      duplicateFlag.value = 'true';
      return true;
    }
    duplicateWarning.style.display = 'none';
    duplicateFlag.value = 'false';
    return false;
  }

  function clampAdditional() {
    const value = Math.max(0, Math.min(4, parseInt(additionalTanks.value || '0', 10)));
    additionalTanks.value = Number.isNaN(value) ? 0 : value;
  }

  function renderSelectedFiles() {
    if (!selectedFiles || !photoUpload) return;
    selectedFiles.innerHTML = '';

    const files = Array.from(photoUpload.files || []);

    if (!files.length) {
      const help = document.createElement('p');
      help.className = 'ft-help';
      help.textContent = 'No photos selected yet.';
      selectedFiles.appendChild(help);
      return;
    }

    const status = document.createElement('p');
    status.className = 'ft-help';
    status.style.marginBottom = '10px';
    status.textContent = `${files.length} photo${files.length !== 1 ? 's' : ''} selected`;
    selectedFiles.appendChild(status);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
    grid.style.gap = '8px';

    files.slice(0, 10).forEach((file, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.style.position = 'relative';
      thumb.style.aspectRatio = '1';
      thumb.style.borderRadius = '8px';
      thumb.style.overflow = 'hidden';
      thumb.style.background = 'rgba(255,255,255,0.05)';
      thumb.style.display = 'flex';
      thumb.style.alignItems = 'center';
      thumb.style.justifyContent = 'center';

      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.src = URL.createObjectURL(file);
        thumb.appendChild(img);

        if (i === 0) {
          const badge = document.createElement('div');
          badge.textContent = 'Hero';
          badge.style.position = 'absolute';
          badge.style.bottom = '4px';
          badge.style.right = '4px';
          badge.style.background = 'rgba(16,185,129,0.9)';
          badge.style.color = 'white';
          badge.style.padding = '2px 6px';
          badge.style.borderRadius = '4px';
          badge.style.fontSize = '0.7rem';
          badge.style.fontWeight = '600';
          thumb.appendChild(badge);
        }
      } else {
        thumb.textContent = file.name;
        thumb.style.fontSize = '0.75rem';
        thumb.style.padding = '4px';
        thumb.style.textAlign = 'center';
      }

      grid.appendChild(thumb);
    });

    selectedFiles.appendChild(grid);
  }

  function computePricing() {
    clampAdditional();
    const isFirst = (form.querySelector('input[name="is_first_tank"]:checked') || {}).value !== 'no';
    const additionalCount = Math.max(0, parseInt(additionalTanks.value || '0', 10));
    const wantsEditing = (form.querySelector('input[name="text_source"]:checked') || {}).value === 'fklc';
    const wantsExtraPhotos = extraPhotos.checked;
    const wantsAdditionalExtra = additionalCount > 0 && extraPhotosAdditional.checked;

    let total = 0;
    let credits = 0;
    const lines = [];

    if (isFirst) {
      lines.push('First tank submission: FREE');
      if (wantsEditing) {
        total += 1;
        credits += 3;
        lines.push('Editing package (+$1): first draft + 3 revisions');
      }
    } else {
      total += 2;
      credits += 3;
      lines.push('Current tank marked as additional: $2 (editing + 3 revisions included)');
    }

    if (additionalCount > 0) {
      total += additionalCount * 2;
      credits += additionalCount * 3;
      lines.push(`${additionalCount} additional tank(s): $${(additionalCount * 2).toFixed(2)}`);
    }

    if (wantsExtraPhotos) {
      total += 1;
      lines.push('Extra photos for main tank: +$1');
    }

    if (wantsAdditionalExtra) {
      total += additionalCount;
      lines.push(`Extra photos for additional tanks: +$${additionalCount.toFixed(2)}`);
    }

    if (!lines.length) {
      lines.push('Free submission selected.');
    }

    totalDisplay.textContent = `$${total.toFixed(2)}`;
    pricingHidden.value = lines.join(' | ');
    totalPrice.value = total.toFixed(2);
    creditSummary.textContent = credits > 0
      ? `${credits} editing credits included for this submission.`
      : 'No editing credits selected for this submission.';

    pricingList.innerHTML = '';
    lines.forEach((item) => {
      const li = document.createElement('li');
      const parts = item.split(':');
      if (parts.length > 1) {
        li.innerHTML = `<span>${parts[0]}</span><span>${parts.slice(1).join(':').trim()}</span>`;
      } else {
        li.textContent = item;
      }
      pricingList.appendChild(li);
    });
  }

  function updateReview() {
    const envValue = (form.querySelector('input[name="environment"]:checked') || {}).value || '';
    const env = formatEnvironment(envValue);
    const lines = [
      `Name: ${form.name.value.trim() || '—'}`,
      `Email: ${form.email.value.trim() || '—'}`,
      `Tank Name: ${form.tank_name.value.trim() || '—'}`,
      `Tank Size: ${form.tank_size.value.trim() || '—'} gallons`,
      `Environment: ${env}`
    ];

    ['youtube', 'instagram', 'tiktok'].forEach((id) => {
      const val = (form[id] || {}).value || '';
      if (val.trim()) lines.push(`${id.charAt(0).toUpperCase() + id.slice(1)}: ${val.trim()}`);
    });

    const textChoice = (form.querySelector('input[name="text_source"]:checked') || {}).value;
    lines.push(`Story: ${textChoice === 'fklc' ? 'FKLC writes with editing package' : 'Self-written'}`);
    if (extraPhotos.checked) lines.push('Extra photos: +2 slots selected');
    const uploadedCount = photoUpload.files ? photoUpload.files.length : 0;
    lines.push(`Photos selected: ${uploadedCount} file(s)`);

    const additionalCount = Math.max(0, parseInt(additionalTanks.value || '0', 10));
    if ((form.querySelector('input[name="is_first_tank"]:checked') || {}).value === 'no') {
      lines.push('Marked as additional tank');
    }
    if (additionalCount > 0) lines.push(`Extra tanks added: ${additionalCount}`);
    if (extraPhotosAdditional.checked && additionalCount > 0) lines.push('Extra photos for additional tanks selected');

    reviewList.innerHTML = '';
    lines.forEach((text) => {
      const div = document.createElement('div');
      div.textContent = text;
      reviewList.appendChild(div);
    });
  }

  function validateStep(step) {
    setError('');
    if (step === 1) {
      // Step 1 is informational only, always valid
      return true;
    } else if (step === 2) {
      const requiredFields = ['name', 'email', 'tank_name', 'tank_size'];
      for (const field of requiredFields) {
        const el = form[field];
        if (!el || !el.value.trim()) {
          setError('Please complete all required contact and tank details.');
          return false;
        }
      }
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(form.email.value.trim())) {
        setError('Enter a valid email address.');
        return false;
      }
      if (!form.querySelector('input[name="environment"]:checked')) {
        setError('Select your environment.');
        return false;
      }
      if (!document.getElementById('newTankConfirm').checked) {
        setError('Please confirm this is a new tank.');
        return false;
      }
      checkDuplicates();
    } else if (step === 3) {
      const count = photoUpload.files ? photoUpload.files.length : 0;
      if (count < 3) {
        setError('Please upload at least 3 photos for your tank feature.');
        return false;
      }

      if (!form.querySelector('input[name="text_source"]:checked')) {
        setError('Please select how you want to create your story.');
        return false;
      }
    } else if (step === 4) {
      const requiredBoxes = ['licenseConfirm', 'guidelinesConfirm', 'contactConsent', 'pricingConfirm'];
      const missing = requiredBoxes.some((id) => {
        const el = document.getElementById(id);
        return !el || !el.checked;
      });
      if (missing) {
        setError('Please agree to all required permissions.');
        return false;
      }
    }
    return true;
  }

  function handleNav(direction) {
    if (direction === 1 && !validateStep(currentStep)) return;
    currentStep = Math.min(Math.max(currentStep + direction, 1), 6);
    if (currentStep === 5) {
      updateReview();
      computePricing();
    }
    setStepVisibility(currentStep);
  }

  async function handleSubmit() {
    if (!validateStep(5)) return;

    clampAdditional();
    updateReview();
    computePricing();

    const email = form.email.value.trim();
    const tankName = form.tank_name.value.trim();
    const size = form.tank_size.value.trim();

    // Store for duplicate detection
    const stored = JSON.parse(localStorage.getItem('ttg-feature-submissions') || '[]');
    stored.push({ email, tank: tankName, size });
    localStorage.setItem('ttg-feature-submissions', JSON.stringify(stored.slice(-10)));

    const fd = new FormData(form);

    console.info('Feature Your Tank submission', Object.fromEntries(fd));

    try {
      // Call new API endpoint
      const response = await fetch('https://feature-tank-api.thetankguide.workers.dev/api/submissions/create', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Submission failed');
      }

      const data = await response.json();

      // Move to confirmation step
      currentStep = 6;
      setStepVisibility(currentStep);
      setError('');

      // Handle payment redirect or show confirmation
      if (data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkout_url;
      } else {
        // Free submission - show confirmation
        if (checkoutMessage) {
          checkoutMessage.textContent = 'Your submission is 100% free! We\'ll email you within 5-7 days with next steps.';
        }
        if (confirmationDetails) {
          confirmationDetails.innerHTML = `
            <p class="ft-help"><strong>Submission ID:</strong> ${data.submission_id}</p>
            <p class="ft-help"><strong>What happens next:</strong></p>
            <ul style="margin:8px 0 0 20px;color:#e5e7eb;">
              <li>We\'ll review your submission within 2-4 weeks</li>
              <li>You\'ll receive an email confirmation shortly</li>
              <li>Your permanent page will be published after approval</li>
            </ul>
          `;
        }
      }
    } catch (error) {
      console.error('Submission error:', error);
      setError(error.message || 'There was a problem sending your submission. Please try again.');
    }
  }

  if (photoUploadTrigger && photoUpload) {
    photoUploadTrigger.addEventListener('click', () => photoUpload.click());
  }

  if (photoUpload) {
    photoUpload.addEventListener('change', renderSelectedFiles);
  }

  form.addEventListener('change', (event) => {
    if (
      ['text_source', 'is_first_tank', 'additional_tanks', 'extra_photos', 'extra_photos_additional'].includes(
        event.target.name
      )
    ) {
      computePricing();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentStep === 5) {
      handleSubmit();
    } else {
      handleNav(1);
    }
  });

  prevBtn.addEventListener('click', () => handleNav(-1));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit();
  });

  renderSelectedFiles();
  computePricing();
  setStepVisibility(currentStep);
})();
