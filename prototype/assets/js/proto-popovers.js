(function(){
  if(!location.pathname.includes('/prototype/stocking-prototype.html')) return;

  // --- portal root + single panel
  let root=document.getElementById('ttg-proto-popover-root');
  if(!root){ root=document.createElement('div'); root.id='ttg-proto-popover-root'; document.body.prepend(root); }
  let panel=document.getElementById('ttg-proto-pop');
  if(!panel){
    panel=document.createElement('div');
    panel.id='ttg-proto-pop';
    panel.className='ttg-proto-pop';
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','false');
    panel.setAttribute('hidden','');
    panel.innerHTML='<button class="close" aria-label="Close">×</button><div class="content"></div>';
    root.appendChild(panel);
  }
  const content=panel.querySelector('.content');
  const closeBtn=panel.querySelector('.close');

  const GAP_MOBILE=6, GAP_DESK=8, PAD=8;
  const isMobile=()=>matchMedia('(max-width:768px)').matches;
  const gap=()=>isMobile()?GAP_MOBILE:GAP_DESK;
  const clamp=(v,a,b)=>Math.min(Math.max(v,a),b);
  let activeTrigger=null;

  function resolvePanelMarkup(trigger){
    // 1) aria-controls points to hidden markup
    const id=trigger.getAttribute('aria-controls');
    if(id){
      const src=document.getElementById(id);
      if(src) return src.innerHTML.trim();
    }
    // 2) data-popover, title, or data-info
    if(trigger.dataset.popover) return trigger.dataset.popover;
    if(trigger.dataset.info) return trigger.dataset.info;
    const t=trigger.getAttribute('title');
    if(t) return `<p>${t}</p>`;
    // 3) next sibling with role tooltip/dialog
    let sib=trigger.nextElementSibling;
    while(sib){
      const role=(sib.getAttribute('role')||'').toLowerCase();
      if(role==='tooltip'||role==='dialog'||sib.hasAttribute('data-popover')){
        return sib.innerHTML.trim();
      }
      sib=sib.nextElementSibling;
    }
    return '';
  }

  function computePos(triggerRect, panelRect){
    const vw=document.documentElement.clientWidth;
    const vh=document.documentElement.clientHeight;
    const prefersBottom=triggerRect.bottom+gap()+panelRect.height+PAD<=vh;
    let top=prefersBottom?triggerRect.bottom+gap():triggerRect.top-panelRect.height-gap();
    let left=triggerRect.left;
    left=clamp(left, PAD, vw-panelRect.width-PAD);
    top=clamp(top, PAD, vh-panelRect.height-PAD);
    return {top,left,edge:prefersBottom?'bottom':'top'};
  }

  function open(trigger, html){
    content.innerHTML=html||'<p>More info</p>';
    panel.removeAttribute('hidden');
    panel.style.visibility='hidden'; // measure first
    const t=trigger.getBoundingClientRect();
    const p=panel.getBoundingClientRect();
    const pos=computePos(t,p);
    panel.style.top = `${Math.round(window.scrollY+pos.top)}px`;
    panel.style.left= `${Math.round(window.scrollX+pos.left)}px`;
    panel.dataset.edge=pos.edge;
    panel.style.visibility='visible';

    trigger.setAttribute('aria-expanded','true');
    activeTrigger=trigger;
    document.addEventListener('mousedown',onDocDown,true);
    document.addEventListener('keydown',onKey,true);
    window.addEventListener('resize',reposition,true);
    window.addEventListener('scroll',reposition,true);
  }

  function close(){
    if(!activeTrigger) return;
    activeTrigger.setAttribute('aria-expanded','false');
    activeTrigger=null;
    panel.setAttribute('hidden','');
    document.removeEventListener('mousedown',onDocDown,true);
    document.removeEventListener('keydown',onKey,true);
    window.removeEventListener('resize',reposition,true);
    window.removeEventListener('scroll',reposition,true);
  }

  function reposition(){
    if(!activeTrigger || panel.hasAttribute('hidden')) return;
    panel.style.visibility='hidden';
    const t=activeTrigger.getBoundingClientRect();
    const p=panel.getBoundingClientRect();
    const pos=computePos(t,p);
    panel.style.top = `${Math.round(window.scrollY+pos.top)}px`;
    panel.style.left= `${Math.round(window.scrollX+pos.left)}px`;
    panel.dataset.edge=pos.edge;
    panel.style.visibility='visible';
  }

  function onDocDown(e){
    if(panel.contains(e.target) || e.target===activeTrigger) return;
    close();
  }
  function onKey(e){
    if(e.key==='Escape') { e.preventDefault(); close(); }
    if((e.key==='Enter'||e.key===' ') && document.activeElement===activeTrigger){ e.preventDefault(); close(); }
  }
  closeBtn.addEventListener('click', close);

  // --- Event delegation for ALL info triggers
  const TRIGGER_SEL = ['#stocking-tip-btn','.ttg-info-btn','.tooltip-trigger','[data-info]','[aria-haspopup][aria-controls]','[data-popover-target]'].join(',');
  document.addEventListener('click', (e)=>{
    const t = e.target.closest(TRIGGER_SEL);
    if(!t) return;
    e.preventDefault();
    const html = resolvePanelMarkup(t);
    if(!html) return; // nothing to show
    const expanded = t.getAttribute('aria-expanded')==='true';
    expanded ? close() : open(t, html);
  });

  document.addEventListener('keydown', (e)=>{
    const t = e.target.closest?.(TRIGGER_SEL);
    if(!t) return;
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      const html = resolvePanelMarkup(t);
      if(!html) return;
      const expanded = t.getAttribute('aria-expanded')==='true';
      expanded ? close() : open(t, html);
    }
  });

  // Bootstrap aria-expanded for discoverability
  function seed(){
    document.querySelectorAll(TRIGGER_SEL).forEach(el=>{
      if(!el.hasAttribute('aria-expanded')) el.setAttribute('aria-expanded','false');
      if(!el.hasAttribute('role')) el.setAttribute('role','button');
      el.setAttribute('tabindex','0');
    });
  }
  seed();

  // Re-seed as cards mount/compact
  new MutationObserver(seed).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});

  // Log binding count
  setTimeout(()=> {
    console.info('[PROTO] info triggers bound:', document.querySelectorAll(TRIGGER_SEL).length);
  }, 600);
})();
