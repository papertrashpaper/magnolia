import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,submit,publicView,makePlayer,placeOne,clone,level,power} from '../public/js/engine.js';
import {resolutionView,scoreRank,changeSentence,undoChanges,levelChangeSentence,levelProgress,battleRank} from '../public/js/presentation.js';
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

test('マリガンは枚数だけで消失・補充を表し、全員の捨て札処理後に補充する',()=>{
 const g=game();g.players[1].hand.splice(3);const originals=g.players.map(p=>[...p.hand]);
 submit(g,'human',{discard:[0,2]});assert.equal(publicView(g,'b').resolution,null);
 submit(g,'b',{discard:[1]});const v=publicView(g,'human'),r=v.resolution;
 assert.deepEqual(r.events.map(e=>[e.playerId,e.handAnimation.type,e.handAnimation.from,e.handAnimation.to]),[['human','discard',5,3],['b','discard',3,2],['human','refill',3,5],['b','refill',2,5]]);
 assert.equal(r.events.some(e=>e.summary),false);assert.equal(g.logs.length,0);
 let interim=resolutionView(v,0);assert.deepEqual(interim.players.map(p=>p.handCount),[3,3]);
 interim=resolutionView(v,1);assert.deepEqual(interim.players.map(p=>p.handCount),[3,2]);
 interim=resolutionView(v,3);assert.deepEqual(interim.players.map(p=>p.handCount),[5,5]);
 for(const p of [...r.before,...r.events.map(e=>e.after)])assert.ok(!Object.hasOwn(p,'hand'));
 assert.deepEqual(g.players[0].hand.slice(0,3),originals[0].filter((_,i)=>![0,2].includes(i)));
});
test('交換も補充もない場合にはマリガンの確認表示を作らない',()=>{
 const g=game();submit(g,'human',{discard:[]});submit(g,'b',{discard:[]});assert.equal(g.resolution.events.length,0);assert.equal(g.phase,'place');
});
test('点数の全境界と上限・取り消しに合わせたレベル増減を伝える',()=>{
 for(const [before,after] of [[0,1],[2,3],[6,7],[14,15],[15,14],[7,6],[3,2],[1,0]]){
  const text=levelChangeSentence({stat:'faith',before,after});assert.ok(text.includes(`Lv.${level(before)} → Lv.${level(after)}`));assert.match(text,after>before?/上昇/:/低下/);
 }
 assert.match(levelChangeSentence({stat:'tech',before:3,after:6}),/Lv.2のまま/);
 assert.equal(levelChangeSentence({stat:'gold',before:3,after:6}),'');
});
test('バーの目盛りは全レベル境界に一致し、次レベルまでの点数を正確に表示',()=>{
 for(const [i,n] of [0,1,3,7,15].entries())assert.equal(levelProgress(n).percent,i*25);
 let previous=-1;for(let n=0;n<=15;n++){const m=levelProgress(n);assert.equal(m.level,level(n));assert.ok(m.percent>previous);previous=m.percent;assert.equal(m.remaining,m.next===null?0:m.next-n);}
 assert.deepEqual(levelProgress(15),{level:4,percent:100,next:null,remaining:0});
});
test('戦争演出は計算済みの戦力・同率順位を使用し、カードを失わない',()=>{
 const g=game();g.phase='place';g.players.forEach(p=>{p.board=[{card:'human_knight',x:0,y:0}];p.hand=[];});
 submit(g,'human',{moves:[]});submit(g,'b',{moves:[]});
 const battle=g.resolution.events.find(e=>e.battle).battle;
 assert.deepEqual(battle.map(a=>a.rank),[1,1]);assert.ok(battle.every(a=>a.power===power(g.players.find(p=>p.id===a.id))));
 assert.deepEqual(g.players.map(p=>p.board.length),[1,1]);
 const armies=[{power:7},{power:7},{power:4},{power:0}];assert.deepEqual(armies.map(p=>battleRank(armies,p)),[1,1,3,4]);
});
