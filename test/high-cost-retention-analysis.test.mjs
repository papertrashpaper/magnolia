import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRetention} from '../scripts/analyze-high-cost-retention.mjs';
const row=(ended=16)=>({state:{count:2,stratum:'dwarf_beer'},evaluations:[{key:'once',aggregate:{ended,total:16,share:1,vp:40,gap:2,complete:1,drawn:9}},{key:'drop',aggregate:{ended:16,total:16,share:.5,vp:42,gap:0,complete:0,drawn:10}}]});
test('initial-hand pairing excludes censored outcomes and has no false precision for one hand',()=>{const d=compareRetention([row(),row(15)],'once','drop');assert.equal(d.states,1);assert.equal(d.share,.5);assert.equal(d.vp,-2);assert.equal(d.completion,1);assert.equal(d.drawn,-1);assert.equal(d.ci95,null);assert.equal(compareRetention([row(15)],'once','drop').states,0);});
test('reversing retention contrast reverses share and score differences',()=>{const a=compareRetention([row()],'drop','once');assert.equal(a.share,-.5);assert.equal(a.vp,2);assert.equal(a.worse,1);});
