(function() {
  var HOUSE_ADS = [
    {
      id: 'ttg-house-ad-daily-journal',
      src: '/assets/img/ads/Daily-tank-journal-ad.PNG',
      href: '/store.html',
      alt: 'Daily Tank Journal promo banner'
    },
    {
      id: 'ttg-house-ad-planted-journal',
      src: '/assets/img/ads/Planted-daily-tank-journal-ad.PNG',
      href: '/store.html',
      alt: 'Planted Daily Tank Journal promo banner'
    },
    {
      id: 'ttg-house-ad-life-in-balance',
      src: '/assets/img/ads/IMG_2870.jpeg',
      href: 'https://www.amazon.com/dp/B0FR299HW7/ref=cm_sw_r_as_gl_api_gl_i_XAD96V0ES00XR0ZGM8AT?linkCode=ml1&tag=fishkeepingli-20&linkId=49a3f894baf2831850d234ec7c63d26d',
      alt: 'Life in Balance – The Hidden Magic of Aquariums book promo banner'
    },
    {
      id: 'ttg-house-ad-coloring-books',
      src: '/assets/img/ads/Coloring-books.JPG',
      href: '/store.html',
      alt: 'Aquarium coloring books promo banner'
    }
  ];

  if (typeof window !== 'undefined') {
    window.HOUSE_ADS = HOUSE_ADS;
  }

  function isExternal(href) {
    return href.indexOf('http') === 0;
  }

  function getNextIndex(count) {
    try {
      var key = 'ttgHouseAdIndex';
      var stored = localStorage.getItem(key);
      var nextIndex = stored ? (parseInt(stored, 10) + 1) % count : Math.floor(Math.random() * count);
      localStorage.setItem(key, nextIndex);
      return nextIndex;
    } catch (e) {
      return Math.floor(Math.random() * count);
    }
  }

  function selectAd() {
    if (!HOUSE_ADS.length) return null;
    var index = getNextIndex(HOUSE_ADS.length);
    return HOUSE_ADS[index];
  }

  function renderSlots(ad) {
    var slots = document.querySelectorAll('.ttg-house-ad-slot[data-house-ad="rotate"]');
    if (!slots.length || !ad) return;

    slots.forEach(function(slot) {
      while (slot.firstChild) {
        slot.removeChild(slot.firstChild);
      }

      var link = document.createElement('a');
      link.className = 'ttg-ad-banner-link';
      link.href = ad.href;
      link.target = isExternal(ad.href) ? '_blank' : '_self';
      link.rel = isExternal(ad.href) ? 'noopener sponsored' : 'noopener';

      var img = document.createElement('img');
      img.className = 'ttg-ad-img';
      img.src = ad.src;
      img.alt = ad.alt;
      img.loading = 'lazy';

      link.appendChild(img);
      slot.appendChild(link);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      renderSlots(selectAd());
    });
  } else {
    renderSlots(selectAd());
  }
})();
