import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,CARD} from '../public/js/cards.js';
import {makePlayer,newGame,level,legalCells,placeOne,previewPlacement,power,submit,nextRound,resolveRound,publicView} from '../public/js/engine.js';
import {cpuDraw,cpuPlace} from '../public/js/cpu.js';

const player=(hand=[],gold=20)=>({...makePlayer('a','A'),hand:[...hand],gold});
const board=(cards)=>cards.map(([card,x,y])=>({card,x,y}));
function rng(seed=1){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
test('41種類・102枚、王1枚、眼2枚、その他デーモン1枚',()=>{
 assert.equal(CARDS.length,41);assert.equal(CARDS.reduce((s,c)=>s+c.copies,0),102);
 for(const c of CARDS){if(c.job==='ruler')assert.equal(c.copies,1);if(c.race==='demon')assert.equal(c.copies,c.id==='demon_eye'?2:1);}
});
test('技術・信仰の全境界',()=>{assert.deepEqual(Array.from({length:16},(_,i)=>level(i)),[0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,4]);});
test('最初のカードの相対位置は後から決まり、幅と高さ3以内',()=>{
 const p=player(['human_knight','human_marchant','human_saint','human_sorcerer']);
 placeOne(p,{handIndex:0,x:0,y:0});assert.equal(legalCells(p.board).length,4);
 placeOne(p,{handIndex:0,x:-1,y:0});placeOne(p,{handIndex:0,x:1,y:0});placeOne(p,{handIndex:0,x:0,y:1});
 assert.deepEqual(p.board[0],{card:'human_knight',x:0,y:0});assert.ok(legalCells(p.board).every(c=>c.x>=-1&&c.x<=1));
 assert.throws(()=>placeOne({...p,hand:['human_knight']},{handIndex:0,x:0,y:-2}));
 assert.throws(()=>placeOne({...p,hand:['human_knight']},{handIndex:0,x:2,y:1}));
});
test('配置時効果が先、ボーナスは後。種族と職業を両方付与',()=>{
 const p=player(['elf_saint']);p.faith=2;p.board=board([['elf_saint',0,0],['elf_saint',1,0]]);
 const r=placeOne(p,{handIndex:0,x:2,y:0});assert.equal(p.vp,1);assert.equal(p.faith,6);assert.equal(r.bonuses.length,2);
});
test('ゴーレム種族ボーナスは技術と信仰の両方、15点で打ち止め',()=>{
 const p=player(['golem_cristal']);p.tech=14;p.faith=14;p.board=board([['golem_iron',0,0],['golem_gold',1,0]]);
 placeOne(p,{handIndex:0,x:2,y:0});assert.equal(p.tech,15);assert.equal(p.faith,15);
});
test('複数列と種族・職業のボーナスをすべて処理',()=>{
 const p=player(['human_knight']);p.board=board([['human_knight',0,0],['human_knight',1,0],['human_knight',2,1],['human_knight',2,2]]);
 const before=p.gold;const r=placeOne(p,{handIndex:0,x:2,y:0});assert.equal(r.bonuses.length,4);assert.equal(p.vp,10);assert.equal(p.gold,before-3+6);
});
test('配置ボーナスのお金を2枚目の支払いに使える',()=>{
 const p=player(['human_knight','human_marchant'],3);p.board=board([['human_knight',-1,0],['dwarf_pugilist',0,0]]);
 const r=previewPlacement(p,[{handIndex:0,x:1,y:0},{handIndex:0,x:1,y:1}]);assert.equal(r.player.gold,2);assert.equal(p.hand.length,2);
});
test('1枚配置で受け取る1金をその支払いには使えない',()=>{
 const p=player(['human_knight'],2);assert.throws(()=>previewPlacement(p,[{handIndex:0,x:0,y:0}]),/コスト/);
 const g=newGame([{id:'a',name:'A'},{id:'b',name:'B'}],{},rng());g.phase='place';g.players[0].hand=['human_knight'];g.players[0].gold=3;
 submit(g,'a',{moves:[{handIndex:0,x:0,y:0}]});submit(g,'b',{moves:[]});assert.equal(g.players[0].gold,4);
});
test('射手は後列でも参加、前列でも二重加算しない。戦力強化は前線のみ',()=>{
 const p=player();p.faith=2;p.tech=3;p.board=board([['human_knight',0,0],['elf_archer',0,1],['human_sorcerer',1,0],['golem_iron',1,1]]);assert.equal(power(p),14);
 p.board=board([['elf_archer',0,0]]);assert.equal(power(p),3);
});
test('同順位は飛ばし、戦争追加VPは後列でも処理、葬儀屋は連鎖しない',()=>{
 const g=newGame([{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],{},rng());
 g.players[0].board=board([['human_knight',0,0],['goblin_great_soldier',0,1]]);
 g.players[1].board=board([['human_knight',0,0]]);
 g.players[2].board=board([['human_undertaker',0,0],['goblin_soldier',0,1]]);
 resolveRound(g);assert.deepEqual(g.players.map(p=>p.rank),[1,1,3]);assert.deepEqual(g.players.map(p=>p.vp),[8,6,2]);
});
test('設定した戦争VPを使用',()=>{
 const g=newGame([{id:'a',name:'A'},{id:'b',name:'B'}],{warVP:[9,2]},rng());g.players[0].board=board([['human_marchant',0,0]]);resolveRound(g);assert.deepEqual(g.players.map(p=>p.warVP),[9,2]);
});
test('嵐のデーモンは他列のボーナスも持続して2倍。2体なら4倍',()=>{
 for(const count of [1,2]){const p=player(['human_knight']);p.board=board([['human_knight',0,0],['human_knight',1,0],...Array.from({length:count},(_,i)=>['demon_storm',i,1])]);
  const r=placeOne(p,{handIndex:0,x:2,y:0});assert.equal(r.rewards.vp,5*2**count);assert.equal(r.rewards.gold,3*2**count);
 }
});
test('君主は自身を数える。ゴーレムの王は点数を高い方に揃える',()=>{
 const p=player(['golem_king']);p.tech=7;p.faith=2;placeOne(p,{handIndex:0,x:0,y:0});assert.equal(p.tech,7);assert.equal(p.faith,7);assert.equal(p.vp,1);
});
test('終わるラウンドも最後まで処理し、お金は端数切捨て後に倍率適用',()=>{
 const g=newGame([{id:'a',name:'A'},{id:'b',name:'B'}],{},rng());const p=g.players[0];p.vp=40;p.gold=13;p.board=board([['human_king',0,0],['demon_pest',0,1]]);resolveRound(g);
 assert.equal(g.phase,'ended');assert.equal(p.gold,16);assert.equal(p.finalGoldVP,15);assert.equal(p.vp,63);
});
test('未公開手札・配置予定が他の参加者の状態に含まれない',()=>{
 const g=newGame([{id:'a',name:'A'},{id:'b',name:'B'}],{},rng());submit(g,'a',{discard:[0]});let v=publicView(g,'b');assert.equal(v.players[0].hand,undefined);assert.equal(v.orders,undefined);assert.equal(v.deck,undefined);assert.equal(v.players[0].ready,true);
 submit(g,'b',{discard:[]});const p=g.players[0];p.hand=['human_marchant'];submit(g,'a',{moves:[{handIndex:0,x:0,y:0}]});v=publicView(g,'b');assert.equal(v.players[0].board.length,0);assert.equal(v.players[0].gold,5);
});
test('手札は先に補充せず交換、全員の確定後だけ進行、重複確定拒否',()=>{
 const g=newGame([{id:'a',name:'A'},{id:'b',name:'B'}],{},rng());g.players[0].hand.splice(0,2);g.discard.push('human_knight','human_knight');submit(g,'a',{discard:[0]});assert.equal(g.phase,'draw');assert.throws(()=>submit(g,'a',{discard:[]}));submit(g,'b',{discard:[]});assert.equal(g.phase,'place');assert.equal(g.players[0].hand.length,5);assert.throws(()=>submit(g,'a',{moves:[{handIndex:99,x:0,y:0}]}));
});
test('2～5人のCPUゲームが完走し、カード102枚を保存する',()=>{
 for(let count=2;count<=5;count++)for(let seed=1;seed<=4;seed++){
  const random=rng(seed);const g=newGame(Array.from({length:count},(_,i)=>({id:String(i),name:String(i),cpu:true})),{},random);
  for(let step=0;step<80&&g.phase!=='ended';step++){
   if(g.phase==='round')nextRound(g);
   const phase=g.phase;for(const p of g.players){if(g.phase!==phase)break;submit(g,p.id,phase==='draw'?cpuDraw(p):cpuPlace(p,g.players.filter(q=>q!==p)),random);}
   assert.equal(g.deck.length+g.discard.length+g.players.reduce((n,p)=>n+p.hand.length+p.board.length,0),102);
   for(const p of g.players){assert.ok(p.gold>=0);assert.ok(p.tech<=15&&p.faith<=15);assert.ok(p.board.length<=9);}
  }assert.equal(g.phase,'ended',`count=${count}, seed=${seed}`);assert.ok(g.winners.length);
 }
});

test('嵐のデーモンは9金未満では配置不可、9金で支払う',()=>{
 assert.equal(CARD.demon_storm.cost,9);
 assert.throws(()=>placeOne(player(['demon_storm'],8),{handIndex:0,x:0,y:0}),/コスト/);
 const p=player(['demon_storm'],9);placeOne(p,{handIndex:0,x:0,y:0});assert.equal(p.gold,0);assert.equal(p.board[0].card,'demon_storm');
});
