import {createHash} from 'node:crypto';
import {CARD,CARDS} from '../public/js/cards.js';
import {clone,legalCells,placeOne,power,amount,level,resolveRound,submit,nextRound,publicPlayer,shuffle} from '../public/js/engine.js';
import {random,unseenPool} from './adaptive-strategies.mjs';
import {strategyPlace,strategyDraw,score} from './strategy-policies.mjs';
import {enumeratePlacements,auditCards,guaranteedEnd} from './endgame-decisions.mjs';
export const visible=p=>({...publicPlayer({...p,hand:p.hand??[]}),hand:[],handCount:p.handCount??p.hand?.length??5});
export function pairFor(p,opponents,settings,seed){
 const pairs=[];for(const invest of [...new Set(p.hand)])for(const payoff of [...new Set(p.hand)])if(invest!==payoff&&CARD[invest].cost<=p.gold&&CARD[payoff].cost<=p.gold){
  const ie=CARD[invest].effects,pe=CARD[payoff].effects;
  if(ie.some(e=>e.phase==='income'||e.phase==='develop')&&pe.some(e=>e.stat==='vp'&&['vp','war','place','noWar'].includes(e.phase)))pairs.push({invest,payoff,type:ie.some(e=>e.phase==='income')?'income':'develop'});
 }
 if(!pairs.length)return null;const pair=pairs[Math.abs(seed)%pairs.length],layouts=[];
 for(const a of legalCells(p.board))for(const b of legalCells(p.board))if(a.x!==b.x||a.y!==b.y){
  if(!legalCells([...p.board,{card:pair.invest,...a}]).some(c=>c.x===b.x&&c.y===b.y)||!legalCells([...p.board,{card:pair.payoff,...b}]).some(c=>c.x===a.x&&c.y===a.y))continue;
  const value=[];for(const seq of [[{card:pair.invest,...a},{card:pair.payoff,...b}],[{card:pair.payoff,...b},{card:pair.invest,...a}]]){
   const q=clone(p);q.gold=100;for(const m of seq)placeOne(q,{handIndex:q.hand.indexOf(m.card),x:m.x,y:m.y});q.gold=0;value.push(score(q,opponents,settings,'balanced'));
  }layouts.push({invest:{card:pair.invest,...a},payoff:{card:pair.payoff,...b},layoutValue:(value[0]+value[1])/2});
 }
 layouts.sort((a,b)=>b.layoutValue-a.layoutValue);return layouts.length?{...pair,...layouts[0]}:null;
}
export function targetFor(p){
 const targets=[];for(const id of [...new Set(p.hand)])for(const cell of legalCells(p.board)){
  const q=clone(p);q.gold=Math.max(q.gold,CARD[id].cost);const result=placeOne(q,{handIndex:q.hand.indexOf(id),...cell});if(result.bonuses.length)targets.push({card:id,...cell,goalKeys:q.bonuses.filter(k=>!p.bonuses.includes(k)),affordable:CARD[id].cost<=p.gold,cost:CARD[id].cost});
 }return targets.sort((a,b)=>Number(a.affordable)-Number(b.affordable)||b.goalKeys.length-a.goalKeys.length||a.cost-b.cost)[0]??null;
}
export function candidates(state){
 if(state.kind==='investment')return [{id:0,label:'investmentFirst',schedule:[state.pair.invest,state.pair.payoff]},{id:1,label:'payoffFirst',schedule:[state.pair.payoff,state.pair.invest]}];
 if(state.kind==='holding')return Array.from({length:2**state.p.hand.length},(_,id)=>{const discard=state.p.hand.map((_,i)=>i).filter(i=>id&(1<<i));return {id,discard,label:state.p.hand.some((card,i)=>card===state.target.card&&!discard.includes(i))?'keep':'replace'};});
 return enumeratePlacements(state.p).map(a=>({id:a.id,moves:a.moves,named:a.named,label:a.player.board.length===9?'finishNow':'defer',features:a.features}));
}
export function worldFor(state,world){
 const opponents=state.opponents.map(visible),seed=createHash('sha256').update(JSON.stringify(['strategic-timing-v1',state.p,opponents,state.settings,state.discard,state.round,state.phase])).digest().readUInt32LE(0),rng=random(seed+Math.imul(world+1,2654435761)),deck=shuffle(unseenPool(state.p,opponents,state.discard),rng),players=[clone(state.p),...opponents.map(clone)];
 for(const q of players.slice(1))for(let i=0;i<q.handCount;i++){if(!deck.length)throw Error('Empty pool');q.hand.push(deck.pop());}
 const g={players,deck,discard:clone(state.discard),settings:clone(state.settings),round:state.round,phase:state.phase,orders:{},logs:[],revision:0,objectives:[]};auditCards(g);return {g,rng};
}
function reservedDraw(p,others,settings,card){const base=strategyDraw(p,others,settings,'balanced');const index=p.hand.indexOf(card);return {discard:base.discard.filter(i=>i!==index)};}
export function rollout(state,candidate,model,world,{limit=12}={}){
 const {g,rng}=worldFor(state,world),p=g.players[0],trajectory=[];let placed=0,targetPlacedAt=null,bonusAt=null;
 for(let step=0;step<limit;step++){
  if(g.phase==='round')nextRound(g);
  if(g.phase==='draw'){
   const orders=g.players.map((q,i)=>{
    const others=g.players.filter(t=>t!==q).map(visible);
    if(i!==0)return strategyDraw(q,others,g.settings,model);
    if(state.kind==='holding'&&step===0)return {discard:candidate.discard};
    if(state.kind==='investment'&&placed<candidate.schedule.length)return reservedDraw(q,others,g.settings,candidate.schedule[placed].card);
    return strategyDraw(q,others,g.settings,'balanced');
   });for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);auditCards(g);
  }
  const orders=g.players.map((q,i)=>{
   const others=g.players.filter(t=>t!==q).map(visible);if(i!==0)return strategyPlace(q,others,g.settings,model,1,1);
   if(state.kind==='ending'&&step===0)return {moves:candidate.moves};
   if(state.kind==='investment'&&placed<candidate.schedule.length){const m=candidate.schedule[placed],index=q.hand.indexOf(m.card);if(index<0)throw Error('Reserved known card missing');if(CARD[m.card].cost>q.gold)return {moves:[]};if(!legalCells(q.board).some(c=>c.x===m.x&&c.y===m.y))throw Error('Reserved layout no longer legal');placed++;return {moves:[{handIndex:index,x:m.x,y:m.y}]};}
   return strategyPlace(q,others,g.settings,'balanced',1,1);
  });
  const own=clone(p),named=[];for(const m of orders[0].moves){named.push(own.hand[m.handIndex]);placeOne(own,m);}if(state.kind==='holding'&&targetPlacedAt===null&&named.includes(state.target.card))targetPlacedAt=step+1;
  for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);auditCards(g);
  if(state.kind==='holding'&&bonusAt===null&&state.target.goalKeys.some(k=>p.bonuses.includes(k)))bonusAt=step+1;
  const ended=g.phase==='ended',kings=p.board.filter(b=>b.card==='human_king').length;
  trajectory.push({step:step+1,round:g.round,vp:p.vp,gold:p.gold,tech:p.tech,faith:p.faith,power:power(p),board:p.board.length,bankedVP:ended?p.vp:p.vp+Math.floor(p.gold/3)*3**kings,ended,placed:named,newBonuses:p.bonuses.filter(k=>!state.p.bonuses.includes(k))});
  if(ended)break;
 }
 const ended=g.phase==='ended',best=Math.max(...g.players.slice(1).map(q=>q.vp));return {model,world,ended,share:ended?(g.winners.includes(p.id)?1/g.winners.length:0):null,vp:ended?p.vp:null,gap:ended?p.vp-best:null,steps:trajectory.length,secondPlaced:state.kind==='investment'?placed===2:null,targetPlacedAt,bonusAt,trajectory};
}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function aggregate(outcomes){const done=outcomes.filter(o=>o.ended);return {ended:done.length,total:outcomes.length,share:mean(done.map(o=>o.share)),vp:mean(done.map(o=>o.vp)),gap:mean(done.map(o=>o.gap)),steps:mean(outcomes.map(o=>o.steps)),endsFirst:mean(outcomes.map(o=>o.ended&&o.steps===1?1:0)),secondPlaced:mean(outcomes.filter(o=>o.secondPlaced!==null).map(o=>Number(o.secondPlaced))),targetPlaced:mean(outcomes.map(o=>Number(o.targetPlacedAt!==null))),bonusMade:mean(outcomes.map(o=>Number(o.bonusAt!==null)))};}
export function select(evaluations,label){const allowed=evaluations.filter(e=>!label||e.label===label).filter(e=>e.train.ended===e.train.total);return [...allowed].sort((a,b)=>b.train.share-a.train.share||b.train.gap-a.train.gap||b.train.vp-a.train.vp||a.id-b.id)[0]?.id??null;}
export function study(state,{trainWorlds=[0,1,2,3],auditWorlds=[100,101,102,103,104,105,106,107]}={}){
 const start=performance.now(),evaluations=candidates(state).map(c=>{
  const run=ws=>['balanced','war'].flatMap(model=>ws.map(world=>rollout(state,c,model,world))),trainOutcomes=run(trainWorlds),auditOutcomes=run(auditWorlds);
  return {...c,train:aggregate(trainOutcomes),audit:aggregate(auditOutcomes),trainOutcomes,auditOutcomes};
 }),groups=state.kind==='investment'?['investmentFirst','payoffFirst']:state.kind==='holding'?['keep','replace']:['finishNow','defer'],choices=Object.fromEntries([...groups,'all'].map(k=>[k,select(evaluations,k==='all'?undefined:k)]));
 return {state,evaluations,choices,timingMs:performance.now()-start};
}
