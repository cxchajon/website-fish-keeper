export function computeEnv({ speciesList = [], planted = false }) {
  const num = v => typeof v === "number" && isFinite(v);
  const rng = r => r && num(r.min) && num(r.max) && r.min < r.max;
  const tRng = r => r && num(r.min_f) && num(r.max_f) && r.min_f < r.max_f;

  // Defaults if empty stock
  if (!speciesList.length) {
    return {
      rows: {
        temperature: { label:"Temperature", value:"74–78 °F", setpoint:76, confidence:"low" },
        ph:          { label:"pH",         value:"6.5–7.5", mode:"soft" },
        gH:          { label:"gH (dGH)",   value:"4–12" },
        kH:          { label:"kH (dKH)",   value:"2–8" },
        salinity:    { label:"Salinity",   value:"Freshwater" },
        flow:        { label:"Flow",       value:"Moderate" },
        blackwater:  { label:"Blackwater / Tannins", value:"Off" },
        turnover:    { label:"Turnover (×/hr)", value: planted ? "6–8×" : "7–9×" }
      },
      advisories: ["Defaults shown. Add species to refine."],
      mismatches: []
    };
  }

  // Collect ranges/flags
  const temps = speciesList.filter(s=>tRng(s.temperature)).map(s=>({id:s.id,name:s.common_name,min:s.temperature.min_f,max:s.temperature.max_f}));
  const phs   = speciesList.filter(s=>rng(s.ph)).map(s=>({id:s.id,name:s.common_name,min:s.ph.min,max:s.ph.max,sens:!!s.ph_sensitive}));
  const ghs   = speciesList.filter(s=>rng({min:s?.gH?.min_dGH, max:s?.gH?.max_dGH})).map(s=>({min:s.gH.min_dGH,max:s.gH.max_dGH}));
  const khs   = speciesList.filter(s=>rng({min:s?.kH?.min_dKH, max:s?.kH?.max_dKH})).map(s=>({min:s.kH.min_dKH,max:s.kH.max_dKH}));
  const flows = speciesList.map(s=>s.flow).filter(Boolean);
  const blacks= speciesList.map(s=>s.blackwater).filter(Boolean);
  const sals  = speciesList.map(s=>s.salinity).filter(Boolean);

  const flowRank = {low:0, moderate:1, high:2}, flowInv = ["Low","Moderate","High"];
  const SAL_ALLOWED = ["fresh","brackish-low","brackish-high","dual"]; // marine not supported
  const salOrderIdx = v => Math.max(0, SAL_ALLOWED.indexOf(v));

  const intersection = (pairs) => {
    if (!pairs.length) return {ok:false,min:NaN,max:NaN};
    const lo = Math.max(...pairs.map(r=>r.min));
    const hi = Math.min(...pairs.map(r=>r.max));
    return {ok: lo < hi, min: lo, max: hi};
  };

  // --- Temperature: HARD mismatch if no intersection
  const tInt = intersection(temps);
  const hardMismatches = [];
  let tempRow;
  if (tInt.ok) {
    const mid = Math.round(((tInt.min+tInt.max)/2));
    tempRow = { label:"Temperature", value:`${Math.round(tInt.min)}–${Math.round(tInt.max)} °F`, setpoint: mid, confidence:"high" };
  } else {
    // Build groups for message: below vs above
    const hiMin = Math.max(...temps.map(t=>t.min));
    const below = temps.filter(t=>t.max <= hiMin).map(t=>`${t.name} (${Math.round(t.min)}–${Math.round(t.max)} °F)`);
    const above = temps.filter(t=>t.min >= hiMin).map(t=>`${t.name} (${Math.round(t.min)}–${Math.round(t.max)} °F)`);
    hardMismatches.push({
      axis:"temperature",
      title:"Not compatible – Temperature",
      reason:"No shared temperature range.",
      details: { below, above }
    });
    tempRow = { label:"Temperature", value:"— (See warning)" };
  }

  // --- Salinity: marine disallowed, fresh+brackish = advisory
  const marineIds = speciesList.filter(s=>s.salinity==="marine").map(s=>s.common_name);
  if (marineIds.length) {
    hardMismatches.push({
      axis:"salinity",
      title:"Not compatible – Salinity (Marine not supported)",
      reason:"Marine species are not supported in this tool.",
      details:{ marine: marineIds }
    });
  }
  let salIdx = 0;
  for (const v of sals) salIdx = Math.max(salIdx, salOrderIdx(v));
  const salLabel = ["Freshwater","Brackish-low","Brackish-high","Dual"][salIdx] || "Freshwater";

  // advisory for mixed fresh+brackish (ignore 'dual')
  const hasFresh = sals.includes("fresh");
  const hasBrack = sals.some(v=>v==="brackish-low"||v==="brackish-high");
  const advisories = [];
  if (!marineIds.length && hasFresh && hasBrack) {
    advisories.push("Mixed freshwater/brackish stock — target brackish-low or use dual-tolerant species.");
  }

  // --- pH: STRICT only if any ph_sensitive and empty intersection
  const anySensitive = phs.some(p=>p.sens);
  const pInt = intersection(phs);
  let phRow;
  if (anySensitive && !pInt.ok) {
    const left = phs.map(p=>`${p.name} (${p.min.toFixed(1)}–${p.max.toFixed(1)})`);
    hardMismatches.push({
      axis:"ph",
      title:"Not compatible – pH (Strict)",
      reason:"A pH-sensitive species requires overlapping pH; none found.",
      details:{ ranges:left }
    });
    phRow = { label:"pH", value:"— (See warning)" };
  } else {
    // soft band (trim tails) or strict intersect if ok
    const lo = Math.max(...phs.map(p=>p.min));
    const hi = Math.min(...phs.map(p=>p.max));
    const unionLo = Math.min(...phs.map(p=>p.min));
    const unionHi = Math.max(...phs.map(p=>p.max));
    const softLo = Math.max(unionLo, unionLo + (unionHi-unionLo)*0.25);
    const softHi = Math.min(unionHi, unionHi - (unionHi-unionLo)*0.25);
    const min = (pInt.ok ? lo : softLo), max = (pInt.ok ? hi : softHi);
    phRow = { label:"pH", value:`${min.toFixed(1)}–${max.toFixed(1)}`, mode: anySensitive ? "strict" : "soft" };
  }

  // --- gH/kH: soft ranges
  const gInt = intersection(ghs); const kInt = intersection(khs);
  const gRow = gInt.ok ? {label:"gH (dGH)", value:`${Math.round(gInt.min)}–${Math.round(gInt.max)}`} :
                         bestOverlapRow("gH (dGH)", ghs);
  const kRow = kInt.ok ? {label:"kH (dKH)", value:`${Math.round(kInt.min)}–${Math.round(kInt.max)}`} :
                         bestOverlapRow("kH (dKH)", khs);
  if (gInt.ok && kInt.ok && gInt.min < 3 && kInt.min < 2) {
    advisories.push("Very soft water — avoid large, rapid pH changes.");
  }

  // --- Flow: pick highest
  const flowValue = flows.length ? flowInv[Math.max(...flows.map(f=>flowRank[f] ?? 1))] : "Moderate";
  const anyFinSensitive = speciesList.some(s=>Array.isArray(s.tags) && s.tags.includes("fin_sensitive"));
  if (flowValue === "High" && anyFinSensitive) {
    advisories.push("High flow recommended — provide calm eddies for long/fragile fins.");
  }

  // --- Blackwater
  let black;
  const requires = blacks.includes("requires");
  const prefers  = blacks.includes("prefers");
  if (requires) black = "Requires"; else if (prefers) black = "Prefers"; else black = "Off";

  // --- Turnover (×/hr) by bioload + planted
  const bioload = speciesList.reduce((t,s)=>t + (num(s.bioload_unit)?s.bioload_unit : Math.max(0.1,(s.adult_size_in||2)*0.1)), 0);
  let turnover;
  if (bioload > 7) turnover = planted ? "8–9×" : "9–10×";
  else if (bioload >= 3) turnover = planted ? "6–7×" : "7–8×";
  else turnover = planted ? "5–6×" : "6–7×";

  const rows = {
    temperature: tempRow,
    ph:          phRow,
    gH:          gRow,
    kH:          kRow,
    salinity:    { label:"Salinity", value: salLabel },
    flow:        { label:"Flow", value: flowValue },
    blackwater:  { label:"Blackwater / Tannins", value: black },
    turnover:    { label:"Turnover (×/hr)", value: turnover }
  };

  return { rows, advisories, mismatches: hardMismatches };

  function bestOverlapRow(label, pairs){
    if (!pairs.length) return {label, value:"—"};
    const mins = pairs.map(r=>r.min).sort((a,b)=>a-b);
    const maxs = pairs.map(r=>r.max).sort((a,b)=>a-b);
    const lo = Math.round(mins[Math.floor(mins.length*0.5)]);
    const hi = Math.round(Math.max(lo+1, maxs[Math.floor(maxs.length*0.5)]));
    return {label, value:`${lo}–${hi}`};
  }
}

