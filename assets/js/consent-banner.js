(function(){
  var STORE_KEY = 'ttgConsentV2';
  var EXP_DAYS = 365;
  var MS_PER_DAY = 24*60*60*1000;

  function now(){ return Date.now(); }
  function persist(consent){
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(consent));
      document.cookie = STORE_KEY + '=1; Max-Age=' + (EXP_DAYS*24*3600) + '; Path=/; SameSite=Lax';
    } catch (e) {}
  }
  function erase(){
    try {
      localStorage.removeItem(STORE_KEY);
      document.cookie = STORE_KEY + '=; Max-Age=0; Path=/; SameSite=Lax';
    } catch (e) {}
  }
  function load(){
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if ((now() - (parsed.ts || 0)) > EXP_DAYS * MS_PER_DAY) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  var regionParam = new URLSearchParams(location.search).get('region');
  var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
  var tzHintsEU = /(europe\/|gmt|bst|cet|cest)/.test(tz);
  var inEEA = regionParam ? ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH'].indexOf(regionParam.toUpperCase()) !== -1 : tzHintsEU;
  // Mirror consent-mode.js: default = DENIED until accepted
  var defaultGranted = false;

  var banner = document.querySelector('[data-consent-banner]');
  var modal = document.getElementById('ttg-consent-modal');
  var manageBtn = document.getElementById('ttg-consent-manage');
  var cancelBtn = document.getElementById('ttg-consent-cancel');
  var form = document.getElementById('ttg-consent-form');
  var rows = form ? Array.from(form.querySelectorAll('.ttg-row')) : [];
  var ckAnalytics = document.getElementById('ttg-c-analytics');
  var ckAds = document.getElementById('ttg-c-ads');
  var status = form ? form.querySelector('.ttg-consent-status') : null;
  if (form && !status){
    status = document.createElement('p');
    status.className = 'ttg-consent-status';
    form.appendChild(status);
  }

  function toggleBanner(open){
    if (!banner) return;
    banner.classList.toggle('is-open', !!open);
  }
  function openBanner(){ toggleBanner(true); }
  function closeBanner(){ toggleBanner(false); }

  function openModal(){
    if (!modal) return;
    modal.hidden = false;
    applyFormFromConsent();
  }
  function closeModal(){ if (modal) modal.hidden = true; }

  function consentToForm(consent){
    if (!consent){
      return { analytics: false, ads: false };
    }
    return {
      analytics: consent.analytics_storage === 'granted',
      ads: consent.ad_personalization === 'granted'
    };
  }

  function updateStatus(){
    if (!status) return;
    var analytics = ckAnalytics ? !!ckAnalytics.checked : false;
    var ads = ckAds ? !!ckAds.checked : false;
    status.hidden = false;
    status.textContent = 'Current: Analytics ' + (analytics ? 'ON' : 'OFF') + ' • Personalized Ads ' + (ads ? 'ON' : 'OFF');
  }

  function applyFormFromConsent(){
    var consent = load();
    var formState = consentToForm(consent);
    if (ckAnalytics) ckAnalytics.checked = !!formState.analytics;
    if (ckAds) ckAds.checked = !!formState.ads;
    updateStatus();
  }

  function consentFromForm(){
    var analytics = ckAnalytics ? !!ckAnalytics.checked : false;
    var ads = ckAds ? !!ckAds.checked : false;
    return {
      ad_storage: 'granted',
      analytics_storage: analytics ? 'granted' : 'denied',
      ad_user_data: ads ? 'granted' : 'denied',
      ad_personalization: ads ? 'granted' : 'denied',
      ts: now()
    };
  }

  function dispatchConsent(granted, consent){
    try {
      window.dispatchEvent(new CustomEvent('ttg:consent-change', { detail: { granted: granted, consent: consent || null } }));
    } catch (e) {}
  }

  function applyDocumentConsent(consent){
    var granted = false;
    if (consent){
      granted = consent.ad_storage === 'granted';
    } else {
      granted = defaultGranted;
    }
    document.documentElement.setAttribute('data-ad-consent', granted ? 'granted' : 'denied');
    document.documentElement.classList.toggle('is-ads-disabled', !granted);
    window.__TTG_ADS_DISABLED__ = !granted;
    dispatchConsent(granted, consent);
  }

  rows.forEach(function(row){
    row.addEventListener('click', function(evt){
      var target = evt.target;
      var cb = row.querySelector('input[type="checkbox"]');
      if (!cb || cb.disabled) return;
      if (target && target.tagName && target.tagName.toLowerCase() !== 'input'){
        cb.checked = !cb.checked;
      }
      updateStatus();
    });
  });

  if (ckAnalytics) ckAnalytics.addEventListener('change', updateStatus);
  if (ckAds) ckAds.addEventListener('change', updateStatus);

  if (manageBtn) manageBtn.addEventListener('click', function(){ openModal(); });
  if (cancelBtn) cancelBtn.addEventListener('click', function(){ closeModal(); });

  if (modal) modal.addEventListener('click', function(evt){
    if (evt.target === modal) closeModal();
  });

  document.addEventListener('keydown', function(evt){
    if (evt.key === 'Escape' && modal && !modal.hidden){
      closeModal();
    }
  });

  if (form) form.addEventListener('submit', function(evt){
    evt.preventDefault();
    var consent = consentFromForm();
    if (typeof window.gtag === 'function'){
      window.gtag('consent', 'update', consent);
    }
    persist(consent);
    applyDocumentConsent(consent);
    closeModal();
    closeBanner();
  });

  function syncFromStorage(){
    var consent = load();
    applyDocumentConsent(consent);
    applyFormFromConsent();
  }

  function afterChoice(){
    setTimeout(syncFromStorage, 0);
  }

  document.querySelectorAll('.js-consent-accept').forEach(function(btn){
    btn.addEventListener('click', function(){
      afterChoice();
      if (typeof window.gtag === 'function'){
        window.gtag('consent', 'update', {
          ad_storage: 'granted',
          analytics_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted'
        });
      }
    });
  });
  document.querySelectorAll('.js-consent-reject').forEach(function(btn){
    btn.addEventListener('click', function(){
      afterChoice();
      if (typeof window.gtag === 'function'){
        window.gtag('consent', 'update', {
          ad_storage: 'denied',
          analytics_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied'
        });
      }
    });
  });

  window.addEventListener('storage', function(evt){
    if (evt.key === STORE_KEY){
      syncFromStorage();
    }
  });

  window.cookieConsent = {
    open: function(){
      openBanner();
      openModal();
    },
    reset: function(){
      erase();
      var deniedState = {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        ts: now()
      };
      if (typeof window.gtag === 'function'){
        window.gtag('consent', 'update', deniedState);
      }
      applyDocumentConsent(null);
      closeModal();
      openBanner();
    }
  };

  syncFromStorage();
})();
