(() => {
  const $ = sel => document.querySelector(sel);
  const tabs = document.querySelectorAll('.jdash__tab');
  const panels = {
    nitrate: $('#panel-nitrate'),
    dosing:  $('#panel-dosing'),
    maint:   $('#panel-maint')
  };

  // Tabs with persistence
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('is-active'));
    Object.values(panels).forEach(p => p.classList.remove('is-active'));
    btn.classList.add('is-active');
    panels[btn.dataset.tab].classList.add('is-active');
    localStorage.setItem('jdash.tab', btn.dataset.tab);
    if (window.dispatchEvent) window.dispatchEvent(new Event('resize'));
  }));
  const last = localStorage.getItem('jdash.tab');
  if (last && panels[last]) document.querySelector(`.jdash__tab[data-tab="${last}"]`)?.click();

  // Data loader (JSON → CSV fallback)
  async function loadJournal() {
    const bust = `?v=${Date.now()}`;
    try {
      const r = await fetch(`/data/journal.json${bust}`, { cache:'no-store' });
      if (!r.ok) throw new Error('json missing');
      return await r.json();
    } catch {
      const r = await fetch(`/data/journal.csv${bust}`, { cache:'no-store' });
      if (!r.ok) throw new Error('csv missing');
      const text = await r.text();
      const [head, ...rows] = text.trim().split(/\r?\n/);
      const keys = head.split(',').map(s=>s.trim());
      return rows.map(line => {
        const cols = line.split(',').map(s=>s.trim());
        const o = {};
        keys.forEach((k,i)=> o[k] = cols[i] ?? '');
        if (o.nitrate !== undefined && o.nitrate !== '') o.nitrate = +o.nitrate;
        if (o.thrive  !== undefined && o.thrive  !== '') o.thrive  = +o.thrive;
        if (o.excel   !== undefined && o.excel   !== '') o.excel   = +o.excel;
        return o;
      });
    }
  }

  // Helpers
  const isWC = v => (v?.toLowerCase?.() || '') === 'water_change';
  function startOfWeekSun(d){
    const nd = new Date(d); nd.setHours(0,0,0,0);
    nd.setDate(nd.getDate() - nd.getDay()); return nd;
  }

  function normalize(rows){
    const data = rows.filter(r => r.date).sort((a,b)=> new Date(a.date) - new Date(b.date));

    // Nitrate + WC dots
    const nitrate = [];
    const wcDots = [];
    for (const r of data){
      if (r.nitrate !== undefined && r.nitrate !== '' && r.nitrate !== null){
        const point = { x: new Date(r.date), y: +r.nitrate };
        nitrate.push(point);
        if (isWC(r.event)) wcDots.push({ ...point });
      }
    }

    // Weekly dosing (Sun–Sat)
    const weeks = new Map();
    for (const r of data){
      if (r.thrive || r.excel){
        const s = startOfWeekSun(new Date(r.date));
        const key = s.toISOString().slice(0,10);
        const e = new Date(s); e.setDate(s.getDate()+6);
        const label = `${s.toLocaleDateString(undefined,{month:'short',day:'numeric'})}–${e.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;
        const cur = weeks.get(key) || { start:s, label, thrive:0, excel:0 };
        cur.thrive += +r.thrive||0; cur.excel += +r.excel||0;
        weeks.set(key, cur);
      }
    }
    const dosing = [...weeks.values()].sort((a,b)=> a.start - b.start);

    // Maintenance list
    const maint = data
      .filter(r => r.event && !/reading/i.test(r.event))
      .map(r => ({ date:new Date(r.date), type:r.event }));

    return { nitrate, wcDots, dosing, maint };
  }

  // Crosshair plugin
  const crosshair = {
    id:'crosshair',
    afterDatasetsDraw(chart){
      const act = chart.getActiveElements?.()[0];
      if(!act) return;
      const { ctx, chartArea:{ top, bottom } } = chart;
      const x = act.element.x;
      ctx.save(); ctx.strokeStyle='rgba(148,163,184,.35)'; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore();
    }
  };

  const targetBand = {
    id:'targetBand',
    beforeDatasetsDraw(chart, args, opts){
      if (!opts || !chart.chartArea) return;
      const { ctx, chartArea:{left, right}, scales:{y} } = chart;
      if (!y) return;
      const top = y.getPixelForValue(opts.max ?? 20);
      const bottom = y.getPixelForValue(opts.min ?? 0);
      ctx.save();
      ctx.fillStyle = opts.color || 'rgba(59,130,246,0.12)';
      ctx.fillRect(left, Math.min(top, bottom), right - left, Math.abs(bottom - top));
      ctx.restore();
    }
  };

  Chart.register(crosshair, targetBand);

  function renderNitrate(ctx, s){
    return new Chart(ctx, {
      type: 'line',
      data: { datasets: [
        { label:'Nitrate (ppm)', data:s.nitrate, borderColor:'#3b82f6', backgroundColor:'#3b82f6', pointRadius:4, tension:.3, borderWidth:3, fill:false },
        { label:'Water-change day', data:s.wcDots, type:'scatter', pointRadius:5, pointBackgroundColor:'#f59e0b', pointBorderColor:'#f59e0b' }
      ]},
      options: {
        responsive:true,
        parsing:false,
        interaction:{ mode:'index', intersect:false },
        scales: {
          x: { type:'time', time:{ unit:'day', tooltipFormat:'MMM d' }, ticks:{ maxRotation:40, autoSkip:true, autoSkipPadding:8 },
               grid:{ color:'rgba(148,163,184,.20)' } },
          y: { title:{ display:true, text:'ppm' }, suggestedMin:0, suggestedMax:25, grid:{ color:'rgba(148,163,184,.25)', borderDash:[4,4] } }
        },
        plugins: {
          legend:{ labels:{ usePointStyle:true } },
          targetBand: { min:0, max:20, color:'rgba(59,130,246,0.12)' }
        }
      }
    });
  }

  function renderDosing(ctx, rows){
    return new Chart(ctx, {
      type:'bar',
      data: {
        labels: rows.map(r=>r.label),
        datasets: [
          { label:'Thrive Plus (pumps)', data: rows.map(r=>r.thrive), backgroundColor:'#10b981', stack:'d' },
          { label:'Seachem Excel (capfuls)', data: rows.map(r=>r.excel), backgroundColor:'#8b5cf6', stack:'d' }
        ]
      },
      options:{
        responsive:true,
        scales:{
          x:{ ticks:{ maxRotation:28, minRotation:28 }, grid:{ color:'rgba(148,163,184,.20)' } },
          y:{ beginAtZero:true, grid:{ color:'rgba(148,163,184,.25)', borderDash:[4,4] } }
        },
        interaction:{ mode:'index', intersect:false }
      }
    });
  }

  function renderMaint(listEl, items){
    listEl.innerHTML = items.length
      ? items.map(m => `<div class="jdash__card"><strong>${m.date.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</strong> — ${String(m.type).replace(/_/g,' ')}</div>`).join('')
      : '<div class="jdash__card">No maintenance entries yet.</div>';
  }

  // Bootstrap
  loadJournal().then(rows => {
    const s = normalize(rows);
    const nitrate = renderNitrate(document.getElementById('nitrateChart'), s);
    const dosing  = renderDosing(document.getElementById('dosingChart'), s.dosing);
    tabs.forEach(b => b.addEventListener('click', () => { nitrate.resize(); dosing.resize(); }));
    renderMaint(document.getElementById('maintList'), s.maint);
  }).catch(err => {
    console.error('Journal load failed', err);
    $('#jdash')?.insertAdjacentHTML('beforeend', '<p class="jdash__card">Could not load /data/journal.json or CSV.</p>');
  });
})();
