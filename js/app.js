/* FishkeepingLifeCo — app.js (non-module)
   Purpose: Populate species select, honor Quantity input, render stock & bars,
   and compute Aggression + warnings.
*/

/* ------------------ Helpers ------------------ */
function toArray(x){ return Array.isArray(x) ? x : x ? [x] : []; }
function norm(s){ return (s==null?'':String(s)).trim().toLowerCase(); }
function canonName(s){
  return norm(s).replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\s*\([^)]*\)\s*/g,' ').trim();
}
function formatName(raw){
  if(!raw) return '';
  return String(raw)
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}
function safeQty(raw){
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    let n = Math.floor(raw);
    if (n < 1) n = 1;
    if (n > 999) n = 999;
    return n;
  }
  const s = (raw==null?'':String(raw)).replace(/[^\d]/g,'').slice(0,3);
  let n2 = parseInt(s,10);
  if (isNaN(n2) || n2 < 1) n2 = 1;
  if (n2 > 999) n2 = 999;
  return n2;
}

/* ------------------ Global refs ------------------ */
var $select, $search, $recMin, $qty, $tbody;
var $bioFill, $aggFill, $envFill, $warnBox;

/* Quick index by canonical name for data lookups */
var DATA = (function(){
  var arr = toArray(window.FISH_DATA);
  var map = Object.create(null);
  for (var i=0;i<arr.length;i++){
    var n = canonName(arr[i].name || arr[i].id || '');
    if (n) map[n] = arr[i];
  }
  return { list: arr, byName: map };
})();

/* ------------------ Species dropdown ------------------ */
function populateSelect(){
  if (!$select || $select.options.length) return;

  var items = DATA.list
    .map(function(o){
      return {
        name: o && (o.name || o.id) || '',
        min:  (o && (o.min || o.recommendedMinimum || o.group)) || 1
      };
    })
    .filter(function(x){ return x.name; })
    .sort(function(a,b){ return a.name.localeCompare(b.name); });

  var frag = document.createDocumentFragment();
  items.forEach(function(it){
    var opt = document.createElement('option');
    opt.value = it.name;
    opt.textContent = it.name;
    opt.dataset.min = String(it.min || 1);
    frag.appendChild(opt);
  });
  $select.appendChild(frag);

  updateRecMin();
}

function updateRecMin(){
  if (!$recMin || !$select) return;
  var opt = $select.selectedOptions && $select.selectedOptions[0];
  var min = opt ? parseInt(opt.dataset.min || '1',10) || 1 : 1;
  $recMin.value = String(min);
}

function filterSelect(){
  var q = norm($search.value || '');
  var opts = Array.from($select.options);
  var firstVisible = null;
  opts.forEach(function(o){
    var hit = !q || norm(o.textContent).indexOf(q) !== -1;
    o.hidden = !hit;
    if (hit && !firstVisible) firstVisible = o;
  });
  if (firstVisible){
    $select.value = firstVisible.value;
    updateRecMin();
  }
}

/* ------------------ Stock table ------------------ */
function findRowByName(name){
  var want = canonName(name);
  var rows = $tbody.querySelectorAll('tr');
  for (var i=0;i<rows.length;i++){
    var cell = rows[i].querySelector('td');
    var cur = canonName(cell ? cell.textContent : '');
    if (cur === want) return rows[i];
  }
  return null;
}

function readStock(){
  var rows = Array.from($tbody.querySelectorAll('tr'));
  return rows.map(function(tr){
    var tds = tr.querySelectorAll('td');
    var nm  = (tds[0] && tds[0].textContent) || '';
    var inp = (tds[1] && tds[1].querySelector('input'));
    var q   = safeQty(inp && inp.value ? inp.value : '0');
    return nm ? { name:nm, qty:q } : null;
  }).filter(Boolean);
}

