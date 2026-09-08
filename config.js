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
