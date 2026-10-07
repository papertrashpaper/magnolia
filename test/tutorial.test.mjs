import test from 'node:test';
import assert from 'node:assert/strict';
import {tutorialGame,tutorialGuide} from '../public/js/tutorial.js';
import {CARDS,CARD} from '../public/js/cards.js';
import {submit,publicView,previewPlacement,nextRound} from '../public/js/engine.js';
import {fillCPU} from '../public/js/cpu.js';
test('練習用の安い手札でもカード構成を保ち、1ラウンドを完了して通常対戦に続けられる',()=>{
 const g=tutorialGame('旅人');assert.equal(g.tutorial,true);assert.equal(g.players.length,2);
 assert.ok(g.players[0].hand.every(id=>CARD[id].cost<=2));
 const all=[...g.deck,...g.players.flatMap(p=>p.hand)];
 for(const c of CARDS)assert.equal(all.filter(id=>id===c.id).length,c.copies);
 fillCPU(g,submit);submit(g,'human',{discard:[]});assert.equal(g.phase,'place');fillCPU(g,submit);
 const moves=[{handIndex:0,x:0,y:0}];const preview=previewPlacement(g.players[0],moves).player;assert.equal(preview.board.length,1);
 submit(g,'human',{moves});assert.equal(g.phase,'round');assert.ok(publicView(g,'human').resolution.events.length);
 assert.equal(tutorialGuide({round:1,phase:'round',replayPhase:'war'}).step,3);
 assert.equal(tutorialGuide({round:1,phase:'round'}).done,true);
 g.tutorial=false;nextRound(g);assert.equal(g.round,2);assert.equal(g.phase,'draw');
});
test('案内は交換、配置、確認、完了の順に切り替わる',()=>{
 assert.equal(tutorialGuide({round:1,phase:'draw'}).step,1);
 assert.equal(tutorialGuide({round:1,phase:'place'}).step,2);
 assert.match(tutorialGuide({round:1,phase:'place',moves:1}).text,/取り消せます/);
 assert.equal(tutorialGuide({round:1,phase:'round',replayPhase:'income'}).step,3);
 assert.equal(tutorialGuide({round:2,phase:'draw'}).step,4);
});
