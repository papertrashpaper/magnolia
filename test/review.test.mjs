import test from 'node:test';import assert from 'node:assert/strict';
import {newGame,submit,nextRound,publicView} from '../public/js/engine.js';
test('振り返りはフェーズ・理由・実際の増減を保存し、次ラウンドでも保持して手札を公開しない',()=>{
 const g=newGame([{id:'a',name:'A'},{id:'b',name:'B'}]);
 for(const p of g.players)submit(g,p.id,{discard:[]});
 for(const p of g.players)submit(g,p.id,{moves:[]});
 const r=g.roundReviews[0];assert.equal(r.round,1);const a=r.players[0];assert.equal(a.before.gold,5);assert.equal(a.after.gold,10);
 assert.deepEqual(a.steps.filter(s=>s.changes.some(c=>c.stat==='gold')).flatMap(s=>s.changes.filter(c=>c.stat==='gold').map(c=>[c.delta,c.source])),[[2,'2枠を配置しなかった報酬'],[3,'基本収入']]);
 assert.ok(a.steps.some(s=>s.phase==='war'));assert.ok(!JSON.stringify(r).includes('hand'));
 nextRound(g);assert.deepEqual(publicView(g,'b').roundReviews[0],r);
});
