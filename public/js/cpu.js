import {CARD} from './cards.js?v=3';
import {clone,legalCells,placeOne,power,level,amount,resolveRound,normalizeCPU} from './engine.js?v=9';
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
export function cpuScore(p,opponents=[]){
 const s=power(p);const rank=1+opponents.filter(q=>power(q)>s).length;
 return p.vp*3+p.gold*.9+p.tech*.8+p.faith*.8+s*.7+recurring(p)+potential(p)+(rank===1?5:rank===2?2:0)+p.board.length*1.5;
}
export function cpuDraw(p,rng=Math.random){
 const difficulty=normalizeCPU(p.cpuDifficulty);
 if(difficulty==='easy')return {discard:p.hand.flatMap((_,i)=>rng()<.25?[i]:[])};
 const discard=[];for(let i=0;i<p.hand.length;i++){
  const c=CARD[p.hand[i]];const matching=p.board.filter(b=>CARD[b.card].race===c.race||CARD[b.card].job===c.job).length;
  const advanced=difficulty==='expert';
  const valuable=c.cost<=p.gold+(advanced?1:3)||matching>=2;
  if(advanced&&c.cost<=p.gold&&matching>0)continue;
  if(!valuable||(!matching&&c.cost>p.gold&&discard.length<3))discard.push(i);
 }return {discard};
}
function normalPlace(p,opponents=[]){
 const initial={p:clone(p),moves:[],score:cpuScore({...clone(p),gold:p.gold+2},opponents)};let best=initial;
 let beam=[{p:clone(p),moves:[]}];
 for(let depth=0;depth<2;depth++){
  const candidates=[];
  for(const entry of beam)for(let i=0;i<entry.p.hand.length;i++){
   if(CARD[entry.p.hand[i]].cost>entry.p.gold)continue;
   for(const cell of legalCells(entry.p.board)){
    const next=clone(entry.p),move={handIndex:i,...cell};placeOne(next,move);
    const moves=[...entry.moves,move],score=cpuScore({...clone(next),gold:next.gold+2-moves.length},opponents);
    const candidate={p:next,moves,score};candidates.push(candidate);if(score>best.score)best=candidate;
   }
  }
  candidates.sort((a,b)=>b.score-a.score);beam=candidates.slice(0,14);
 }return {moves:best.moves};
}
// All search uses only this player's hand and opponents' public kingdoms.
function forecast(p,opponents,settings){
 const players=[clone(p),...opponents.map(q=>({...clone(q),hand:[]}))];
 const g={players,settings,logs:[],round:1,orders:{}};resolveRound(g);
 const after=g.players[0];
 if(g.phase==='ended')return {score:1000+after.vp*10+(g.winners.includes(after.id)?500:0),after,ended:true};
 return {score:cpuScore(after,g.players.slice(1))+after.vp+recurring(after)*2+potential(after),after,ended:false};
}
export function cpuPlace(p,opponents=[],settings={},rng=Math.random){
 const difficulty=normalizeCPU(p.cpuDifficulty);
 if(difficulty==='normal')return normalPlace(p,opponents);
 if(difficulty==='easy'){
  const draft=clone(p),moves=[];
  for(let depth=0;depth<2;depth++){
   const cards=draft.hand.flatMap((id,i)=>CARD[id].cost<=draft.gold?[i]:[]),cells=legalCells(draft.board);
   if(!cards.length||!cells.length||rng()<.15)break;
   const move={handIndex:cards[Math.floor(rng()*cards.length)],...cells[Math.floor(rng()*cells.length)]};
   placeOne(draft,move);moves.push(move);
  }return {moves};
 }
 const rules={warVP:settings.warVP??(opponents.length===1?[4,0]:[5,3,0,0,0])};
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
  beam=difficulty==='expert'?nextBeam:nextBeam.slice(0,24);
 }
 candidates.sort((a,b)=>b.score-a.score);
 if(difficulty==='expert'){
  // Look ahead using remaining known cards, never the deck or other hands.
  const finalists=candidates.slice(0,8);
  for(const c of finalists)if(!c.ended){
   const next=clone(c.after),order=normalPlace(next,opponents);
   for(const move of order.moves)placeOne(next,move);next.gold+=2-order.moves.length;
   c.score+=.55*(forecast(next,opponents,rules).score-c.score);
  }
  finalists.sort((a,b)=>b.score-a.score);return {moves:finalists[0].moves};
 }
 return {moves:candidates[0].moves};
}
export function fillCPU(g,submit){
 const phase=g.phase;for(const p of g.players){if(g.phase!==phase)break;if(p.cpu&&!g.orders[p.id])submit(g,p.id,phase==='draw'?cpuDraw(p):cpuPlace(p,g.players.filter(q=>q.id!==p.id),g.settings));}
}
