/**
 * Async Font Loading Handler
 *
 * Handles the media attribute swap for async font loading.
 * Replaces inline onload="this.media='all'" handlers.
 *
 * Usage:
 * 1. Add data-font-loader attribute to font link tags
 * 2. <link rel="stylesheet" href="..." media="print" data-font-loader>
 * 3. Include this script: <script src="/js/font-loader.js" defer></script>
 */
document.addEventListener('DOMContentLoaded', function() {
  var fontLinks = document.querySelectorAll('link[data-font-loader]');

  fontLinks.forEach(function(link) {
    // If already loaded (cached), switch media immediately
    if (link.sheet) {
      link.media = 'all';
    } else {
      // Set up load handler for async loading
      link.onload = function() {
        this.media = 'all';
        this.onload = null; // Clean up
      };
    }
  });
});
