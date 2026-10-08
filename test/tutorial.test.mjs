import test from 'node:test';
import assert from 'node:assert/strict';
import {tutorialGame,tutorialGuide,tutorialObservation,tutorialPhaseOutcome,TUTORIAL_REFERENCE,tutorialTask,tutorialPlacementAllowed,TUTORIAL_SLIDES} from '../public/js/tutorial.js';
import {CARDS} from '../public/js/cards.js';
import {submit,publicView,previewPlacement,level,power,legalCells} from '../public/js/engine.js';
import {fillCPU} from '../public/js/cpu.js';
function inventory(g){
 const all=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];
 for(const c of CARDS)assert.equal(all.filter(id=>id===c.id).length,c.copies,`${c.id}の枚数`);
}
function beginPlace(g){fillCPU(g,submit);submit(g,'human',{discard:[]});assert.equal(g.phase,'place');fillCPU(g,submit);}
test('3つの独立した例題は実在するカード枚数と合法な3×3盤面を保つ',()=>{
 for(let chapter=0;chapter<3;chapter++){
  const g=tutorialGame('旅人',chapter);assert.equal(g.tutorial,true);assert.equal(g.tutorialChapter,chapter);inventory(g);
  for(const p of g.players){assert.equal(p.hand.length,5);assert(p.board.every(c=>c.x>=0&&c.x<=2&&c.y>=0&&c.y<=2));assert.equal(p.power,power(p));}
  beginPlace(g);submit(g,'human',{moves:[]});assert.equal(g.phase,chapter===2?'ended':'round');inventory(g);
  assert.equal(tutorialGuide({chapter,phase:g.phase}).done,true);
  assert(publicView(g,'human').resolution.events.length>0);
 }
 assert.throws(()=>tutorialGame('旅人',3),/章/);
});
test('序盤は支払い・収入・技術を2枚で実際に体験できる',()=>{
 const g=tutorialGame('旅人');beginPlace(g);
 const moves=[{handIndex:0,x:0,y:0},{handIndex:0,x:0,y:1}];
 const draft=previewPlacement(g.players[0],moves).player;
 assert.equal(draft.gold,2);assert.equal(power(draft),3);
 submit(g,'human',{moves});assert.equal(g.phase,'round');inventory(g);
 assert.equal(g.players[0].gold,6);assert.equal(g.players[0].tech,1);
 assert(g.resolution.events.some(e=>e.changes.some(c=>c.source==='人間の行商の効果')));
});
test('中盤は配置時効果とドワーフ3枚揃えで技術Lv.2になり、後列でも効果を使える',()=>{
 const g=tutorialGame('旅人',1);beginPlace(g);
 const result=previewPlacement(g.players[0],[{handIndex:0,x:2,y:0}]);
 assert.equal(result.player.tech,5);assert.equal(level(result.player.tech),2);
 assert(result.placed[0].bonuses.some(b=>b.value==='dwarf'));
 assert.match(tutorialObservation(g.players[0],[]).join(' '),/ドワーフの拳闘士.*3枚揃え/);
 submit(g,'human',{moves:[{handIndex:0,x:2,y:0},{handIndex:0,x:2,y:1}]});
 assert.equal(g.players[0].faith,5);assert.equal(g.players[0].tech,6);inventory(g);
 assert(g.resolution.events.some(e=>e.changes.some(c=>c.source==='人間の聖職者の効果'&&c.delta===2)));
});
test('終盤は9体の終了条件と残金得点を1ラウンドだけで確認できる',()=>{
 const g=tutorialGame('旅人',2);beginPlace(g);
 const moves=[{handIndex:0,x:1,y:2},{handIndex:1,x:2,y:2}];
 assert(legalCells(g.players[0].board).some(c=>c.x===1&&c.y===2));
 submit(g,'human',{moves});assert.equal(g.phase,'ended');assert.equal(g.players[0].board.length,9);inventory(g);
 assert.equal(g.players[0].finalGoldVP,Math.floor(g.players[0].gold/3));
 assert(g.resolution.events.some(e=>e.phase==='final'));assert(g.winners.length);
});
test('各処理の助言と解説は成長・前線・得点・終了を区別する',()=>{
 assert.equal(tutorialGuide({phase:'draw'}).step,1);
 assert.equal(tutorialGuide({phase:'place'}).step,2);
 assert.match(tutorialGuide({phase:'place',moves:1}).text,/やり直せます/);
 for(const phase of ['place','war','develop','income','vp','final']){
  const guide=tutorialGuide({chapter:2,phase:'ended',replayPhase:phase});assert.equal(guide.step,3);assert.equal(guide.done,undefined);
 }
 assert.match(tutorialGuide({phase:'round',replayPhase:'develop'}).text,/新しいレベル/);
 const text=TUTORIAL_REFERENCE.flatMap(t=>t.paragraphs).join(' ');
 for(const phrase of ['消費しません','前線','端数切り捨て','9体','戦争順位は別','配置時効果','毎ラウンド'])assert(text.includes(phrase));
 assert(!text.includes('CPUの判断'));
});

