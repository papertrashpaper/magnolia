import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer} from '../server.mjs';
import {makeRoomStore} from '../room-store.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
const key='ab'.repeat(32);
async function start(options){const server=makeServer(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;return {server,post:async(route,body)=>{const r=await fetch(`${base}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};},get:async c=>await(await fetch(`${base}/api/state?${new URLSearchParams(c)}`)).json(),stream:async c=>fetch(`${base}/api/stream?${new URLSearchParams(c)}`)};}
const close=s=>new Promise(r=>s.close(r));
test('暗号化バックアップはサーバー再起動後に部屋と確定操作を復元し、改ざん・別参加者を拒否',async()=>{
 let api=await start({key});
 try{
 const a=(await api.post('create',{name:'A',total:3,cpuCount:1,settings:{cpuDifficulties:['easy','overlord']}})).data;
 const b=(await api.post('join',{name:'B',room:a.state.room})).data;
 const c={room:a.state.room,token:a.token},other={room:a.state.room,token:b.token};
 let s=(await api.post('start',c)).data;assert.equal(s.players.find(p=>p.cpu).cpuDifficulty,'easy');
 s=(await api.post('action',{...c,phase:'draw',round:1,order:{discard:[]}})).data;
 const backup=s.backup;assert.ok(!backup.includes('members'));assert.ok(!backup.includes(a.token));
 await close(api.server);api=await start({key});
 assert.equal((await api.post('restore',{...c,backup:backup.slice(0,-4)+'AAAA'})).status,400);
 assert.equal((await api.post('restore',{...c,token:'other',backup})).status,400);
 const restored=(await api.post('restore',{...c,backup})).data;
 assert.equal(restored.gameId,s.gameId);assert.deepEqual(restored.ownOrder,{discard:[]});assert.equal(restored.players.find(p=>p.id===a.id).ready,true);
 assert.equal(restored.players.find(p=>p.id===b.id).hand,undefined);
 assert.equal((await api.get(other)).you,b.id);
 const newer=(await api.post('action',{...other,phase:'draw',round:1,order:{discard:[]}})).data;assert.equal(newer.phase,'place');
 assert.equal((await api.post('restore',{...c,backup})).data.phase,'place','古いバックアップは稼働中の部屋を上書きしない');
 await close(api.server);api=await start({key});await api.post('restore',{...c,backup});assert.equal((await api.post('restore',{...c,backup:newer.backup})).data.phase,'place','再起動後に別の参加者が持つ新しい保存データを受け取ると更新する');
 }finally{await close(api.server);}
});
test('接続・切断は配信接続で判定し、複数タブの一方を閉じても接続を保持',async()=>{
 const api=await start({key});const controllers=[];
 try{const a=(await api.post('create',{name:'A',total:2})).data,c={room:a.state.room,token:a.token};
 for(let i=0;i<2;i++){const r=await api.stream(c);const reader=r.body.getReader();await reader.read();controllers.push(reader);}
 assert.equal((await api.get(c)).presence[0].connected,true);await controllers.pop().cancel();
 await new Promise(r=>setTimeout(r,30));assert.equal((await api.get(c)).presence[0].connected,true);
 await controllers.pop().cancel();await new Promise(r=>setTimeout(r,30));assert.equal((await api.get(c)).presence[0].connected,false);
 }finally{for(const reader of controllers)await reader.cancel();await close(api.server);}
});
test('ファイル保存も暗号化し、同じ鍵で再起動時に読み込める',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'magnolia-')),file=path.join(dir,'rooms.json');
 try{const storage=makeRoomStore({key,file}),room={code:'ABCDEF',members:[{id:'x',token:'secret'}],updated:Date.now(),streams:new Set()};storage.save(new Map([[room.code,room]]));assert.equal(makeRoomStore({key,file}).load()[0].members[0].token,'secret');}finally{await rm(dir,{recursive:true,force:true});}
});
test('CPUごとの強さと振り返りも同じ部屋の再対戦で保持する',async()=>{
 const {newGame}=await import('../public/js/engine.js');
 const game=newGame([{id:'human',name:'A'},{id:'c1',name:'CPU 1',cpu:true,cpuDifficulty:'easy'},{id:'c2',name:'CPU 2',cpu:true,cpuDifficulty:'expert'}],{cpuDifficulties:['easy','expert']});game.phase='ended';
 const data={code:'ABC123',total:3,cpuCount:2,settings:game.settings,hostId:'human',members:[{id:'human',name:'A',token:'secret'}],game,gameId:'old',updated:Date.now()};
 const api=await start({key});
 try{const c={room:data.code,token:'secret'};assert.equal((await api.post('restore',{...c,backup:makeRoomStore({key}).seal(data)})).status,200);const r=(await api.post('rematch',{...c,gameId:'old'})).data;assert.equal(r.room,data.code);assert.deepEqual(r.players.filter(p=>p.cpu).map(p=>p.cpuDifficulty),['easy','expert']);assert.equal(r.roundReviews.length,0);}finally{await close(api.server);}
});
