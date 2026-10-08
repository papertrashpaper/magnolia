import {CARD} from '../public/js/cards.js';
import {clone,legalCells,placeOne,power,amount,level,resolveRound} from '../public/js/engine.js';
export const STRATEGIES={
 balanced:{name:'適応型',vp:1,income:1,tech:1,faith:1,war:1,bonus:1,slots:0,gold:1},
 tech:{name:'技術得点型',vp:1.2,income:.9,tech:2.4,faith:.45,war:.7,bonus:1,slots:0,gold:.8},
 faith:{name:'信仰戦力型',vp:1.1,income:.9,tech:.45,faith:2.4,war:1.4,bonus:1,slots:0,gold:.8},
 war:{name:'戦争特化型',vp:.65,income:.8,tech:.6,faith:.8,war:2.5,bonus:.7,slots:0,gold:.8},
 economy:{name:'収入先行型',vp:1,income:2.5,tech:1,faith:1,war:.8,bonus:.8,slots:0,gold:1.2},
 bonus:{name:'3枚揃え型',vp:1,income:.8,tech:.8,faith:.8,war:.8,bonus:3,slots:0,gold:.8},
 rush:{name:'9体早期終了型',vp:.8,income:.5,tech:.6,faith:.6,war:1,bonus:.7,slots:1.8,gold:.6},
 savings:{name:'貯金・君主型',vp:.8,income:1.5,tech:.6,faith:.6,war:.8,bonus:.6,slots:0,gold:2.7},
};
function rates(p){const r={vp:0,income:0,tech:0,faith:0,war:0};for(const b of p.board)for(const e of CARD[b.card].effects){if(e.phase==='vp')r.vp+=amount(p,CARD[b.card],e);if(e.phase==='income')r.income+=amount(p,CARD[b.card],e);if(e.phase==='develop'&&e.stat in r)r[e.stat]+=amount(p,CARD[b.card],e);if(e.phase==='war')r.war+=amount(p,CARD[b.card],e);}return r;}
function almost(p){let n=0;for(const axis of ['x','y']){const lines=new Map();for(const b of p.board){if(!lines.has(b[axis]))lines.set(b[axis],[]);lines.get(b[axis]).push(CARD[b.card]);}for(const cards of lines.values())if(cards.length===2)for(const kind of ['race','job'])if(cards[0][kind]===cards[1][kind])n++;}return n;}
export function score(p,opponents,settings,key,variant=1){
 const w=STRATEGIES[key],r=rates(p),s=power(p),rank=1+opponents.filter(q=>power(q)>s).length;
 const horizon=Math.max(.5,Math.min(3,(9-Math.max(p.board.length,...opponents.map(q=>q.board.length)))/1.5));
 const war=(settings.warVP[rank-1]??0)+(rank<=settings.warVP.filter(v=>v>0).length?r.war:0);
 const hasTech=p.board.some(b=>CARD[b.card].effects.some(e=>e.scale==='techLevel'));
 const hasFaith=p.board.some(b=>CARD[b.card].effects.some(e=>e.scale==='faithLevel'));
 const emphasis=x=>1+(x-1)*variant;
 const king=p.board.some(b=>CARD[b.card].effects.some(e=>e.stat==='tripleGold'))?3:1;
 return p.vp*3+r.vp*3*horizon*emphasis(w.vp)+r.income*horizon*emphasis(w.income)+p.gold*.65*emphasis(w.gold)*king+
 (level(p.tech)*2+p.tech*.15+r.tech*horizon)*emphasis(w.tech)*(hasTech?1:.45)+
 (level(p.faith)*2+p.faith*.15+r.faith*horizon)*emphasis(w.faith)*(hasFaith?1:.45)+
 war*2*emphasis(w.war)+Math.min(s,Math.max(0,...opponents.map(power))+2)*.18*emphasis(w.war)+almost(p)*1.3*emphasis(w.bonus)+p.bonuses.length*emphasis(w.bonus)+p.board.length*w.slots;
}
export function strategyPlace(p,opponents,settings,key,variant=1,beamWidth=5){
 let beam=[{p:clone(p),moves:[]}],all=[beam[0]];
 for(let d=0;d<2;d++){
  const next=[];for(const a of beam)for(let i=0;i<a.p.hand.length;i++)if(CARD[a.p.hand[i]].cost<=a.p.gold)for(const cell of legalCells(a.p.board)){
   const q=clone(a.p),move={handIndex:i,...cell};placeOne(q,move);const moves=[...a.moves,move];
   const scored={...q,gold:q.gold+2-moves.length};next.push({p:q,moves,score:score(scored,opponents,settings,key,variant)});
  }
  next.sort((a,b)=>b.score-a.score);beam=next.slice(0,beamWidth);all.push(...beam);
 }
 // Identical search budget and endgame logic for every strategy. No future cards or opponent hands.
 let best=null;for(const a of all){
  const q=clone(a.p);q.gold+=2-a.moves.length;
  const g={players:[q,...opponents.map(clone)],settings,logs:[],round:1,orders:{}};resolveRound(g);
  const after=g.players[0];let value;
  if(g.phase==='ended'){const top=Math.max(...g.players.slice(1).map(x=>x.vp));value=(after.vp>top?10000:after.vp===top?5000:-10000)+(after.vp-top)*30+after.vp;}
  else value=score(after,g.players.slice(1),settings,key,variant);
  if(!best||value>best.value)best={moves:a.moves,value};
 }
 return {moves:best.moves};
}
export function strategyDraw(p,opponents,settings,key,variant=1){
 const base=score(p,opponents,settings,key,variant),values=p.hand.map((id,index)=>{
  const c=CARD[id];let gain=-Infinity;
  // Assess affordable cards and cards affordable after one ordinary income phase.
  const q=clone(p);q.gold=Math.max(q.gold,Math.min(c.cost,q.gold+3));
  if(q.gold>=c.cost)for(const cell of legalCells(q.board)){const n=clone(q);placeOne(n,{handIndex:index,...cell});gain=Math.max(gain,score(n,opponents,settings,key,variant)-base);}
  return {index,gain,cost:c.cost};
 });
 values.sort((a,b)=>b.gain-a.gain);const keep=new Set(values.slice(0,2).filter(x=>x.gain>-2&&x.cost<=p.gold+3).map(x=>x.index));
 return {discard:values.filter(x=>!keep.has(x.index)&&(x.gain<1||x.cost>p.gold+3)).map(x=>x.index).sort((a,b)=>a-b)};
}
