import {CARD,CARDS} from '../public/js/cards.js';
import {clone,placeOne,submit,nextRound,amount,level,power} from '../public/js/engine.js';
import {strategyDraw,strategyPlace} from './strategy-policies.mjs';
import {visible,worldFor} from './strategic-timing.mjs';
import {auditCards} from './endgame-decisions.mjs';
export const HIGH=CARDS.filter(c=>c.cost>=5).map(c=>c.id);
export const LABELS={adaptive:'通常の適応判断',drop:'初手で対象を引き直す',once:'初手だけ対象を保持',locked:'置くまで対象を保持',round2:'2ラウンド目まで保持',round3:'3ラウンド目まで保持',affordable:'2ラウンド目以降、払えなければ引き直す',budget:'既知の資金と終了接近で保持解除',finance:'保持して最初の2ラウンドは収入重視',beerOnce:'初手はビール職人だけ保持',smithOnce:'初手は大工だけ保持',beerLocked:'ビール職人だけ配置まで保持',smithLocked:'大工だけ配置まで保持'};
export function policySpecs(state){return Object.keys(LABELS).filter(k=>state.case==='pair'||!['beerOnce','smithOnce','beerLocked','smithLocked'].includes(k)).map(key=>({key}));}
export function freshMemory(){return {released:[],discardedAt:{},returnedAt:{},placedAt:{},releaseEvents:[]};}
const heldTargets=(s,key)=>key.startsWith('beer')?['dwarf_beer']:key.startsWith('smith')?['human_smith']:s.targets;
export function expectedIncome(p){const q=clone(p);for(const b of q.board)for(const e of CARD[b.card].effects)if(e.phase==='develop'&&['tech','faith'].includes(e.stat))q[e.stat]=Math.min(15,q[e.stat]+amount(q,CARD[b.card],e));return q.board.flatMap(b=>CARD[b.card].effects.filter(e=>e.phase==='income').map(e=>amount(q,CARD[b.card],e))).reduce((a,b)=>a+b,0);}
function decision(cache,phase,p,others,settings,key){const k=cache?JSON.stringify([phase,p,others,settings,key]):null;if(cache?.has(k))return clone(cache.get(k));const value=phase==='draw'?strategyDraw(p,others,settings,key):strategyPlace(p,others,settings,key,1,1);if(cache)cache.set(k,clone(value));return value;}
export function retentionOrder(state,key,p,others,settings,round,memory,cache){
 const base=decision(cache,'draw',p,others,settings,'balanced'),discards=new Set(base.discard),targets=heldTargets(state,key),pending=targets.filter(id=>!memory.placedAt[id]&&!memory.released.includes(id));
 let release=[];if(round>1){
  if(key==='round2'&&round>=3||key==='round3'&&round>=4)release=pending;
  if(key==='affordable')release=pending.filter(id=>CARD[id].cost>p.gold);
  if(key==='budget'&&(pending.reduce((s,id)=>s+CARD[id].cost,0)>p.gold+5+expectedIncome(p)||others.some(q=>q.vp>=30||q.board.length>=7)))release=pending;
 }
 if(release.length){memory.released.push(...release);memory.releaseEvents.push({round,cards:release,gold:p.gold,existingIncome:expectedIncome(p),enemyMaxVP:Math.max(...others.map(q=>q.vp)),enemyMaxBoard:Math.max(...others.map(q=>q.board.length))});}
 const persistent=['locked','round2','round3','affordable','budget','finance','beerLocked','smithLocked'].includes(key),force=round===1&&key!=='adaptive';
 for(const id of state.targets){const indices=p.hand.map((v,i)=>v===id?i:-1).filter(i=>i>=0);if(!indices.length)continue;
  const preserve=force?key!=='drop'&&targets.includes(id):persistent&&pending.includes(id)&&!release.includes(id);
  if(force||preserve||release.includes(id))for(const i of indices)discards.add(i);
  if(preserve)discards.delete(indices[0]);
 }
 for(const i of discards)if(state.targets.includes(p.hand[i]))memory.discardedAt[p.hand[i]]??=round;
 return {discard:[...discards].sort((a,b)=>a-b)};
}
export function rolloutRetention(state,key,model,world,{limit=12,cache}={}){
 const {g,rng}=worldFor(state,world),p=g.players[0],memory=freshMemory(),trajectory=[];let targetVP=0,cardIncome=0,drawn=0,unaffordable=0,completedAt=null,completionLevel=null;
 for(let step=0;step<limit;step++){
  if(g.phase==='round')nextRound(g);const beforeDraw=clone(p),others=g.players.slice(1).map(visible);
  const draws=g.players.map((q,i)=>i===0?retentionOrder(state,key,q,others,g.settings,g.round,memory,cache):decision(cache,'draw',q,g.players.filter(t=>t!==q).map(visible),g.settings,model));
  const kept=beforeDraw.hand.filter((_,i)=>!draws[0].discard.includes(i));drawn+=5-kept.length;
  for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,draws[i],rng);auditCards(g);
  for(const id of state.targets)if(memory.discardedAt[id]&&!memory.returnedAt[id]&&p.hand.filter(x=>x===id).length>kept.filter(x=>x===id).length)memory.returnedAt[id]=g.round;
  const afterDraw=clone(p);unaffordable+=state.targets.filter(id=>!memory.placedAt[id]&&p.hand.includes(id)&&CARD[id].cost>p.gold).length;
  const orders=g.players.map((q,i)=>decision(cache,'place',q,g.players.filter(t=>t!==q).map(visible),g.settings,i===0?(key==='finance'&&g.round<=2?'economy':'balanced'):model));
  const preview=clone(p),named=[];for(const move of orders[0].moves){const id=preview.hand[move.handIndex];named.push({card:id,x:move.x,y:move.y,cost:CARD[id].cost});placeOne(preview,move);if(state.targets.includes(id))memory.placedAt[id]??=g.round;}
  for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);auditCards(g);
  if(completedAt===null&&state.targets.every(id=>memory.placedAt[id])){completedAt=g.round;completionLevel=level(p.tech);}
  const roundVP=p.board.filter(b=>state.targets.includes(b.card)).flatMap(b=>CARD[b.card].effects.filter(e=>e.phase==='vp').map(e=>amount(p,CARD[b.card],e))).reduce((a,b)=>a+b,0);targetVP+=roundVP;
  const income=p.board.flatMap(b=>CARD[b.card].effects.filter(e=>e.phase==='income').map(e=>amount(p,CARD[b.card],e))).reduce((a,b)=>a+b,0);cardIncome+=income;
  trajectory.push({round:g.round,goldBeforeDraw:beforeDraw.gold,handBeforeDraw:beforeDraw.hand,discarded:draws[0].discard.map(i=>beforeDraw.hand[i]),handBeforePlace:afterDraw.hand,goldBeforePlace:afterDraw.gold,placed:named,cardIncome:income,gold:p.gold,vp:p.vp,tech:p.tech,faith:p.faith,board:p.board.length,power:power(p),targetVP:roundVP,bonuses:[...p.bonuses],enemy:g.players.slice(1).map(q=>({id:q.id,vp:q.vp,gold:q.gold,board:q.board.length,power:power(q)})),ended:g.phase==='ended'});
  if(g.phase==='ended')break;
 }
 const ended=g.phase==='ended';return {model,world,ended,share:ended?(g.winners.includes(p.id)?1/g.winners.length:0):null,vp:ended?p.vp:null,gap:ended?p.vp-Math.max(...g.players.slice(1).map(q=>q.vp)):null,lastRound:g.round,completedAt,completionLevel,placedAt:memory.placedAt,discardedAt:memory.discardedAt,returnedAt:memory.returnedAt,releaseEvents:memory.releaseEvents,targetVP,cardIncome,drawn,unaffordable,unplaced:state.targets.filter(id=>!memory.placedAt[id]),finalBoard:p.board,trajectory};
}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function aggregateRetention(outcomes,state){const done=outcomes.filter(o=>o.ended);return {total:outcomes.length,ended:done.length,share:mean(done.map(o=>o.share)),vp:mean(done.map(o=>o.vp)),gap:mean(done.map(o=>o.gap)),rounds:mean(outcomes.map(o=>o.lastRound)),complete:mean(outcomes.map(o=>Number(o.completedAt!==null))),completeBy3:mean(outcomes.map(o=>Number(o.completedAt!==null&&o.completedAt<=3))),targetVP:mean(outcomes.map(o=>o.targetVP)),cardIncome:mean(outcomes.map(o=>o.cardIncome)),drawn:mean(outcomes.map(o=>o.drawn)),unaffordable:mean(outcomes.map(o=>o.unaffordable)),unplaced:mean(outcomes.map(o=>o.unplaced.length)),neverPlaced:mean(outcomes.map(o=>Number(o.unplaced.length>0))),onlyFinal:mean(outcomes.map(o=>Number(o.completedAt!==null&&o.completedAt===o.lastRound))),reacquired:mean(outcomes.map(o=>Number(state.targets.some(id=>o.returnedAt[id])))),released:mean(outcomes.map(o=>Number(o.releaseEvents.length>0))),byCard:Object.fromEntries(state.targets.map(id=>[id,{placed:mean(outcomes.map(o=>Number(!!o.placedAt[id]))),placedBy3:mean(outcomes.map(o=>Number(!!o.placedAt[id]&&o.placedAt[id]<=3))),reacquired:mean(outcomes.map(o=>Number(!!o.returnedAt[id])))}]))};}
export function studyRetention(state,{worlds=[100,101,102,103,104,105,106,107],models=['balanced','war']}={}){const start=performance.now(),cache=new Map();return {state,evaluations:policySpecs(state).map(({key})=>{const outcomes=models.flatMap(model=>worlds.map(world=>rolloutRetention(state,key,model,world,{cache})));return {key,outcomes,aggregate:aggregateRetention(outcomes,state),byModel:Object.fromEntries(models.map(model=>[model,aggregateRetention(outcomes.filter(o=>o.model===model),state)]))};}),timingMs:performance.now()-start};}
