import test from 'node:test';
import assert from 'node:assert/strict';
import {matBounds,createRefreshments,servingLabel} from '../public/js/tavern.js';
import {bounds,legalCells} from '../public/js/engine.js';

test('empty mat has the first-card framing without adding legal placement cells',()=>{
 const empty=[],first=[{x:0,y:0,card:'irrelevant-for-bounds'}];
 assert.deepEqual(matBounds(empty,legalCells(empty)),bounds([...first,...legalCells(first)]));
 assert.deepEqual(legalCells(empty),[{x:0,y:0}]);
 const grown=[{x:-1,y:-1},{x:-1,y:0},{x:0,y:0}];
 assert.deepEqual(matBounds(grown,legalCells(grown)),bounds([...grown,...legalCells(grown)]));
});

test('three servings become empty, refill once, and food and beer are independent',()=>{
 const pending=[],changes=[];
 const service=createRefreshments((...args)=>changes.push(args),{schedule:fn=>pending.push(fn)});
 assert.equal(service.take('bread'),true);assert.deepEqual(service.servings,{bread:1,beer:0});
 service.take('beer');service.take('bread');service.take('bread');
 assert.deepEqual(service.servings,{bread:3,beer:1});assert.equal(pending.length,1);
 assert.equal(service.take('bread'),false);assert.equal(pending.length,1);
 assert.match(servingLabel('bread',3),/給仕/);
 pending.shift()();assert.deepEqual(service.servings,{bread:0,beer:1});assert.deepEqual(changes.at(-1),['bread',true]);
 service.take('bread');service.take('beer');service.take('beer');
 assert.deepEqual(service.servings,{bread:1,beer:3});assert.match(servingLabel('beer',3),/注いで/);
 pending.shift()();assert.deepEqual(service.servings,{bread:1,beer:0});assert.deepEqual(changes.at(-1),['beer',true]);
});
