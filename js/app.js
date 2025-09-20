// js/app.js

import { stock } from "./stock.js";
import { renderStock } from "./render.js";
import { safeQty } from "./utils.js";

document.addEventListener("DOMContentLoaded", () => {
  const speciesSelect = document.getElementById("fishSelect");
  const qtyInput = document.getElementById("fQty");
  const addBtn = document.getElementById("addFish");
  const tbody = document.getElementById("tbody");
  const resetBtn = document.getElementById("reset");

  // populate dropdown
  FISH_DATA.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    speciesSelect.appendChild(opt);
  });

  // add fish
  addBtn.addEventListener("click", () => {
    const id = speciesSelect.value;
    const spec = FISH_DATA.find(f => f.id === id);
    if (!spec) return;

    // FIXED: respect entered value, fallback only if blank
    let qty;
    if (qtyInput.value.trim() === "") {
      qty = spec.min || 1;
    } else {
      qty = safeQty(qtyInput.value);
    }

    stock.add(id, qty);
    render();
  });

  // reset
  resetBtn.addEventListener("click", () => {
    stock.clear();
    render();
  });

  function render() {
    renderStock(tbody);
  }

  render();
});