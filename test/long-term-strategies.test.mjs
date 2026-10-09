import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,previewPlacement,makePlayer} from '../public/js/engine.js';
import {random} from '../scripts/adaptive-strategies.mjs';
import {chooseLongTerm,continueLongTerm,PROFILES} from '../scripts/long-term-strategies.mjs';
import {auditCards,longTermMatch,tasksFor} from '../scripts/benchmark-long-term.mjs';

test('all long-term profiles produce legal actions and leave the source game unchanged',()=>{
 const g=newGame([{id:'0',name:'self'},{id:'1',name:'other'}],{},random(900333)),before=structuredClone(g);
 for(const profile of PROFILES){const d=chooseLongTerm(g.players[0],g.players.slice(1),g.settings,g.discard,1,'place',{profiles:[profile],rounds:2,beam:2});previewPlacement(g.players[0],d.order.moves);assert.equal(d.key,profile);}
 assert.deepEqual(g,before);
});
test('long-term decisions are deterministic and ignore opponent hidden hands',()=>{
 const g=newGame([{id:'0',name:'self'},{id:'1',name:'other'}],{},random(900334));
 const options={profiles:['tech','economy'],rounds:2,beam:2},decision=()=>chooseLongTerm(g.players[0],g.players.slice(1),g.settings,g.discard,1,'draw',options);
 const a=decision();g.deck.reverse();g.players[1].hand=Array(5).fill('demon_storm');assert.deepEqual(decision(),a);
});
test('committed schedules keep required copies, reject missing cards and stop after completion',()=>{
 const p=makePlayer('0','self'),q=makePlayer('1','other');p.hand=['human_marchant','human_marchant','human_knight'];
 const commitment={key:'economy',step:0,schedule:[[{card:'human_marchant',x:0,y:0}],[{card:'human_marchant',x:1,y:0}]]},settings={warVP:[4,0]};
 assert.deepEqual(continueLongTerm(p,[q],settings,'draw',commitment).order,{discard:[2]});
 previewPlacement(p,continueLongTerm(p,[q],settings,'place',commitment).order.moves);
 p.hand=['human_knight'];assert.equal(continueLongTerm(p,[q],settings,'place',commitment),null);
 commitment.step=2;assert.equal(continueLongTerm(p,[q],settings,'draw',commitment),null);
});
test('current deck composition is audited, and a missing card is detected',()=>{
 const g=newGame([{id:'0',name:'self'},{id:'1',name:'other'}],{},random(900335));auditCards(g);g.deck.pop();assert.throws(()=>auditCards(g));
});
test('research groups use independent deals, identical paired initial hands and reproducible VP accounting',()=>{
 const main=tasksFor('results'),validation=tasksFor('validation');assert.equal(main.length,320);assert.equal(validation.length,320);
 assert.equal(main.some(a=>validation.some(b=>a.seed===b.seed)),false);
 const task={id:0,group:'test',count:2,seed:900336,focal:0,opponent:'balanced',arm:'committed'},a=longTermMatch(task),b=longTermMatch(task),c=longTermMatch({...task,arm:'tech'});
 assert.deepEqual(a.initial,c.initial);delete a.timing;delete b.timing;assert.deepEqual(a,b);
 const vp=a.roundHistory.reduce((s,r)=>s+Object.values(r.vpByPhase).reduce((n,v)=>n+v,0),0);assert.equal(vp,a.players[0].vp);
 assert.equal(a.players.reduce((s,p)=>s+p.winShare,0),1);
});
