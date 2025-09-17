// js/aggression.js

// Option 2: boost conflicts by +10, cap at 100, then take the max vs base.
function getAggression(base, conflict) {
  const conflictBoosted = Math.min(100, conflict + 10);
  return Math.max(base, conflictBoosted);
}

// Tiny UI helper: renders a simple aggression bar into a container element.
function renderAggressionBar(container, base, conflict, label = "Aggression") {
  const value = getAggression(base, conflict);

  // container can be an element or an id string
  const el = typeof container === "string" ? document.getElementById(container) : container;
  if (!el) return;

  // wipe previous
  el.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.style.width = "100%";
  wrap.style.margin = "8px 0";

  const lab = document.createElement("label");
  lab.style.display = "block";
  lab.style.marginBottom = "4px";
  lab.textContent = `${label}: ${value}%`;

  const track = document.createElement("div");
  track.style.width = "100%";
  track.style.height = "20px";
  track.style.background = "#e0e0e0";
  track.style.borderRadius = "4px";
  track.style.overflow = "hidden";

  const fill = document.createElement("div");
  fill.style.width = value + "%";
  fill.style.height = "100%";
  fill.style.transition = "width 0.3s ease-in-out";
  fill.style.background =
    value < 40 ? "green" : value < 70 ? "orange" : "red";

  track.appendChild(fill);
  wrap.appendChild(lab);
  wrap.appendChild(track);
  el.appendChild(wrap);

  return value; // in case you need the number
}

// Example usage hook (safe to remove):
// window.addEventListener("DOMContentLoaded", () => {
//   renderAggressionBar("aggression-demo", 70, 20, "Betta");
// });