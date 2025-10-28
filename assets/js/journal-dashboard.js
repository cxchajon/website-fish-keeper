(() => {
  const $ = s => document.querySelector(s);
  const tabs = document.querySelectorAll('.jdash__tab');
  const panels = {
    nitrate: $('#tab-nitrate'),
    dosing:  $('#tab-dosing'),
    maint:   $('#tab-maint')
  };

  if (window['chartjs-plugin-annotation']) {
    Chart.register(window['chartjs-plugin-annotation']);
  }

  // Tabs
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(b=>b.classList.remove('is-active'));
    Object.values(panels).forEach(p=>p.classList.remove('is-active'));
    btn.classList.add('is-active');
    panels[btn.dataset.tab].classList.add('is-active');
    localStorage.setItem('jdash.tab', btn.dataset.tab);
  }));
  const last = localStorage.getItem('jdash.tab'); if(last && panels[last]){
    document.querySelector(`.jdash__tab[data-tab="${last}"]`)?.click();
  }

  // Fetch data (JSON → CSV fallback)
  async function fetchData() {
    const bust = `?v=${Date.now()}`;
    try {
      const r = await fetch(`/data/journal.json${bust}`);
      if(!r.ok) throw new Error('json not ok');
      return await r.json();
    } catch(e) {
      const r = await fetch(`/data/journal.csv${bust}`);
      if(!r.ok) throw e;
      const text = await r.text();
      // very small CSV parser
      const [head,...rows] = text.trim().split(/\r?\n/);
      const keys = head.split(',').map(h=>h.trim());
      return rows.map(line=>{
        const cols=line.split(',').map(c=>c.trim());
        const o={}; keys.forEach((k,i)=>o[k]=cols[i]);
        if(o.nitrate!==undefined && o.nitrate!=="") o.nitrate = +o.nitrate;
        if(o.thrive!==undefined && o.thrive!=="") o.thrive = +o.thrive;
        if(o.excel!==undefined && o.excel!=="") o.excel = +o.excel;
        return o;
      });
    }
  }

  function fmtDateISO(d){ return new Date(d).toISOString().slice(0,10); }
  function labelMD(d){
    const dt=new Date(d);
    return dt.toLocaleDateString(undefined,{month:'short', day:'numeric'});
  }

  function normalize(rows){
    // ensure sorted, and only current month range shown by default
    const data = rows
      .filter(r=>r.date) // keep dated rows
      .sort((a,b)=> new Date(a.date)-new Date(b.date));

    // nitrate series & wc markers
    const nitrate = [];
    const wcDots  = [];
    for(const r of data){
      if(r.nitrate !== undefined && r.nitrate !== "" && r.nitrate !== null){
        nitrate.push({x: r.date, y: +r.nitrate});
        if((r.event||"").toLowerCase()==="water_change"){
          wcDots.push({x: r.date, y: +r.nitrate});
        }
      }
    }

    // weekly dosing buckets (Sun-Sat)
    const weeks = new Map();
    for(const r of data){
      if(r.thrive || r.excel){
        const d = new Date(r.date);
        const s = new Date(d); s.setDate(d.getDate()-((d.getDay()+7-0)%7)); // start of week (Sun)
        const e = new Date(s); e.setDate(s.getDate()+6);
        const key = fmtDateISO(s);
        const lab = `${s.toLocaleDateString(undefined,{month:'short',day:'2-digit'})}–${e.toLocaleDateString(undefined,{month:'short',day:'2-digit'})}`;
        const cur = weeks.get(key) || {week:lab, thrive:0, excel:0};
        cur.thrive += +r.thrive||0; cur.excel += +r.excel||0;
        weeks.set(key, cur);
      }
    }
    const dosing = [...weeks.values()];

    // maintenance cards
    const maint = data
      .filter(r => (r.event && r.event !== ''))
      .map(r => ({date: r.date, type: r.event}));

    return { nitrate, wcDots, dosing, maint };
  }

  function renderNitrate(ctx, s){
    return new Chart(ctx, {
      type:'line',
      data:{
        datasets:[
          {
            label:'Nitrate (ppm)',
            data:s.nitrate,
            borderWidth:3,
            pointRadius:4,
            borderColor:'#3b82f6',
            backgroundColor:'#3b82f6',
            tension:.3
          },
          {
            label:'Water-change day',
            data:s.wcDots,
            type:'scatter',
            pointRadius:5,
            pointBackgroundColor:'#f59e0b',
            pointBorderColor:'#f59e0b',
            showLine:false
          }
        ]
      },
      options:{
        responsive:true,
        parsing:false,
        scales:{
          x:{
            type:'time',
            adapters:{ date: { } },
            time:{ unit:'day', tooltipFormat:'MMM d' },
            ticks:{
              maxRotation: 40, minRotation: 40,
              autoSkip:true, autoSkipPadding:8,
              callback(v, i, ticks) {
                // keep ~5–6 ticks on mobile
                return i%Math.ceil(ticks.length/6)===0 ? this.getLabelForValue(v) : '';
              }
            },
            grid:{ color:'rgba(148,163,184,.2)' }
          },
          y:{
            title:{ display:true, text:'ppm' },
            suggestedMin:0, suggestedMax:25,
            grid:{ color:'rgba(148,163,184,.25)', borderDash:[4,4] }
          }
        },
        plugins:{
          legend:{ labels:{ usePointStyle:true } },
          tooltip:{ mode:'index', intersect:false },
          annotation:{
            annotations:{
              target:{
                type:'line', yMin:20, yMax:20, borderDash:[6,6],
                borderColor:'#fbbf24',
                label:{ display:true, content:'Target: <20 ppm', backgroundColor:'rgba(0,0,0,.6)' }
              }
            }
          }
        }
      }
    });
  }

  function renderDosing(ctx, rows){
    return new Chart(ctx, {
      type:'bar',
      data:{
        labels: rows.map(r=>r.week),
        datasets:[
          { label:'Thrive Plus (pumps)', data: rows.map(r=>r.thrive), backgroundColor:'#10b981' },
          { label:'Seachem Excel (capfuls)', data: rows.map(r=>r.excel), backgroundColor:'#8b5cf6' }
        ]
      },
      options:{
        responsive:true,
        scales:{
          x:{ ticks:{ maxRotation:30, minRotation:30 }, grid:{ color:'rgba(148,163,184,.2)' } },
          y:{ beginAtZero:true, grid:{ color:'rgba(148,163,184,.25)', borderDash:[4,4] } }
        }
      }
    });
  }

  function renderMaint(listEl, items){
    listEl.innerHTML = items.map(m =>
      `<div class="jdash__card"><strong>${new Date(m.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</strong> — ${m.type.replace(/_/g,' ')}</div>`
    ).join('') || '<div class="jdash__card">No maintenance logged in this window.</div>';
  }

  // Crosshair (simple)
  Chart.register({
    id:'crosshair-lite',
    afterDatasetsDraw(chart, _args, _pluginOptions){
      const act = chart.getActiveElements?.()[0];
      if(!act) return;
      const {ctx, chartArea:{top,bottom}} = chart;
      const x = act.element.x;
      ctx.save(); ctx.strokeStyle='rgba(148,163,184,.35)'; ctx.lineWidth=1;
      ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore();
    }
  });

  // Bootstrap
  fetchData().then(rows=>{
    const s = normalize(rows);
    const nitrateChart = renderNitrate(document.getElementById('nitrateChart'), s);
    const dosingChart  = renderDosing(document.getElementById('dosingChart'), s.dosing);
    renderMaint(document.getElementById('maintList'), s.maint);
    // resize fix on tab switch
    tabs.forEach(b=>b.addEventListener('click', ()=>{
      nitrateChart.resize(); dosingChart.resize();
    }));
  }).catch(err=>{
    console.error('Journal data load failed:', err);
    document.querySelector('.jdash').insertAdjacentHTML('beforeend',
      `<p class="jdash__card">Couldn’t load journal data. Make sure /data/journal.json (or CSV) exists.</p>`);
  });
})();
