import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {newGame,submit,nextRound,publicView,normalizeSettings} from './public/js/engine.js';
import {makeRoomStore,roomData,ROOM_TTL} from './room-store.mjs';
import {fillCPU} from './public/js/cpu.js';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const id=()=>randomBytes(18).toString('hex');
const cleanName=value=>String(value??'').trim().slice(0,20)||'プレイヤー';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
export function makeServer(options={}){
 const storage=makeRoomStore(options),rooms=new Map(storage.load().map(r=>[r.code,{...r,streams:new Set()}])),rates=new Map();
 function save(room){room.updated=Date.now();room.saveVersion=(room.saveVersion??0)+1;room.backup=storage.seal(roomData(room));storage.save(rooms);}
 for(const room of rooms.values())room.backup=storage.seal(roomData(room));
 const origins=new Set((process.env.ALLOWED_ORIGINS||'https://papertrashpaper.github.io').split(',').map(x=>x.trim()).filter(Boolean));
 function find(roomCode,token){
  const room=rooms.get(String(roomCode??'').toUpperCase());if(!room)throw Error('部屋が見つかりません。サーバー再起動で消えた可能性があります。');
  const member=room.members.find(m=>m.token===token);if(!member)throw Error('この部屋の参加情報がありません。');room.updated=Date.now();return {room,member};
 }
 function view(room,member){return {backup:room.backup,presence:room.members.map(m=>({id:m.id,connected:[...room.streams].some(s=>s.member.id===m.id)})),room:room.code,total:room.total,hostId:room.hostId,you:member.id,gameId:room.gameId||null,...(room.game?publicView(room.game,member.id):{phase:'lobby',players:room.members.map(({id,name})=>({id,name,cpu:false})),settings:room.settings})};}
 function publish(room){for(const {res,member}of room.streams)res.write(`data: ${JSON.stringify(view(room,member))}\n\n`);}
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  const hostOrigin=`${req.headers['x-forwarded-proto']==='https'?'https':'http'}://${req.headers.host}`;
  if(origin){
   if(origin!==hostOrigin&&!origins.has(origin)){res.writeHead(403);res.end('Origin not allowed');return;}
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  }
  res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const url=new URL(req.url,'http://localhost');
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   if(url.pathname==='/health'){json(200,{ok:true});return;}
   if(url.pathname==='/api/stream'&&req.method==='GET'){
    const {room,member}=find(url.searchParams.get('room'),url.searchParams.get('token'));
    const existing=[...room.streams].filter(s=>s.member.id===member.id);if(existing.length>=3)throw Error('同じ参加者の接続が多すぎます。');
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
    const stream={res,member};room.streams.add(stream);publish(room);res.write(`data: ${JSON.stringify(view(room,member))}\n\n`);
    const heartbeat=setInterval(()=>res.write(': keepalive\n\n'),20000);req.on('close',()=>{clearInterval(heartbeat);room.streams.delete(stream);publish(room);});return;
   }
   if(url.pathname==='/api/state'&&req.method==='GET'){const {room,member}=find(url.searchParams.get('room'),url.searchParams.get('token'));json(200,view(room,member));return;}
   if(url.pathname.startsWith('/api/')&&req.method==='POST'){
    const ip=req.socket.remoteAddress;const now=Date.now();let rate=rates.get(ip);if(!rate||now-rate.start>60000){rate={start:now,count:0};rates.set(ip,rate);}if(++rate.count>120){json(429,{error:'操作が多すぎます。少し待ってください。'});return;}
    let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>(url.pathname==='/api/restore'?1500000:24000)){json(413,{error:'送信内容が大きすぎます。'});return;}}
    let body;try{body=JSON.parse(text);}catch{throw Error('送信内容を読み取れません。');}
    if(url.pathname==='/api/restore'){
     const recovered=storage.open(body.backup);
     if(recovered.code!==String(body.room??'').toUpperCase()||!recovered.members.some(m=>m.token===body.token))throw Error('この保存データの参加情報がありません。');
     const existing=rooms.get(recovered.code);
     if(!existing){if(rooms.size>=250)throw Error('現在、部屋が満員です。');rooms.set(recovered.code,{...recovered,streams:new Set()});storage.save(rooms);}
     else if(recovered.hostId===existing.hostId&&(recovered.saveVersion??0)>(existing.saveVersion??0)){
      const streams=existing.streams;Object.assign(existing,recovered,{streams});existing.backup=storage.seal(roomData(existing));storage.save(rooms);publish(existing);
     }
     const restored=rooms.get(recovered.code);restored.backup??=storage.seal(roomData(restored));
     const {room,member}=find(body.room,body.token);json(200,view(room,member));return;
    }
    if(url.pathname==='/api/create'){
     if(rooms.size>=250)throw Error('現在、部屋が満員です。');
     const total=Number(body.total),cpuCount=Number(body.cpuCount??0);
     if(!Number.isInteger(total)||total<2||total>5||!Number.isInteger(cpuCount)||cpuCount<0||cpuCount>=total)throw Error('人数設定が不正です。');
     const settings=normalizeSettings(body.settings,total);let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
     const member={id:id(),token:id(),name:cleanName(body.name)};
     const room={code,total,cpuCount,settings,hostId:member.id,members:[member],streams:new Set(),game:null,updated:Date.now()};rooms.set(code,room);save(room);
     json(200,{token:member.token,id:member.id,state:view(room,member)});return;
    }
    if(url.pathname==='/api/join'){
     const room=rooms.get(String(body.room??'').toUpperCase());if(!room)throw Error('部屋が見つかりません。');
     if(room.game)throw Error('この部屋はゲーム開始済みです。');
     if(room.members.length>=room.total-room.cpuCount)throw Error('人間用の席が満員です。');
     const member={id:id(),token:id(),name:cleanName(body.name)};room.members.push(member);room.updated=Date.now();save(room);publish(room);
     json(200,{token:member.token,id:member.id,state:view(room,member)});return;
    }
    const {room,member}=find(body.room,body.token);
    if(body.gameId&&body.gameId!==room.gameId)throw Error('対戦が更新されました。現在の画面を確認してください。');
    if(url.pathname==='/api/rematch'){
     if(member.id!==room.hostId)throw Error('部屋主のみ再対戦を開始できます。');
     if(room.game?.phase!=='ended')throw Error('対戦終了後に再対戦できます。');
     const seats=room.game.players.map(({id,name,cpu,cpuDifficulty})=>({id,name,cpu,cpuDifficulty}));
     room.game=newGame(seats,room.settings);room.gameId=id();fillCPU(room.game,submit);
    }else if(url.pathname==='/api/start'){
     if(member.id!==room.hostId)throw Error('部屋主のみ開始できます。');if(room.game)throw Error('ゲームは開始済みです。');
     const seats=room.members.map(m=>({id:m.id,name:m.name,cpu:false}));while(seats.length<room.total){const index=seats.length-room.members.length;seats.push({id:`cpu-${seats.length}`,name:`CPU ${index+1}`,cpu:true,cpuDifficulty:room.settings.cpuDifficulties?.[index]??room.settings.cpuDifficulty});}
     room.game=newGame(seats,room.settings);room.gameId=id();fillCPU(room.game,submit);
    }else if(url.pathname==='/api/action'){
     if(!room.game)throw Error('ゲームが始まっていません。');
     if(body.phase!==room.game.phase||body.round!==room.game.round)throw Error('画面が更新されました。現在のフェイズを確認してください。');
     submit(room.game,member.id,body.order);if(['draw','place'].includes(room.game.phase))fillCPU(room.game,submit);
    }else if(url.pathname==='/api/next'){
     if(member.id!==room.hostId)throw Error('部屋主が次のラウンドへ進めます。');if(!room.game)throw Error('ゲームが始まっていません。');nextRound(room.game);fillCPU(room.game,submit);
    }else{json(404,{error:'操作が見つかりません。'});return;}
    save(room);publish(room);json(200,view(room,member));return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){json(405,{error:'Method not allowed'});return;}
   const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const file=path.resolve(root,'.'+relative);
   if(!file.startsWith(root+path.sep)){json(404,{error:'Not found'});return;}
   try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);}catch{json(404,{error:'Not found'});}
  }catch(err){if(!res.headersSent)json(400,{error:err.message});else res.end();}
 });
 const cleanup=setInterval(()=>{const now=Date.now();for(const[code,room]of rooms)if(now-room.updated>ROOM_TTL&&!room.streams.size)rooms.delete(code);storage.save(rooms);for(const[ip,r]of rates)if(now-r.start>60000)rates.delete(ip);},60000);cleanup.unref();
 server.on('close',()=>{clearInterval(cleanup);for(const room of rooms.values())for(const s of room.streams)s.res.end();});
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||3000);makeServer().listen(port,'0.0.0.0',()=>console.log(`Magnolia: http://localhost:${port}`));
}
