import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,publicPlayer,previewPlacement} from '../public/js/engine.js';
import {chooseStrategy,unseenPool,random} from '../scripts/adaptive-strategies.mjs';
import {adaptiveMatch} from '../scripts/benchmark-adaptive-strategies.mjs';
import {validate} from '../scripts/analyze-adaptive-strategies.mjs';
import {royalMatch} from '../scripts/benchmark-royal-route.mjs';
test('adaptive planning is deterministic, legal and ignores actual hidden deck/hands',()=>{
 const g=newGame([{id:'0',name:'self'},{id:'1',name:'other'}],{},random(8901));const p=g.players[0],opponents=g.players.slice(1).map(q=>({...publicPlayer(q),hand:[]}));const args=[p,opponents,g.settings,g.discard,1,'place',{worlds:1,horizon:0,beam:1}];
 const before=structuredClone(g),a=chooseStrategy(...args);previewPlacement(p,a.order.moves);g.deck.reverse();g.players[1].hand.reverse();const b=chooseStrategy(...args);assert.deepEqual(a,b);assert.deepEqual(g.players[0],before.players[0]);assert.ok(a.coBest.includes(a.key));assert.equal(a.evaluations.length,8);
 assert.equal(unseenPool(p,opponents,g.discard).length,97);
});
test('the offered royal route is legal, reproducible and awards the doubled ruler bonus',()=>{
 const task={id:0,count:2,seed:500000,focal:0,treatment:'route',options:{worlds:2,horizon:1,beam:2}};
 const r=royalMatch(task);validate([r],{games:1});assert.ok(r.completed);assert.ok(r.players[0].sources.bonus>=18);assert.deepEqual(r,royalMatch(task));
});
test('offered-card retention experiment pairs initial hands and enforces only first mulligan',()=>{
 const task={id:0,group:'card',seed:88123,controllers:['adaptive','balanced'],focal:0,card:'human_king',options:{worlds:1,horizon:0,beam:1}};
 const keep=adaptiveMatch({...task,treatment:'keep'}),exchange=adaptiveMatch({...task,treatment:'exchange'});
 const a=keep.players[0].history[0],b=exchange.players[0].history[0];assert.deepEqual(a.hand,b.hand);const index=a.hand.indexOf('human_king');assert.ok(index>=0);assert.ok(!a.order.discard.includes(index));assert.ok(b.order.discard.includes(index));
 for(const r of [keep,exchange]){validate([r],{games:1});assert.equal(r.players.reduce((s,p)=>s+p.winShare,0),1);for(const p of r.players)assert.equal(Object.values(p.sources).reduce((a,b)=>a+b,0),p.vp);}
 const broken=structuredClone(keep);broken.players[0].sources.gold++;assert.throws(()=>validate([broken],{games:1}),/VP attribution/);
 assert.deepEqual(keep,adaptiveMatch({...task,treatment:'keep'}));
});
