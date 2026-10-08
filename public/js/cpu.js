import {objectiveProgress} from './objectives.js?v=3';
import {CARD,CARDS} from './cards.js?v=4';
import {clone,legalCells,placeOne,power,level,amount,resolveRound,normalizeCPU} from './engine.js?v=16';
function potential(p){
 let score=0;
 for(const axis of ['x','y'])for(const type of ['race','job']){
  const buckets=new Map();for(const b of p.board){const key=`${b[axis]}:${CARD[b.card][type]}`;buckets.set(key,(buckets.get(key)||0)+1);}
  for(const n of buckets.values())if(n===2)score+=2;
 }return score;
}
function recurring(p){
 let result=0;for(const b of p.board){const c=CARD[b.card];for(const e of c.effects){
  let factor=amount(p,c,e)/e.amount;
  if(e.phase==='vp')result+=e.amount*factor*1.8;
  if(e.phase==='income')result+=e.amount*factor;
  if(e.phase==='develop')result+=e.amount*1.2;
 }}return result;
}
export function cpuScore(p,opponents=[],settings={}){
 const s=power(p);const rank=1+opponents.filter(q=>power(q)>s).length;
 const goals=(settings.objectives??[]).filter(o=>!o.claimedBy?.length).reduce((score,o)=>{const progress=objectiveProgress(p,o.id);return score+(progress?.met?9:(progress?.ratio??0)*3);},0);
 return goals+p.vp*3+p.gold*.9+p.tech*.8+p.faith*.8+s*.7+recurring(p)+potential(p)+(settings.warVP?.[rank-1]??(rank===1?5:rank===2?2:0))+p.board.length*1.5;
}
export function cpuDraw(p,rng=Math.random){
 const difficulty=normalizeCPU(p.cpuDifficulty);
 if(difficulty==='easy')return {discard:p.hand.flatMap((_,i)=>rng()<.25?[i]:[])};
 const discard=[];for(let i=0;i<p.hand.length;i++){
  const c=CARD[p.hand[i]];const matching=p.board.filter(b=>CARD[b.card].race===c.race||CARD[b.card].job===c.job).length;
  const advanced=difficulty==='expert'||difficulty==='overlord';
  const valuable=c.cost<=p.gold+(advanced?1:3)||matching>=2;
  if(advanced&&c.cost<=p.gold&&matching>0)continue;
  if(!valuable||(!matching&&c.cost>p.gold&&discard.length<3))discard.push(i);
 }return {discard};
}
function normalPlace(p,opponents=[],beamWidth=14,settings={}){
 const initial={p:clone(p),moves:[],score:cpuScore({...clone(p),gold:p.gold+2},opponents,settings)};let best=initial;
 let beam=[{p:clone(p),moves:[]}];
 for(let depth=0;depth<2;depth++){
  const candidates=[];
  for(const entry of beam)for(let i=0;i<entry.p.hand.length;i++){
   if(CARD[entry.p.hand[i]].cost>entry.p.gold)continue;
   for(const cell of legalCells(entry.p.board)){
    const next=clone(entry.p),move={handIndex:i,...cell};placeOne(next,move);
    const moves=[...entry.moves,move],score=cpuScore({...clone(next),gold:next.gold+2-moves.length},opponents,settings);
    const candidate={p:next,moves,score};candidates.push(candidate);if(score>best.score)best=candidate;
   }
  }
  candidates.sort((a,b)=>b.score-a.score);beam=candidates.slice(0,beamWidth);
 }return {moves:best.moves};
}
function ordinaryPlace(p,opponents,rng,settings={}){
 const draft=clone(p),moves=[];
 for(let depth=0;depth<2;depth++){
  const candidates=[];
  for(let i=0;i<draft.hand.length;i++){
   if(CARD[draft.hand[i]].cost>draft.gold)continue;
   let best=null;
   for(const cell of legalCells(draft.board)){
    const next=clone(draft),move={handIndex:i,...cell};placeOne(next,move);
    const score=cpuScore({...clone(next),gold:next.gold+1-depth},opponents,settings);
    if(!best||score>best.score)best={next,move,score};
   }if(best)candidates.push(best);
  }
  candidates.sort((a,b)=>b.score-a.score);if(!candidates.length)break;
  // Ordinary opponents usually prefer the best immediate option, but are
  // less consistent than the exhaustive higher difficulties.
  const index=rng()<.4?0:Math.floor(rng()*Math.min(3,candidates.length));
  const chosen=candidates[index];Object.assign(draft,chosen.next);moves.push(chosen.move);
 }return {moves};
}
// All search uses only this player's hand and opponents' public kingdoms.
function forecast(p,opponents,settings){
 const players=[clone(p),...opponents.map(q=>({...clone(q),hand:[]}))];
 const g={players,settings,objectives:clone(settings.objectives??[]),logs:[],round:1,orders:{}};resolveRound(g);
 const after=g.players[0];
 if(g.phase==='ended')return {score:1000+after.vp*10+(g.winners.includes(after.id)?500:0),after,ended:true};
 return {score:cpuScore(after,g.players.slice(1),{...settings,objectives:g.objectives})+after.vp+recurring(after)*2+potential(after),after,ended:false};
}
export function cpuPlace(p,opponents=[],settings={},rng=Math.random){
 const difficulty=normalizeCPU(p.cpuDifficulty);
 if(difficulty==='normal')return ordinaryPlace(p,opponents,rng,settings);
 if(difficulty==='hard')return normalPlace(p,opponents,14,settings);
 if(difficulty==='easy'){
  const draft=clone(p),moves=[];
  for(let depth=0;depth<2;depth++){
   const cards=draft.hand.flatMap((id,i)=>CARD[id].cost<=draft.gold?[i]:[]),cells=legalCells(draft.board);
   if(!cards.length||!cells.length||rng()<.15)break;
   const move={handIndex:cards[Math.floor(rng()*cards.length)],...cells[Math.floor(rng()*cells.length)]};
   placeOne(draft,move);moves.push(move);
  }return {moves};
 }
 const rules={...settings,warVP:settings.warVP??(opponents.length===1?[4,0]:[5,3,0,0,0])};
 const evaluate=(entry)=>{
  const rewarded=clone(entry.p);rewarded.gold+=2-entry.moves.length;
  const result=forecast(rewarded,opponents,rules);
  if(difficulty==='hard'&&!result.ended)result.score=.75*cpuScore(rewarded,opponents)+.25*result.score;
  return {...entry,...result};
 };
 const candidates=[evaluate({p:clone(p),moves:[]})];let beam=[{p:clone(p),moves:[]}];
 for(let depth=0;depth<2;depth++){
  const nextBeam=[];
  for(const entry of beam)for(let i=0;i<entry.p.hand.length;i++){
   if(CARD[entry.p.hand[i]].cost>entry.p.gold)continue;
   for(const cell of legalCells(entry.p.board)){
    const next=clone(entry.p),move={handIndex:i,...cell};placeOne(next,move);
    nextBeam.push(evaluate({p:next,moves:[...entry.moves,move]}));
   }
  }
  nextBeam.sort((a,b)=>b.score-a.score);candidates.push(...nextBeam);
  beam=['expert','overlord'].includes(difficulty)?nextBeam:nextBeam.slice(0,24);
 }
 candidates.sort((a,b)=>b.score-a.score);
 if(difficulty==='expert')return overlordPlace(p,opponents,rules,candidates,{finalists:8,samples:4,rounds:1});
 if(difficulty==='overlord')return overlordPlace(p,opponents,rules,candidates);
 return {moves:candidates[0].moves};
}
// Sample hypothetical unseen cards from the published card counts. This is
// deliberately independent of actual deck order, opponents' hands and orders.
function scenarioRng(p,opponents,sample){
 let seed=2166136261;
 const key=JSON.stringify([p.hand,p.board,p.gold,p.tech,p.faith,p.vp,opponents.map(q=>[q.board,q.gold,q.tech,q.faith,q.vp]),sample]);
 for(const c of key)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}
