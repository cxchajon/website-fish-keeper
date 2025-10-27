# Findings

The standalone `percentBioload` math already reduces the percentage as flow increases (see `prototype/audit_out/filtration_sweep.csv`). However, the live prototype UI never calls that proxy logic. The callgraph shows the filtration chips fire `ttg:recompute`, but `js/stocking.js` still imports the base engine from `./logic/compute.js` (lines 1-13), so the browser keeps using the legacy bioload path that ignores the turnover bonus. That is why turning up GPH on the prototype causes the displayed % to drift upward—it is still governed by the old `computeFiltrationFactor` path that can raise `currentPercent` for stronger filter mixes. 

**Root cause:** the import map in `prototype/stocking-prototype.html` only remaps the absolute specifier `"/js/logic/compute.js"` (lines 1798-1804). Because `js/stocking.js` uses the relative specifier `./logic/compute.js`, the swap never happens, and the UI stays on the unpatched module. To fix the inversion, update the import so the import map can take effect—for example, change the line below to point at the absolute path (or add a matching `"./logic/compute.js"` entry in the import map):

```js
} from './logic/compute.js'; // js/stocking.js:1-13
```

Once the stocker loads `/prototype/js/logic/compute-proxy.js`, the capacity bonus math in that file (see `prototype/audit_out/formula.js`) will finally drive the UI percentage down as filtration increases.
