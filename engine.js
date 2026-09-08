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
