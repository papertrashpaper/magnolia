import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,makePlayer,previewPlacement,placeOne,resolveRound} from '../public/js/engine.js';
import {random} from '../scripts/adaptive-strategies.mjs';
import {knownHandPlans,choosePlanning} from '../scripts/planning-strategies.mjs';
import {planningMatch} from '../scripts/benchmark-planning.mjs';
import {ROYAL_HAND} from '../scripts/benchmark-royal-route.mjs';
test('known-card search discovers and legally funds a four-round ruler bonus without future draws',()=>{
 const p={...makePlayer('0','self'),hand:[...ROYAL_HAND]},q=makePlayer('1','other'),settings={warVP:[4,0]};
 const before=structuredClone(p),plans=knownHandPlans(p,[q],settings);assert.deepEqual(p,before);assert.ok(plans.length);
 let bonusVP=0;for(const round of plans[0].schedule){for(const m of round){const result=placeOne(p,{handIndex:p.hand.indexOf(m.card),x:m.x,y:m.y});bonusVP+=result.rewards.vp;}
  p.gold+=2-round.length;q.gold+=2;const g={players:[p,q],settings,round:1,phase:'place',logs:[],orders:{},revision:0};resolveRound(g);if(g.phase==='ended')break;
 }
 assert.ok(p.bonuses.some(k=>k.endsWith(':job:ruler')));assert.ok(bonusVP>=18);assert.ok(p.gold>=0);
});
test('planning is reproducible, does not mutate inputs and ignores real hidden cards',()=>{
 const g=newGame([{id:'0',name:'a'},{id:'1',name:'b'}],{},random(81123)),before=structuredClone(g);
 const args=[g.players[0],g.players.slice(1),g.settings,g.discard,1,'place',{worlds:1,rounds:3,beam:4,finalists:2}];
 const a=choosePlanning(...args);previewPlacement(g.players[0],a.order.moves);assert.deepEqual(g,before);
 g.deck.reverse();g.players[1].hand=['demon_storm','human_king','golem_king','dwarf_beer','golem_cristal'];assert.deepEqual(choosePlanning(...args),a);
});
test('both planning and old adaptive finish paired complete games with identical initial hands',()=>{
 const task={id:0,group:'test',count:2,seed:81231,focal:0,opponent:'balanced',options:{worlds:1,rounds:3,beam:4,rolloutBeam:2,finalists:2}};
 const old=planningMatch({...task,treatment:'adaptive'}),planned=planningMatch({...task,treatment:'planning'});assert.deepEqual(old.initial,planned.initial);
 for(const r of [old,planned])assert.equal(r.players.reduce((s,p)=>s+p.winShare,0),1);
 const repeated=planningMatch({...task,treatment:'planning'});delete planned.timing;delete repeated.timing;assert.deepEqual(planned,repeated);
});
