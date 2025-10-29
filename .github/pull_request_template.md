### Scope
- [ ] Prototype-only changes (must only touch `/prototype-home.html` and `/experiments/**`)
- [ ] Global/site-wide changes (requires @cxchajon review)

### Checklist
- [ ] No edits to `css/style.css`, `index.html`, or `/includes/**` if this is prototype-only.
- [ ] All CSS in `/experiments/` is namespaced under `.proto-home`.

### Prototype Isolation Checklist
- [ ] No files under `/stocking.html`, `/assets/js`, `/assets/css` changed
- [ ] All prototype code under `/prototype/` only
- [ ] `npm run guard:live` passes
