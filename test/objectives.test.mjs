import test from 'node:test';
import assert from 'node:assert/strict';
import {OBJECTIVES,objectiveProgress} from '../public/js/objectives.js';
import {newGame,makePlayer,checkObjectives,submit,resolveRound,publicView,objectivePlacementHints} from '../public/js/engine.js';
import {resolutionView} from '../public/js/presentation.js';
const seats=[{id:'a',name:'A'},{id:'b',name:'B'}];
const goal=id=>({id,claimedBy:[]});
const board=ids=>ids.map((card,i)=>({card,x:i%3,y:Math.floor(i/3)}));
test('12枚・各3VP、オンで4枚重複なし／オフで従来配札',()=>{
 assert.equal(OBJECTIVES.length,12);assert.ok(OBJECTIVES.every(o=>o.vp===3));
 const a=newGame(seats,{},()=>.3),b=newGame(seats,{additionalObjectives:false},()=>.3);
 assert.deepEqual(a.players,b.players);assert.equal(a.objectives.length,0);
 const g=newGame(seats,{additionalObjectives:true},()=>.3);assert.equal(new Set(g.objectives.map(o=>o.id)).size,4);
 assert.throws(()=>newGame(seats,{additionalObjectives:'true'}));
});
test('配置フェイズ完了時のみ判定、全員が同時達成し再加点しない',()=>{
 const g=newGame(seats);g.objectives=[goal('gold2')];g.phase='place';
 for(const p of g.players){p.gold=5;p.hand=['human_knight'];}
 submit(g,'a',{moves:[{handIndex:0,x:0,y:0}]});assert.deepEqual(g.objectives[0].claimedBy,[]);
 // A:5 -3 +1 =3, so transient cash2 must NOT claim.
 submit(g,'b',{moves:[{handIndex:0,x:0,y:0}]});assert.deepEqual(g.objectives[0].claimedBy,[]);
 for(const p of g.players)p.gold=2;
 checkObjectives(g,'income');assert.deepEqual(g.objectives[0].claimedBy,[]);
 const before=g.players.map(p=>p.vp);checkObjectives(g,'place');assert.deepEqual(g.objectives[0].claimedBy,['a','b']);
 assert.deepEqual(g.players.map(p=>p.vp),before.map(n=>n+3));checkObjectives(g,'place');assert.deepEqual(g.players.map(p=>p.vp),before.map(n=>n+3));
});
test('12金はすべてのフェイズ終了時に完全一致、残金換算では判定しない',()=>{
 const g=newGame(seats);g.objectives=[goal('gold12')];g.players[0].gold=13;checkObjectives(g,'income');assert.deepEqual(g.objectives[0].claimedBy,[]);
 g.players[0].gold=12;checkObjectives(g,'final');assert.deepEqual(g.objectives[0].claimedBy,[]);checkObjectives(g,'income');assert.deepEqual(g.objectives[0].claimedBy,['a']);
});
test('収入は所持金ではなく基本収入込みの当該フェイズ増加額',()=>{
 const g=newGame(seats);g.objectives=[goal('income7')];const before=structuredClone(g.players);g.players[0].gold=12;g.players[1].gold=11;
 checkObjectives(g,'income',before);assert.deepEqual(g.objectives[0].claimedBy,['a']);
 const p=makePlayer('p','P');p.board=board(['human_great_marchant','human_great_marchant']);assert.equal(objectiveProgress(p,'income7').value,7);
});
test('全12条件の境界と盤面・能力を使った進捗',()=>{
 const p=makePlayer('p','P');p.gold=2;assert.equal(objectiveProgress(p,'gold2').met,true);p.gold=12;assert.equal(objectiveProgress(p,'gold12').met,true);
 p.board=board(['human_knight','human_marchant','dwarf_pugilist']);assert.equal(objectiveProgress(p,'cheap3').met,true);
 p.board=board(['human_smith','human_king','elf_queen']);assert.equal(objectiveProgress(p,'expensive3').met,true);
 p.board=board(['human_knight','human_marchant','human_smith','human_saint']);assert.equal(objectiveProgress(p,'jobs4').met,true);
 p.board=board(['human_knight','dwarf_pugilist','elf_archer','goblin_soldier']);assert.equal(objectiveProgress(p,'races4').met,true);
 p.board=board(['human_knight','human_knight','dwarf_pugilist']);assert.equal(objectiveProgress(p,'power15').met,true);
 p.board=board(Array(6).fill('human_marchant')).map((b,i)=>({...b,x:i%2-2,y:Math.floor(i/2)-2}));assert.equal(objectiveProgress(p,'columns2').met,true);p.board.pop();assert.equal(objectiveProgress(p,'columns2').met,false);
 p.tech=p.faith=3;assert.equal(objectiveProgress(p,'levels2').met,true);p.faith=2;assert.equal(objectiveProgress(p,'levels2').met,false);
 p.tech=p.faith=7;assert.equal(objectiveProgress(p,'tech3').met,true);assert.equal(objectiveProgress(p,'faith3').met,true);p.tech=p.faith=6;assert.equal(objectiveProgress(p,'tech3').met,false);assert.equal(objectiveProgress(p,'faith3').near,true);
});
test('目標の得点で終了判定・手札非公開・演出は達成前の状態から開始',()=>{
 const g=newGame(seats);g.objectives=[goal('tech3')];g.players[0].tech=7;g.players[0].vp=37;g.settings.warVP=[0,0];resolveRound(g);
 assert.equal(g.phase,'ended');const v=publicView(g,'a');assert.equal(v.players[1].hand,undefined);assert.deepEqual(v.objectives[0].claimedBy,['a']);
 assert.deepEqual(resolutionView(v,-1).objectives[0].claimedBy,[]);
 const index=v.resolution.events.findIndex(e=>e.objectiveId);assert.deepEqual(resolutionView(v,index).objectives[0].claimedBy,['a']);
 delete g.objectives;assert.deepEqual(publicView(g,'a').objectives,[]);
});
test('配置案内は手札と合法位置を使用、未配置報酬込み、達成済みは案内しない',()=>{
 const p=makePlayer('p','P');p.gold=4;p.hand=['human_knight'];const hints=objectivePlacementHints(p,[goal('gold2'),{id:'tech3',claimedBy:['q']}]);
 assert.equal(hints.gold2.moves.length,1);assert.equal(hints.tech3,undefined);
 const poor={...p,gold:2};assert.equal(objectivePlacementHints(poor,[goal('gold2')]).gold2,undefined);
});
test('HTTPで公開目標・設定・再接続を同期し相手の手札を秘匿する',async()=>{
 const {makeServer}=await import('../server.mjs');const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(route,body)=>{const res=await fetch(`${base}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(res.status,200);return res.json();};
 try{
  const a=await post('create',{name:'A',total:2,settings:{additionalObjectives:true,warVP:[4,0]}}),b=await post('join',{name:'B',room:a.state.room});
  assert.equal(b.state.settings.additionalObjectives,true);
  const ac={room:a.state.room,token:a.token},bc={room:a.state.room,token:b.token};const s=await post('start',ac);
  assert.equal(s.objectives.length,4);const v=await(await fetch(`${base}/api/state?${new URLSearchParams(bc)}`)).json();assert.deepEqual(s.objectives,v.objectives);assert.equal(v.players.find(p=>p.id===a.id).hand,undefined);
  await post('action',{...ac,phase:'draw',round:1,order:{discard:[]}});await post('action',{...bc,phase:'draw',round:1,order:{discard:[]}});
  await post('action',{...ac,phase:'place',round:1,order:{moves:[]}});const after=await post('action',{...bc,phase:'place',round:1,order:{moves:[]}});
  const restored=await(await fetch(`${base}/api/state?${new URLSearchParams(ac)}`)).json();assert.deepEqual(restored.objectives,after.objectives);
 }finally{await new Promise(r=>server.close(r));}
});
test('配置案内は次の発展・収入も考慮する',()=>{
 const p=makePlayer('p','P');p.gold=4;p.faith=6;p.hand=['human_saint'];
 const h=objectivePlacementHints(p,[goal('faith3')]);assert.equal(h.faith3.phase,'develop');assert.equal(h.faith3.moves[0].name,'人間の聖職者');
 p.board=[{card:'human_great_marchant',x:0,y:0}];p.hand=['human_great_marchant'];const income=objectivePlacementHints(p,[goal('income7')]);assert.equal(income.income7.phase,'income');
});
