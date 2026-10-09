import {CARD} from '../public/js/cards.js';
import {clone,placeOne,submit,nextRound,amount,level,power} from '../public/js/engine.js';
import {strategyDraw,strategyPlace} from './strategy-policies.mjs';
import {visible,worldFor} from './strategic-timing.mjs';
import {auditCards} from './endgame-decisions.mjs';
import {freshMemory,retentionOrder} from './high-cost-retention.mjs';
export function focusRoute(state){const effects=state.targets.flatMap(id=>CARD[id].effects);if(effects.some(e=>e.stat==='tripleGold'))return 'savings';if(effects.some(e=>e.stat==='doubleBonus'))return 'bonus';if(effects.some(e=>e.scale==='techLevel'||e.stat==='tech'))return 'tech';if(effects.some(e=>e.scale==='faithLevel'||e.stat==='faith'))return 'faith';if(effects.some(e=>e.phase==='income'))return 'economy';if(effects.some(e=>e.phase==='war'))return 'war';if(effects.some(e=>e.scale==='cost3Minus'))return 'rush';return 'balanced';}
function decision(cache,phase,p,others,settings,key){const k=cache?JSON.stringify([phase,p,others,settings,key]):null;if(cache?.has(k))return clone(cache.get(k));const value=phase==='draw'?strategyDraw(p,others,settings,key):strategyPlace(p,others,settings,key,1,1);if(cache)cache.set(k,clone(value));return value;}
// Same engine and observation contract as the primary study; only own placement emphasis differs.
export function rolloutFocused(state,key,model,world,{limit=12,cache,strategy=focusRoute(state)}={}){
 const {g,rng}=worldFor(state,world),p=g.players[0],memory=freshMemory(),trajectory=[];let targetVP=0,cardIncome=0,drawn=0,unaffordable=0,completedAt=null,completionLevel=null;
 for(let step=0;step<limit;step++){
  if(g.phase==='round')nextRound(g);const beforeDraw=clone(p),others=g.players.slice(1).map(visible);
  const draws=g.players.map((q,i)=>i===0?retentionOrder(state,key,q,others,g.settings,g.round,memory,cache):decision(cache,'draw',q,g.players.filter(t=>t!==q).map(visible),g.settings,model));
  const kept=beforeDraw.hand.filter((_,i)=>!draws[0].discard.includes(i));drawn+=5-kept.length;
  for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,draws[i],rng);auditCards(g);
  for(const id of state.targets)if(memory.discardedAt[id]&&!memory.returnedAt[id]&&p.hand.filter(x=>x===id).length>kept.filter(x=>x===id).length)memory.returnedAt[id]=g.round;
  const afterDraw=clone(p);unaffordable+=state.targets.filter(id=>!memory.placedAt[id]&&p.hand.includes(id)&&CARD[id].cost>p.gold).length;
  const orders=g.players.map((q,i)=>decision(cache,'place',q,g.players.filter(t=>t!==q).map(visible),g.settings,i===0?strategy:model));
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
