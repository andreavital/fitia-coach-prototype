/* ---------------- config, per Intraday V4 §3–5 ---------------- */
const CONFIG={typeAThreshold:.75,typeACalCeiling:1,typeBMinCalRatio:.5,typeBMinCalRoom:150,typeBProjectionThreshold:.7};
const CAPS={maxPerNutrientPerDay:1,maxAlertsPerDay:5};
const CAL_TARGET=1800, CAL_RANGE_TOP=2000;

const N=[
 {key:'transFat',  rank:1,label:'Trans Fat',  unit:'g', type:'A',limit:2,   max:5,   step:.1, v:0.4},
 {key:'sodium',    rank:2,label:'Sodium',     unit:'mg',type:'A',limit:2300,max:4000,step:25, v:2000},
 {key:'addedSugar',rank:3,label:'Added Sugar',unit:'g', type:'A',limit:50,  max:100, step:1,  v:18},
 {key:'satFat',    rank:4,label:'Sat Fat',    unit:'g', type:'A',limit:20,  max:45,  step:.5, v:7},
 {key:'protein',   rank:5,label:'Protein',    unit:'g', type:'B',limit:120, max:180, step:1,  v:44},
 {key:'fiber',     rank:6,label:'Fiber',      unit:'g', type:'B',limit:30,  max:60,  step:1,  v:8}
];
const byKey=Object.fromEntries(N.map(n=>[n.key,n]));

/* the ONLY thing persisted: which nutrients have triggered today */
let dayState={triggeredToday:{},sentTodayByNutrient:{},totalSentToday:0};
let tab='coach', unseen=false;
let cal=1100, view='home', chatKey=null;

/* ---------------- derivation ---------------- */
const calRatio=()=>cal/CAL_TARGET;
const calRoom =()=>CAL_RANGE_TOP-cal;
const ratio=n=>n.v/n.limit;
const projected=n=>calRatio()>.05 ? ratio(n)/Math.min(calRatio(),1) : 1;

function qualifies(n){
  if(n.type==='A') return ratio(n)>=CONFIG.typeAThreshold && calRatio()<CONFIG.typeACalCeiling;
  if(calRatio()<CONFIG.typeBMinCalRatio) return false;
  if(calRoom()<CONFIG.typeBMinCalRoom)   return false;
  return projected(n)<CONFIG.typeBProjectionThreshold;
}

/* card state derives from the nutrient's own condition right now,
   independent of the gating rules that decide whether a push fires */
/* State = how much has been eaten. Limit nutrients have no low side:
   under the limit they are simply on track, and the card is preventive
   (no indicator) until the limit is actually crossed. */
const CUTS={ lowHard:.50, lowSoft:.90, overHard:1.25 };
function stateOf(n){
  const r=ratio(n);
  if(n.type==='A'){
    if(r>=CUTS.overHard) return 'tooHigh';   // heavy overconsumption
    if(r>=1)             return 'high';      // slight overconsumption
    return 'preventive';                     // still under: warn, don't label
  }
  if(r<CUTS.lowHard) return 'tooLow';
  if(r<CUTS.lowSoft) return 'low';
  return 'onTrack';
}
const STATE_LABEL={onTrack:'On track',low:'Low',tooLow:'Too low',high:'High',tooHigh:'Too high'};
const fmt=(x,u)=>{const s=Math.round(x*10)/10;return (Number.isInteger(s)?s:s.toFixed(1)).toLocaleString('en-US')+u;};

const COPY={
 preventive:n=>({tag:null,title:`Watch your ${n.label.toLowerCase()}`,
   body:`You have <b>${fmt(n.limit-n.v,n.unit)}</b> left before your limit today.`,
   fix:'Keep your next meal simple and you stay under it.',
   cta:'How to stay under it'}),
 high:n=>({tag:STATE_LABEL.high,title:`${n.label} is high`,
   body:`You are <b>${fmt(n.v-n.limit,n.unit)}</b> over your limit today.`,
   fix:'It cannot be undone, but it can stop here.',
   cta:'See what caused it'}),
 tooHigh:n=>({tag:STATE_LABEL.tooHigh,title:`${n.label} is too high`,
   body:`You are <b>${fmt(n.v-n.limit,n.unit)}</b> over your limit today.`,
   fix:'It cannot be undone, but it can stop here.',
   cta:'See what caused it'}),
 tooLow:n=>({tag:STATE_LABEL.tooLow,title:`${n.label} is too low`,
   body:`You are <b>${fmt(n.limit-n.v,n.unit)}</b> short of your target for today.`,
   fix:n.key==='protein'?'Eggs, yogurt, legumes or fish all close this fast.'
                        :'Beans, oats and whole fruit move it the most.',
   cta:'See how to fix it'}),
 low:n=>({tag:STATE_LABEL.low,title:`${n.label} is low`,
   body:`<b>${fmt(n.limit-n.v,n.unit)}</b> to go before you reach your target.`,
   fix:'One more serving today and it is closed.',
   cta:'See how to fix it'}),
 onTrack:n=>({tag:STATE_LABEL.onTrack,title:`${n.label} is on track`,
   body:n.type==='A'?'You are under your daily limit again.':'You reached your target for today.',
   fix:`Now at ${fmt(n.v,n.unit)} of ${fmt(n.limit,n.unit)}.`,
   cta:'See what changed'})
};

