# Legacy HTML Stubs

- **/404.html**
  - Canonical: None
  - Internal inlinks: 0
  - Redirect snippet: `window.location.pathname;
        if (path && path.endsWith('.html')) {
          var candidate = path.slice(0, -5);
          if (candidate && !candidate.endsWith('/')) {
            window.location.`
  - Rationale: Non-canonical HTML stub redirecting to canonical URL.

