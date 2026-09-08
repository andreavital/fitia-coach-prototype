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
  document.querySelector('.phone').classList.add('plain');   // aura fades out for the conversation
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
        <div class="cic"><img src="${ICON3D[n.key]||ICON3D.sodium}" width="24" height="24" alt=""></div>
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
