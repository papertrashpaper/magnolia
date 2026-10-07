import test from 'node:test';
import assert from 'node:assert/strict';
import {finalResultMessages} from '../public/js/presentation.js';

test('final banners use final VP ranking, player count and a kind runner-up message in two-player games',()=>{
 for(let total=2;total<=5;total++){
  const players=Array.from({length:total},(_,i)=>({id:String(i),name:`王国${i}`,vp:i*10}));
  const results=finalResultMessages(players,'0');
  assert.deepEqual(results.map(p=>p.rank),Array.from({length:total},(_,i)=>i+1));
  assert.equal(results[0].winner,true);assert.match(results[0].title,/おめでとう/);
  assert.equal(results.at(-1).own,true);assert.equal(results.at(-1).total,total);
  if(total===2)assert.match(results.at(-1).title,/見事な健闘/);
  else assert.match(results.at(-1).title,/巻き返そう/);
 }
});
test('tied winners both celebrate and subsequent ranks are skipped',()=>{
 const results=finalResultMessages([{id:'a',vp:40},{id:'b',vp:40},{id:'c',vp:30}],'b');
 assert.deepEqual(results.map(p=>p.rank),[1,1,3]);
 assert.deepEqual(results.map(p=>p.winner),[true,true,false]);
 assert.equal(results[1].own,true);
});