test('増減がない理由も実際のフェーズ記録から説明する',()=>{
 const empty=tutorialGame('旅人');beginPlace(empty);submit(empty,'human',{moves:[]});
 assert.match(tutorialPhaseOutcome(empty.resolution,'develop').join(' '),/発展.*カードがない/);
 assert.match(tutorialPhaseOutcome(empty.resolution,'vp').join(' '),/VP.*カードがない/);
 assert.match(tutorialPhaseOutcome(empty.resolution,'income').join(' '),/基本収入.*お金/);
 const g=tutorialGame('旅人',1);g.players[0].tech=0;g.players[0].faith=0;
 // 既存の発展カードを外した合法な例で、芸術家の技術Lv.0を検証。
 const cook=g.players[0].board.find(b=>b.card==='dwarf_cook');g.discard.push(cook.card);
 g.players[0].board=g.players[0].board.filter(b=>b!==cook);
 const saint=g.players[0].board.find(b=>b.card==='human_saint');g.discard.push(saint.card);
 g.players[0].board=g.players[0].board.filter(b=>b!==saint);
 beginPlace(g);submit(g,'human',{moves:[{handIndex:3,x:0,y:0}]});
 assert.match(tutorialPhaseOutcome(g.resolution,'vp').join(' '),/エルフの芸術家.*Lv.0/);
 inventory(g);
});

test('導入から3章の指定操作まで、交換・配置・確定を順番に案内する',()=>{
 assert.equal(TUTORIAL_SLIDES.length,6);
 assert.match(TUTORIAL_SLIDES[0].title,/ようこそ/);
 assert.match(TUTORIAL_SLIDES.at(-1).title,/実際の盤面/);
 for(let chapter=0;chapter<3;chapter++){
  const g=tutorialGame('旅人',chapter),own=g.players[0];fillCPU(g,submit);
  let task=tutorialTask(chapter,'draw',own.hand,0,[]);
  assert.equal(task.canConfirm,chapter!==0);
  const discard=chapter===0?[task.handIndex]:[];
  assert(tutorialTask(chapter,'draw',own.hand,0,discard).canConfirm);
  assert.equal(tutorialTask(chapter,'draw',own.hand,0,[0,1]).canConfirm,false);
  submit(g,'human',{discard});fillCPU(g,submit);
  if(chapter===0)assert(own.hand.includes('elf_saint'));
  const moves=[];
  for(let i=0;i<2;i++){
   const draft=previewPlacement(own,moves).player;
   task=tutorialTask(chapter,'place',draft.hand,moves.length);
   assert.equal(task.canConfirm,false);
   assert(tutorialPlacementAllowed(task,task.handIndex,task.x,task.y));
   assert.equal(tutorialPlacementAllowed(task,task.handIndex+1,task.x,task.y),false);
   assert.equal(tutorialPlacementAllowed(task,task.handIndex,task.x+1,task.y),false);
   moves.push({handIndex:task.handIndex,x:task.x,y:task.y});
   assert.equal(tutorialTask(chapter,'place',draft.hand,i).text,task.text);
  }
  const finished=previewPlacement(own,moves).player;
  assert(tutorialTask(chapter,'place',finished.hand,2).canConfirm);
  assert.equal(tutorialPlacementAllowed(tutorialTask(chapter,'place',finished.hand,2),0,0,0),false);
  const undo=previewPlacement(own,moves.slice(0,1)).player;
  assert.equal(tutorialTask(chapter,'place',undo.hand,1).card,task.card);
  submit(g,'human',{moves});assert.equal(g.phase,chapter===2?'ended':'round');inventory(g);
 }
});
