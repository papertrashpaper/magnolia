import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,submit,publicView,makePlayer,placeOne,clone} from '../public/js/engine.js';
import {resolutionView,scoreRank,changeSentence,undoChanges} from '../public/js/presentation.js';
function game(){return newGame([{id:'human',name:'あなた'},{id:'b',name:'B'}]);}
test('カードごとの増減はコストと効果を相殺せず、理由と実際の値を記録',()=>{
 const p=makePlayer('human','あなた');p.hand=['golem_gold'];
 const result=placeOne(p,{handIndex:0,x:0,y:0});
 assert.deepEqual(result.steps.map(c=>[c.before,c.after,c.delta]),[[5,3,-2],[3,4,1]]);
 assert.match(changeSentence(result.steps[0]),/黄金のゴーレムの配置コストによってお金が2減少/);
 assert.match(changeSentence(result.steps[1]),/黄金のゴーレムの配置時効果によってお金が1増加/);
});
test('全員の確定までは相手の配置履歴を公開せず、解決後も手札は含めない',()=>{
 const g=game();submit(g,'human',{discard:[]});submit(g,'b',{discard:[]});
 g.players[0].hand=['golem_gold'];g.players[1].hand=['human_marchant'];
 submit(g,'human',{moves:[{handIndex:0,x:0,y:0}]});
 assert.ok(!publicView(g,'b').resolution.events.some(e=>e.card==='golem_gold'));
 submit(g,'b',{moves:[{handIndex:0,x:0,y:0}]});
 const r=publicView(g,'human').resolution;
 function noHand(v){if(v&&typeof v==='object'){assert.ok(!Object.hasOwn(v,'hand'));for(const x of Object.values(v))noHand(x);}}
 noHand(r);assert.equal(r.before[0].board.length,0);
});
test('配置・戦争・発展・収入・VPを順番に表示し、途中の盤面から最終結果まで再現',()=>{
 const g=game();g.phase='place';g.players[0].hand=['golem_gold','human_knight'];g.players[1].hand=['human_marchant'];
 submit(g,'human',{moves:[{handIndex:0,x:0,y:0},{handIndex:0,x:1,y:0}]});submit(g,'b',{moves:[{handIndex:0,x:0,y:0}]});
 const v=publicView(g,'human'),r=v.resolution;
 assert.deepEqual([...new Set(r.events.map(e=>e.phase))],['place','war','develop','income','vp']);
 const first=r.events.findIndex(e=>e.card==='golem_gold');let shown=resolutionView(v,first);
 assert.equal(shown.players[0].board.length,1);assert.equal(shown.players[0].gold,4);assert.equal(shown.players[1].board.length,0);
 shown=resolutionView(v,r.events.length-1);
 for(const p of v.players){const displayed=shown.players.find(q=>q.id===p.id);for(const stat of ['gold','faith','tech','vp','board'])assert.deepEqual(displayed[stat],p[stat]);}
 assert.equal(r.events.filter(e=>e.summary).length,5);
 assert.ok(r.events.some(e=>e.changes.some(c=>c.source==='基本収入'&&c.delta===3)));
});
test('点数上限の増減と、仮配置取り消しの値は正確',()=>{
 const p=makePlayer('human','あなた');p.hand=['dwarf_king'];p.gold=10;p.tech=14;const before=clone(p);
 const result=placeOne(p,{handIndex:0,x:0,y:0});assert.equal(result.steps.find(c=>c.stat==='tech').delta,1);
 const undo=undoChanges(p,before);assert.equal(undo.find(c=>c.stat==='tech').delta,-1);assert.equal(undo.find(c=>c.stat==='gold').delta,7);
});
test('現在順位はVP順、同点は同順位',()=>{
 const players=[{vp:10},{vp:10},{vp:4}];assert.deepEqual(players.map(p=>scoreRank(players,p)),[1,1,3]);
});
