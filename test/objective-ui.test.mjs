import test from 'node:test';
import assert from 'node:assert/strict';
import {objectiveAlerts} from '../public/js/objective-ui.js';
import {makePlayer,submit,publicView} from '../public/js/engine.js';
import {tutorialGame,tutorialTask,tutorialGuide,tutorialFeedback,TUTORIAL_CHAPTERS} from '../public/js/tutorial.js';
import {CARDS} from '../public/js/cards.js';
const goal=id=>({id,claimedBy:[]});
const view=(a,b,goals)=>({phase:'place',players:[a,b],objectives:goals});
test('普段は青・赤どちらの手紙もなく、手札の達成案でも出ない',()=>{
 const a=makePlayer('a','A'),b=makePlayer('b','B');a.gold=b.gold=5;
 // A can place a cost4 card + skipped-slot reward to finish with 2 cash;
 // the request is number proximity only, so the hidden route must not alert.
 a.hand=['dwarf_saint'];const g=view(a,b,[goal('gold2'),goal('tech3'),goal('cheap3')]);
 assert.deepEqual(objectiveAlerts(g,'a',a),{own:[],rivals:[]});
 a.hand=['human_knight','human_saint'];assert.deepEqual(objectiveAlerts(g,'a',a),{own:[],rivals:[]});
});
test('条件への数値の接近でだけ青・赤の手紙が出る',()=>{
 const a=makePlayer('a','A'),b=makePlayer('b','B');a.tech=5;b.faith=6;
 const g=view(a,b,[goal('tech3'),goal('faith3')]);let hints=objectiveAlerts(g,'a',a);
 assert.deepEqual(hints.own.map(x=>x.goal.id),['tech3']);assert.deepEqual(hints.rivals.map(x=>x.goal.id),['faith3']);assert.equal(hints.rivals[0].players[0].name,'B');
 assert.equal(hints.own[0].hint,undefined);assert.match(hints.own[0].progress.detail,/あと2点/);
 a.tech=4;b.faith=4;assert.deepEqual(objectiveAlerts(g,'a',a),{own:[],rivals:[]});
});
test('達成済み目標・解決演出・終了後は手紙を表示しない',()=>{
 const a=makePlayer('a','A'),b=makePlayer('b','B');a.gold=b.gold=2;
 const g=view(a,b,[{id:'gold2',claimedBy:['b']}]);assert.deepEqual(objectiveAlerts(g,'a',a),{own:[],rivals:[]});
 g.objectives=[goal('gold2')];assert.equal(objectiveAlerts(g,'a',a).own.length,1);
 assert.deepEqual(objectiveAlerts(g,'a',a,{playback:true}),{own:[],rivals:[]});g.phase='ended';assert.deepEqual(objectiveAlerts(g,'a',a),{own:[],rivals:[]});
});
test('相手の非公開手札を変えても赤い手紙は変わらない',()=>{
 const a=makePlayer('a','A'),b=makePlayer('b','B');b.faith=6;
 const g=view(a,b,[goal('faith3')]),expected=objectiveAlerts(g,'a',a);b.hand=['demon_storm'];assert.deepEqual(objectiveAlerts(g,'a',a),expected);
});
test('追加目標の第4章は合法な実カード枚数で、自分・相手・同時達成を体験する',()=>{
 assert.equal(TUTORIAL_CHAPTERS.length,4);const g=tutorialGame('旅人',3);
 const inventory=()=>{const all=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];for(const c of CARDS)assert.equal(all.filter(id=>id===c.id).length,c.copies,c.id);};inventory();
 assert.equal(g.settings.additionalObjectives,true);assert.equal(g.objectives.length,4);
 const start=objectiveAlerts(publicView(g,'human'),'human',g.players[0]);assert(start.own.some(e=>e.goal.id==='cheap3'));assert(start.rivals.some(e=>e.goal.id==='faith3'));
 for(const p of g.players)submit(g,p.id,{discard:[]});
 const first=tutorialTask(3,'place',g.players[0].hand,0);assert.equal(first.card,'human_marchant');
 submit(g,'human',{moves:[{handIndex:0,x:1,y:0},{handIndex:0,x:1,y:1}]});submit(g,'cpu-0',{moves:[]});
 assert.equal(g.phase,'round');inventory();assert.deepEqual(g.objectives.find(o=>o.id==='gold2').claimedBy,['human']);assert.deepEqual(g.objectives.find(o=>o.id==='cheap3').claimedBy,['human','cpu-0']);assert.deepEqual(g.objectives.find(o=>o.id==='faith3').claimedBy,['cpu-0']);
 assert(tutorialGuide({chapter:3,phase:g.phase}).done);
 const i=g.resolution.events.findIndex(e=>e.objectiveId==='cheap3'&&e.playerId==='human');assert.match(tutorialFeedback(g.resolution,i,3).paragraphs.join(''),/全員が3VP/);
 const rival=g.resolution.events.findIndex(e=>e.objectiveId==='faith3');assert.match(tutorialFeedback(g.resolution,rival,3).title,/宿屋の常連/);
});
