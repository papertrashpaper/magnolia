import {test} from 'node:test';
import assert from 'node:assert/strict';
import {match} from '../scripts/benchmark-strategies.mjs';
import {validate} from '../scripts/analyze-strategies.mjs';
for(const count of [2,3,4,5])test(`strategy research reproduces legal complete ${count}-player games`,()=>{
 const task={id:0,group:'test',lineup:['balanced','bonus','tech','faith','war'].slice(0,count),seed:54321+count,warVP:count===2?[4,0]:[5,3,...Array(count-2).fill(0)],variant:1,beam:5};
 const a=match(task),b=match(task);assert.deepEqual(a,b);validate([a],{games:1});
 assert.ok(a.endNine||a.endVP);assert.ok(a.rounds>0&&a.rounds<=30);
 for(const p of a.players)assert.ok(p.gold>=0&&p.tech>=0&&p.faith>=0&&p.vp>=0);
 const broken=structuredClone(a);broken.players[0].sources.bonusVP++;assert.throws(()=>validate([broken],{games:1}),/VP attribution/);
});
test('research rejects duplicate or missing match records',()=>assert.throws(()=>validate([],{games:1}),/Incomplete/));