function addRow(name, qty){
  var tr = document.createElement('tr');

  var tdName = document.createElement('td');
  tdName.textContent = formatName(name);

  var tdQty = document.createElement('td');
  var input = document.createElement('input');
  input.type = 'number';
  input.min  = '0';
  input.step = '1';
  input.inputMode = 'numeric';
  input.style.width = '64px';
  input.value = String(qty);
  input.addEventListener('input', renderAll);
  input.addEventListener('change', renderAll);
  tdQty.appendChild(input);

  var tdAct = document.createElement('td');
  tdAct.style.textAlign = 'right';
  var bMinus = document.createElement('button');
  bMinus.className = 'btn'; bMinus.textContent = '−'; bMinus.style.marginRight='6px'; bMinus.type='button';
  var bPlus  = document.createElement('button');
  bPlus.className  = 'btn'; bPlus.textContent = '+'; bPlus.style.marginRight='6px'; bPlus.type='button';
  var bDel   = document.createElement('button');
  bDel.className   = 'btn'; bDel.textContent = 'Delete'; bDel.style.background='var(--bad)'; bDel.type='button';

  bMinus.addEventListener('click', function(){
    var v = safeQty(input.value) - 1;
    if (v <= 0) { tr.remove(); renderAll(); return; }
    input.value = String(v); renderAll();
  });
  bPlus.addEventListener('click', function(){
    input.value = String(safeQty(input.value) + 1); renderAll();
  });
  bDel.addEventListener('click', function(){
    tr.remove(); renderAll();
  });

  tdAct.appendChild(bMinus);
  tdAct.appendChild(bPlus);
  tdAct.appendChild(bDel);

  tr.appendChild(tdName);
  tr.appendChild(tdQty);
  tr.appendChild(tdAct);
  $tbody.appendChild(tr);
}

function addOrUpdate(name, deltaQty){
  var tr = findRowByName(name);
  if (tr){
    var inp = tr.querySelector('td:nth-child(2) input');
    var v = safeQty(inp.value) + deltaQty;
    if (v <= 0){ tr.remove(); renderAll(); return; }
    inp.value = String(v);
    renderAll();
    return;
  }
  if (deltaQty > 0){
    addRow(name, deltaQty);
    renderAll();
  }
}

/* ------------------ Bars: Bioload ------------------ */
function bioloadUnits(){
  var stock = readStock();
  var total = 0;
  for (var i=0;i<stock.length;i++){
    var item = stock[i];
    var data = DATA.byName[canonName(item.name)];
    var pts = data && Number(data.points) ? Number(data.points) : 1.0;
    total += pts * (item.qty || 0);
  }
  return total;
}
function capacityUnits(){
  var gal = parseFloat(document.getElementById('gallons')?.value || '0') || 0;
  var planted = !!document.getElementById('planted')?.checked;
  var filtSel = document.getElementById('filtration');
  var filt = (filtSel && filtSel.value) || 'standard';
  var perGal = 0.9;
  var filtFactor = (filt==='low') ? 0.80 : (filt==='high') ? 1.25 : 1.0;
  var plantedBonus = planted ? 1.10 : 1.0;
  return Math.max(1, gal * perGal) * filtFactor * plantedBonus;
}
function renderBioload(){
  if (!$bioFill) return;
  var pct = (bioloadUnits() / capacityUnits()) * 100;
  if (!isFinite(pct) || pct < 0) pct = 0;
  if (pct > 160) pct = 160;
  $bioFill.style.width = pct.toFixed(1) + '%';
}

/* ------------------ Bars: Environmental Fit ------------------ */
function getRange(obj, key){
  var r = obj && obj[key];
  if (!r || r.length !== 2) return null;
  var a = Number(r[0]), b = Number(r[1]);
  if (!isFinite(a) || !isFinite(b)) return null;
  if (a > b){ var t=a; a=b; b=t; }
  return [a,b];
}
function rangeUnion(rs){
  var lo = +Infinity, hi = -Infinity;
  for (var i=0;i<rs.length;i++){
    lo = Math.min(lo, rs[i][0]);
    hi = Math.max(hi, rs[i][1]);
  }
  return [lo,hi];
}
function rangeIntersect(rs){
  var lo = -Infinity, hi = +Infinity;
  for (var i=0;i<rs.length;i++){
    lo = Math.max(lo, rs[i][0]);
    hi = Math.min(hi, rs[i][1]);
  }
  return [lo,hi];
}
function span(r){ return (r[1]-r[0]); }

