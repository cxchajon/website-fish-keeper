prototype/js/logic/compute-proxy.js L1-L160 — replaced capacity bonus math with loadPlanted · (1 - eff) / capacity canonical flow.
prototype/js/logic/compute-proxy.js L161-L260 — added type blend + plant bonus helpers feeding FILTER_BASE clamps.
prototype/js/logic/compute-proxy.js L261-L340 — patched bioload patcher to pass capacity/mixFactor and expose efficiency debug rows.
prototype/tests/bioload.inversion.test.js — added monotonic filtration regression cases for percent vs GPH & planted bonus.
prototype/tests/bioload.turnover.spec.js L35-L38 — updated zero-capacity expectation to clamp at 200% instead of 0%.
