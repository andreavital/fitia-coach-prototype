const COPY={
 preventive:n=>({tag:null,title:`Watch your ${n.label.toLowerCase()}`,
   body:`You have <b>${fmt(n.limit-n.v,n.unit)}</b> of room left before your limit. Keeping your next meal simple should be enough — want ideas?`,
   cta:'How to stay under it'}),
 high:n=>({tag:STATE_LABEL.high,title:n.label,
   body:`You went <b>${fmt(n.v-n.limit,n.unit)}</b> over your limit today. It cannot be undone, but I can show you what pushed it there.`,
   cta:'See what caused it'}),
 tooHigh:n=>({tag:STATE_LABEL.tooHigh,title:n.label,
   body:`You went <b>${fmt(n.v-n.limit,n.unit)}</b> over your limit today. It cannot be undone, but I can show you what pushed it there.`,
   cta:'See what caused it'}),
 tooLow:n=>({tag:STATE_LABEL.tooLow,title:n.label,
   body:`You are <b>${fmt(n.limit-n.v,n.unit)}</b> short of your target for today. Would ${n.pair} work to close it?`,
   cta:'See how to fix it'}),
 low:n=>({tag:STATE_LABEL.low,title:n.label,
   body:`You are <b>${fmt(n.limit-n.v,n.unit)}</b> away from your target. Would ${n.pair} do it?`,
   cta:'See how to fix it'}),
 onTrack:n=>({tag:STATE_LABEL.onTrack,title:n.label,
   body:n.type==='A'
     ? `You are back under your daily limit, now at <b>${fmt(n.v,n.unit)}</b> of ${fmt(n.limit,n.unit)}.`
     : `You reached your target for today, now at <b>${fmt(n.v,n.unit)}</b> of ${fmt(n.limit,n.unit)}.`,
   cta:null})   // nothing left to do, so no button
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