function renderEnvFit(){
  if (!$envFill) return;
  var stock = readStock();
  if (stock.length <= 1){ $envFill.style.width = '0%'; return; }

  var temps = [], phs = [];
  for (var i=0;i<stock.length;i++){
    var d = DATA.byName[canonName(stock[i].name)];
    var t = getRange(d, 'temp');
    var p = getRange(d, 'ph');
    if (t) temps.push(t);
    if (p) phs.push(p);
  }
  if (temps.length < 2 && phs.length < 2){ $envFill.style.width='0%'; return; }

  function fit(rs){
    if (rs.length < 2) return 1;
    var uni = rangeUnion(rs);
    var inter = rangeIntersect(rs);
    var uniW = Math.max(0, span(uni));
    var interW = Math.max(0, span(inter));
    if (inter[1] === inter[0] && rs.length >= 2){ interW = 0.25; }
    if (uniW <= 0) return 1;
    var ratio = interW / uniW;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    return ratio;
  }

  var tFit = fit(temps);
  var pFit = fit(phs);
  var avg = (tFit + pFit) / 2;
  var pct = Math.round(avg * 100);
  $envFill.style.width = pct + '%';
}

/* ------------------ Bars: Aggression + Warning bubbles ------------------ */
/*
  Simple rule engine (weights add up to form %):
  - Species-only tank (single species), except male bettas: minimal movement (10%).
  - Male betta with any other fish: high risk with long-finned/bright small fish.
  - Known fin-nippers with long-finned fish: add medium/high.
  - Under-schooling (qty < min): mild → moderate depending gap.
  - Territorial large/semi-aggressive species in small tanks: mild→moderate.
  - Stacking multiple warnings sums up; cap at 100.
*/
var FIN_NIPPERS = [
  'tiger barb','serpae tetra','columbian tetra','black skirt tetra',
  'skunk barb','sumatra barb','red tail shark'
];
var LONG_FINNED = [
  'angelfish','guppy','betta','gourami','pearl gourami','dwarf gourami'
];

function hasAny(names, targets){
  var set = targets.map(canonName);
  for (var i=0;i<names.length;i++){
    if (set.indexOf(canonName(names[i])) !== -1) return true;
  }
  return false;
}

function computeAggression(stock){
  var warnings = []; // { text, severity: 'mild|moderate|severe', weight }
  var score = 0;

  if (stock.length === 0) return { score:0, warnings:[] };

  // Names & map for quick lookups
  var names = stock.map(function(s){ return s.name; });
  var cset = names.map(canonName);

  function addWarn(text, severity, weight){
    warnings.push({ text, severity, weight });
    score += weight;
  }

  // Species-only tank (single species) → light movement (unless male bettas)
  if (stock.length === 1){
    var only = canonName(stock[0].name);
    if (only.indexOf('betta') !== -1){
      addWarn('Male bettas are territorial, even alone.', 'moderate', 35);
    } else {
      // keep some motion so bar isn’t dead-flat, but very low
      score = Math.min(score, 10);
    }
    return { score: Math.max(0, Math.min(100, score)), warnings };
  }

  // 1) Male betta + others
  var hasBetta = cset.some(function(n){ return n.indexOf('betta') !== -1; });
  if (hasBetta){
    // long-finned or flashy small fish present?
    var riskyLongFins = cset.some(function(n){
      return LONG_FINNED.some(function(L){ return n.indexOf(canonName(L)) !== -1; }) && n.indexOf('betta') === -1;
    });
    if (riskyLongFins){
      addWarn('Betta with long-finned/flashy tankmates can nip or be nipped.', 'severe', 60);
    } else {
      addWarn('Betta with community fish can be unpredictable.', 'moderate', 35);
    }
  }

  // 2) Fin-nippers with long-finned species
  var hasNippers = cset.some(function(n){
    return FIN_NIPPERS.some(function(f){ return n.indexOf(canonName(f)) !== -1; });
  });
  var hasLongFins = cset.some(function(n){
    return LONG_FINNED.some(function(f){ return n.indexOf(canonName(f)) !== -1; });
  });
  if (hasNippers && hasLongFins){
    addWarn('Fin-nippers with long-finned fish — high nip risk.', 'severe', 50);
  }

  // 3) Under-schooling (qty < min)
  for (var i=0;i<stock.length;i++){
    var nm = canonName(stock[i].name);
    var spec = DATA.byName[nm];
    var min = spec && (spec.min || spec.recommendedMinimum || spec.group) || 1;
    var qty = stock[i].qty || 0;
    if (min > 1 && qty > 0 && qty < min){
      var gap = min - qty;
      if (gap >= 3){
        addWarn(formatName(stock[i].name)+': under-schooled; stress & nipping likely.', 'moderate', 25);
      } else {
        addWarn(formatName(stock[i].name)+': consider adding to its recommended group size.', 'mild', 12);
      }
    }
  }

  // 4) Territorial large/semi-aggressive in small tanks (rough heuristic)
  var gal = parseFloat(document.getElementById('gallons')?.value || '0') || 0;
  var territorial = ['angelfish','bristlenose pleco','apistogramma','ram cichlid'];
  var hasTerritorial = cset.some(function(n){
    return territorial.some(function(t){ return n.indexOf(canonName(t)) !== -1; });
  });
  if (hasTerritorial && gal < 30){
    addWarn('Territorial species in small tanks may chase/guard space.', 'moderate', 20);
  }

  // Cap and return
  if (score > 100) score = 100;
  if (score < 0) score = 0;
  return { score, warnings };
}

