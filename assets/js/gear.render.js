(function(){
  const CSV_URL = "/data/test_heater.csv"; // test data source
  const SECTION_HEATING = document.querySelector('[data-gear-section="Heating"]') || document.getElementById('gear-heating');

  function parseCSV(text){
    // simple robust CSV parser for quoted commas
    const rows = [];
    let i=0, cur="", inQ=false, row=[];
    for(const ch of text){
      if(ch === '"'){ inQ = !inQ; cur += ch; }
      else if(ch === ',' && !inQ){ row.push(cur.replace(/^"|"$/g,"")); cur=""; }
      else if((ch === '\n' || ch === '\r') && !inQ){
        if(cur.length || row.length){ row.push(cur.replace(/^"|"$/g,"")); rows.push(row); }
        cur=""; row=[];
      } else { cur += ch; }
    }
    if(cur.length || row.length){ row.push(cur.replace(/^"|"$/g,"")); rows.push(row); }
    // to objects
    const [hdr,...data] = rows.filter(r=>r.length>1);
    const idx = Object.fromEntries(hdr.map((h,k)=>[h.trim(),k]));
    return data.map(r=>Object.fromEntries(hdr.map((h,k)=>[h.trim(), (r[k]||"").trim()])));
  }

  function cardHTML(item){
    const asin = AffiliateLinkBuilder.cleanASIN(item.ASIN);
    const href = AffiliateLinkBuilder.buildFromASIN(asin) || item.Amazon_Link || "";
    const img  = item.Image_URL || "";
    const name = item.Product_Name || "Unnamed";
    const desc = item.Description || "";
    const notes= item.Notes || "";
    const range= item.Tank_Size_Range || "";
    const watt = item.Wattage || "";
    return `
      <article class="gear-card" data-card data-category="Heating" data-asin="${asin}">
        <div class="gear-card__media">
          ${img ? `<img src="${img}" alt="${name}" loading="lazy">` : ``}
        </div>
        <div class="gear-card__body">
          <h3 class="gear-card__title">${name}</h3>
          <p class="gear-card__desc">${desc}</p>
          <p class="gear-card__meta">
            ${range ? `<span class="badge">${range}</span>`:``}
            ${watt ? `<span class="badge">${watt}</span>`:``}
            <span class="badge">Heating</span>
          </p>
          ${notes ? `<p class="gear-card__notes">${notes}</p>`:``}
          <div class="gear-card__actions">
            <a class="btn buy-amazon" data-action="buy-amazon" href="${href}" target="_blank" rel="noopener noreferrer">Buy on Amazon</a>
          </div>
        </div>
      </article>
    `;
  }

  function render(items){
    if(!SECTION_HEATING) return;
    SECTION_HEATING.innerHTML = items.map(cardHTML).join("") || `<p class="empty">No heaters yet.</p>`;
    // After render, harden links:
    if(window.__rehardenLinks) window.__rehardenLinks();
    // After harden, initialize dev tester (if present and ?dev=true)
    if(window.__devTesterInit) window.__devTesterInit();
  }

  fetch(CSV_URL, {cache:"no-store"})
    .then(r=>r.ok?r.text():Promise.reject(r.status))
    .then(t=>parseCSV(t))
    .then(rows=>rows.filter(r=> (r.Category||"").toLowerCase()==="heating"))
    .then(render)
    .catch(e=>{
      if(SECTION_HEATING) SECTION_HEATING.innerHTML = `<p class="error">Failed to load test heater data.</p>`;
      console.error("gear.render test load error:", e);
    });
})();
