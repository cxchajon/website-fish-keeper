(function() {
  var ATTR_ROTATOR = 'data-ttg-ad-rotator';
  var ATTR_MANIFEST = 'data-ttg-ad-manifest';
  var ATTR_INTERVAL = 'data-ttg-ad-interval';
  var ATTR_MAX_HEIGHT = 'data-ttg-ad-maxheight';
  var DEFAULT_INTERVAL = 10000;
  var manifestCache = {};

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function fetchManifest(url) {
    if (manifestCache[url]) {
      return manifestCache[url];
    }

    manifestCache[url] = fetch(url, { cache: 'no-cache' })
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Failed to load ad manifest');
        }
        return response.json();
      })
      .catch(function(error) {
        console.error('Ad rotator manifest error', error);
        return [];
      });

    return manifestCache[url];
  }

  function isExternal(href) {
    return /^https?:\/\//i.test(href);
  }

  function preloadImage(src) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() { resolve(true); };
      img.onerror = function() { resolve(false); };
      img.src = src;
    });
  }

  function getStartIndex(manifest, key) {
    if (!manifest.length) return 0;

    try {
      var storageKey = 'ttgAdRotator:' + key;
      var stored = sessionStorage.getItem(storageKey);
      if (stored !== null) {
        var parsed = parseInt(stored, 10);
        if (!Number.isNaN(parsed)) {
          return parsed % manifest.length;
        }
      }

      var randomIndex = Math.floor(Math.random() * manifest.length);
      sessionStorage.setItem(storageKey, randomIndex);
      return randomIndex;
    } catch (e) {
      return Math.floor(Math.random() * manifest.length);
    }
  }

  function applyEntry(container, linkEl, imgEl, entry, maxHeight) {
    if (!entry) return;
    if (imgEl && !imgEl.classList.contains('inhouse-ad-img')) {
      imgEl.classList.add('inhouse-ad-img');
    }
    linkEl.href = entry.href || '/store.html';
    linkEl.target = isExternal(linkEl.href) ? '_blank' : '_self';
    linkEl.rel = isExternal(linkEl.href) ? 'noopener sponsored nofollow' : 'noopener';

    if (entry.id) {
      linkEl.dataset.ttgAdId = entry.id;
    }

    if (typeof maxHeight === 'number') {
      container.style.setProperty('--ttg-ad-rotator-height', maxHeight + 'px');
      container.style.setProperty('--ttg-ad-rotator-max-height', maxHeight + 'px');
    }

    imgEl.alt = entry.alt || 'FishKeepingLifeCo promo';
    imgEl.src = entry.src;
  }

  function createRotator(container, manifest, interval, maxHeight, reducedMotion) {
    if (!manifest.length) return;

    var rotator = document.createElement('div');
    rotator.className = 'ttg-ad-rotator';

    var link = document.createElement('a');
    link.className = 'ttg-ad-banner-link ttg-ad-rotator__link';

    var img = document.createElement('img');
    img.className = 'ttg-ad-img ttg-ad-rotator__img inhouse-ad-img';
    img.loading = 'lazy';
    img.decoding = 'async';

    link.appendChild(img);
    rotator.appendChild(link);

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(rotator);

    var storageKey = (container.id || container.getAttribute('data-ad-label') || container.dataset.ttgAdManifest || 'default') + ':' + window.location.pathname;
    var index = getStartIndex(manifest, storageKey);
    applyEntry(rotator, link, img, manifest[index], maxHeight);

    if (reducedMotion || manifest.length < 2) {
      return;
    }

    var nextIndex = function(current) {
      return (current + 1) % manifest.length;
    };

    var currentIndex = index;
    var timer = null;

    function fadeSwap(newEntry) {
      img.classList.add('ttg-ad-rotator__img--fade');

      setTimeout(function() {
        applyEntry(rotator, link, img, newEntry, maxHeight);
        requestAnimationFrame(function() {
          img.classList.remove('ttg-ad-rotator__img--fade');
        });
      }, 180);
    }

    function scheduleNext() {
      timer = window.setTimeout(function() {
        var upcomingIndex = nextIndex(currentIndex);
        var upcoming = manifest[upcomingIndex];
        preloadImage(upcoming.src).finally(function() {
          fadeSwap(upcoming);
          currentIndex = upcomingIndex;
          scheduleNext();
        });
      }, interval);
    }

    scheduleNext();

    container.addEventListener('ttg:ad-rotator:destroy', function() {
      if (timer) {
        window.clearTimeout(timer);
      }
    });
  }

  function initRotators() {
    var containers = document.querySelectorAll('[' + ATTR_ROTATOR + '="true"]');
    if (!containers.length) return;

    containers.forEach(function(container) {
      var manifestUrl = container.getAttribute(ATTR_MANIFEST) || '/assets/ads/manifest.json';
      var interval = parseInt(container.getAttribute(ATTR_INTERVAL), 10);
      var maxHeight = parseInt(container.getAttribute(ATTR_MAX_HEIGHT), 10);
      var effectiveInterval = !Number.isNaN(interval) && interval > 0 ? interval : DEFAULT_INTERVAL;
      var effectiveMaxHeight = !Number.isNaN(maxHeight) && maxHeight > 0 ? maxHeight : null;
      var reducedMotion = prefersReducedMotion();

      fetchManifest(manifestUrl).then(function(manifest) {
        createRotator(container, manifest, effectiveInterval, effectiveMaxHeight, reducedMotion);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRotators);
  } else {
    initRotators();
  }
})();