function renderAggression(){
  if (!$aggFill) return;
  var stock = readStock();

  var res = computeAggression(stock);
  $aggFill.style.width = Math.round(res.score) + '%';

  // Render warning bubbles
  if ($warnBox){
    $warnBox.innerHTML = '';
    if (res.warnings.length){
      var frag = document.createDocumentFragment();
      var holder = document.createElement('div');
      holder.className = 'warning-bubbles';
      res.warnings.forEach(function(w){
        var b = document.createElement('div');
        var cls = 'warning-bubble ' +
          (w.severity==='severe' ? 'warning-severe' :
           w.severity==='moderate' ? 'warning-moderate' :
           w.severity==='mild' ? 'warning-mild' : 'warning-info');
        b.className = cls;
        b.textContent = w.text;
        holder.appendChild(b);
      });
      frag.appendChild(holder);
      $warnBox.appendChild(frag);
    }
  }
}

/* ------------------ Render orchestration ------------------ */
function renderAll(){
  renderBioload();
  renderAggression();
  renderEnvFit();
}

/* ------------------ Boot ------------------ */
window.addEventListener('load', function(){
  // Grab refs
  $select = document.getElementById('fishSelect');
  $search = document.getElementById('fishSearch');
  $recMin = document.getElementById('recMin');
  $qty    = document.getElementById('fQty');
  $tbody  = document.getElementById('tbody');
  $bioFill= document.getElementById('bioBarFill');
  $aggFill= document.getElementById('aggBarFill');
  $envFill= document.getElementById('envBarFill');
  $warnBox= document.getElementById('aggression-warnings');

  // Populate species
  populateSelect();

  // Wire search & selection changes
  if ($search) $search.addEventListener('input', filterSelect);
  if ($select) $select.addEventListener('change', updateRecMin);

  // Add button (respect Quantity field; fall back to rec min only when empty)
  var addBtn = document.getElementById('addFish');
  if (addBtn){
    addBtn.addEventListener('click', function(e){
      e.preventDefault();
      var name = $select && $select.value ? $select.value : '';
      if (!name) return;

      var fieldRaw = $qty ? $qty.value : '';
      var hasUserValue = fieldRaw != null && String(fieldRaw).trim().length > 0;
      var qty = hasUserValue ? safeQty(fieldRaw)
                             : safeQty($recMin && $recMin.value ? $recMin.value : '1');

      addOrUpdate(name, qty);
    });
  }

  // Enter to add
  if ($qty){
    $qty.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){
        e.preventDefault();
        var name = $select && $select.value ? $select.value : '';
        if (!name) return;
        var fieldRaw = $qty.value;
        var has = fieldRaw != null && String(fieldRaw).trim().length > 0;
        var qty = has ? safeQty(fieldRaw)
                      : safeQty($recMin && $recMin.value ? $recMin.value : '1');
        addOrUpdate(name, qty);
      }
    });
  }

  // Clear stock
  var resetBtn = document.getElementById('reset');
  if (resetBtn){
    resetBtn.addEventListener('click', function(e){
      e.preventDefault();
      $tbody.innerHTML = '';
      renderAll();
    });
  }

  // Tank control hooks for live bar updates
  ['gallons','planted','filtration'].forEach(function(id){
    var el = document.getElementById(id);
    if (el){
      el.addEventListener('input', renderAll);
      el.addEventListener('change', renderAll);
    }
  });

  // Initial bars
  renderAll();
});