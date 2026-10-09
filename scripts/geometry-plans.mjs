import {createHash} from 'node:crypto';
import {CARD} from '../public/js/cards.js';
import {clone,legalCells,placeOne,amount,level,power,resolveRound,submit,nextRound,publicPlayer,shuffle} from '../public/js/engine.js';
import {KEYS,random,unseenPool} from './adaptive-strategies.mjs';
import {strategyPlace,strategyDraw,score} from './strategy-policies.mjs';

// Preserve exact card coordinates and bonus identities; card insertion order has no geometric meaning.
export function geometryKey(p){return JSON.stringify([[...p.hand].sort(),p.gold,p.tech,p.faith,p.vp,[...p.bonuses].sort(),p.board.map(b=>[b.x,b.y,b.card]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2].localeCompare(b[2]))]);}
const safeOpponent=q=>({...publicPlayer({...q,hand:q.hand??[]}),hand:[],handCount:q.handCount??q.hand?.length??5});
function utility(g){
 const p=g.players[0],others=g.players.slice(1),best=Math.max(...others.map(q=>q.vp));
 if(g.phase==='ended'){const share=g.winners.includes(p.id)?1/g.winners.length:0;return (share?1000*share:-1000)+(p.vp-best)*3;}
 return score(p,others,g.settings,'balanced')/3-Math.max(...others.map(q=>score(q,g.players.filter(t=>t!==q),g.settings,'balanced')/3));
}
function resources(p){const r={vp:0,gold:3,tech:0,faith:0};for(const b of p.board)for(const e of CARD[b.card].effects){if(e.phase==='vp')r.vp+=amount(p,CARD[b.card],e);if(e.phase==='income')r.gold+=amount(p,CARD[b.card],e);if(e.phase==='develop')r[e.stat]+=amount(p,CARD[b.card],e);}return r;}
function planningValue(p,opponents,settings,left){
 const r=resources(p),remaining=Math.max(1,left),futureTech=level(Math.min(15,p.tech+r.tech*Math.max(0,left-1))),futureFaith=level(Math.min(15,p.faith+r.faith*Math.max(0,left-1)));
 let futureVP=0;for(const b of p.board)for(const e of CARD[b.card].effects)if(e.phase==='vp')futureVP+=e.scale==='techLevel'?e.amount*futureTech:e.scale==='faithLevel'?e.amount*futureFaith:amount(p,CARD[b.card],e);
 const king=p.board.some(b=>CARD[b.card].effects.some(e=>e.stat==='tripleGold'));
 const known=[...p.board.map(b=>b.card),...p.hand],storm=known.some(id=>CARD[id].effects.some(e=>e.stat==='doubleBonus'));
 let potential=0;
 if(left>0&&p.hand.length){
  const cost=p.hand.reduce((n,id)=>n+CARD[id].cost,0),funding=Math.min(1,(p.gold+r.gold*left)/Math.max(1,cost));
  const capacity=Math.min(1,(9-p.board.length)/p.hand.length,2*left/p.hand.length);
  for(const id of p.hand)for(const e of CARD[id].effects)if(e.phase==='vp')potential+=e.scale==='techLevel'?e.amount*futureTech:e.scale==='faithLevel'?e.amount*futureFaith:e.scale?0:e.amount;
  potential*=funding*capacity*1.5;
  for(const type of ['race','job'])for(const value of new Set(known.map(id=>CARD[id][type]))){
   const onBoard=p.board.filter(b=>CARD[b.card][type]===value).length,inHand=p.hand.filter(id=>CARD[id][type]===value).length;
   if(inHand&&onBoard+inHand>=3&&p.board.length+Math.max(0,3-onBoard)<=9){const reward=type==='job'?(value==='ruler'?9:value==='merchant'?5:value==='mage'?3:2):(value==='demon'?7:value==='human'?5:2);potential+=reward*(storm?2:1)*funding*.6;}
  }
 }
 // Money reserved for the known schedule is not also valued as final savings.
 const reserve=left>0?p.hand.reduce((n,id)=>n+CARD[id].cost,0):0;
 const uncommitted=Math.max(0,p.gold-reserve);
 return score({...p,gold:uncommitted},opponents,settings,'balanced')/3+futureVP*remaining*.8+r.gold*left*.35+uncommitted*(king?.4:0)+potential;
}
function actions(p,opponents,settings,width,left,frontline=false){
 let beam=[{p:clone(p),moves:[],named:[]}],all=[beam[0]];
 for(let d=0;d<2;d++){
  const next=[];for(const a of beam)for(let i=0;i<a.p.hand.length;i++)if(CARD[a.p.hand[i]].cost<=a.p.gold)for(const cell of legalCells(a.p.board)){
   const q=clone(a.p),id=q.hand[i];placeOne(q,{handIndex:i,...cell});const moves=[...a.moves,{handIndex:i,...cell}],named=[...a.named,{card:id,...cell}];
   const rewarded={...q,gold:q.gold+2-moves.length};next.push({p:q,moves,named,value:planningValue(rewarded,opponents,settings,left)+(frontline?power(q)*2:0)});
  }
  next.sort((a,b)=>b.value-a.value);const unique=new Map();for(const n of next){const key=geometryKey(n.p);if(!unique.has(key))unique.set(key,n);if(unique.size===width)break;}beam=[...unique.values()];all.push(...beam);
 }
 return all;
}
export function geometryPlans(p,opponents,settings,{rounds=4,beam=8,finalists=3,frontline=false}={}){
 opponents=opponents.map(safeOpponent);
 let states=[{players:[clone(p),...opponents.map(q=>({...clone(q),hand:[]}))],schedule:[],powers:[],ended:false,value:0,tempo:0}];
 for(let step=0;step<rounds;step++){
  const next=[];
  for(const state of states){if(state.ended){next.push(state);continue;}
   const others=state.players.slice(1);
   for(const action of actions(state.players[0],others,settings,beam,rounds-step,frontline)){
    const players=[clone(action.p),...others.map(clone)];players[0].gold+=2-action.moves.length;for(const q of players.slice(1))q.gold+=2;
    const g={players,settings:clone(settings),round:step+1,phase:'place',logs:[],orders:{},revision:0};resolveRound(g);
    const ended=g.phase==='ended',tempo=state.tempo+players[0].vp;
    const base=frontline?(ended?players[0].vp-Math.max(...players.slice(1).map(q=>q.vp)):planningValue(players[0],players.slice(1),settings,rounds-step-1))+(power(players[0])*2):(ended?utility(g):planningValue(players[0],players.slice(1),settings,rounds-step-1));
    const value=base+tempo*.001;
    next.push({players,schedule:[...state.schedule,action.named],powers:[...state.powers,players[0].power],ended,value,tempo});
   }
  }
  next.sort((a,b)=>b.value-a.value);const unique=new Map();for(const n of next){const own=n.players[0],key=JSON.stringify([geometryKey(own),n.schedule.map(m=>m.map(x=>x.card).sort())]);if(!unique.has(key))unique.set(key,n);if(unique.size===beam)break;}states=[...unique.values()];
 }
 // Keep timing alternatives, including plans with the same first action.
 const distinct=new Map();for(const s of states){const timing=JSON.stringify(s.schedule);if(!distinct.has(timing))distinct.set(timing,s);}
 return [...distinct.values()].sort((a,b)=>b.value-a.value).slice(0,finalists).map(s=>({schedule:s.schedule,value:s.value}));
}
