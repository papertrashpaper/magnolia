import test from 'node:test';
import assert from 'node:assert/strict';
import {metrics,paired} from '../scripts/analyze-long-term.mjs';
const row=(seed,count,arm,win,vp)=>({seed,count,arm,group:'natural',focal:0,initial:[['same']],players:[{winShare:win,vp,features:{}}]});
test('paired comparison requires matching initial deals and clusters the shared seeds',()=>{
 const rows=[];for(let seed=0;seed<4;seed++)for(const count of [2,5])rows.push(row(seed,count,'baseline',0,10),row(seed,count,'flexible',1,20));
 const p=paired(rows,'flexible');assert.equal(p.pairs,8);assert.equal(p.seeds,4);assert.equal(p.diff,1);assert.deepEqual(p.ci95,[1,1]);assert.equal(p.vpDiff,10);
 rows.at(-1).initial=[['different']];assert.throws(()=>paired(rows,'flexible'));
});
test('income precedes expensive placement only when a later round actually places it',()=>{
 const game={focal:0,players:[{winShare:0,vp:0,features:{}}],history:[],rounds:2,timing:{totalMs:1,decisions:1,maxMs:1},roundHistory:[
  {round:1,vpByPhase:{},changes:[{card:'human_great_marchant',phase:'place',changes:[]}]},
  {round:2,vpByPhase:{},changes:[{card:'human_king',phase:'place',changes:[]}]}
 ]};
 assert.equal(metrics(game).incomeToExpensive,1);game.roundHistory[1].round=1;assert.equal(metrics(game).incomeToExpensive,0);
});
