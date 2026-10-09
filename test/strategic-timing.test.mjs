import test from 'node:test';
import assert from 'node:assert/strict';
import {makeStates} from '../scripts/run-strategic-timing.mjs';
import {candidates,worldFor,rollout,select,pairFor} from '../scripts/strategic-timing.mjs';
import {auditCards} from '../scripts/endgame-decisions.mjs';
import {makePlayer,clone,legalCells,placeOne} from '../public/js/engine.js';
test('investment intervention swaps the same cards and layout and keeps reserved cards until affordable',()=>{
 const state=makeStates('investment','pilot').states[0],before=structuredClone(state),cs=candidates(state);assert.equal(cs.length,2);assert.deepEqual(cs[0].schedule,cs[1].schedule.toReversed());
 const a=rollout(state,cs[0],'balanced',0),b=rollout(state,cs[1],'balanced',0);assert.ok(a.ended&&b.ended);assert.ok(a.trajectory[0].placed.includes(state.pair.invest.card));assert.ok(b.trajectory[0].placed.includes(state.pair.payoff.card));assert.deepEqual(state,before);
 const world=worldFor(state,100);auditCards(world.g);state.opponents[0].hand=Array(5).fill('demon_storm');assert.deepEqual(worldFor(state,100).g,world.g);
});
test('holding candidates enumerate every discard subset and distinguish retaining a copy',()=>{
 const state={kind:'holding',p:{hand:['human_smith','human_smith','elf_artist']},target:{card:'human_smith'}};
 const cs=candidates(state);assert.equal(cs.length,8);assert.equal(cs.filter(c=>c.label==='keep').length,6);assert.equal(cs.filter(c=>c.label==='replace').length,2);assert.equal(new Set(cs.map(c=>JSON.stringify(c.discard))).size,8);
});
test('ending candidates use the actual nine-card condition rather than an imposed stop',()=>{
 const p=makePlayer('0','0');p.gold=20;p.hand=['elf_archer','goblin_soldier'];p.board=['human_marchant','human_knight','dwarf_cook','elf_artist','goblin_saint','golem_iron','demon_pest'].map((card,i)=>({card,x:i%3,y:Math.floor(i/3)}));const cs=candidates({kind:'ending',p});assert.ok(cs.some(c=>c.label==='finishNow'));assert.ok(cs.some(c=>c.label==='defer'));
 for(const c of cs){const q=clone(p);for(const m of c.moves)placeOne(q,m);assert.equal(c.label==='finishNow',q.board.length===9);}
});
test('selection uses only completed training outcomes and never the independent audit',()=>{
 const es=[{id:0,label:'keep',train:{ended:8,total:8,share:.5,gap:0,vp:40},audit:{share:0}},{id:1,label:'keep',train:{ended:7,total:8,share:1,gap:10,vp:50},audit:{share:1}}];assert.equal(select(es,'keep'),0);es[0].audit.share=100;assert.equal(select(es,'keep'),0);assert.equal(select(es,'replace'),null);
});
test('both-now supplement respects actual sequential funding and shares the initial hypothetical deal',async()=>{
 const {immediateOptions}=await import('../scripts/extend-investment-timing.mjs');
 const p=makePlayer('0','0');p.gold=2;p.hand=['golem_gold','human_marchant'];p.board=[{card:'human_marchant',x:0,y:0},{card:'dwarf_gem',x:1,y:0}];
 const state={p,pair:{invest:{card:'golem_gold',x:0,y:1},payoff:{card:'human_marchant',x:1,y:1}}};const cs=immediateOptions(state);assert.equal(cs.length,1);assert.deepEqual(cs[0].named.map(m=>m.card),['golem_gold','human_marchant']);
 const natural=makeStates('investment','pilot').states[0];assert.deepEqual(worldFor(natural,100).g,worldFor({...natural,kind:'ending'},100).g);
});
