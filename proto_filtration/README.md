# Prototype Filtration Overrides

This prototype introduces additive filtration controls for `/prototype/stocking-prototype.html` without touching the live stocking route.

## State

The custom module keeps a lightweight filtration state:

```ts
type FilterItem = {
  id: string;
  source: 'product' | 'manual';
  label: string;
  gph: number;
  type?: string;
};

interface FiltrationState {
  filters: FilterItem[];
  tankGallons: number;
}
```

* Product filters are canonicalised with `canonicalizeFilterType` and deduped by `id`.
* Manual filters always use type `HOB` and get a generated `manual-<stamp>` id.

## DOM Hooks

`prototype/js/proto-filtration.js` wires the following elements:

| Element | Selector | Purpose |
| --- | --- | --- |
| Product select | `#filter-product` | Captured `change` events prevent the stock handler and call `handleProductChange`. |
| Manual input | `#filter-rated-gph` | `Enter` adds a manual filter, `input` clears errors. |
| Chip host | `[data-role="proto-filter-chips"]` | Renders filter chips with remove buttons. |
| Summary | `[data-role="proto-filter-summary"]` | Shows the `Filtration: {total} GPH • {turnover}×/h` line. |

The module persists filters to `localStorage` (`ttg.stocking.filters.v1`) and pushes updates back into `window.appState.filters` before dispatching `ttg:recompute`.

## Removal

Each chip has `<button data-remove-filter>` with `aria-label="Remove {label}"`. Clicking, pressing Enter, or Space triggers `removeFilterById` which synchronises state, storage, and app recompute.