export function renderEnvInto(targetEl, data){
  if (!targetEl || !data) return;
  const { rows, advisories } = data;
  targetEl.innerHTML = [
    row(rows.temperature),
    row(rows.ph),
    row(rows.gH),
    row(rows.kH),
    row(rows.salinity),
    row(rows.flow),
    row(rows.blackwater),
    row(rows.turnover),
    advisories?.length ? `<div class="env-advisories">${advisories.map(a=>`<span class="chip">${escapeHtml(a)}</span>`).join("")}</div>` : ""
  ].join("");

  function row(r){
    const sub = r.setpoint ? `Set heater ~${r.setpoint} °F (${r.confidence||"medium"} agreement)` :
               r.mode==="strict" ? "Strict match (pH-sensitive species present)" :
               r.mode==="soft"   ? "Soft match (acclimation okay)" : "";
    return `
      <div class="env-row">
        <div class="env-row__label">${r.label}</div>
        <div class="env-row__value">${escapeHtml(r.value)}</div>
        ${sub ? `<div class="env-row__sub">${escapeHtml(sub)}</div>` : ``}
      </div>`;
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c])); }
}

export function renderWarningsInto(targetEl, data){
  if (!targetEl) return;
  const list = data?.mismatches || [];
  if (!list.length) {
    targetEl.innerHTML = ""; targetEl.hidden = true; return;
  }
  targetEl.hidden = false;
  targetEl.innerHTML = `
    <div class="card__hd"><h2>Warnings</h2></div>
    <div class="warn-list">
      ${list.map(w=>warn(w)).join("")}
    </div>`;
  function warn(w){
    const details = detailHtml(w);
    return `<div class="warn-row">
      <div class="warn-title">⚠️ ${escapeHtml(w.title)}</div>
      <div class="warn-reason">${escapeHtml(w.reason)}</div>
      ${details}
      <div class="warn-reco">Recommendation: ${escapeHtml(recoFor(w.axis))}</div>
    </div>`;
  }
  function detailHtml(w){
    if (w.axis==="temperature") {
      const below = (w.details?.below||[]).join(", ");
      const above = (w.details?.above||[]).join(", ");
      return `<div class="warn-detail"><strong>Cool side:</strong> ${escapeHtml(below)}<br/><strong>Warm side:</strong> ${escapeHtml(above)}</div>`;
    }
    if (w.axis==="ph") {
      const r = (w.details?.ranges||[]).join(", ");
      return `<div class="warn-detail"><strong>pH ranges:</strong> ${escapeHtml(r)}</div>`;
    }
    if (w.axis==="salinity") {
      const m = (w.details?.marine||[]).join(", ");
      return `<div class="warn-detail"><strong>Marine species:</strong> ${escapeHtml(m)}</div>`;
    }
    return "";
  }
  function recoFor(axis){
    if (axis==="temperature") return "Pick species that share a temperature band (swap cool-water or warm-water species).";
    if (axis==="ph")          return "Choose species with overlapping pH or remove the pH-sensitive species.";
    if (axis==="salinity")    return "Remove marine species. This tool supports freshwater and brackish only.";
    return "Adjust stock for environmental compatibility.";
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c])); }
}
