import {createHash} from 'node:crypto';
import {CARD} from '../public/js/cards.js';
import {clone,legalCells,placeOne,amount,level,power,resolveRound,submit,nextRound,publicPlayer,shuffle} from '../public/js/engine.js';
import {CARDS} from '../public/js/cards.js';
import {knownHandPlans} from './planning-strategies.mjs';
import {knownHandPlans as profilePlans} from './long-term-strategies.mjs';
import {KEYS,random,unseenPool} from './adaptive-strategies.mjs';
import {strategyPlace,strategyDraw,score} from './strategy-policies.mjs';

const visible=p=>({...publicPlayer(p),hand:[]});
const safeOpponent=q=>({...publicPlayer({...q,hand:q.hand??[]}),hand:[],handCount:q.handCount??q.hand?.length??5});
function utility(g){
 const p=g.players[0],others=g.players.slice(1),best=Math.max(...others.map(q=>q.vp));
 if(g.phase==='ended'){const share=g.winners.includes(p.id)?1/g.winners.length:0;return (share?1000*share:-1000)+(p.vp-best)*3;}
 return score(p,others,g.settings,'balanced')/3-Math.max(...others.map(q=>score(q,g.players.filter(t=>t!==q),g.settings,'balanced')/3));
}
function reservedDraw(p,schedule,step){
 const counts=new Map();for(const move of schedule.slice(step).flat())counts.set(move.card,(counts.get(move.card)??0)+1);
 const discard=[];for(let i=0;i<p.hand.length;i++){const id=p.hand[i],n=counts.get(id)??0;if(n)counts.set(id,n-1);else discard.push(i);}return {discard};
}
function scheduledPlace(p,schedule,step){const q=clone(p),moves=[];for(const m of schedule[step]??[]){const i=q.hand.indexOf(m.card);if(i<0||CARD[m.card].cost>q.gold||!legalCells(q.board).some(c=>c.x===m.x&&c.y===m.y))return null;const move={handIndex:i,x:m.x,y:m.y};placeOne(q,move);moves.push(move);}return {moves};}
function orderFor(p,opponents,settings,candidate,phase,step,beam){
 if(candidate.schedule&&step<candidate.schedule.length){if(phase==='draw')return reservedDraw(p,candidate.schedule,step);const order=scheduledPlace(p,candidate.schedule,step);if(order)return order;}
 const key=KEYS.includes(candidate.key)?candidate.key:'balanced';
 return phase==='draw'?strategyDraw(p,opponents,settings,key):strategyPlace(p,opponents,settings,key,1,beam);
}
export function candidatesFor(p,opponents,settings,{rounds=4,beam=4}={}){
 opponents=opponents.map(safeOpponent);
 const old=[...knownHandPlans(p,opponents,settings,{rounds,beam,finalists:1}),...knownHandPlans(p,opponents,settings,{rounds,beam,finalists:1,frontline:true})];
 return [...KEYS.map(key=>({id:key,key,extra:false})),...old.map((plan,i)=>({...plan,id:'plan-'+i,key:'plan-'+i,extra:false})),
 ...['economy','tech','faith','war','bonus','savings'].flatMap(profile=>profilePlans(p,opponents,settings,{rounds,beam,finalists:1,profile}).map(plan=>({...plan,id:'extra-'+profile,key:profile,extra:true})))];
}
function audit(g){const all=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];for(const c of CARDS)if(all.filter(id=>id===c.id).length!==c.copies)throw Error('Card conservation failed');}
export function evaluateCandidate(p,opponents,settings,discard,round,phase,candidate,world,{rounds=4,beam=1}={}){
 opponents=opponents.map(safeOpponent);
 const hash=createHash('sha256').update(JSON.stringify(['planning-v1',p,opponents,settings,discard,round,phase])).digest().readUInt32LE(0);
 const rng=random(hash+Math.imul(world+1,2654435761)),pool=shuffle(unseenPool(p,opponents,discard),rng);
 const players=[clone(p),...opponents.map(q=>({...clone(q),hand:[]}))];for(const q of players.slice(1)){for(let i=0;i<(q.handCount??5);i++){if(!pool.length)throw Error('Empty hypothetical pool');q.hand.push(pool.pop());}}
 const g={players,settings:clone(settings),round,phase,deck:pool,discard:clone(discard),orders:{},logs:[],revision:0};audit(g);
 for(let step=0;step<rounds;step++){
  if(g.phase==='draw'){const orders=g.players.map((q,i)=>i===0?orderFor(q,g.players.filter(t=>t!==q).map(visible),settings,candidate,'draw',step,beam):strategyDraw(q,g.players.filter(t=>t!==q).map(visible),settings,'balanced'));for(let i=0;i<players.length;i++)submit(g,players[i].id,orders[i],rng);}
  const orders=g.players.map((q,i)=>i===0?orderFor(q,g.players.filter(t=>t!==q).map(visible),settings,candidate,'place',step,beam):strategyPlace(q,g.players.filter(t=>t!==q).map(visible),settings,'balanced',1,beam));for(let i=0;i<players.length;i++)submit(g,players[i].id,orders[i],rng);
  if(g.phase==='ended')break;if(step<rounds-1)nextRound(g);
 }audit(g);return {value:utility(g),ended:g.phase==='ended',winShare:g.phase==='ended'?(g.winners.includes(p.id)?1/g.winners.length:0):null,vp:players[0].vp,gap:players[0].vp-Math.max(...players.slice(1).map(q=>q.vp)),round:g.round};
}
const robust=a=>.85*a.reduce((s,n)=>s+n,0)/a.length+.15*Math.min(...a);
export function selectCandidate(evaluations,{expanded=false,worlds=1}={}){
 const allowed=evaluations.filter(e=>expanded||!e.extra);
 return [...allowed].sort((a,b)=>robust(b.train.slice(0,worlds).map(x=>x.value))-robust(a.train.slice(0,worlds).map(x=>x.value)))[0];
}
export function diagnose(state){
 const {p,opponents,settings,discard,round,phase}=state,candidates=candidatesFor(p,opponents,settings),start=performance.now();
 const evaluations=candidates.map(candidate=>({...candidate,train:[0,1,2].map(w=>evaluateCandidate(p,opponents,settings,discard,round,phase,candidate,w)),audit:[100,101,102].map(w=>evaluateCandidate(p,opponents,settings,discard,round,phase,candidate,w))}));
 const choices={};for(const expanded of [false,true])for(const worlds of [1,3]){const e=selectCandidate(evaluations,{expanded,worlds});choices[(expanded?'expanded':'baseline')+worlds]=e.id;}
 return {state,evaluations,choices,timingMs:performance.now()-start};
}