function unknownPool(p,opponents){
 const known=[...p.hand,...[p,...opponents].flatMap(q=>q.board.map(b=>b.card))];
 return CARDS.flatMap(c=>Array(Math.max(0,c.copies-known.filter(id=>id===c.id).length)).fill(c.id));
}
function hypotheticalDraw(p,pool,rng){
 const available=pool;
 while(p.hand.length<5&&available.length){const i=Math.floor(rng()*available.length);p.hand.push(available.splice(i,1)[0]);}
}
function simulatePlans(players,settings){
 // Decisions use the same pre-placement public boards, never another plan.
 const plans=players.map((p,i)=>normalPlace(p,players.filter(q=>q.id!==p.id),i===0?8:4,settings));
 for(let i=0;i<players.length;i++){
  for(const move of plans[i].moves)placeOne(players[i],move);
  players[i].gold+=2-plans[i].moves.length;
 }
 const g={players,settings,objectives:clone(settings.objectives??[]),logs:[],round:1,orders:{}};resolveRound(g);return g;
}
function rolloutValue(g){
 const p=g.players[0],opponents=g.players.slice(1),best=Math.max(...opponents.map(q=>q.vp));
 if(g.phase==='ended')return (g.winners.includes(p.id)?1200:-1200)+(p.vp-best)*15;
 return cpuScore(p,opponents)+(p.vp-best)*5+recurring(p)*2;
}
function overlordPlace(p,opponents,settings,candidates,options={finalists:12,samples:4,rounds:2}){
 // Deduplicate equivalent outcomes so placement-order symmetry does not fill
 // all finalist slots.
 const unique=new Map();
 for(const c of candidates){
  const key=JSON.stringify([c.p.board.map(b=>[b.card,b.x,b.y]).sort(),c.p.hand,c.p.gold,c.p.tech,c.p.faith,c.p.vp]);
  if(!unique.has(key))unique.set(key,c);
  if(unique.size===options.finalists)break;
 }
 const finalists=[...unique.values()],pool=unknownPool(p,opponents);
 for(const c of finalists){
  const values=[];
  for(let sample=0;sample<options.samples;sample++){
   const rng=scenarioRng(p,opponents,sample),sampledPool=[...pool];
   const others=opponents.map(q=>({...clone(q),hand:[]}));
   for(const q of others)hypotheticalDraw(q,sampledPool,rng);
   const plans=others.map(q=>normalPlace(q,[p,...others.filter(o=>o.id!==q.id)],4,settings));
   for(let i=0;i<others.length;i++){
    for(const move of plans[i].moves)placeOne(others[i],move);others[i].gold+=2-plans[i].moves.length;
   }
   const own=clone(c.p);own.gold+=2-c.moves.length;
   let g={players:[own,...others],settings,objectives:clone(settings.objectives??[]),logs:[],round:1,orders:{}};resolveRound(g);
   // Current round and bounded future rounds, with shared sampled draws across
   // candidates to reduce luck in the comparison.
   for(let round=0;round<options.rounds&&g.phase!=='ended';round++){
    for(const q of g.players){
     const indices=new Set(cpuDraw({...q,cpuDifficulty:'expert'}).discard);
     const removed=q.hand.filter((_,i)=>indices.has(i));
     q.hand=q.hand.filter((_,i)=>!indices.has(i));hypotheticalDraw(q,sampledPool,rng);sampledPool.push(...removed);
    }
    g=simulatePlans(g.players,{...settings,objectives:g.objectives});
   }
   values.push(rolloutValue(g));
  }
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  c.rollout=.85*mean+.15*Math.min(...values); // Prefer robust plans over a lucky draw.
 }
 finalists.sort((a,b)=>b.rollout-a.rollout);return {moves:finalists[0].moves};
}
export function fillCPU(g,submit){
 const phase=g.phase;for(const p of g.players){if(g.phase!==phase)break;if(p.cpu&&!g.orders[p.id])submit(g,p.id,phase==='draw'?cpuDraw(p):cpuPlace(p,g.players.filter(q=>q.id!==p.id),{...g.settings,objectives:g.objectives}));}
}
