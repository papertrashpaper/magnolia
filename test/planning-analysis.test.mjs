import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from '../scripts/analyze-planning.mjs';
function row(count,treatment,share){return {group:'natural',count,seed:123,focal:0,treatment,initial:[['human_marchant']],players:[{vp:10,winShare:share,bonuses:[]}],history:[],timing:{decisions:1,maxMs:1,totalMs:1}};}
test('pooled comparisons keep different player counts as separate paired conditions',()=>{
 const rows=[row(2,'planning',1),row(2,'adaptive',0),row(5,'planning',0),row(5,'adaptive',1)].map(r=>({...r,originalCount:r.count,count:'all'}));
 const result=summarize(rows)['natural/all'];assert.equal(result.pairs,2);assert.equal(result.difference,0);assert.deepEqual(result.ci,[0,0]);
});
test('planning analysis rejects missing paired treatments',()=>assert.throws(()=>summarize([row(2,'planning',1)]),/Missing paired/));
test('planning analysis rejects comparisons with different initial deals',()=>{
 const a=row(2,'planning',1),b=row(2,'adaptive',0);b.initial=[['demon_pest']];assert.throws(()=>summarize([a,b]),/Initial deal mismatch/);
});
