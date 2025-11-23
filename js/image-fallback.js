/**
 * Image Fallback Handler
 *
 * Handles image load errors by swapping to fallback images.
 * Replaces inline onerror="this.onerror=null;this.src='...'" handlers.
 *
 * Usage:
 * 1. Add data-fallback attribute with fallback image URL
 * 2. <img src="original.jpg" data-fallback="/path/to/fallback.jpg" alt="...">
 * 3. Include this script: <script src="/js/image-fallback.js" defer></script>
 */
document.addEventListener('DOMContentLoaded', function() {
  var images = document.querySelectorAll('img[data-fallback]');

  images.forEach(function(img) {
    img.onerror = function() {
      // Prevent infinite loop if fallback also fails
      this.onerror = null;
      this.src = this.dataset.fallback;
    };

    // Check if image already failed to load
    if (img.complete && img.naturalWidth === 0) {
      img.src = img.dataset.fallback;
    }
  });
});