const TOP_ITEMS={
 sodium:[['Ham sandwich','980 mg'],['Instant soup','720 mg'],['Olives','210 mg']],
 addedSugar:[['Granola bar','22 g'],['Flavored yogurt','14 g'],['Iced coffee','11 g']],
 satFat:[['Cheddar cheese','9 g'],['Butter on toast','6 g'],['Beef patty','5 g']],
 transFat:[['Croissant','0,8 g'],['Packaged cookies','0,5 g']]
};
const ADD_FOODS={
 protein:[['Greek yogurt','1 cup',18],['Two eggs','2 units',12],['Chicken breast','150 g',31]],
 fiber:[['Cooked lentils','1 cup',15],['Pear with skin','1 unit',6],['Oats','½ cup',8]]
};
function longMessage(n){
  const s=stateOf(n);
  if(s==='preventive') return `There is still room under your ${n.label.toLowerCase()} ceiling, but it goes faster than people expect. Packaged foods and anything with a sauce carry most of it. Keep whatever you eat next simple and you will land under it comfortably.`;
  if(s==='high'||s==='tooHigh') return `${n.label} went past its ceiling for today. That part is done and there is no way to walk it back, so the useful thing is knowing where it came from and keeping it from climbing further. Here is what contributed most:`;
  if(s==='tooLow'||s==='low') return `${n.label} is short of your target and it will not close on its own. It moves fast though: one solid portion covers most of the gap. Add one of these straight to your next meal.`;
  return `${n.label} is settled for today. Nothing to do here, and your log already reflects it.`;
}

/* ---------------- evaluation cycle (§1: on return to the Plan tab) ---------------- */
function evaluate(){
  const q=N.filter(qualifies).sort((a,b)=>a.rank-b.rank);
  const pick=q.find(n=>(dayState.sentTodayByNutrient[n.key]||0)<CAPS.maxPerNutrientPerDay
                    && dayState.totalSentToday<CAPS.maxAlertsPerDay);
  if(!pick){ toast(q.length?'Qualified, but caps blocked it.':'Nothing qualifies right now.'); render(); return; }
  dayState.sentTodayByNutrient[pick.key]=(dayState.sentTodayByNutrient[pick.key]||0)+1;
  dayState.totalSentToday+=1;
  const isNew=!dayState.triggeredToday[pick.key];
  dayState.triggeredToday[pick.key]=true;
  if(tab!=='coach') unseen=true;          // badge on the Coach tab until it is opened
  render();
  const c=document.querySelector(`.card[data-id="${pick.key}"]`);
  if(c) c.classList.add('flash');
  toast(isNew?`Alert sent: ${pick.label}. Its card is now pinned here.`
             :`Second alert for ${pick.label}. Same card, updated.`);
}

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
  .sort((a,b)=>{const o={tooHigh:0,tooLow:0,high:1,low:1,preventive:2,onTrack:3};
    return (o[stateOf(a)]-o[stateOf(b)])||(a.rank-b.rank);});

function titleFor(){
  const p=pinned(), openN=p.filter(n=>stateOf(n)!=='onTrack').length, done=p.length-openN;
  if(!p.length) return {lbl:'Today',h1:'Nothing to fix today',
    sub:"Everything you've logged so far is inside your targets."};
  if(openN===0) return {lbl:"Today's alerts",h1:`You closed all ${p.length}`,
    sub:'Everything I flagged today is back inside your targets.'};
  if(done===0)  return {lbl:"Today's alerts",h1:`${openN} thing${openN>1?'s':''} to check`,sub:''};
  return {lbl:"Today's alerts",h1:`${openN} left to check`,sub:`You closed ${done} of ${p.length}.`};
}

