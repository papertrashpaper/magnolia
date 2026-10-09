import {createHash} from 'node:crypto';
import {CARD,CARDS} from '../public/js/cards.js';
import {clone,legalCells,placeOne,power,amount,submit,resolveRound,publicPlayer,shuffle} from '../public/js/engine.js';
import {random,unseenPool} from './adaptive-strategies.mjs';
import {strategyPlace} from './strategy-policies.mjs';
const visible=p=>({...publicPlayer({...p,hand:p.hand??[]}),hand:[],handCount:p.handCount??p.hand?.length??5});
export function guaranteedEnd(players){return players.some(p=>p.vp+p.board.flatMap(b=>CARD[b.card].effects.filter(e=>e.phase==='vp').map(e=>amount(p,CARD[b.card],e))).reduce((a,b)=>a+b,0)>=40);}
export function enumeratePlacements(p){
 const out=[],visit=(q,moves,named)=>{out.push({id:out.length,moves,named,player:q,features:{count:moves.length,power:power(q),powerGain:power(q)-power(p),newBonuses:q.bonuses.length-p.bonuses.length,placementVP:q.vp-p.vp,placementGold:q.gold-p.gold,remainingGold:q.gold+2-moves.length,techGain:q.tech-p.tech,faithGain:q.faith-p.faith}});
  if(moves.length===2)return;
  for(let handIndex=0;handIndex<q.hand.length;handIndex++)if(CARD[q.hand[handIndex]].cost<=q.gold)for(const cell of legalCells(q.board)){
   const n=clone(q),id=n.hand[handIndex],move={handIndex,...cell};placeOne(n,move);visit(n,[...moves,move],[...named,{card:id,...cell}]);
  }
 };visit(clone(p),[],[]);return out;
}
export function auditCards(g){const ids=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];for(const c of CARDS)if(ids.filter(id=>id===c.id).length!==c.copies)throw Error('Wrong card count: '+c.id);}
export function makeWorld(state,model,world){
 const {p,settings,discard,round}=state,opponents=state.opponents.map(visible),seed=createHash('sha256').update(JSON.stringify(['endgame-v1',p,opponents,settings,discard,round])).digest().readUInt32LE(0),rng=random(seed+Math.imul(world+1,2654435761)),pool=shuffle(unseenPool(p,opponents,discard),rng),players=[clone(p),...opponents.map(clone)];
 for(const q of players.slice(1))for(let i=0;i<q.handCount;i++){if(!pool.length)throw Error('Empty pool');q.hand.push(pool.pop());}
 const g={players,deck:pool,discard:clone(discard),settings:clone(settings),round,phase:'place',orders:{},logs:[],revision:0};auditCards(g);
 const orders=players.slice(1).map(q=>strategyPlace(q,players.filter(t=>t!==q).map(visible),settings,model,1,4));
 const responses=[];for(let i=1;i<players.length;i++){const q=players[i],named=[];for(const m of orders[i-1].moves){named.push({card:q.hand[m.handIndex],x:m.x,y:m.y});placeOne(q,m);}q.gold+=2-orders[i-1].moves.length;responses.push({id:q.id,moves:named});}
 return {model,world,players,deck:pool,discard:clone(discard),responses};
}
export function finishAction(state,action,world,{audit=false}={}){
 const p=clone(action.player);p.gold+=2-action.moves.length;
 const g={players:[p,...world.players.slice(1).map(clone)],deck:world.deck,discard:world.discard,settings:state.settings,round:state.round,phase:'place',orders:{},logs:[],revision:0};
 if(audit)auditCards(g);resolveRound(g);if(g.phase!=='ended')throw Error('Not a guaranteed final round');if(audit)auditCards(g);
 return [g.winners.includes(p.id)?1/g.winners.length:0,p.vp,p.vp-Math.max(...g.players.slice(1).map(q=>q.vp)),p.rank,p.warVP,p.finalGoldVP];
}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function aggregate(outcomes){return {share:mean(outcomes.map(x=>x[0])),vp:mean(outcomes.map(x=>x[1])),gap:mean(outcomes.map(x=>x[2])),rank:mean(outcomes.map(x=>x[3])),warVP:mean(outcomes.map(x=>x[4])),goldVP:mean(outcomes.map(x=>x[5]))};}
export function choose(actions,key='all'){
 let allowed=actions;
 if(key==='war'){const best=Math.max(...actions.map(a=>a.features.power));allowed=actions.filter(a=>a.features.power===best);}
 if(key==='bonus')allowed=actions.filter(a=>a.features.newBonuses>0);
 if(key==='single')allowed=actions.filter(a=>a.features.count<=1);
 if(key==='double')allowed=actions.filter(a=>a.features.count===2);
 if(key==='pass')allowed=actions.filter(a=>a.features.count===0);
 if(!allowed.length)return null;
 const ordered=[...allowed].sort((a,b)=>key==='ownVP'?b.train.vp-a.train.vp||b.train.share-a.train.share||a.id-b.id:b.train.share-a.train.share||b.train.gap-a.train.gap||b.train.vp-a.train.vp||a.id-b.id);
 return ordered[0].id;
}
export function study(state,{trainWorlds=Array.from({length:8},(_,i)=>i),auditWorlds=Array.from({length:16},(_,i)=>100+i)}={}){
 if(!guaranteedEnd([state.p,...state.opponents]))throw Error('End is not guaranteed');const start=performance.now(),enumerated=enumeratePlacements(state.p),models=['balanced','war'],worlds=models.flatMap(model=>[...trainWorlds.map(world=>({...makeWorld(state,model,world),split:'train'})),...auditWorlds.map(world=>({...makeWorld(state,model,world),split:'audit'}))]);
 const actions=enumerated.map(a=>{
  const outcomes=worlds.map(w=>finishAction(state,a,w,{audit:true})),train=outcomes.filter((_,i)=>worlds[i].split==='train'),held=outcomes.filter((_,i)=>worlds[i].split==='audit');
  return {id:a.id,moves:a.moves,named:a.named,features:a.features,train:aggregate(train),audit:aggregate(held),byModel:Object.fromEntries(models.map(model=>[model,{train:aggregate(outcomes.filter((_,i)=>worlds[i].model===model&&worlds[i].split==='train')),audit:aggregate(outcomes.filter((_,i)=>worlds[i].model===model&&worlds[i].split==='audit'))}])),outcomes};
 });const choices=Object.fromEntries(['all','war','bonus','single','double','pass','ownVP'].map(k=>[k,choose(actions,k)]));
 const frozen=makeFrozen(state),publicOnly=enumerated.map(a=>({id:a.id,outcome:finishAction(state,a,frozen)}));
 return {state,choices,actions,worlds:worlds.map(({model,world,split,responses})=>({model,world,split,responses})),publicOnly,timingMs:performance.now()-start};
}
function makeFrozen(state){return {players:[state.p,...state.opponents.map(q=>({...clone(q),hand:[],gold:q.gold+2}))],deck:[],discard:[],responses:[]};}
