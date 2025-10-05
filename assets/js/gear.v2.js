(function(){
  /* Utility: simple element builder */
  function el(tag, attrs={}, html=""){
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if(k==="class") n.className=v;
      else if(k==="html") n.innerHTML=v;
      else n.setAttribute(k,v);
    });
    if(html) n.innerHTML = html;
    return n;
  }

  /* Info tips modal (lightweight) */
  function showTip(kind){
    const msg = TIPS[kind] || "No tip available.";
    const wrap = el("div",{class:"tip-wrap",style:"position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:60"});
    const card = el("div",{style:"max-width:520px;background:#0b1220;color:#e5e7eb;border:1px solid #1f2937;border-radius:10px;padding:16px"});
    card.innerHTML = `<h3 style="margin:0 0 8px">Tip</h3><p style="margin:0 0 12px;color:#9ca3af">${msg}</p><button style="padding:8px 12px;background:#111827;color:#e5e7eb;border:1px solid #1f2937;border-radius:6px">Close</button>`;
    card.querySelector("button").onclick = ()=>wrap.remove();
    wrap.onclick = (e)=>{ if(e.target===wrap) wrap.remove(); };
    wrap.appendChild(card); document.body.appendChild(wrap);
  }

  /* Render a category body from data */
  function renderRangeBlock(range){
    const wrap = el("div",{class:"range", "data-range-id":range.id});
    wrap.appendChild(el("p",{class:"range__title"}, range.label));
    if(range.tip) wrap.appendChild(el("p",{class:"range__tip"}, range.tip));
    const list = el("div",{class:"range__list"});
    (range.options||[]).forEach(opt=>{
      const row = el("div",{class:"option"});
      const linkOk = !!opt.href;
      row.innerHTML = `<strong>${opt.label} — ${opt.title || "(add title)"}</strong><br>${ linkOk ? `<a href="${opt.href}" target="_blank" rel="noopener noreferrer">Buy on Amazon</a>` : `<span style="color:#9ca3af">Add link</span>` }`;
      list.appendChild(row);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function buildCategory(kind, container){
    container.innerHTML = ""; // clear
    let blocks = [];
    if(kind==="heaters"){
      blocks = (GEAR.heaters?.ranges||[]).map(renderRangeBlock);
    } else if(kind==="filters"){
      blocks = (GEAR.filters?.ranges||[]).map(renderRangeBlock);
    } else if(kind==="lights"){
      blocks = (GEAR.lights?.ranges||[]).map(renderRangeBlock);
    } else if(kind==="substrate"){
      blocks = (GEAR.substrate?.groups||[]).map(renderRangeBlock);
    }
    blocks.forEach(b=>container.appendChild(b));
  }

  /* Accordion behavior */
  function wireAccordions(){
    document.querySelectorAll('[data-accordion="toggle"]').forEach(h=>{
      h.addEventListener("click", toggle);
      h.addEventListener("keydown", (e)=>{ if(e.key==="Enter"||e.key===" ") toggle.call(h,e); });
      function toggle(e){
        const expanded = this.getAttribute("aria-expanded")==="true";
        const body = document.getElementById(this.getAttribute("aria-controls"));
        this.setAttribute("aria-expanded", String(!expanded));
        this.parentElement.querySelector(".chevron").style.transform = expanded ? "rotate(0deg)" : "rotate(90deg)";
        body.hidden = expanded;
      }
    });
    document.querySelectorAll('.info-btn').forEach(b=> b.addEventListener('click', ()=> showTip(b.getAttribute('data-tip')) ));
  }

  /* Sticky reference: matching + highlighting */
  function matchRange(value, ranges){
    if(!value || isNaN(value)) return null;
    const v = Number(value);
    // choose the first range where v >= min and v <= max; else closest by min distance
    let exact = ranges.find(r => v >= r.min && v <= r.max);
    if(exact) return exact.id;
    // nearest
    let nearest = null, best = Infinity;
    ranges.forEach(r=>{
      const d = v < r.min ? (r.min - v) : (v - r.max);
      if(d < best){ best = d; nearest = r; }
    });
    return nearest ? nearest.id : null;
  }

  function applyHighlights(){
    const gVal = document.getElementById('ref-gallons').value;
    const lVal = document.getElementById('ref-length').value;

    const heaterId = matchRange(gVal, RANGES_HEATERS);
    const filterId = matchRange(gVal, RANGES_FILTERS);
    const lightId  = matchRange(lVal, RANGES_LIGHTS);

    // clear old
    document.querySelectorAll('.range.is-active').forEach(n=>n.classList.remove('is-active'));

    // apply & auto-open section if match
    function activate(sectionSel, id){
      if(!id) return;
      const body = document.querySelector(sectionSel);
      const block = body ? body.querySelector(`[data-range-id="${id}"]`) : null;
      if(block){
        block.classList.add('is-active');
        // open accordion if closed
        const header = body.previousElementSibling;
        if(header && header.getAttribute('aria-expanded')==="false"){
          header.click();
        }
        // ensure body is visible (if user closed after)
        body.hidden = false;
        header.setAttribute("aria-expanded","true");
        header.querySelector(".chevron").style.transform = "rotate(90deg)";
      }
    }

    activate('#heaters-body', heaterId);
    activate('#filters-body', filterId);
    activate('#lights-body',  lightId);
  }

  function wireTankRef(){
    const g = document.getElementById('ref-gallons');
    const l = document.getElementById('ref-length');
    const p = document.getElementById('ref-preset');
    [g,l].forEach(inp => inp.addEventListener('input', applyHighlights));
    p.addEventListener('change', ()=>{
      try{
        const v = JSON.parse(p.value || "{}");
        if(v.g) document.getElementById('ref-gallons').value = v.g;
        if(v.l) document.getElementById('ref-length').value = v.l;
        applyHighlights();
      }catch(_){ }
    });
  }

  /* Init on DOM ready */
  function init(){
    // build categories
    buildCategory("heaters",  document.getElementById('heaters-body'));
    buildCategory("filters",  document.getElementById('filters-body'));
    buildCategory("lights",   document.getElementById('lights-body'));
    buildCategory("substrate",document.getElementById('substrate-body'));
    // wire interactions
    wireAccordions();
    wireTankRef();
  }
  if(document.readyState!=="loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
