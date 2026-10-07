import test from 'node:test';
import assert from 'node:assert/strict';
import {finalResultMessages} from '../public/js/presentation.js';

test('only the viewer receives a final banner, with a rank based on every participant',()=>{
 for(let total=2;total<=5;total++){
  const players=Array.from({length:total},(_,i)=>({id:String(i),name:`王国${i}`,vp:i*10}));
  for(const player of players){
   const results=finalResultMessages(players,player.id);
   assert.equal(results.length,1);const result=results[0];
   assert.equal(result.id,player.id);assert.equal(result.rank,total-Number(player.id));
   assert.equal(result.own,true);assert.equal(result.total,total);
   assert.equal(result.winner,result.rank===1);
   if(result.winner)assert.match(result.title,/おめでとう/);
   if(result.rank===2)assert.match(result.title,/見事な健闘/);
   if(result.rank===total&&total>2)assert.match(result.title,/巻き返そう/);
  }
 }
 assert.deepEqual(finalResultMessages([{id:'cpu',vp:50}],'absent'),[]);
});
test('a tied winner celebrates only their own banner and subsequent ranks are skipped',()=>{
 const players=[{id:'a',vp:40},{id:'b',vp:40},{id:'c',vp:30}];
 assert.deepEqual(finalResultMessages(players,'b').map(p=>[p.id,p.rank,p.winner]),[['b',1,true]]);
 assert.deepEqual(finalResultMessages(players,'c').map(p=>[p.id,p.rank,p.winner]),[['c',3,false]]);
});