function card(n){
  const st=stateOf(n), c=COPY[st](n);
  const src=ICON3D[n.key]||ICON3D.sodium;
  const node=el(`<div class="card ${st==='onTrack'?'resolved':''}" data-id="${n.key}">
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

/* ---- chat: full loop from the card ---- */
function bubbleCoach(html){
  return el(`<div class="bubble enter" style="max-width:100%">
    <div class="bmeta"><div class="av"><svg width="14" height="14" viewBox="0 0 34 34" fill="none">
      <path d="M17 4l2.6 7.4L27 14l-7.4 2.6L17 24l-2.6-7.4L7 14l7.4-2.6z" fill="#fff"/></svg></div>
      <div class="nm">Coach</div></div><div class="bt">${html}</div></div>`);
}
function chatChips(items){
  sugg.innerHTML='';
  items.forEach(([txt,fn])=>{const b=document.createElement('button');b.textContent=txt;b.onclick=fn;sugg.appendChild(b);});
}
function openChat(k){
  if(view==='chat') return;
  view='chat'; chatKey=k;
  const n=byKey[k], st=stateOf(n), c=COPY[st](n);
  const card=document.querySelector(`.card[data-id="${k}"]`);

  // everything that is not this card folds away; the card rises with the flow
  document.querySelectorAll('.spark,.lbl,.h1,.sub,.dots').forEach(e=>e.classList.add('fold'));
  document.querySelectorAll('.card').forEach(el2=>{ if(el2!==card) el2.classList.add('leaving'); });
  if(card){
    card.classList.add('tochat');
    const rail=card.closest('.rail');
    if(rail){ rail.style.overflow='hidden'; rail.scrollTo({left:0}); }
  }

  setTimeout(()=>{
    body.className='body chat';
    body.innerHTML='';
    // the same card, now the header of the conversation
    body.appendChild(el(`<div class="ctxcard"><div class="cin">
      <div class="crow">
        <div class="cic"><svg width="20" height="20" fill="none" stroke="${(st==='tooHigh'||st==='tooLow')?'#c0392b':st==='onTrack'?'#2f9e57':'#BB6B02'}" stroke-width="1.8">
          ${n.type==='A'?'<path d="M10 2.5l7.5 14H2.5z"/><path d="M10 8v3.5M10 13.5v.5"/>'
            :'<path d="M10 2.5v15M10 9.5c-3.3 0-4.6-2-4.6-4.6C8.7 4.9 10 6.9 10 9.5zM10 9.5c3.3 0 4.6-2 4.6-4.6C11.3 4.9 10 6.9 10 9.5z"/>'}
        </svg></div>
        <div class="ct" style="font-size:15px">${c.title}</div>
        ${c.tag?`<span class="tag ${st}">${c.tag}</span>`:''}
      </div>
      <div class="cb" style="margin-top:7px;font-size:14px">${c.body}</div>
    </div></div>`));
    body.appendChild(el(`<div class="bubble me enter"><div class="bt">${c.cta}</div></div>`));
    const t=el(`<div class="bubble enter"><div class="typing"><i></i><i></i><i></i></div></div>`);
    body.appendChild(t);
    chatChips([]);

    setTimeout(()=>{
      t.remove();
      const b=bubbleCoach(longMessage(n));

      if(st==='high'||st==='tooHigh'){
        (TOP_ITEMS[n.key]||[]).forEach(([name,amt])=>
          b.appendChild(el(`<div class="food"><div><div class="fn">${name}</div>
            <div class="fv">${amt} of ${n.label.toLowerCase()}</div></div></div>`)));
        body.appendChild(b);
        body.appendChild(bubbleCoach('For the rest of today, cooking from scratch keeps it from climbing. Nothing you eat now lowers what is already logged.'));
        chatChips([['Plan the rest of my day',()=>{}],['Why does it matter?',()=>{}]]);
      }
      else if(st==='tooLow'||st==='low'){
        (ADD_FOODS[n.key]||[]).forEach(([name,portion,amount])=>{
          const row=el(`<div class="food"><div><div class="fn">${name}</div>
            <div class="fv">${portion} · +${amount}${n.unit}</div></div>
            <button class="fadd">Add</button></div>`);
          row.querySelector('.fadd').onclick=e=>{
            n.v=Math.min(n.max,n.v+amount);
            const sl=document.querySelector(`#sliders input[data-k="${n.key}"]`); if(sl) sl.value=n.v;
            e.target.textContent='Added ✓'; e.target.classList.add('added'); e.target.disabled=true;
            paintPanel();
            body.appendChild(bubbleCoach(stateOf(n)==='onTrack'
              ? `That closes it. ${n.label} is on track for today.`
              : `Logged. ${n.label} is at ${fmt(n.v,n.unit)} now, ${fmt(n.limit-n.v,n.unit)} to go.`));
            body.scrollTop=body.scrollHeight;
            chatChips([['Something else',()=>{}]]);
          };
          b.appendChild(row);
        });
        body.appendChild(b);
        chatChips([['Something else',()=>{}],['Plan the rest of my day',()=>{}]]);
      }
      else{
        body.appendChild(b);
        chatChips([['Plan the rest of my day',()=>{}]]);
      }
      body.scrollTop=body.scrollHeight;
    },900);
  },320);
}

