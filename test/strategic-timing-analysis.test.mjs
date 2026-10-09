import test from 'node:test';
import assert from 'node:assert/strict';
import {compare} from '../scripts/analyze-strategic-timing.mjs';
const row=(ended=16)=>({state:{count:2,profile:'balanced'},choices:{left:0,right:1},evaluations:[{id:0,audit:{ended,total:16,share:1,vp:40,gap:2,steps:2}},{id:1,audit:{ended:16,total:16,share:.5,vp:42,gap:0,steps:3}}]});
test('paired comparisons exclude incomplete continuations rather than treating them as losses',()=>{
 const d=compare([row(),row(15)],'left','right');assert.equal(d.states,1);assert.equal(d.share,.5);assert.equal(d.vp,-2);assert.equal(d.steps,-1);assert.equal(d.ci95,null);assert.equal(compare([row(15)],'left','right').states,0);
});
test('unavailable choices are excluded and reversing comparison reverses its sign',()=>{
 const a=row(),b=row();b.choices.right=null;assert.equal(compare([a,b],'left','right').states,1);assert.equal(compare([a],'right','left').share,-.5);assert.equal(compare([a],'right','left').worse,1);
});
