# Blockers

- Unable to install Python package `beautifulsoup4` due to corporate proxy returning HTTP 403 for PyPI. Implemented custom HTML parser instead, but this may limit complex parsing capabilities.
- Playwright browser binaries (Chromium) cannot be downloaded because https://cdn.playwright.dev/... requests return HTTP 403 (forbidden). This blocked execution of required coverage/network capture runs.
