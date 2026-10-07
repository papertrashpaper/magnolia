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
