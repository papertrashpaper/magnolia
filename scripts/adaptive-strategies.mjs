import {createHash} from 'node:crypto';
import {CARD,CARDS} from '../public/js/cards.js';
import {clone,submit,nextRound,publicPlayer,shuffle,placeOne} from '../public/js/engine.js';
import {STRATEGIES,strategyDraw,strategyPlace,score} from './strategy-policies.mjs';
export const KEYS=Object.keys(STRATEGIES);
export function random(seed){let n=createHash('sha256').update('magnolia-research-seed:'+seed).digest().readUInt32LE(0);return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
const visible=p=>({...publicPlayer(p),hand:[]});
export function unseenPool(p,opponents,discard){const pool=CARDS.flatMap(c=>Array(c.copies).fill(c.id));for(const id of [...p.hand,...p.board.map(b=>b.card),...opponents.flatMap(q=>q.board.map(b=>b.card)),...discard]){const i=pool.indexOf(id);if(i<0)throw Error('Invalid public card counts');pool.splice(i,1);}return pool;}
function utility(g){const p=g.players[0],others=g.players.slice(1);if(g.phase==='ended'){const top=Math.max(...others.map(q=>q.vp));const share=g.winners.includes(p.id)?1/g.winners.length:0;return (share?1000*share:-1000)+(p.vp-top)*3+p.vp;}return score(p,others,g.settings,'balanced')/3-Math.max(...others.map(q=>score(q,g.players.filter(x=>x!==q),g.settings,'balanced')/3));}
export function chooseStrategy(p,opponents,settings,discard,round,phase,{worlds=2,horizon=1,beam=3}={}){
 // Seed from visible information only, independent of the real game's RNG/deck.
 const hash=createHash('sha256').update(JSON.stringify(['adaptive-research-v1',p,opponents,discard,round,phase])).digest();const seed=hash.readUInt32LE(0);
 const evaluations=[];
 for(const key of KEYS){let total=0;for(let world=0;world<worlds;world++){
  const rng=random(seed+Math.imul(world+1,2654435761)),pool=shuffle(unseenPool(p,opponents,discard),rng);
  const players=[clone(p),...opponents.map(q=>({...clone(q),hand:[]}))];for(const q of players.slice(1)){const count=phase==='place'?5:q.handCount??5;for(let i=0;i<count;i++){if(!pool.length)throw Error('Empty hypothetical pool');q.hand.push(pool.pop());}}
  const g={players,settings:clone(settings),round,phase,deck:pool,discard:clone(discard),orders:{},logs:[],revision:0};
  for(let step=0;step<=horizon;step++){
   if(g.phase==='draw'){const orders=g.players.map((q,i)=>strategyDraw(q,g.players.filter(t=>t!==q).map(visible),g.settings,i===0?key:'balanced'));for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);}
   const orders=g.players.map((q,i)=>strategyPlace(q,g.players.filter(t=>t!==q).map(visible),g.settings,i===0?key:'balanced',1,beam));for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);
   if(g.phase==='ended')break;if(step<horizon)nextRound(g);
  }total+=utility(g);
 }evaluations.push({key,value:total/worlds});}
 const best=Math.max(...evaluations.map(e=>e.value)),coBest=evaluations.filter(e=>Math.abs(e.value-best)<1e-9).map(e=>e.key);
 // Reproducible tie breaking avoids always naming the first strategy.
 const key=coBest[hash.readUInt32LE(4)%coBest.length];
 const order=phase==='draw'?strategyDraw(p,opponents,settings,key):strategyPlace(p,opponents,settings,key,1,beam);
 let q=clone(p);if(phase==='place')for(const move of order.moves)placeOne(q,move);
 const ids=[...p.hand,...p.board.map(b=>b.card)],effects=ids.flatMap(id=>CARD[id].effects);
 const ready={balanced:true,tech:effects.some(e=>e.scale==='techLevel')&&(p.tech>0||effects.some(e=>e.stat==='tech'||e.stat==='equalize')),faith:effects.some(e=>e.scale==='faithLevel')&&(p.faith>0||effects.some(e=>e.stat==='faith'||e.stat==='equalize')),war:effects.some(e=>e.phase==='war'),economy:effects.some(e=>e.phase==='income'),bonus:q.bonuses.length>p.bonuses.length,rush:q.board.length===9,savings:ids.includes('human_king')};
 return {key,coBest,evaluations,order,ready};
}
