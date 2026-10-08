import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CARDS} from '../public/js/cards.js';
import {newGame} from '../public/js/engine.js';
import {random} from './adaptive-strategies.mjs';
const total=CARDS.reduce((s,c)=>s+c.copies,0),trials=10000,counts=Object.fromEntries(CARDS.map(c=>[c.id,0])),first=new Set();
for(let seed=100000;seed<100000+trials;seed++){const g=newGame([{id:'0',name:'0'},{id:'1',name:'1'}],{},random(seed));first.add(g.players[0].hand[0]);for(const p of g.players)for(const id of new Set(p.hand))counts[id]++;}
const cards=CARDS.map(c=>{let absent=1;for(let i=0;i<5;i++)absent*=(total-c.copies-i)/(total-i);const expected=1-absent,observed=counts[c.id]/(trials*2);return {id:c.id,copies:c.copies,expected,observed,difference:observed-expected};});
const maxDeviation=Math.max(...cards.map(c=>Math.abs(c.difference)));assert.ok(maxDeviation<.01,'Initial card frequencies deviate by more than 1 percentage point');assert.equal(first.size,CARDS.length);
const result={schema:1,totalCards:total,decks:trials,handObservations:trials*2,seedStart:100000,seedEnd:109999,firstCardTypes:first.size,maxDeviation,cards,note:'Seed is SHA-256 mixed before LCG initialization. Deterministic distribution sanity check, not proof of perfect randomness.'};await writeFile('research/adaptive-strategy-comparison/deal-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({decks:trials,firstCardTypes:first.size,maxDeviation}));
