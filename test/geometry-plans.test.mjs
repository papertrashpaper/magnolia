import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,newGame,placeOne,resolveRound,legalCells} from '../public/js/engine.js';
import {CARD} from '../public/js/cards.js';
import {random} from '../scripts/adaptive-strategies.mjs';
import {geometryKey,geometryPlans} from '../scripts/geometry-plans.mjs';
import {candidatesFor as oldCandidates} from '../scripts/diagnose-planning.mjs';
import {candidatesFor} from '../scripts/diagnose-geometry.mjs';
test('geometry identity keeps different arrangements and ignores insertion order',()=>{
 const g=newGame([{id:'0',name:'0'},{id:'1',name:'1'}],{},random(1051000)),a=clone(g.players[0]);
 a.board=[{card:a.hand[0],x:0,y:0},{card:a.hand[1],x:1,y:0}];
 const b=clone(a);b.board.reverse();assert.equal(geometryKey(a),geometryKey(b));b.board[0].y=-1;assert.notEqual(geometryKey(a),geometryKey(b));
});
test('geometry plans retain baseline candidates, remain legal and cannot see opponent hands',()=>{
 const g=newGame([{id:'0',name:'0'},{id:'1',name:'1'}],{},random(1051001)),p=g.players[0],opponents=g.players.slice(1),state={p,opponents,settings:g.settings},before=clone(g);
 const candidates=candidatesFor(state),baseline=oldCandidates(p,opponents,g.settings).filter(e=>!e.extra);
 assert.deepEqual(candidates.filter(e=>!e.extra),baseline);assert.deepEqual(g,before);
 assert.ok(candidates.some(e=>e.group==='wide'));assert.ok(candidates.some(e=>e.group==='geometry'));
 for(const candidate of candidates.filter(e=>e.group==='geometry')){
  const players=clone(g.players);
  for(const actions of candidate.schedule){
   for(const m of actions){const q=players[0],handIndex=q.hand.indexOf(m.card);assert.ok(handIndex>=0);assert.ok(q.gold>=CARD[m.card].cost);assert.ok(legalCells(q.board).some(c=>c.x===m.x&&c.y===m.y));placeOne(q,{handIndex,x:m.x,y:m.y});}
   players[0].gold+=2-actions.length;for(const q of players.slice(1))q.gold+=2;
   const model={players,settings:clone(g.settings),round:1,phase:'place',logs:[],orders:{},revision:0};resolveRound(model);if(model.phase==='ended')break;
  }
 }
 const a=geometryPlans(p,opponents,g.settings,{beam:16,finalists:3});opponents[0].hand=Array(5).fill('demon_storm');assert.deepEqual(geometryPlans(p,opponents,g.settings,{beam:16,finalists:3}),a);
});
