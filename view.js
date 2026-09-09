/* ---------------- render ---------------- */
const body=document.getElementById('body'), sugg=document.getElementById('sugg');
const el=h=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstElementChild;};
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2600);}

const USER='Ana';
let firstEver=false;
const greeting=()=>{const h=16; return h<12?'Good morning':h<19?'Good afternoon':'Good evening';};
const PILL_ICON={
 scan:'<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="1.5" y="4" width="14" height="10.5" rx="3"/><circle cx="8.5" cy="9.2" r="2.4"/><path d="M5.5 4l1.1-1.8h3.8L11.5 4"/></svg>',
 recipe:'<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.0203 5.19266C13.5292 4.84314 14.1413 4.63926 14.8 4.63926C16.5673 4.63926 18 6.1071 18 7.91778C18 9.6994 16.5531 11.19 14.8 11.19V12.75C14.8 14.2821 14.8 15.0481 14.3314 15.524C13.8627 16 13.1085 16 11.6 16H8.4C6.89151 16 6.13726 16 5.66863 15.524C5.2 15.0481 5.2 14.2821 5.2 12.75V11.3931C3.33147 11.3931 2 9.97962 2 7.91778C2 6.1071 3.43269 4.63926 5.2 4.63926C5.85865 4.63926 6.47083 4.84314 6.97969 5.19266C7.41705 3.91564 8.60416 3 10 3C11.3958 3 12.5829 3.91564 13.0203 5.19266ZM13.0203 5.19266C13.1367 5.5325 13.2 5.89794 13.2 6.27852"/></svg>',
 eat:'<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="3.5" width="13" height="11.5" rx="3"/><path d="M2 7h13M5.5 2v3M11.5 2v3"/></svg>',
 day:'<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2.5 14h12M5 14V8M8.5 14V3.5M12 14V9.5"/></svg>'};
const nothingLogged=()=>cal===0 && N.every(n=>n.v===0);
const pinned=()=>N.filter(n=>dayState.triggeredToday[n.key])
  // resolved before the user ever saw it open: there is no story to tell
  .filter(n=>stateOf(n)!=='onTrack' || dayState.seenToday[n.key])
  .sort((a,b)=>{const o={tooHigh:0,tooLow:0,high:1,low:1,preventive:2,onTrack:3};
    return (o[stateOf(a)]-o[stateOf(b)])||(a.rank-b.rank);});

/* The headline counts only what the user can still act on. An over-limit alert
   is information, not a task: you cannot un-eat it, so it never sits there as
   something pending. Nothing here counts how much the user reviewed. */
const actionable=n=>['tooLow','low','preventive'].includes(stateOf(n));

/* opening Coach counts as seeing whatever is currently open */
function markSeen(list){ list.forEach(n=>{ if(stateOf(n)!=='onTrack') dayState.seenToday[n.key]=true; }); }

function titleFor(){
  const p=pinned(), openN=p.filter(actionable).length;
  if(!p.length) return {lbl:'Today',h1:'Nothing to fix today',
    sub:"Everything you've logged so far is inside your targets."};
  if(openN===0){
    const allClosed=p.every(n=>stateOf(n)==='onTrack');
    return {lbl:"Today's alerts",
      h1: allClosed ? `You closed all ${p.length}` : 'Nothing left to fix today',
      sub: allClosed ? 'Everything I flagged today is back inside your targets.' : ''};
  }
  return {lbl:"Today's alerts",h1:`${openN} thing${openN>1?'s':''} to check`,sub:''};
}

function card(n){
  const st=stateOf(n), c=COPY[st](n);
  const src=ICON3D[n.key]||ICON3D.sodium;
  const node=el(`<div class="card s-${st}" data-id="${n.key}">
    <div class="cin">
      <div class="crow">
        <div class="cic"><img src="${src}" width="24" height="24" alt=""></div>
        <div class="ct">${c.title}</div>
        ${c.tag?`<span class="tag ${st}">${c.tag}</span>`:''}
      </div>
      <div class="cbody">
        <div class="cb">${c.body}</div>
        <div class="hr"></div>
        <div class="cf">${c.fix}</div>
      </div>
    </div>
    <div class="ctarow"><button class="cta">${c.cta}</button></div>
  </div>`);
  node.querySelector('.cta').onclick=()=>openChat(n.key);
  return node;
}

