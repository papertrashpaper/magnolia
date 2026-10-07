import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer} from '../server.mjs';
test('実HTTPで作成・参加・CPU補充・手札秘匿・フェイズ同期・再接続',async()=>{
 const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(route,body)=>{const r=await fetch(`${base}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const a=(await post('create',{name:'A',total:3,cpuCount:1,settings:{warVP:[7,3,0]}})).data;
  const b=(await post('join',{name:'B',room:a.state.room})).data;assert.equal(b.state.players.length,2);
  assert.equal((await post('join',{name:'C',room:a.state.room})).status,400);
  assert.equal((await post('start',{room:a.state.room,token:b.token})).status,400);
  let state=(await post('start',{room:a.state.room,token:a.token})).data;
  assert.equal(state.players.length,3);assert.equal(state.players[2].cpu,true);assert.equal(state.players[1].hand,undefined);assert.equal(state.players[0].hand.length,5);
  assert.equal((await post('action',{room:a.state.room,token:'bad',phase:'draw',round:1,order:{discard:[]}})).status,400);
  const credentials={room:a.state.room,token:a.token};const other={room:a.state.room,token:b.token};
  state=(await post('action',{...credentials,phase:'draw',round:1,order:{discard:[]}})).data;assert.equal(state.phase,'draw');
  state=(await post('action',{...other,phase:'draw',round:1,order:{discard:[]}})).data;assert.equal(state.phase,'place');
  const response=await fetch(`${base}/api/stream?${new URLSearchParams(credentials)}`);assert.equal(response.headers.get('content-type'),'text/event-stream');
  const reader=response.body.getReader();const chunk=await reader.read();assert.ok(new TextDecoder().decode(chunk.value).includes('data:'));await reader.cancel();
  state=(await post('action',{...credentials,phase:'place',round:1,order:{moves:[]}})).data;assert.equal(state.phase,'place');
  state=(await post('action',{...other,phase:'place',round:1,order:{moves:[]}})).data;assert.equal(state.phase,'round');
  assert.equal((await post('action',{...credentials,phase:'place',round:1,order:{moves:[]}})).status,400);
  state=(await post('next',credentials)).data;assert.equal(state.round,2);assert.equal(state.phase,'draw');
  const restored=await(await fetch(`${base}/api/state?${new URLSearchParams(other)}`)).json();assert.equal(restored.you,b.id);assert.equal(restored.round,2);
  const denied=await fetch(`${base}/api/state?${new URLSearchParams(credentials)}`,{headers:{Origin:'https://example.invalid'}});assert.equal(denied.status,403);
  const good=await fetch(`${base}/health`,{headers:{Origin:'https://papertrashpaper.github.io'}});assert.equal(good.headers.get('access-control-allow-origin'),'https://papertrashpaper.github.io');
 }finally{await new Promise(r=>server.close(r));}
});

test('確定配置は本人だけ復元でき、終了後は同じ部屋・参加者・設定で再対戦',async()=>{
 const {cpuDraw,cpuPlace}=await import('../public/js/cpu.js');
 const {previewPlacement}=await import('../public/js/engine.js');
 const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(route,body)=>{const r=await fetch(`${base}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const get=async(c)=>await(await fetch(`${base}/api/state?${new URLSearchParams(c)}`)).json();
 try{
  const a=(await post('create',{name:'A',total:3,cpuCount:1,settings:{warVP:[7,3,0]}})).data;
  const b=(await post('join',{name:'B',room:a.state.room})).data;
  const ac={room:a.state.room,token:a.token},bc={room:a.state.room,token:b.token};
  let s=(await post('start',ac)).data;const gameId=s.gameId;
  assert.equal((await post('rematch',ac)).status,400);
  let checked=false;
  for(let steps=0;s.phase!=='ended'&&steps<120;steps++){
   if(s.phase==='round'){s=(await post('next',{...ac,gameId})).data;continue;}
   for(const c of [ac,bc]){
    const v=await get(c),p=v.players.find(x=>x.id===v.you);
    const order=v.phase==='draw'?cpuDraw(p):cpuPlace(p,v.players.filter(x=>x.id!==p.id));
    const result=await post('action',{...c,gameId,round:v.round,phase:v.phase,order});assert.equal(result.status,200);s=result.data;
    if(c===ac&&v.phase==='place'&&order.moves.length&&!checked){
     const restored=await get(ac),other=await get(bc);
     assert.deepEqual(restored.ownOrder,order);assert.equal(restored.players.find(x=>x.id===a.id).ready,true);
     const preview=previewPlacement(restored.players.find(x=>x.id===a.id),restored.ownOrder.moves).player;
     assert.equal(preview.board.length,p.board.length+order.moves.length);assert.equal(preview.hand.length,p.hand.length-order.moves.length);
     assert.equal(other.ownOrder,null);assert.deepEqual(other.players.find(x=>x.id===a.id).board,p.board);assert.equal(other.players.find(x=>x.id===a.id).hand,undefined);checked=true;
    }
   }
  }
  assert.equal(checked,true);assert.equal(s.phase,'ended');const seats=s.players.map(({id,name,cpu})=>({id,name,cpu}));
  assert.equal((await post('rematch',{...bc,gameId})).status,400);
  const fresh=(await post('rematch',{...ac,gameId})).data;assert.equal(fresh.room,a.state.room);assert.notEqual(fresh.gameId,gameId);assert.equal(fresh.round,1);assert.equal(fresh.phase,'draw');assert.deepEqual(fresh.settings.warVP,[7,3,0]);assert.deepEqual(fresh.players.map(({id,name,cpu})=>({id,name,cpu})),seats);
  for(const p of fresh.players){assert.equal(p.gold,5);assert.equal(p.vp,0);assert.equal(p.board.length,0);assert.equal(p.handCount,5);}
  const other=await get(bc);assert.equal(other.gameId,fresh.gameId);assert.equal(other.you,b.id);
  assert.equal((await post('action',{...ac,gameId,round:1,phase:'draw',order:{discard:[]}})).status,400);
  assert.equal((await post('rematch',{...ac,gameId})).status,400);
 }finally{await new Promise(r=>server.close(r));}
});
