import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from '../scripts/analyze-geometry-diagnosis.mjs';
const evaluation=(id,value,group)=>({id,extra:!!group,group,schedule:group?[[]]:undefined,audit:[{value,ended:true,winShare:0,vp:10,gap:-1}]});
test('diagnosis separates a missed better candidate from a harmful chosen candidate',()=>{
 const rows=[
  {state:{seed:1,count:2,round:2,p:{hand:[],board:[]}},evaluations:[evaluation('old',5),evaluation('wide',5,'wide'),evaluation('geo',8,'geometry')],choices:{baseline1:'old',baseline3:'old',wide1:'old',wide3:'old',geometry1:'geo',geometry3:'old'},generatedMs:1,uniqueCandidates:3},
  {state:{seed:2,count:2,round:2,p:{hand:[],board:[]}},evaluations:[evaluation('old',5),evaluation('wide',5,'wide'),evaluation('geo',1,'geometry')],choices:{baseline1:'old',baseline3:'old',wide1:'old',wide3:'old',geometry1:'old',geometry3:'geo'},generatedMs:1,uniqueCandidates:3}
 ];
 const s=summarize(rows);assert.equal(s.diagnostic.geometry.beatsExistingCeiling,1);assert.equal(s.diagnostic.geometry.missed3,1);assert.equal(s.diagnostic.geometry.harmful3,1);assert.equal(s.diagnostic.geometry.improved1,1);assert.equal(s.comparisons['geometry3-baseline3'].difference,-2);
});
