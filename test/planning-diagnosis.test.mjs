import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../public/js/engine.js';
import {random} from '../scripts/adaptive-strategies.mjs';
import {choosePlanning} from '../scripts/planning-strategies.mjs';
import {candidatesFor,evaluateCandidate,selectCandidate} from '../scripts/diagnose-planning.mjs';
test('baseline candidate evaluation matches the existing planner exactly',()=>{
 const g=newGame([{id:'0',name:'0'},{id:'1',name:'1'}],{},random(1020345)),p=g.players[0],others=g.players.slice(1),before=structuredClone(g);
 const candidates=candidatesFor(p,others,g.settings),evaluations=candidates.map(c=>({...c,train:[0,1,2].map(w=>evaluateCandidate(p,others,g.settings,g.discard,1,'draw',c,w))}));
 for(const worlds of [1,3]){const d=choosePlanning(p,others,g.settings,g.discard,1,'draw',{worlds,rounds:4,beam:4,rolloutBeam:1,finalists:2});assert.equal(selectCandidate(evaluations,{worlds}).id,d.key);for(const e of d.evaluations){const ours=evaluations.find(c=>c.id===e.key);assert.deepEqual(ours.train.slice(0,worlds).map(x=>x.value),e.values);}}
 assert.deepEqual(g,before);assert.equal(candidates.filter(c=>c.extra).length,6);
});
test('independent-world evaluation ignores real hidden cards and is reproducible',()=>{
 const g=newGame([{id:'0',name:'0'},{id:'1',name:'1'}],{},random(1020346)),p=g.players[0],others=g.players.slice(1),c=candidatesFor(p,others,g.settings)[0];
 const run=()=>evaluateCandidate(p,others,g.settings,g.discard,1,'draw',c,100),a=run();g.deck.reverse();g.players[1].hand=Array(5).fill('demon_storm');assert.deepEqual(run(),a);
});