/* ---------------- panel ---------------- */
const STATE_COLOR={high:['#fdf3e3','#BB6B02'],tooHigh:['#fbeceb','#c0392b'],
  tooLow:['#fbeceb','#c0392b'],low:['#fdf3e3','#BB6B02'],onTrack:['#eaf6ee','#2f9e57'],
  preventive:['#fdf3e3','#BB6B02']};

function buildSliders(){
  const box=document.getElementById('sliders'); box.innerHTML='';
  N.forEach(n=>{
    const w=el(`<div class="slid">
      <div class="sl-top"><span class="sl-name">${n.label}</span>
        <span class="sl-state" data-state="${n.key}"></span>
        <span class="sl-val" data-val="${n.key}"></span></div>
      <input type="range" min="0" max="${n.max}" step="${n.step}" value="${n.v}" data-k="${n.key}"></div>`);
    w.querySelector('input').addEventListener('input',e=>{
      n.v=parseFloat(e.target.value);
      if(tab==='plan') paintPanel(); else render();
    });
    box.appendChild(w);
  });
  const c=document.getElementById('cal');
  c.value=cal;
  c.addEventListener('input',e=>{cal=parseInt(e.target.value); if(tab==='plan') paintPanel(); else render();});
}

function paintPanel(){
  document.getElementById('vcal').textContent=`${cal.toLocaleString('en-US')} / ${CAL_TARGET.toLocaleString('en-US')} kcal`;
  document.getElementById('kSent').textContent=`${dayState.totalSentToday} / ${CAPS.maxAlertsPerDay}`;
  N.forEach(n=>{
    const v=document.querySelector(`[data-val="${n.key}"]`), s=document.querySelector(`[data-state="${n.key}"]`);
    if(!v) return;
    v.textContent=`${fmt(n.v,n.unit)} / ${fmt(n.limit,n.unit)} · ${(ratio(n)*100).toFixed(0)}%`;
    if(dayState.triggeredToday[n.key]){
      const st=stateOf(n), [bg,fg]=STATE_COLOR[st];
      s.textContent=COPY[st](n).tag||'Preventive'; s.style.background=bg; s.style.color=fg;
    } else if(qualifies(n)){
      s.textContent='qualifies'; s.style.background='#eaf6ee'; s.style.color='#2f9e57';
    } else {
      // its own condition is met but a calorie gate is holding it back
      const ownCondition = n.type==='A'
        ? ratio(n)>=CONFIG.typeAThreshold
        : (calRatio()>.05 ? ratio(n)/Math.min(calRatio(),1) : 1) < CONFIG.typeBProjectionThreshold;
      let why='';
      if(ownCondition){
        if(n.type==='A' && calRatio()>=CONFIG.typeACalCeiling) why='blocked: calories over target';
        else if(n.type==='B' && calRatio()<CONFIG.typeBMinCalRatio) why='blocked: needs 50% of calories';
        else if(n.type==='B' && calRoom()<CONFIG.typeBMinCalRoom) why='blocked: under 150 kcal of room';
      }
      s.textContent=why; s.style.background=why?'#fbeceb':'transparent'; s.style.color=why?'#c0392b':'transparent';
    }
  });
  const g=document.getElementById('gates');
  const rows=[
    ['Limit alerts (sodium, sugar, sat fat, trans fat)',
     calRatio()<CONFIG.typeACalCeiling,
     calRatio()<CONFIG.typeACalCeiling ? 'open · calories under target'
       : `blocked · calories at ${(calRatio()*100).toFixed(0)}% of target`],
    ['Target alerts (protein, fiber) evaluated',
     calRatio()>=CONFIG.typeBMinCalRatio,
     calRatio()>=CONFIG.typeBMinCalRatio ? 'open · half the day logged'
       : `blocked · only ${(calRatio()*100).toFixed(0)}% of calories logged, needs 50%`],
    ['Room left to act on advice',
     calRoom()>=CONFIG.typeBMinCalRoom,
     calRoom()>=CONFIG.typeBMinCalRoom ? `open · ${calRoom()} kcal to the top of the range`
       : `blocked · only ${Math.max(0,calRoom())} kcal left, needs 150`]
  ];
  g.innerHTML=rows.map(([label,ok,note])=>
    `<div class="gate ${ok?'ok':'no'}"><i></i><div><b>${label}</b><span>${note}</span></div></div>`).join('');

  const q=N.filter(qualifies).map(n=>n.label);
  const lg=document.getElementById('legend');
  const blockers=[];
  if(dayState.totalSentToday>=CAPS.maxAlertsPerDay) blockers.push('daily cap of 5 alerts reached.');
  lg.innerHTML = (q.length
      ? `<b>Qualifying now:</b> ${q.join(', ')}. Press “Return to Plan tab” — only the highest priority one sends.`
      : '<b>Nothing qualifies right now.</b>')
    + (blockers.length?`<br><br><b>Blocked by:</b> ${blockers.join(' ')}`:'');
}