function render(){
  paintPanel();
  const planEl=document.getElementById('plan');
  const footEl=document.querySelector('.footer');
  const ttlEl=document.querySelector('.hdr .ttl');
  if(planEl){
    planEl.hidden = tab!=='plan';
    body.style.display = tab==='plan' ? 'none' : '';
    if(footEl) footEl.style.display = tab==='plan' ? 'none' : '';
    if(ttlEl) ttlEl.textContent = tab==='plan' ? 'Plan' : 'Fitia Coach';
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab==='plan'&&tab==='plan'));
    const solo=document.querySelector('.tabsolo');
    solo.classList.toggle('on',tab==='coach');
    solo.classList.toggle('badge',unseen && tab!=='coach');
    if(tab==='plan') return;
  }
  const nb=document.getElementById('newBtn');
  if(nb) nb.style.visibility = nothingLogged() ? 'hidden' : 'visible';
  if(view==='chat'){ return; }
  body.className='body';
  const t=titleFor(), p=pinned();

  // nothing logged, or logged with no alerts → same layout, different words
  document.querySelector('.phone').classList.add('plain');   // no aura without alerts
  if(nothingLogged() || !p.length){
    const blank=nothingLogged();
    const h  = blank ? (firstEver ? "Hello, I'm Coach" : `${greeting()}, ${USER}`)
                     : 'Nothing to fix today';
    const sb = blank ? (firstEver ? "I'll answer anything about your nutrition." : '')
                     : "Everything you've logged is inside your targets.";
    const fn = blank ? "As your day fills in, I'll tell you how it's going and what to fix."
                     : "I'll let you know if that changes.";
    // scope label depends on whether anything has been logged yet
    const acts = blank
      ? [['eat',"Plan today's meals"],['recipe','Create a recipe'],['scan','Scan my food']]
      : [['day','How is my day going?'],['eat','Plan the rest of my day'],['recipe','Create a recipe']];
    body.innerHTML=`<div class="head-block"><div class="ai"><i></i></div>
        <div class="ttlgrp"><div class="h1">${h}</div>
        ${sb?`<div class="sub">${sb}</div>`:''}</div></div>
      <div class="pills">${acts.map(([k,t])=>
        `<button class="pill">${PILL_ICON[k]}${t}</button>`).join('')}</div>
      <div class="footnote">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6v3.6l2.2 1.3"/></svg>
        <p>${fn}</p>
      </div>`;
    sugg.innerHTML='';
    return;
  }

  body.innerHTML=`<div class="head-block"><div class="ai"><i></i></div>
      <div class="ttlgrp"><div class="lbl">${t.lbl}</div><div class="h1">${t.h1}</div>
      ${t.sub?`<div class="sub">${t.sub}</div>`:''}</div></div><div id="content"></div>`;
  const content=document.getElementById('content');

  {
      document.querySelector('.phone').classList.remove('plain');
    markSeen(p);
    const rail=el(`<div class="rail" role="group" aria-label="Today's alerts"></div>`);
    p.forEach(n=>rail.appendChild(card(n)));
    content.appendChild(rail);
    const dots=el(`<div class="dots">${p.length>1?p.map((n,i)=>
      `<button class="dot ${i===0?'on':''}" aria-label="Alert ${i+1} of ${p.length}"></button>`).join(''):''}</div>`);
    content.appendChild(dots);
    wireRail(rail,dots,p.length);
  }
  sugg.innerHTML='';
  // insight mode: only the day-review chips, per the Figma frame
  ['How is my day going?','Create my dinner','How was my lunch?'].forEach(t=>{
    const b=document.createElement('button');b.textContent=t;sugg.appendChild(b);});
}

function wireRail(rail,dots,count){
  const step=()=>{const c=rail.querySelector('.card');if(!c)return 337;
    return c.getBoundingClientRect().width+(parseFloat(getComputedStyle(rail).gap)||16);};
  const idx=()=>Math.max(0,Math.min(count-1,Math.round(rail.scrollLeft/step())));
  rail.addEventListener('scroll',()=>{const i=idx();
    dots.querySelectorAll('.dot').forEach((d,j)=>d.classList.toggle('on',j===i));},{passive:true});
  dots.querySelectorAll('.dot').forEach((d,i)=>d.onclick=()=>rail.scrollTo({left:i*step(),behavior:'smooth'}));
  // Drag must not swallow clicks on the cards: only capture the pointer once
  // the gesture is clearly a drag, never on pointerdown.
  let armed=false,dragging=false,sx=0,ss=0,pid=null;
  rail.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch') return;
    armed=true; dragging=false; sx=e.clientX; ss=rail.scrollLeft; pid=e.pointerId;
  });
  rail.addEventListener('pointermove',e=>{
    if(!armed) return;
    const dx=e.clientX-sx;
    if(!dragging){
      if(Math.abs(dx)<5) return;              // still a click, leave it alone
      dragging=true; rail.classList.add('dragging');
      try{ rail.setPointerCapture(pid); }catch(_){}
    }
    rail.scrollLeft=ss-dx;
  });
  const end=()=>{
    armed=false;
    if(!dragging) return;                      // plain click: nothing to snap
    dragging=false; rail.classList.remove('dragging');
    rail.scrollTo({left:idx()*step(),behavior:'smooth'});
  };
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>rail.addEventListener(ev,end));
}
