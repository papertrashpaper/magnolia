import {CARD} from './cards.js';
import {clone,legalCells,placeOne,power,level} from './engine.js';
function potential(p){
 let score=0;
 for(const axis of ['x','y'])for(const type of ['race','job']){
  const buckets=new Map();for(const b of p.board){const key=`${b[axis]}:${CARD[b.card][type]}`;buckets.set(key,(buckets.get(key)||0)+1);}
  for(const n of buckets.values())if(n===2)score+=2;
 }return score;
}
function recurring(p){
 let result=0;for(const b of p.board){const c=CARD[b.card];for(const e of c.effects){
  let factor=e.scale==='techLevel'?level(p.tech):e.scale==='faithLevel'?level(p.faith):e.scale?p.board.length/2:1;
  if(e.phase==='vp')result+=e.amount*factor*1.8;
  if(e.phase==='income')result+=e.amount*factor;
  if(e.phase==='develop')result+=e.amount*1.2;
 }}return result;
}
export function cpuScore(p,opponents=[]){
 const s=power(p);const rank=1+opponents.filter(q=>power(q)>s).length;
 return p.vp*3+p.gold*.9+p.tech*.8+p.faith*.8+s*.7+recurring(p)+potential(p)+(rank===1?5:rank===2?2:0)+p.board.length*1.5;
}
export function cpuDraw(p){
 const discard=[];for(let i=0;i<p.hand.length;i++){
  const c=CARD[p.hand[i]];const matching=p.board.filter(b=>CARD[b.card].race===c.race||CARD[b.card].job===c.job).length;
  const valuable=c.cost<=p.gold+3||matching>=2;
  if(!valuable||(!matching&&c.cost>p.gold&&discard.length<3))discard.push(i);
 }return {discard};
}
export function cpuPlace(p,opponents=[]){
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
export function fillCPU(g,submit){
 const phase=g.phase;for(const p of g.players){if(g.phase!==phase)break;if(p.cpu&&!g.orders[p.id])submit(g,p.id,phase==='draw'?cpuDraw(p):cpuPlace(p,g.players.filter(q=>q.id!==p.id)));}
}
