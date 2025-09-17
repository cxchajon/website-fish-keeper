// js/stocking_advisor.js
// Self-contained Stocking Advisor widget that mounts into #advisor-root
// Uses Aggression Option 2: max(base, min(100, conflict + 10))
// Styles are scoped under #advisor-root to avoid page-wide clashes.

(function () {
  const ROOT_ID = "advisor-root";
  const root = document.getElementById(ROOT_ID);
  if (!root) return; // no-op if container not present

  // Inject scoped styles
  const style = document.createElement("style");
  style.textContent = `
  #${ROOT_ID} { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  #${ROOT_ID} .card { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin:12px 0; box-shadow:0 1px 2px rgba(0,0,0,0.03); }
  #${ROOT_ID} .row { display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; }
  #${ROOT_ID} .row > * { flex:1; min-width:160px; }
  #${ROOT_ID} h2 { margin:0 0 12px; }
  #${ROOT_ID} label { display:block; font-size:14px; margin-bottom:6px; color:#374151; }
  #${ROOT_ID} input, #${ROOT_ID} select, #${ROOT_ID} button {
    width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; font-size:16px; background:#fff; color:#111827;
  }
  #${ROOT_ID} input[readonly]{ background:#f3f4f6; color:#374151; }
  #${ROOT_ID} button { background:#0b84ff; color:#fff; border:none; cursor:pointer; }
  #${ROOT_ID} button:hover { filter:brightness(0.98); }
  #${ROOT_ID} .btn-danger { background:#ef4444; }
  #${ROOT_ID} .btn-success { background:#10b981; }
  #${ROOT_ID} .list { display:flex; flex-direction:column; gap:10px; }
  #${ROOT_ID} .fish-item { border:1px solid #e5e7eb; border-radius:8px; padding:12px; display:grid; grid-template-columns:1fr; gap:10px; }
  @media (min-width:700px){ #${ROOT_ID} .fish-item { grid-template-columns:2fr 1fr auto; align-items:center; } }
  #${ROOT_ID} .fish-title { font-weight:600; }
  #${ROOT_ID} .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; background:#eef2ff; color:#1f2937; border:1px solid #c7d2fe; margin-left:8px; }
  #${ROOT_ID} .warn { font-size:12px; color:#b45309; margin-top:6px; }
  #${ROOT_ID} .danger { color:#b91c1c; }
  #${ROOT_ID} .muted { color:#6b7280; }
  #${ROOT_ID} .toolbar { display:flex; gap:8px; }
  #${ROOT_ID} .footer-note { text-align:center; font-size:12px; color:#6b7280; margin-top:8px; }
  `;
  document.head.appendChild(style);

  // Species “database”
  const SPECIES = [
    { id:"betta_male", name:"Betta (Male)", baseAggression:70, tags:{ longFin:true, territorialMale:true, aggressive:true }, notes:"Long-finned, territorial males should generally be kept solo.", recommendedMin:1 },
    { id:"cardinal_tetra", name:"Cardinal Tetra", baseAggression:20, tags:{ peaceful:true, schooling:true, small:true }, notes:"Peaceful schooling fish. Keep in a group (6+ recommended).", recommendedMin:6 },
    { id:"angelfish", name:"Angelfish", baseAggression:50, tags:{ semiAggressive:true, predator:true, longFin:true }, notes:"Can prey on small fish as they grow. Semi-aggressive.", recommendedMin:1 },
    { id:"guppy", name:"Guppy", baseAggression:15, tags:{ peaceful:true, longFin:true, small:true }, notes:"Peaceful, small, long-finned livebearer.", recommendedMin:3 },
    { id:"dwarf_gourami", name:"Dwarf Gourami", baseAggression:35, tags:{ semiAggressive:true, longFin:true }, notes:"Can be territorial. Long fins.", recommendedMin:1 },
    { id:"zebra_danio", name:"Zebra Danio", baseAggression:25, tags:{ finNipper:true, schooling:true }, notes:"Active, can nip fins if understocked.", recommendedMin:6 },
  ];

  // Build widget markup
  root.innerHTML = `
    <div class="card" id="controlsCard">
      <h2>Stocking Advisor – Aggression (Option 2)</h2>
      <div class="row">
        <div>
          <label for="species">Species</label>
          <select id="species" aria-label="Species selector"></select>
        </div>
        <div>
          <label for="recommended">Recommended minimum (if schooling)</label>
          <input id="recommended" type="number" min="1" value="1" readonly />
        </div>
        <div>
          <label for="qty">Quantity</label>
          <input id="qty" type="number" min="1" value="1" />
        </div>
        <div>
          <button id="addBtn" title="Add fish to tank">Add fish</button>
        </div>
      </div>
      <small id="speciesNotes" class="muted" style="display:block;margin-top:8px;"></small>
    </div>

    <div class="card">
      <h2 style="margin-top:0;">Your Tank</h2>
      <div id="tankList" class="list"></div>
      <div class="toolbar" style="margin-top:10px;">
        <button id="clearBtn" class="btn-danger" title="Remove all fish">Clear tank</button>
      </div>
      <div class="footer-note">Aggression uses: <code>max(base, min(100, conflict + 10))</code> to lean toward conflicts.</div>
    </div>
  `;

  // DOM refs
  const speciesSelect = root.querySelector("#species");
  const recommendedInput = root.querySelector("#recommended");
  const qtyInput = root.querySelector("#qty");
  const addBtn = root.querySelector("#addBtn");
  const speciesNotes = root.querySelector("#speciesNotes");
  const tankListEl = root.querySelector("#tankList");
  const clearBtn = root.querySelector("#clearBtn");

  // Init dropdown
  function initSpeciesDropdown() {
    speciesSelect.innerHTML = "";
    SPECIES.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      speciesSelect.appendChild(opt);
    });
    updateRecommendedUI();
  }
  function updateRecommendedUI() {
    const s = SPECIES.find(x => x.id === speciesSelect.value);
    if (!s) return;
    recommendedInput.value = s.recommendedMin || 1;
    speciesNotes.textContent = s.notes || "";
  }
  speciesSelect.addEventListener("change", updateRecommendedUI);

  // Tank data
  const tank = []; // entries: { id, name, baseAggression, tags, qty, recommendedMin }

  // Option 2 aggression
  function getAggression(base, conflict) {
    const conflictBoosted = Math.min(100, (Number(conflict) || 0) + 10);
    return Math.max(Number(base) || 0, conflictBoosted);
  }

  // Conflict heuristics
  function computeConflictForEntry(entry, allEntries) {
    let conflict = 0;
    const warnings = [];
    const any = (pred) => allEntries.some(e => pred(e));
    const tag = (e, k) => !!(e.tags && e.tags[k]);

    // Multiple territorial male Bettas
    if (tag(entry, "territorialMale") && entry.qty > 1) {
      conflict = Math.max(conflict, 90);
      warnings.push("Multiple territorial males together.");
    }
    // Fin-nippers vs long-fin (conflict on long-fin fish)
    const anyFinNipper = any(e => tag(e, "finNipper") && e.qty > 0);
    if (tag(entry, "longFin") && anyFinNipper) {
      conflict = Math.max(conflict, 70);
      warnings.push("Long fins with fin-nippers.");
    }
    // Peaceful with aggressive/semi-aggressive
    const anyAggressive = any(e => (tag(e, "aggressive") || tag(e, "semiAggressive")) && e.qty > 0);
    if (tag(entry, "peaceful") && anyAggressive) {
      conflict = Math.max(conflict, 60);
      warnings.push("Peaceful fish with aggressive tankmates.");
    }
    // Predator with small fish (conflict on small fish)
    const anyPredator = any(e => tag(e, "predator") && e.qty > 0);
    if (tag(entry, "small") && anyPredator) {
      conflict = Math.max(conflict, 80);
      warnings.push("Predator present with small fish.");
    }
    // Schooling under minimum
    if (tag(entry, "schooling") && entry.qty < (entry.recommendedMin || 6)) {
      conflict = Math.max(conflict, 40);
      warnings.push(`Schooling understocked (have ${entry.qty}, recommend ${entry.recommendedMin || 6}).`);
    }

    return { conflict, warnings };
  }

  // Render helpers
  function renderAggressionBar(container, base, conflict, label = "Aggression") {
    const value = getAggression(base, conflict);
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.margin = "6px 0";

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
    fill.style.background = value < 40 ? "green" : value < 70 ? "orange" : "red";

    track.appendChild(fill);
    wrap.appendChild(lab);
    wrap.appendChild(track);
    container.appendChild(wrap);

    return value;
  }

  function renderTank() {
    tankListEl.innerHTML = "";
    if (tank.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No fish added yet.";
      empty.className = "muted";
      tankListEl.appendChild(empty);
      return;
    }

    tank.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "fish-item";

      const meta = document.createElement("div");
      const title = document.createElement("div");
      title.className = "fish-title";
      title.innerHTML = `${entry.name} <span class="pill">Qty: ${entry.qty}</span>`;
      meta.appendChild(title);

      const barHolder = document.createElement("div");
      const { conflict, warnings } = computeConflictForEntry(entry, tank);
      const agg = renderAggressionBar(barHolder, entry.baseAggression, conflict, "Aggression");

      if (warnings.length) {
        const warn = document.createElement("div");
        warn.className = "warn";
        warn.textContent = "Notes: " + warnings.join(" ");
        if (agg >= 80) warn.classList.add("danger");
        meta.appendChild(warn);
      }

      const actions = document.createElement("div");
      actions.className = "toolbar";
      const addOneBtn = document.createElement("button");
      addOneBtn.textContent = "Add one";
      addOneBtn.className = "btn-success";
      addOneBtn.addEventListener("click", () => { entry.qty += 1; renderTank(); });

      const removeOneBtn = document.createElement("button");
      removeOneBtn.textContent = "Remove one";
      removeOneBtn.className = "btn-danger";
      removeOneBtn.addEventListener("click", () => {
        entry.qty -= 1;
        if (entry.qty <= 0) {
          const i = tank.findIndex(t => t.id === entry.id);
          if (i >= 0) tank.splice(i, 1);
        }
        renderTank();
      });

      actions.appendChild(addOneBtn);
      actions.appendChild(removeOneBtn);

      item.appendChild(meta);
      item.appendChild(barHolder);
      item.appendChild(actions);
      tankListEl.appendChild(item);
    });
  }

  // Events
  addBtn.addEventListener("click", () => {
    const s = SPECIES.find(x => x.id === speciesSelect.value);
    if (!s) return;
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const existing = tank.find(t => t.id === s.id);
    if (existing) existing.qty += qty;
    else tank.push({ ...s, qty });
    renderTank();
  });

  clearBtn.addEventListener("click", () => { tank.splice(0, tank.length); renderTank(); });

  // Boot
  initSpeciesDropdown();
  renderTank();
})();