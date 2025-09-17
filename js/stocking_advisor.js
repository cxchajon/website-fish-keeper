// js/stocking_advisor.js
// This file connects your webpage (index.html) to aggression.js logic.

function $(sel) { return document.querySelector(sel); }

// These will be shared with index.html
let stock = [];
let FISH = window.FISH_DATA || [];

// Refresh the bars, table, and warnings
function refreshAll() {
  // Update bioload bar
  const gallons = Number($("#gallons").value || 0);
  const used = stock.reduce((acc, item) => {
    const fish = FISH.find(f => f.id === item.id);
    return acc + (fish ? (fish.points * item.qty) : 0);
  }, 0);
  const cap = gallons * 1.0; // super simple capacity for now
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  $("#barFill").style.width = pct + "%";

  // Update overall aggression bar (conflicts only)
  const overall = Aggression.overallAverageConflict(stock, FISH, gallons);
  $("#aggBarFill").style.width = overall + "%";

  // Update stock table
  renderStock();

  // Update warnings
  renderAggressionMessages(Aggression.checkIssues(stock, FISH, gallons));
}

function renderStock() {
  const tb = $("#tbody");
  tb.innerHTML = "";
  stock.forEach((item, i) => {
    const fish = FISH.find(f => f.id === item.id);
    const qty  = item.qty;

    const agg = Aggression.speciesAggression(item, stock, FISH, Number($("#gallons").value));

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${fish ? fish.name : "(unknown)"}</td>
      <td class="right">${qty}</td>
      <td class="right">
        <span class="mini-bar"><span class="mini-fill" style="width:${agg}%"></span></span>
        <span class="mini-label">${agg}%</span>
      </td>
      <td class="right">
        <button class="ghost" onclick="updateQty(${i}, -1)">-1</button>
        <button class="ghost" onclick="updateQty(${i}, 1)">+1</button>
        <button class="ghost" onclick="deleteFish(${i})">Delete</button>
      </td>
    `;
    tb.appendChild(row);
  });
}

function updateQty(i, delta) {
  if (!stock[i]) return;
  stock[i].qty += delta;
  if (stock[i].qty <= 0) stock.splice(i, 1);
  refreshAll();
}

function deleteFish(i) {
  stock.splice(i, 1);
  refreshAll();
}

function renderAggressionMessages(issues) {
  const target = $("#aggression-warnings");
  target.innerHTML = "";
  if (!issues.length) {
    target.textContent = "No aggression/compatibility issues detected with the current stock.";
    return;
  }
  issues.forEach(issue => {
    const box = document.createElement("div");
    box.style.border = issue.severity === "danger" ? "2px solid #b91c1c" : "1px solid #c2410c";
    box.style.background = issue.severity === "danger" ? "#fee2e2" : "#ffedd5";
    box.style.padding = "10px";
    box.style.margin = "8px 0";
    box.style.borderRadius = "10px";
    box.textContent = issue.message;
    target.appendChild(box);
  });
}

// Event handlers
$("#addFish").addEventListener("click", () => {
  const id = $("#fishSelect").value;
  const qty = Math.max(1, Number($("#fQty").value || 1));
  const existing = stock.find(item => item.id === id);
  if (existing) existing.qty += qty;
  else stock.push({ id, qty });
  $("#fQty").value = "";
  refreshAll();
});

$("#reset").addEventListener("click", () => {
  stock.length = 0;
  refreshAll();
});

window.addEventListener("DOMContentLoaded", refreshAll);