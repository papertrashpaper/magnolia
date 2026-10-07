import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,submit,nextRound,clone,previewPlacement,normalizeSettings} from '../public/js/engine.js';
import {cpuDraw,cpuPlace} from '../public/js/cpu.js';
const seeded=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
test('全CPU難易度で2～5人対戦を完走し、資源とカード枚数を保存する',()=>{
 for(const cpuDifficulty of ['easy','normal','hard','expert','overlord'])for(const count of [2,3,5]){
  const rng=seeded(count),g=newGame(Array.from({length:count},(_,i)=>({id:String(i),name:String(i),cpu:true})),{cpuDifficulty},rng);
  for(let turn=0;turn<100&&g.phase!=='ended';turn++){
   if(g.phase==='round'){nextRound(g);continue;}
   const phase=g.phase;
   for(const p of g.players){
    assert.equal(p.cpuDifficulty,cpuDifficulty);
    const before=clone(g),others=g.players.filter(q=>q!==p);
    const order=phase==='draw'?cpuDraw(p,rng):cpuPlace(p,others,g.settings,rng);
    assert.deepEqual(g,before,'CPUの検討では実際の盤面を変更しない');
    if(phase==='place')previewPlacement(p,order.moves);
    submit(g,p.id,order,rng);
   }
   assert.equal(g.deck.length+g.discard.length+g.players.reduce((n,p)=>n+p.hand.length+p.board.length,0),102);
   for(const p of g.players){assert.ok(p.gold>=0);assert.ok(p.tech<=15&&p.faith<=15);assert.ok(p.board.length<=9);}
  }
  assert.equal(g.phase,'ended');
 }
});
test('難易度の初期値と未知の値は普通、設定された戦争配点を強いCPUが使える',()=>{
 assert.equal(normalizeSettings({},2).cpuDifficulty,'normal');
 assert.equal(normalizeSettings({cpuDifficulty:'bad'},2).cpuDifficulty,'normal');
 const g=newGame([{id:'a',cpu:true},{id:'b',cpu:true}],{cpuDifficulty:'hard',warVP:[50,0]},seeded(1));
 const p=g.players[0];p.hand=['human_knight','elf_marchant'];g.players[1].board=[{card:'human_marchant',x:0,y:0}];
 assert.equal(cpuPlace(p,[g.players[1]],g.settings).moves.length>0,true);
});
test('覇王は相手の手札を参照せず同じ公開盤面には同じ判断をする',()=>{
 const g=newGame([{id:'a',cpu:true},{id:'b',cpu:true}],{cpuDifficulty:'overlord'},seeded(2));
 const q=clone(g.players[1]);q.hand=['demon_storm','human_king'];
 assert.deepEqual(cpuPlace(g.players[0],[q],g.settings),cpuPlace(g.players[0],[{...q,hand:[]}],g.settings));
});
