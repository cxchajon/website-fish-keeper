// js/stocking_advisor.js
function $(sel) { return document.querySelector(sel); }

let stock = [];
let FISH  = [];
let FILTERED = [];

/* ---------- Fallback data (used only if fish-data.js didn't register a global) ---------- */
const DEFAULT_FISH = [
  { id:"neon_tetra", name:"Neon tetra", points:1.0, min:6, temp:[72,80], ph:[6.0,7.2] },
  { id:"cardinal_tetra", name:"Cardinal tetra", points:1.2, min:6, temp:[75,82], ph:[4.6,6.8] },
  { id:"tiger_barb", name:"Tiger barb", points:2.5, min:6, temp:[74,79], ph:[6.0,7.0] },
  { id:"guppy", name:"Guppy (male)", points:1.6, min:3, temp:[72,82], ph:[7.0,8.0] },
  { id:"betta_male", name:"Betta (male)", points:6.0, min:1, temp:[78,82], ph:[6.0,7.5] },
  { id:"cory_small", name:"Corydoras (small)", points:2.2, min:6, temp:[72,79], ph:[6.2,7.4] },
  { id:"amano_shrimp", name:"Amano shrimp", points:0.5, min:3 }
];

/* ---------- Detect fish-data.js global ---------- */
function getFishArrayFromWindow() {
  const candidates = [
    window.FISH_DATA,
    window.FISH,
    window.fishData,
    window.fish_list,
    window.fish
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c;
  }
  return [];
}

/* ---------- Bioload ---------- */
function capacity() {
  const gallons    = Number($("#gallons").value || 0);
  const filtration = $("#filtration").value;
  const planted    = $("#planted").checked;
  const filtFactor  = filtration === "high" ? 1.3 : (filtration === "low" ? 0.7 : 1.0);
  const plantFactor = planted ? 1.15 : 1.0;
  return Math.max(0, gallons * filtFactor * plantFactor);
}
function usedPoints() {
  return stock.reduce((acc, item) => {
    const fish = FISH.find(f => f.id === item.id);
    return acc + (fish ? (fish.points * item.qty) : 0);
  }, 0);
}
function updateBioloadBar() {
  const cap = capacity();
  const used = usedPoints();
  const pct = (cap <= 0 || used <= 0) ? 0 : Math.min(100, Math.round((used / cap) * 100));
  $("#barFill").style.width = pct + "%";
}

/* ---------- Aggression (overall = average conflicts only) ---------- */
function updateAggressionBar() {
  const gallons = Number($("#gallons").value || 0);
  const overall = Aggression.overallAverageConflict(stock, FISH, gallons);
  $("#aggBarFill").style.width = overall + "%";
}

/* ---------- Warnings ---------- */
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
    box.style.margin  = "8px 0";
    box.style.borderRadius = "10px";
    box.textContent = issue.message;
    target.appendChild(box);
  });
}
function refreshAggressionWarnings() {
  const gallons = Number($("#gallons").value || 0);
  renderAggressionMessages(Aggression.checkIssues(stock, FISH, gallons));
}

/* ---------- Stock table ---------- */
function renderStock() {
  const tb = $("#tbody");
  tb.innerHTML = "";
  stock.forEach((item, i) => {
    const fish = FISH.find(f => f.id === item.id);
    const qty  = item.qty;
    const gallons = Number($("#gallons").value || 0);
    const agg = Aggression.speciesAggression(item, stock, FISH, gallons);

    const tr  = document.createElement("tr");
    tr.innerHTML = `
      <td>${fish ? fish.name : "(unknown)"}</td>
      <td class="right">${qty}</td>
      <td class="right">
        <span class="mini-bar"><span class="mini-fill" style="width:${agg}%"></span></span>
        <span class="mini-label">${agg}%</span>
      </td>
      <td class="right">
        <div class="controls">
          <button class="ghost" data-act="minus" data-i="${i}">–1</button>
          <button class="ghost" data-act="plus" data-i="${i}">+1</button>
          <button class="ghost" data-act="del" data-i="${i}">Delete</button>
        </div>
      </td>`;
    tb.appendChild(tr);
  });
}

/* ---------- Fish select + search ---------- */
function refreshFishSelect() {
  const select = $("#fishSelect");
  select.innerHTML = "";
  FILTERED.forEach(fish => {
    const opt = document.createElement("option");
    opt.value = fish.id;
    opt.textContent = fish.name;
    select.appendChild(opt);
  });
  updateRecMin();
}
function updateRecMin() {
  const id   = $("#fishSelect").value;
  const fish = FISH.find(f => f.id === id);
  $("#recMin").value = fish ? (fish.min ?? "") : "";
}

/* ---------- Recalc all ---------- */
function refreshAll() {
  updateBioloadBar();
  updateAggressionBar();
  refreshAggressionWarnings();
  renderStock();
}

/* ---------- Events ---------- */
$("#fishSearch").addEventListener("input", (e) => {
  const val = e.target.value.toLowerCase();
  FILTERED = FISH.filter(f => f.name.toLowerCase().includes(val));
  refreshFishSelect();
});
$("#fishSelect").addEventListener("change", updateRecMin);
$("#addFish").addEventListener("click", () => {
  const id  = $("#fishSelect").value;
  const qty = Math.max(1, Number($("#fQty").value || 1));
  if (!id) return;
  const existing = stock.find(s => s.id === id);
  if (existing) existing.qty += qty;
  else stock.push({ id, qty });
  $("#fQty").value = "";
  refreshAll();
});
$("#tbody").addEventListener("click", (e) => {
  if (!e.target || !e.target.dataset.act) return;
  const i = Number(e.target.dataset.i);
  if (!Number.isFinite(i) || !stock[i]) return;
  const act = e.target.dataset.act;
  if (act === "minus") {
    stock[i].qty -= 1;
    if (stock[i].qty <= 0) stock.splice(i, 1);
  } else if (act === "plus") {
    stock[i].qty += 1;
  } else if (act === "del") {
    stock.splice(i, 1);
  }
  refreshAll();
});
$("#reset").addEventListener("click", () => { stock.length = 0; refreshAll(); });
["#filtration", "#planted", "#gallons"].forEach(sel => { $(sel).addEventListener("change", refreshAll); });

/* ---------- Boot ---------- */
window.addEventListener("DOMContentLoaded", () => {
  FISH = getFishArrayFromWindow();
  if (!FISH.length) {
    FISH = DEFAULT_FISH;
    const msg = document.createElement('div');
    msg.textContent = "Using built-in sample species (js/fish-data.js not detected).";
    msg.style.fontSize = "12px";
    msg.style.color = "#6b7280";
    msg.style.marginTop = "6px";
    const speciesCard = document.querySelector(".card + .card"); // the Add Fish card
    speciesCard && speciesCard.insertBefore(msg, speciesCard.firstChild);
    console.warn("No fish data found. Make sure js/fish-data.js exposes a global like window.FISH_DATA.");
  }
  FILTERED = [...FISH];
  refreshFishSelect();
  refreshAll();
});