document.getElementById('delBtn').onclick=()=>{
  dayState.sentTodayByNutrient={};      // §4.1: deletion clears per-nutrient caps
  toast('Food deleted. Per-nutrient caps cleared, cards stay.');
  render();
};
document.getElementById('resetBtn').onclick=()=>{
  dayState={triggeredToday:{},sentTodayByNutrient:{},totalSentToday:0};
  cal=0; unseen=false; N.forEach(n=>n.v=0);
  document.getElementById('cal').value=0;
  document.querySelectorAll('#sliders input[type=range]').forEach(i=>i.value=0);
  view='home'; toast('New day. Nothing logged yet.'); render();
};

/* drag-to-scroll for any horizontal strip, click-safe (5px threshold) */
function dragScroll(elm){
  let armed=false,dragging=false,sx=0,ss=0,pid=null;
  elm.style.cursor='grab';
  elm.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch') return;
    armed=true; dragging=false; sx=e.clientX; ss=elm.scrollLeft; pid=e.pointerId;
  });
  elm.addEventListener('pointermove',e=>{
    if(!armed) return;
    const dx=e.clientX-sx;
    if(!dragging){
      if(Math.abs(dx)<5) return;
      dragging=true; elm.style.cursor='grabbing';
      try{ elm.setPointerCapture(pid); }catch(_){}
    }
    elm.scrollLeft=ss-dx;
  });
  const stop=()=>{armed=false;dragging=false;elm.style.cursor='grab';};
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>elm.addEventListener(ev,stop));
  elm.addEventListener('wheel',e=>{
    if(Math.abs(e.deltaX)>Math.abs(e.deltaY)) return;   // trackpad already horizontal
    e.preventDefault(); elm.scrollLeft+=e.deltaY;
  },{passive:false});
}
dragScroll(sugg);

function goTab(t){
  if(t===tab) return;
  tab=t;
  if(t==='plan'){ evaluate(); render(); }   // §1: the day is evaluated on return to the Plan tab
  else { unseen=false; view='home'; render(); }
}
document.querySelectorAll('.tab').forEach(el2=>{
  el2.style.cursor='pointer';
  el2.onclick=()=>{ if(el2.dataset.tab==='plan') goTab('plan'); };
});
document.querySelector('.tabsolo').style.cursor='pointer';
document.querySelector('.tabsolo').onclick=()=>goTab('coach');

document.getElementById('newBtn').onclick=()=>{
  view='home'; render(); toast('New chat. Your alerts are here.');
};
document.getElementById('menuBtn').onclick=()=>toast('Opens chat history.');

buildSliders();
dayState.triggeredToday={sodium:true,protein:true,fiber:true};
dayState.sentTodayByNutrient={sodium:1,protein:1,fiber:1};
dayState.totalSentToday=3;
render();
