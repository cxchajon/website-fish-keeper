/**
 * Feature Your Tank - Multi-step submission wizard
 * Version: 1.0.3
 *
 * Handles 6-step form wizard with:
 * - Cloudinary photo upload integration
 * - Formspree submission
 * - Dynamic pricing calculations
 * - Form validation
 * - Mobile-first experience
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    formspreeEndpoint: 'https://formspree.io/f/xangqlww',
    cloudinaryCloudName: 'fishkeepinglifeco',
    cloudinaryUploadPreset: 'feature-your-tank',
    stripePublishableKey: 'pk_test_PLACEHOLDER', // Not implemented yet
  };

  // State
  let currentStep = 1;
  const totalSteps = 6;
  let uploadedPhotos = [];
  let cloudinaryWidget = null;

  // DOM Elements
  const form = document.getElementById('featureForm');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const errorMessage = document.getElementById('errorMessage');
  const photoUploadTrigger = document.getElementById('photoUploadTrigger');
  const selectedFiles = document.getElementById('selectedFiles');
  const pricingBreakdown = document.getElementById('pricingBreakdown');
  const totalPriceDisplay = document.getElementById('totalPriceDisplay');
  const totalPriceInput = document.getElementById('totalPrice');
  const duplicateWarning = document.getElementById('duplicateWarning');
  const duplicateFlag = document.getElementById('duplicateFlag');
  const creditSummary = document.getElementById('creditSummary');

  /**
   * Initialize the form wizard
   */
  function init() {
    // Add class to enable wizard mode
    document.body.classList.add('js-feature-wizard');
    document.documentElement.classList.add('js-feature-wizard');

    // Show first step
    showStep(1);

    // Bind events
    bindEvents();

    // Initialize Cloudinary widget
    initCloudinaryWidget();

    // Setup pricing listeners
    setupPricingListeners();

    // Initial render
    updatePhotoPreview();
    updatePricing();
  }

  /**
   * Bind all event listeners
   */
  function bindEvents() {
    if (nextBtn) {
      nextBtn.addEventListener('click', handleNext);
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', handlePrev);
    }

    if (photoUploadTrigger) {
      photoUploadTrigger.addEventListener('click', function(e) {
        e.preventDefault();
        openCloudinaryWidget();
      });
    }

    // Prevent form submission
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
      });
    }

    // Radio button labels - make them clickable
    document.querySelectorAll('.radio-option, .selection-inline, .radio-row label').forEach((label) => {
      label.addEventListener('click', (e) => {
        if (e.target.type !== 'radio') {
          const input = label.querySelector('input[type="radio"]');
          if (input) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    });
  }

  /**
   * Initialize Cloudinary Upload Widget
   */
  function initCloudinaryWidget() {
    // Check if Cloudinary is available
    if (typeof cloudinary === 'undefined') {
      console.error('Cloudinary widget not loaded. Please ensure the Cloudinary script is included.');
      return;
    }

    try {
      cloudinaryWidget = cloudinary.createUploadWidget({
        cloudName: CONFIG.cloudinaryCloudName,
        uploadPreset: CONFIG.cloudinaryUploadPreset,
        sources: ['local', 'camera'],
        multiple: true,
        maxFiles: 5,
        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxFileSize: 10000000, // 10MB
        folder: 'feature-your-tank',
        tags: ['tank-submission'],
        showPoweredBy: false,
        cropping: false,
        styles: {
          palette: {
            window: '#0b0f12',
            windowBorder: '#3b82f6',
            tabIcon: '#10b981',
            menuIcons: '#10b981',
            textDark: '#000000',
            textLight: '#ffffff',
            link: '#10b981',
            action: '#10b981',
            inactiveTabIcon: '#555555',
            error: '#f87171',
            inProgress: '#3b82f6',
            complete: '#10b981',
            sourceBg: '#111820'
          }
        }
      }, handleUploadResult);
    } catch (error) {
      console.error('Failed to initialize Cloudinary widget:', error);
      showError('Photo upload system unavailable. Please refresh the page.');
    }
  }

  /**
   * Open Cloudinary widget
   */
  function openCloudinaryWidget() {
    if (cloudinaryWidget) {
      cloudinaryWidget.open();
    } else {
      showError('Photo upload widget not initialized. Please refresh the page.');
    }
  }

  /**
   * Handle Cloudinary upload results
   */
  function handleUploadResult(error, result) {
    if (error) {
      console.error('Upload error:', error);
      showError('Photo upload failed: ' + error.message + '. Please try again.');
      return;
    }

    if (result.event === 'success') {
      const photo = {
        url: result.info.secure_url,
        thumbnail: result.info.thumbnail_url || result.info.secure_url,
        publicId: result.info.public_id,
        width: result.info.width,
        height: result.info.height,
      };

      uploadedPhotos.push(photo);
      updatePhotoPreview();
      hideError();
    }

    if (result.event === 'close') {
      // Widget closed
      updatePhotoPreview();
    }
  }

  /**
   * Update photo preview thumbnails
   */
  function updatePhotoPreview() {
    if (!selectedFiles) return;

    const extraPhotos = document.getElementById('extraPhotos');
    const maxPhotos = extraPhotos && extraPhotos.checked ? 5 : 3;

    if (uploadedPhotos.length === 0) {
      selectedFiles.innerHTML = '<p class="ft-help" style="padding:12px;margin:0;">No photos selected yet. Tap "Upload Photos" to add images.</p>';
      return;
    }

    // Status message
    let statusHtml = '';
    const count = uploadedPhotos.length;
    let statusColor = '';

    if (count < 3) {
      statusColor = '#fbbf24'; // Yellow
      statusHtml = `<strong>${count} photo${count !== 1 ? 's' : ''} selected</strong> — need at least 3`;
    } else if (count <= maxPhotos) {
      statusColor = '#10b981'; // Green
      statusHtml = `<strong>${count} photo${count !== 1 ? 's' : ''} selected</strong> — ✓ ready`;
    } else {
      statusColor = '#f87171'; // Red
      statusHtml = `<strong>${count} photo${count !== 1 ? 's' : ''} selected</strong> — max ${maxPhotos} allowed`;
    }

    selectedFiles.innerHTML = `
      <p class="ft-help" style="margin:0 0 10px;color:${statusColor};">${statusHtml}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-bottom:12px;">
        ${uploadedPhotos.map((photo, index) => {
          // Create thumbnail URL using Cloudinary transformations
          const thumbUrl = photo.url.replace('/upload/', '/upload/c_fill,h_200,w_200/');
          const isHero = index === 0;

          return `
            <div class="thumb" style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;">
              <img src="${thumbUrl}" alt="Tank photo ${index + 1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />
              ${isHero ? '<div class="badge" style="position:absolute;bottom:4px;right:4px;background:rgba(16,185,129,0.9);color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;font-weight:600;">Hero</div>' : ''}
              <button type="button" class="remove-photo-btn" data-index="${index}" aria-label="Remove photo ${index + 1}"
                style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(248,113,113,0.9);color:white;font-size:16px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">×</button>
            </div>
          `;
        }).join('')}
      </div>
      ${count < maxPhotos ? `<button type="button" class="btn-ghost add-more-photos" style="width:100%;">+ Add More Photos (${maxPhotos - count} more allowed)</button>` : ''}
    `;

    // Bind remove buttons
    selectedFiles.querySelectorAll('.remove-photo-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const index = parseInt(this.getAttribute('data-index'));
        removePhoto(index);
      });
    });

    // Bind add more button
    const addMoreBtn = selectedFiles.querySelector('.add-more-photos');
    if (addMoreBtn) {
      addMoreBtn.addEventListener('click', openCloudinaryWidget);
    }
  }

  /**
   * Remove a photo from the uploaded list
   */
  function removePhoto(index) {
    uploadedPhotos.splice(index, 1);
    updatePhotoPreview();
  }

  /**
   * Setup pricing listeners
   */
  function setupPricingListeners() {
    // Text source radio buttons
    const textSourceRadios = document.querySelectorAll('input[name="text_source"]');
    textSourceRadios.forEach(radio => {
      radio.addEventListener('change', updatePricing);
    });

    // Extra photos checkbox
    const extraPhotosCheckbox = document.getElementById('extraPhotos');
    if (extraPhotosCheckbox) {
      extraPhotosCheckbox.addEventListener('change', () => {
        updatePhotoPreview();
        updatePricing();
      });
    }

    // Additional tanks input
    const additionalTanksInput = document.getElementById('additionalTanks');
    if (additionalTanksInput) {
      additionalTanksInput.addEventListener('input', updatePricing);
    }

    // Extra photos for additional tanks
    const extraPhotosAdditionalCheckbox = document.getElementById('extraPhotosAdditional');
    if (extraPhotosAdditionalCheckbox) {
      extraPhotosAdditionalCheckbox.addEventListener('change', updatePricing);
    }

    // First tank radio
    const isFirstTankRadios = document.querySelectorAll('input[name="is_first_tank"]');
    isFirstTankRadios.forEach(radio => {
      radio.addEventListener('change', updatePricing);
    });
  }

  // Listen for story source changes
  document.addEventListener('DOMContentLoaded', function() {
    const textSourceRadios = document.querySelectorAll('input[name="text_source"]');
    const blogOptions = document.querySelector('.blog-options');

    if (textSourceRadios.length && blogOptions) {
      // Create text areas if they don't exist
      let userTextArea = document.getElementById('user-story-text');
      let fklcNotesArea = document.getElementById('fklc-notes-text');

      if (!userTextArea) {
        const userContainer = document.createElement('div');
        userContainer.id = 'user-story-container';
        userContainer.className = 'ft-field';
        userContainer.style.display = 'none';
        userContainer.innerHTML = `
        <label for="user-story-text" class="ft-label">Your Tank Story</label>
        <textarea 
          id="user-story-text" 
          name="user_story" 
          class="ft-input" 
          rows="10" 
          placeholder="Tell us about your tank setup, equipment, livestock, plants, challenges, maintenance routine, and what you've learned..."
          minlength="50"
        ></textarea>
        <small class="ft-help">
          Minimum 50 characters. Write about your experience, challenges, and successes.
        </small>
        <div class="character-count" style="text-align: right; font-size: 0.9rem; color: #a1a1aa; margin-top: 6px;">
          <span id="user-story-count">0</span> characters
        </div>
      `;

        // Insert after the radio buttons
        const radioGroup = blogOptions.querySelector('[role="radiogroup"]');
        radioGroup.parentNode.insertBefore(userContainer, radioGroup.nextSibling);
      }

      if (!fklcNotesArea) {
        const fklcContainer = document.createElement('div');
        fklcContainer.id = 'fklc-notes-container';
        fklcContainer.className = 'ft-field';
        fklcContainer.style.display = 'none';
        fklcContainer.innerHTML = `
        <div class="intro-card" style="margin-bottom: 16px;">
          <h4>📝 How the $1 Editing Package Works</h4>
          <ul>
            <li><strong>Step 1:</strong> Provide basic notes below about your tank</li>
            <li><strong>Step 2:</strong> We write a professional first draft (FREE - doesn't use a credit)</li>
            <li><strong>Step 3:</strong> You get 3 revision rounds that NEVER expire</li>
            <li><strong>Step 4:</strong> Use your credits anytime for updates to your feature</li>
          </ul>
          <p class="ft-help">
            Credits stay tied to your tank forever. First draft is on us!
          </p>
        </div>
        <label for="fklc-notes-text" class="ft-label">Notes for FKLC Writing Team</label>
        <textarea 
          id="fklc-notes-text" 
          name="fklc_notes" 
          class="ft-input" 
          rows="6" 
          placeholder="Example: 29 gallon planted, running 2 years, DIY sump filtration, betta + tetras + shrimp, no CO2 but plants grow well, biggest challenge was balancing light..."
          minlength="30"
        ></textarea>
        <small class="ft-help">
          Give us the basics - we'll turn it into a great story! Minimum 30 characters.
        </small>
        <div class="character-count" style="text-align: right; font-size: 0.9rem; color: #a1a1aa; margin-top: 6px;">
          <span id="fklc-notes-count">0</span> characters
        </div>
      `;

        // Insert after user story container
        const userContainer = document.getElementById('user-story-container');
        userContainer.parentNode.insertBefore(fklcContainer, userContainer.nextSibling);
      }

      // Set up change handlers
      function updateTextBoxes() {
        const selectedValue = document.querySelector('input[name="text_source"]:checked')?.value;
        const userContainer = document.getElementById('user-story-container');
        const fklcContainer = document.getElementById('fklc-notes-container');

        if (selectedValue === 'user') {
          if (userContainer) userContainer.style.display = 'block';
          if (fklcContainer) fklcContainer.style.display = 'none';
        } else if (selectedValue === 'fklc') {
          if (userContainer) userContainer.style.display = 'none';
          if (fklcContainer) fklcContainer.style.display = 'block';
        }
      }

      // Add change listeners
      textSourceRadios.forEach(radio => {
        radio.addEventListener('change', updateTextBoxes);
      });

      // Initial state
      updateTextBoxes();

      // Character counters
      const userStoryText = document.getElementById('user-story-text');
      const userStoryCount = document.getElementById('user-story-count');
      const fklcNotesText = document.getElementById('fklc-notes-text');
      const fklcNotesCount = document.getElementById('fklc-notes-count');

      if (userStoryText && userStoryCount) {
        userStoryText.addEventListener('input', function() {
          userStoryCount.textContent = this.value.length;
        });
      }

      if (fklcNotesText && fklcNotesCount) {
        fklcNotesText.addEventListener('input', function() {
          fklcNotesCount.textContent = this.value.length;
        });
      }
    }
  });

  /**
   * Calculate and update pricing
   */
  function updatePricing() {
    let total = 0;
    let credits = 0;
    const breakdown = [];

    // Check if user wants editing package
    const textSource = document.querySelector('input[name="text_source"]:checked');
    const wantsEditing = textSource && textSource.value === 'fklc';

    // Check if this is first tank
    const isFirstTank = document.querySelector('input[name="is_first_tank"]:checked');
    const firstTank = isFirstTank && isFirstTank.value === 'yes';

    // Base submission
    if (firstTank) {
      breakdown.push({ label: 'First tank submission', amount: 'FREE' });
    } else {
      total += 2;
      credits += 3;
      breakdown.push({ label: 'Current tank (editing + 3 revisions included)', amount: 2 });
    }

    // Editing package: +$1 (only for first tank)
    if (wantsEditing && firstTank) {
      total += 1;
      credits += 3;
      breakdown.push({ label: 'Editing package (first draft + 3 revision credits)', amount: 1 });
    }

    // Extra photos: +$1
    const extraPhotos = document.getElementById('extraPhotos');
    if (extraPhotos && extraPhotos.checked) {
      total += 1;
      breakdown.push({ label: 'Extra photos (2 additional slots)', amount: 1 });
    }

    // Additional tanks: $2 each
    const additionalTanks = document.getElementById('additionalTanks');
    const additionalTanksCount = additionalTanks ? Math.max(0, Math.min(4, parseInt(additionalTanks.value) || 0)) : 0;
    if (additionalTanksCount > 0) {
      const additionalCost = additionalTanksCount * 2;
      total += additionalCost;
      credits += additionalTanksCount * 3;
      breakdown.push({
        label: `Additional tank${additionalTanksCount > 1 ? 's' : ''} (${additionalTanksCount} × $2, editing + 3 revisions each)`,
        amount: additionalCost
      });
    }

    // Extra photos for additional tanks: +$1 per tank
    const extraPhotosAdditional = document.getElementById('extraPhotosAdditional');
    if (extraPhotosAdditional && extraPhotosAdditional.checked && additionalTanksCount > 0) {
      const extraPhotosCost = additionalTanksCount * 1;
      total += extraPhotosCost;
      breakdown.push({
        label: `Extra photos for additional tanks (${additionalTanksCount} × $1)`,
        amount: extraPhotosCost
      });
    }

    // Clamp additional tanks value
    if (additionalTanks) {
      additionalTanks.value = additionalTanksCount;
    }

    // Update UI
    if (pricingBreakdown) {
      pricingBreakdown.innerHTML = breakdown.map(item => {
        const amountText = typeof item.amount === 'number' ? `$${item.amount}` : item.amount;
        return `<li><span>${item.label}</span><span>${amountText}</span></li>`;
      }).join('');
    }

    if (totalPriceDisplay) {
      totalPriceDisplay.textContent = `$${total}`;
    }

    if (totalPriceInput) {
      totalPriceInput.value = total;
    }

    if (creditSummary) {
      creditSummary.textContent = credits > 0
        ? `${credits} editing credit${credits !== 1 ? 's' : ''} included for this submission.`
        : 'No editing credits selected for this submission.';
    }

    // Update hidden pricing breakdown for form submission
    const pricingHidden = document.getElementById('pricingHidden');
    if (pricingHidden) {
      pricingHidden.value = breakdown.map(item => {
        const amountText = typeof item.amount === 'number' ? `$${item.amount}` : item.amount;
        return `${item.label}: ${amountText}`;
      }).join(' | ');
    }
  }

  /**
   * Show specific step
   */
  function showStep(step) {
    currentStep = step;

    // Hide all steps
    const allSteps = document.querySelectorAll('.ft-step');
    allSteps.forEach(stepEl => {
      stepEl.style.display = 'none';
      stepEl.hidden = true;
      stepEl.setAttribute('aria-hidden', 'true');
    });

    // Show current step
    const currentStepEl = document.querySelector(`.ft-step[data-step="${step}"]`);
    if (currentStepEl) {
      currentStepEl.style.display = 'block';
      currentStepEl.hidden = false;
      currentStepEl.setAttribute('aria-hidden', 'false');
    }

    // Update step indicators
    const stepIndicators = document.querySelectorAll('.step');
    stepIndicators.forEach(indicator => {
      const stepNum = parseInt(indicator.getAttribute('data-step'));
      if (stepNum === step) {
        indicator.classList.add('active');
        indicator.setAttribute('aria-current', 'step');
      } else {
        indicator.classList.remove('active');
        indicator.setAttribute('aria-current', 'false');
      }
    });

    // Update button states
    updateButtons();

    // Update confirmation messaging when reaching final step
    if (currentStep === 6) {
      showConfirmationMessage();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Show appropriate confirmation message based on total
  function showConfirmationMessage() {
    const totalPrice = parseFloat(document.getElementById('totalPrice')?.value || 0);
    const paidConfirmation = document.getElementById('paid-confirmation');
    const freeConfirmation = document.getElementById('free-confirmation');

    if (totalPrice > 0) {
      if (paidConfirmation) paidConfirmation.style.display = 'block';
      if (freeConfirmation) freeConfirmation.style.display = 'none';
    } else {
      if (paidConfirmation) paidConfirmation.style.display = 'none';
      if (freeConfirmation) freeConfirmation.style.display = 'block';
    }
  }

  /**
   * Update button visibility and text
   */
  function updateButtons() {
    if (!nextBtn || !prevBtn) return;

    // Previous button
    if (currentStep === 1 || currentStep === 6) {
      prevBtn.style.display = 'none';
      prevBtn.disabled = true;
    } else {
      prevBtn.style.display = 'inline-block';
      prevBtn.disabled = false;
    }

    // Next button
    if (currentStep === 6) {
      nextBtn.style.display = 'none';
      nextBtn.disabled = true;
    } else if (currentStep === 5) {
      nextBtn.style.display = 'inline-block';
      nextBtn.textContent = 'Submit & Pay';
      nextBtn.disabled = false;
    } else {
      nextBtn.style.display = 'inline-block';
      nextBtn.textContent = 'Next';
      nextBtn.disabled = false;
    }
  }

  /**
   * Handle Next button click
   */
  async function handleNext() {
    hideError();

    // Validate current step
    if (!validateStep(currentStep)) {
      return;
    }

    // Special handling for step 2: duplicate check
    if (currentStep === 2) {
      await checkDuplicate();
      // Continue even if duplicate - just show warning
    }

    // Special handling for step 5: submit form
    if (currentStep === 5) {
      await submitForm();
      return;
    }

    // Move to next step
    if (currentStep < totalSteps) {
      showStep(currentStep + 1);

      // Update review on step 5
      if (currentStep === 5) {
        updateReview();
        updatePricing();
      }
    }
  }

  /**
   * Handle Previous button click
   */
  function handlePrev() {
    hideError();

    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  }

  /**
   * Validate a specific step
   */
  function validateStep(step) {
    if (step === 2) {
      // Validate user and tank information
      const name = document.getElementById('name');
      const email = document.getElementById('email');
      const tankName = document.getElementById('tank_name');
      const tankSize = document.getElementById('tank_size');
      const environment = document.querySelector('input[name="environment"]:checked');
      const newTankConfirm = document.getElementById('newTankConfirm');

      if (!name || !name.value.trim()) {
        showError('Please enter your name.');
        name?.focus();
        return false;
      }

      if (!email || !email.value.trim()) {
        showError('Please enter your email address.');
        email?.focus();
        return false;
      }

      // Email validation
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email.value.trim())) {
        showError('Please enter a valid email address.');
        email?.focus();
        return false;
      }

      if (!tankName || !tankName.value.trim()) {
        showError('Please enter a tank name.');
        tankName?.focus();
        return false;
      }

      if (!tankSize || !tankSize.value || tankSize.value <= 0) {
        showError('Please enter a valid tank size.');
        tankSize?.focus();
        return false;
      }

      if (!environment) {
        showError('Please select an environment type (Planted or Unplanted).');
        return false;
      }

      if (!newTankConfirm || !newTankConfirm.checked) {
        showError('Please confirm this is a new tank submission.');
        newTankConfirm?.focus();
        return false;
      }

      return true;
    }

    if (step === 3) {
      // Validate photos
      const extraPhotos = document.getElementById('extraPhotos');
      const maxPhotos = extraPhotos && extraPhotos.checked ? 5 : 3;

      if (uploadedPhotos.length < 3) {
        showError('Please upload at least 3 photos of your tank.');
        return false;
      }

      if (uploadedPhotos.length > maxPhotos) {
        showError(`You can upload a maximum of ${maxPhotos} photos. ${maxPhotos === 3 ? 'Check "Add 2 more photo slots" to upload up to 5.' : ''}`);
        return false;
      }

      return true;
    }

    if (step === 4) {
      // Validate consent checkboxes
      const licenseConfirm = document.getElementById('licenseConfirm');
      const guidelinesConfirm = document.getElementById('guidelinesConfirm');
      const contactConsent = document.getElementById('contactConsent');
      const pricingConfirm = document.getElementById('pricingConfirm');

      if (!licenseConfirm || !licenseConfirm.checked) {
        showError('Please confirm the license agreement.');
        licenseConfirm?.focus();
        return false;
      }

      if (!guidelinesConfirm || !guidelinesConfirm.checked) {
        showError('Please confirm your content follows community guidelines.');
        guidelinesConfirm?.focus();
        return false;
      }

      if (!contactConsent || !contactConsent.checked) {
        showError('Please consent to email contact about this submission.');
        contactConsent?.focus();
        return false;
      }

      if (!pricingConfirm || !pricingConfirm.checked) {
        showError('Please confirm you understand the pricing and refund policy.');
        pricingConfirm?.focus();
        return false;
      }

      return true;
    }

    return true;
  }

  /**
   * Check for duplicate submissions (client-side warning only)
   */
  async function checkDuplicate() {
    const email = document.getElementById('email');
    const tankName = document.getElementById('tank_name');
    const tankSize = document.getElementById('tank_size');

    if (!email || !tankName || !tankSize) return false;

    // Store in localStorage for basic duplicate checking
    const submissionKey = `${email.value.toLowerCase()}_${tankName.value.toLowerCase()}_${tankSize.value}`;
    const existingSubmissions = JSON.parse(localStorage.getItem('ttg-feature-submissions') || '[]');

    // Simple string similarity check
    const isDuplicate = existingSubmissions.some(sub => {
      const similarity = stringSimilarity(sub.tank || '', tankName.value);
      return sub.email === email.value.toLowerCase() && (similarity > 0.8 || sub.size === tankSize.value);
    });

    if (isDuplicate && duplicateWarning) {
      duplicateWarning.textContent = '⚠️ Warning: We found a similar submission from this email/tank. This may be a duplicate. You can continue, but please verify this is a new tank.';
      duplicateWarning.style.display = 'block';

      if (duplicateFlag) {
        duplicateFlag.value = 'true';
      }

      return true;
    } else if (duplicateWarning) {
      duplicateWarning.style.display = 'none';

      if (duplicateFlag) {
        duplicateFlag.value = 'false';
      }
    }

    return false;
  }

  /**
   * Simple string similarity calculation (Dice coefficient)
   */
  function stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return 0;

    const pairs1 = [];
    const pairs2 = [];

    for (let i = 0; i < s1.length - 1; i++) {
      pairs1.push(s1.substring(i, i + 2));
    }

    for (let i = 0; i < s2.length - 1; i++) {
      pairs2.push(s2.substring(i, i + 2));
    }

    const union = pairs1.length + pairs2.length;
    let intersection = 0;

    const map = new Map();
    pairs1.forEach(pair => map.set(pair, (map.get(pair) || 0) + 1));

    pairs2.forEach(pair => {
      const count = map.get(pair) || 0;
      if (count > 0) {
        map.set(pair, count - 1);
        intersection++;
      }
    });

    return (2.0 * intersection) / union;
  }

  /**
   * Update review section
   */
  function updateReview() {
    const reviewList = document.getElementById('reviewList');
    if (!reviewList) return;

    const name = document.getElementById('name')?.value || 'Not provided';
    const email = document.getElementById('email')?.value || 'Not provided';
    const tankName = document.getElementById('tank_name')?.value || 'Not provided';
    const tankSize = document.getElementById('tank_size')?.value || 'Not provided';
    const environment = document.querySelector('input[name="environment"]:checked')?.value || 'Not selected';
    const textSource = document.querySelector('input[name="text_source"]:checked')?.value || 'user';
    const photoCount = uploadedPhotos.length;

    const youtube = document.getElementById('youtube')?.value || '';
    const instagram = document.getElementById('instagram')?.value || '';
    const tiktok = document.getElementById('tiktok')?.value || '';

    const lines = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Tank Name: ${tankName}`,
      `Tank Size: ${tankSize} gallons`,
      `Environment: ${environment.charAt(0).toUpperCase() + environment.slice(1)}`,
      `Photos Uploaded: ${photoCount}`,
      `Story: ${textSource === 'fklc' ? 'FKLC will write it (editing package)' : 'Self-written'}`
    ];

    if (youtube.trim()) lines.push(`YouTube: ${youtube}`);
    if (instagram.trim()) lines.push(`Instagram: ${instagram}`);
    if (tiktok.trim()) lines.push(`TikTok: ${tiktok}`);

    const extraPhotos = document.getElementById('extraPhotos');
    if (extraPhotos && extraPhotos.checked) {
      lines.push('Extra photos: +2 slots selected');
    }

    const additionalTanks = document.getElementById('additionalTanks');
    const additionalCount = additionalTanks ? parseInt(additionalTanks.value) || 0 : 0;
    if (additionalCount > 0) {
      lines.push(`Extra tanks added: ${additionalCount}`);
    }

    const extraPhotosAdditional = document.getElementById('extraPhotosAdditional');
    if (extraPhotosAdditional && extraPhotosAdditional.checked && additionalCount > 0) {
      lines.push('Extra photos for additional tanks selected');
    }

    reviewList.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
  }

  /**
   * Submit form to Formspree
   */
  async function submitForm() {
    try {
      // Disable submit button
      if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.textContent = 'Submitting...';
      }

      // Prepare form data
      const formData = new FormData(form);

      // Add photo URLs as JSON string
      formData.set('photo_urls', JSON.stringify(uploadedPhotos.map(p => p.url)));

      // Submit to Formspree
      const response = await fetch(CONFIG.formspreeEndpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Store submission in localStorage for duplicate checking
        const email = document.getElementById('email')?.value || '';
        const tankName = document.getElementById('tank_name')?.value || '';
        const tankSize = document.getElementById('tank_size')?.value || '';

        const existingSubmissions = JSON.parse(localStorage.getItem('ttg-feature-submissions') || '[]');
        existingSubmissions.push({
          email: email.toLowerCase(),
          tank: tankName.toLowerCase(),
          size: tankSize
        });
        // Keep only last 10 submissions
        localStorage.setItem('ttg-feature-submissions', JSON.stringify(existingSubmissions.slice(-10)));

        // Show confirmation
        showConfirmation();
        showStep(6);
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Submission failed');
      }
    } catch (error) {
      console.error('Submission error:', error);
      showError('Submission failed: ' + error.message + '. Please try again or contact support.');

      // Re-enable button
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Submit & Pay';
      }
    }
  }

  /**
   * Show confirmation details
   */
  function showConfirmation() {
    const confirmationDetails = document.getElementById('confirmationDetails');
    const checkoutMessage = document.getElementById('checkoutMessage');

    const total = parseInt(totalPriceInput?.value || '0');
    const name = document.getElementById('name')?.value || '';
    const email = document.getElementById('email')?.value || '';
    const tankName = document.getElementById('tank_name')?.value || '';

    if (confirmationDetails) {
      confirmationDetails.innerHTML = `
        <p class="ft-help"><strong>Submitted by:</strong> ${name}</p>
        <p class="ft-help"><strong>Email:</strong> ${email}</p>
        <p class="ft-help"><strong>Tank:</strong> ${tankName}</p>
        <p class="ft-help"><strong>Total:</strong> $${total}</p>
      `;
    }

    if (checkoutMessage) {
      if (total === 0) {
        checkoutMessage.innerHTML = '<strong>✓ Your free submission is complete!</strong> Check your email for confirmation. We\'ll review your submission and create your feature within 5-7 business days.';
      } else {
        checkoutMessage.innerHTML = `<strong>💳 Payment Required: $${total}</strong><br>We\'ll email you a secure Stripe payment link to complete your purchase. Your submission is saved and will be processed once payment is received. Expect your feature to go live within 5-7 business days after payment.`;
      }
    }

    // Ensure confirmation panels reflect the current total
    showConfirmationMessage();
  }

  /**
   * Show error message
   */
  function showError(message) {
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
      errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Hide error message
   */
  function hideError() {
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
