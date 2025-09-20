/* ===============================
   Compatibility bars (decoupled)
   =============================== */

// tiny helpers
const $ = (id) => document.getElementById(id);
const num = (v) => (parseFloat(v) || 0);

// --- Bioload (unchanged) ---
function renderBioload(){
  const bar = $('bioBarFill');
  if (!bar) return;
  const total = totalBioUnits();
  const cap   = capacityUnits();
  const pct   = Math.max(0, Math.min(160, (total / cap) * 100));
  bar.style.width = pct.toFixed(1) + '%';
  bar.classList.add('pulse'); setTimeout(()=>bar.classList.remove('pulse'), 450);
}

// --- Environmental Fit (Temp & pH) ONLY ---
function renderEnvFit(){
  const bar = $('envBarFill');
  if (!bar) return;

  let pct = 0;
  let notes = [];

  if (window.EnvFit && typeof window.EnvFit.compute === 'function') {
    try {
      const stock = readStock();
      const res = window.EnvFit.compute(stock); // { pct:0-100, warnings:[...] }
      pct   = Math.max(0, Math.min(100, Number(res?.pct) || 0));
      notes = Array.isArray(res?.warnings) ? res.warnings : [];
    } catch(e){}
  }

  bar.style.width = pct + '%';
  bar.classList.add('pulse'); setTimeout(()=>bar.classList.remove('pulse'), 450);

  // Show any env-fit warnings as red bubbles under the Aggression card too
  const warnBox = $('aggression-warnings');
  if (warnBox && notes.length){
    // keep existing aggression warnings, then add env-fit section
    const section = document.createElement('div');
    section.className = 'warning-section';
    section.innerHTML = `<div class="warning-title">Environment</div>`;
    const wrap = document.createElement('div');
    wrap.className = 'warning-bubbles';
    notes.forEach(t=>{
      const b = document.createElement('div');
      b.className = 'warning-bubble warning-severe';
      b.textContent = t;
      wrap.appendChild(b);
    });
    section.appendChild(wrap);
    warnBox.appendChild(section);
  }
}

// --- Aggression & Compatibility ONLY (no env influence) ---
function renderAggression(){
  const bar = $('aggBarFill');
  const box = $('aggression-warnings');
  if (!bar) return;

  let score = 0;      // 0–100
  let warns = [];     // array of strings OR {text,severity}

  if (window.Aggression && typeof window.Aggression.compute === 'function') {
    try {
      const stock = readStock();
      const opts = {
        gallons: num($('gallons')?.value),
        planted: !!$('planted')?.checked
      };
      const res = window.Aggression.compute(stock, opts); // {score,warnings}
      score = Math.max(0, Math.min(100, Number(res?.score) || 0));
      warns = Array.isArray(res?.warnings) ? res.warnings : [];
    } catch(e){}
  }

  // strictly use aggression score (decoupled from env-fit)
  bar.style.width = score + '%';
  bar.classList.add('pulse'); setTimeout(()=>bar.classList.remove('pulse'), 450);

  // render warning bubbles
  if (box){
    // clear only the aggression area; env-fit will append its own section after this
    box.innerHTML = '';
    if (warns.length){
      const section = document.createElement('div');
      section.className = 'warning-section';
      section.innerHTML = `<div class="warning-title">Aggression</div>`;
      const wrap = document.createElement('div');
      wrap.className = 'warning-bubbles';

      warns.forEach(w=>{
        const text = typeof w === 'string' ? w : (w?.text || '');
        const sev  = (typeof w === 'object' && w?.severity) ? String(w.severity) : 'moderate';
        const b = document.createElement('div');
        b.className = `warning-bubble warning-${/severe|high/i.test(sev) ? 'severe' : /mild|low/i.test(sev) ? 'mild' : 'moderate'}`;
        b.textContent = text;
        wrap.appendChild(b);
      });

      section.appendChild(wrap);
      box.appendChild(section);
    }
  }
}

// --- Master render ---
function renderAll(){
  renderBioload();
  renderAggression();   // draw aggression first (clears its box)
  renderEnvFit();       // env-fit may add its own section beneath
}