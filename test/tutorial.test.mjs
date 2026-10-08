import test from 'node:test';
import assert from 'node:assert/strict';
import {tutorialGame,tutorialGuide,tutorialObservation,tutorialPhaseOutcome,TUTORIAL_REFERENCE,tutorialTask,tutorialPlacementAllowed,TUTORIAL_SLIDES,TUTORIAL_FRONTLINE,tutorialFeedback,tutorialPlacementFeedback,tutorialTrace} from '../public/js/tutorial.js';
import {CARDS} from '../public/js/cards.js';
import {submit,publicView,previewPlacement,level,power,legalCells,bounds} from '../public/js/engine.js';
import {fillCPU} from '../public/js/cpu.js';
function inventory(g){
 const all=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];
 for(const c of CARDS)assert.equal(all.filter(id=>id===c.id).length,c.copies,`${c.id}の枚数`);
}
function beginPlace(g){fillCPU(g,submit);submit(g,'human',{discard:[]});assert.equal(g.phase,'place');fillCPU(g,submit);}
test('3つの独立した例題は実在するカード枚数と合法な3×3盤面を保つ',()=>{
 for(let chapter=0;chapter<3;chapter++){
  const g=tutorialGame('旅人',chapter);assert.equal(g.tutorial,true);assert.equal(g.tutorialChapter,chapter);inventory(g);
  for(const p of g.players){assert.equal(p.hand.length,5);const b=bounds(p.board);assert(b.maxX-b.minX<=2&&b.maxY-b.minY<=2);assert.equal(p.power,power(p));}
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
 assert.equal(g.players[0].faith,8);assert.equal(g.players[0].tech,6);inventory(g);
 assert(g.resolution.events.some(e=>e.changes.some(c=>c.source==='人間の聖職者の効果'&&c.delta===3)));
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
 assert.deepEqual(TUTORIAL_SLIDES.map(s=>s.kind),['welcome','kingdom','flow','draw','placement','front','develop','income','scoring','effects','levels','practice']);
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

test('階段状の前線は各縦列の先頭で、後列と区別できる合法な王国',()=>{
 const fronts=TUTORIAL_FRONTLINE.filter(c=>!TUTORIAL_FRONTLINE.some(other=>other.x===c.x&&other.y<c.y));
 assert.deepEqual(fronts.map(c=>[c.x,c.y]),[[0,0],[1,1],[2,2]]);
 assert.equal(TUTORIAL_FRONTLINE.length-fronts.length,3);
 const placed=[];
 for(const c of TUTORIAL_FRONTLINE){assert(legalCells(placed).some(cell=>cell.x===c.x&&cell.y===c.y));placed.push(c);}
});

test('配置の狙いと、発展→収入→VPの因果を実際の記録から説明する',()=>{
 const g=tutorialGame('旅人');beginPlace(g);
 const first=[{handIndex:0,x:0,y:0}],moves=[...first,{handIndex:0,x:0,y:1}];
 assert.match(tutorialTask(0,'place',g.players[0].hand,0).purpose,/毎ラウンド.*1金/);
 assert.match(tutorialPlacementFeedback(g.players[0],first).paragraphs.join(' '),/今すぐお金を増やす.*収入/);
 assert.match(tutorialPlacementFeedback(g.players[0],moves).paragraphs.join(' '),/後方.*発展.*VP/);
 submit(g,'human',{moves});
 const find=phase=>g.resolution.events.findIndex(e=>e.phase===phase&&e.playerId==='human');
 const develop=tutorialFeedback(g.resolution,find('develop')).paragraphs.join(' ');
 assert.match(develop,/今回置いたドワーフの料理人のおかげ.*技術点 0→1.*Lv.0→Lv.1/);
 const income=tutorialFeedback(g.resolution,find('income')).paragraphs.join(' ');
 assert.match(income,/今回置いた人間の行商のおかげで＋1金/);assert.match(income,/基本収入3金/);
 const vp=tutorialFeedback(g.resolution,find('vp')).paragraphs.join(' ');
 assert.match(vp,/料理人で1VP/);assert.match(vp,/Lv.1×1＝1VP/);assert.match(vp,/育てた技術点.*得点/);
 assert.equal(tutorialFeedback(g.resolution,g.resolution.events.findIndex(e=>e.phase==='develop'&&e.playerId==='cpu-0')),null);
});

test('中盤の配置ボーナスと信奉者自身のVPを説明する',()=>{
 const g=tutorialGame('旅人',1);beginPlace(g);
 const moves=[{handIndex:0,x:2,y:0},{handIndex:0,x:2,y:1}];
 assert.match(tutorialPlacementFeedback(g.players[0],moves.slice(0,1),1).paragraphs.join(' '),/技術点＋2.*配置時効果.*技術点 2→3/);
 assert.match(tutorialPlacementFeedback(g.players[0],moves,1).paragraphs.join(' '),/聖職者.*信仰点＋2/);
 submit(g,'human',{moves});
 const i=g.resolution.events.findIndex(e=>e.phase==='vp'&&e.playerId==='human');
 const lesson=tutorialFeedback(g.resolution,i,1);
 assert.equal(lesson.card,'elf_follower');
 const text=lesson.paragraphs.join(' ');assert.match(text,/信奉者.*3VP/);assert.match(text,/配置で育てた信仰点/);assert(!text.includes('人間の聖職者'));
});

test('練習の履歴は現在の処理までを表示し、未来の発動や他人の効果を混ぜない',()=>{
 const g=tutorialGame('旅人');beginPlace(g);submit(g,'human',{moves:[{handIndex:0,x:0,y:0},{handIndex:0,x:0,y:1}]});
 const develop=g.resolution.events.findIndex(e=>e.phase==='develop'&&e.playerId==='human');
 const trace=tutorialTrace(g.resolution,develop);
 assert(trace.every(l=>l.eventIndex<=develop&&l.message.startsWith('旅人：')));
 assert(trace.some(l=>/料理人の効果.*技術点 0→1/.test(l.message)));
 assert(!trace.some(l=>/行商の効果.*お金/.test(l.message)));
 const income=g.resolution.events.findIndex(e=>e.phase==='income'&&e.playerId==='human');
 assert(tutorialTrace(g.resolution,income).some(l=>l.eventIndex===income&&/行商の効果.*お金 5→6/.test(l.message)));
 const start=g.resolution.events.findIndex(e=>e.phase==='develop'&&!e.playerId);
 assert.equal(tutorialFeedback(g.resolution,start),null);
});

test('中盤の戦争解説は今回置いた拳闘士を中心にする',()=>{
 for(let run=0;run<8;run++){
  const g=tutorialGame('旅人',1);beginPlace(g);
  submit(g,'human',{moves:[{handIndex:0,x:2,y:0},{handIndex:0,x:2,y:1}]});
  const i=g.resolution.events.findIndex(e=>e.phase==='war'&&e.playerId==='human'),event=g.resolution.events[i];
  assert.equal(event.after.power,15);assert.equal(event.after.warVP,4);
  assert(event.changes.some(c=>c.source==='人間の騎士の効果'&&c.delta===1));
  const lesson=tutorialFeedback(g.resolution,i,1);
  assert.equal(lesson.card,'dwarf_pugilist');assert.match(lesson.paragraphs.join(' '),/拳闘士.*前線.*報酬4VP/);assert(!lesson.paragraphs.join(' ').includes('騎士'));
  assert(tutorialTrace(g.resolution,i).some(l=>l.eventIndex===i&&l.source==='人間の騎士の効果'));
  inventory(g);
 }
});

 test('中盤の2配置で種族だけ・職業だけの3枚揃えを具体的に体験する',()=>{
 const g=tutorialGame('旅人',1);beginPlace(g);
 const first=[{handIndex:0,x:2,y:0}],moves=[...first,{handIndex:0,x:2,y:1}];
 const result=previewPlacement(g.players[0],moves);
 assert.deepEqual(result.placed.map(p=>p.bonuses),[[{type:'race',value:'dwarf'}],[{type:'job',value:'priest'}]]);
 assert.equal(result.player.faith,6);assert.equal(level(result.player.faith),2);
 const race=tutorialPlacementFeedback(g.players[0],first,1).paragraphs.join(' ');
 for(const text of ['ドワーフの料理人','ドワーフの鉱石屋','ドワーフの拳闘士','職業は別々','種族は全員「ドワーフ」','技術点＋2'])assert(race.includes(text),text);
 const job=tutorialPlacementFeedback(g.players[0],moves,1).paragraphs.join(' ');
 for(const text of ['人間の聖職者','エルフの祈り手','エルフの信奉者','種族は違って','職業は全員「聖職者」','信仰点＋2','2→4','1回だけ'])assert(job.includes(text),text);
 const draft=previewPlacement(g.players[0],first).player;
 assert.match(tutorialTask(1,'place',draft.hand,1).purpose,/職業だけの一致/);
 assert(!tutorialTask(1,'place',g.players[0].hand,0).purpose.includes('騎士'));
 submit(g,'human',{moves});inventory(g);
 });

test('中盤・終盤の解説は既存カードを目的として紹介せず、短文で今回の配置を追う',()=>{
 for(const chapter of [1,2]){
  const g=tutorialGame('旅人',chapter);beginPlace(g);const own=g.players[0],moves=[];
  for(let i=0;i<2;i++){const draft=previewPlacement(own,moves).player,t=tutorialTask(chapter,'place',draft.hand,i);moves.push({handIndex:t.handIndex,x:t.x,y:t.y});}
  const added=previewPlacement(own,moves).placed.map(p=>p.card);submit(g,'human',{moves});
  for(let i=0;i<g.resolution.events.length;i++){
   const lesson=tutorialFeedback(g.resolution,i,chapter);if(!lesson)continue;
   if(lesson.card)assert(added.includes(lesson.card));
   assert(lesson.paragraphs.join('').length<300);
   if(['develop','income','vp','war'].includes(g.resolution.events[i].phase))assert(!lesson.paragraphs.join('').includes('行商'));
  }
 }
});
