/* ---------------- panel ---------------- */
const STATE_COLOR={high:['#fdf3e3','#BB6B02'],tooHigh:['#fbeceb','#c0392b'],
  tooLow:['#fbeceb','#c0392b'],low:['#fdf3e3','#BB6B02'],onTrack:['#eaf6ee','#2f9e57'],
  preventive:['#fdf3e3','#BB6B02']};

let liveT=null;
function liveEvaluate(){
  clearTimeout(liveT);
  liveT=setTimeout(()=>{ evaluate(); paintPanel(); },250);
}

function buildSliders(){
  const box=document.getElementById('sliders'); box.innerHTML='';
  N.forEach(n=>{
    const w=el(`<div class="slid">
      <div class="sl-top"><span class="sl-name">${n.label}</span>
        <span class="sl-state" data-state="${n.key}"></span>
        <span class="sl-val" data-val="${n.key}"></span></div>
      <input type="range" min="0" max="${n.max}" step="${n.step}" value="${n.v}" data-k="${n.key}"></div>`);
    const inp=w.querySelector('input');
    inp.addEventListener('input',e=>{
      n.v=parseFloat(e.target.value);
      if(tab==='plan') paintPanel(); else render();
    });
    // evaluate as soon as the slider settles, without leaving the tab
    inp.addEventListener('change',()=>{ if(tab==='plan') liveEvaluate(); });
    box.appendChild(w);
  });
  const c=document.getElementById('cal');
  c.value=cal;
  c.addEventListener('input',e=>{cal=parseInt(e.target.value); if(tab==='plan') paintPanel(); else render();});
  c.addEventListener('change',()=>{ if(tab==='plan') liveEvaluate(); });
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
  dayState={triggeredToday:{},seenToday:{},sentTodayByNutrient:{},totalSentToday:0};
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
