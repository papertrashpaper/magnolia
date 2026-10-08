import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CARDS} from '../public/js/cards.js';
import {cases,evaluateExample} from '../scripts/card-decision-examples.mjs';
const find=id=>cases.find(c=>c.id===id);
test('card guidance covers every current card exactly once',async()=>{
 const data=JSON.parse(await readFile('research/adaptive-strategy-comparison/card-guidance.json','utf8'));
 assert.deepEqual(data.cards.map(c=>c.id).sort(),CARDS.map(c=>c.id).sort());
 for(const c of data.cards)assert.ok(c.keep&&c.play&&c.reconsider);
});
test('faith developed after war does not retroactively qualify war rewards',()=>{
 const c=find('faith-before-war'),[immediate,developed]=c.plans.map(m=>evaluateExample(c,m));
 assert.equal(immediate.warVP,4);assert.equal(developed.warVP,0);
 assert.equal(immediate.power,6);assert.equal(developed.power,4);assert.equal(developed.powerAfter,6);
});
test('terminal king versus beer preference reverses with available cash',()=>{
 const low=find('king-low-gold'),high=find('king-high-gold');
 const [lowKing,lowBeer]=low.plans.map(m=>evaluateExample(low,m));
 const [highKing,highBeer]=high.plans.map(m=>evaluateExample(high,m));
 assert.ok([lowKing,lowBeer,highKing,highBeer].every(o=>o.ended));
 assert.equal(lowBeer.vpGain-lowKing.vpGain,6);assert.equal(highKing.vpGain-highBeer.vpGain,4);
});
