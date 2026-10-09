import test from 'node:test';
import assert from 'node:assert/strict';
import {compare} from '../scripts/analyze-endgame-decisions.mjs';
test('paired terminal comparison excludes unavailable alternatives and cannot claim a tight interval for tiny strata',()=>{
 const rows=[{state:{count:2,profile:'balanced'},choices:{left:0,right:1},actions:[{id:0,audit:{share:1,vp:40,gap:2}},{id:1,audit:{share:.5,vp:42,gap:0}}]},{state:{count:3,profile:'war'},choices:{left:0,right:null},actions:[{id:0,audit:{share:0,vp:30,gap:-4}}]}];
 const d=compare(rows,'left','right');assert.equal(d.states,1);assert.equal(d.share,.5);assert.equal(d.vp,-2);assert.equal(d.gap,2);assert.equal(d.ci95,null);assert.equal(d.better,1);assert.equal(compare(rows,'right','left').share,-.5);
});
