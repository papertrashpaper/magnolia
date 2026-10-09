import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD,CARDS} from '../public/js/cards.js';
import {clone,makePlayer,placeOne,submit,publicPlayer,legalCells} from '../public/js/engine.js';
import {enumeratePlacements,guaranteedEnd,makeWorld,finishAction,choose} from '../scripts/endgame-decisions.mjs';
function fixture(){const p=makePlayer('0','0'),q=makePlayer('1','1');p.gold=1;p.hand=['golem_gold','human_marchant'];p.board=[{card:'human_marchant',x:0,y:0},{card:'dwarf_gem',x:1,y:0}];q.board=[{card:'demon_pest',x:0,y:0}];q.vp=36;return {p,opponents:[{...publicPlayer(q),hand:[],handCount:5}],settings:{warVP:[4,0],targetVP:40,additionalObjectives:false},discard:[],round:7};}
test('complete placement search pays sequentially and includes immediate funding and every affordable coordinate',()=>{
 const state=fixture();state.p.gold=2;const before=clone(state),actions=enumeratePlacements(state.p);
 assert.deepEqual(state,before);assert.equal(actions.filter(a=>!a.moves.length).length,1);
 assert.ok(actions.some(a=>a.named.length===2&&a.named[0].card==='golem_gold'&&a.named[1].card==='human_marchant'));
 for(const a of actions){const p=clone(state.p);for(const m of a.moves)placeOne(p,m);assert.deepEqual(p,a.player);}
 assert.ok(actions.some(a=>a.features.newBonuses>0));assert.equal(actions.filter(a=>a.moves.length===1).length,state.p.hand.filter(id=>CARD[id].cost<=state.p.gold).length*legalCells(state.p.board).length);assert.ok(!actions.some(a=>a.named.length===2&&a.named[0].card==='human_marchant'&&a.named[1].card==='golem_gold'));
});
test('final scoring from precomputed simultaneous orders exactly matches engine submission',()=>{
 const state=fixture();assert.ok(guaranteedEnd([state.p,...state.opponents]));
 const world=makeWorld(state,'balanced',0),action=enumeratePlacements(state.p).at(-1),got=finishAction(state,action,world,{audit:true});
 const p=clone(state.p),others=world.players.slice(1).map(clone);
 // Restore opponents before their submitted placements using a fresh hypothetical deal.
 for(let i=0;i<others.length;i++){const before=state.opponents[i],played=world.responses[i].moves.map(m=>m.card);others[i]={...clone(before),hand:[...others[i].hand,...played]};}
 const g={players:[p,...others],deck:world.deck,discard:[],settings:state.settings,round:state.round,phase:'place',orders:{},logs:[],revision:0};
 submit(g,p.id,{moves:action.moves});for(let i=0;i<others.length;i++){const q=others[i],temp=clone(q),moves=world.responses[i].moves.map(m=>{const move={handIndex:temp.hand.indexOf(m.card),x:m.x,y:m.y};placeOne(temp,move);return move;});submit(g,q.id,{moves});}
 const own=g.players[0];assert.deepEqual(got,[g.winners.includes(own.id)?1/g.winners.length:0,own.vp,own.vp-Math.max(...g.players.slice(1).map(q=>q.vp)),own.rank,own.warVP,own.finalGoldVP]);
});
test('hypothetical worlds do not use real opponent hands, and selection never reads audit outcomes',()=>{
 const state=fixture(),a=makeWorld(state,'war',100);state.opponents[0].hand=Array(5).fill('demon_storm');assert.deepEqual(makeWorld(state,'war',100),a);
 const actions=[{id:0,features:{count:0,power:1,newBonuses:0},train:{share:1,gap:3,vp:40},audit:{share:0}},{id:1,features:{count:2,power:2,newBonuses:1},train:{share:0,gap:10,vp:60},audit:{share:1}}];assert.equal(choose(actions),0);actions[0].audit.share=100;assert.equal(choose(actions),0);assert.equal(choose(actions,'ownVP'),1);
 assert.ok(CARDS.every(c=>c.effects.every(e=>e.amount>=0)));assert.equal(CARDS.length,41);assert.equal(CARDS.reduce((n,c)=>n+c.copies,0),102);
});
