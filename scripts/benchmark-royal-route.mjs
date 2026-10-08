import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARDS} from '../public/js/cards.js';
import {newGame,submit,nextRound,publicPlayer} from '../public/js/engine.js';
import {random,chooseStrategy} from './adaptive-strategies.mjs';
import {strategyDraw,strategyPlace} from './strategy-policies.mjs';
export const ROYAL_HAND=['human_great_marchant','human_marchant','human_king','demon_storm','golem_king'];
const planned=[[[ROYAL_HAND[0],0,0],[ROYAL_HAND[1],1,0]],[[ROYAL_HAND[2],0,-1]],[[ROYAL_HAND[3],1,-1]],[[ROYAL_HAND[4],2,-1]]];
function initial(g,focal){const p=g.players[focal];for(let j=0;j<5;j++){const id=ROYAL_HAND[j],i=p.hand.indexOf(id);if(i>=0){[p.hand[i],p.hand[j]]=[p.hand[j],p.hand[i]];continue;}const old=p.hand[j],d=g.deck.indexOf(id);if(d>=0)g.deck[d]=old;else{const q=g.players.find(q=>q!==p&&q.hand.includes(id));if(!q)throw Error('Missing offered card');q.hand[q.hand.indexOf(id)]=old;}p.hand[j]=id;}}
export function royalMatch(task){const rng=random(task.seed),g=newGame(Array.from({length:task.count},(_,i)=>({id:String(i),name:i===task.focal?'adaptive':'balanced'})),{},rng);initial(g,task.focal);const sources=g.players.map(()=>({war:0,bonus:0,placement:0,recurring:0,gold:0}));
 while(g.phase!=='ended'){
  if(g.round>30)throw Error('No end');if(g.phase==='round'){nextRound(g);continue;}const phase=g.phase;
  const orders=g.players.map((p,i)=>{const opponents=g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]}));
   if(i===task.focal&&task.treatment==='route'&&g.round<=4){
    if(phase==='draw'){const needed=new Set(planned.slice(g.round-1).flatMap(a=>a.map(x=>x[0])));return {discard:p.hand.map((id,j)=>needed.has(id)?-1:j).filter(j=>j>=0)};}
    const hand=[...p.hand],moves=planned[g.round-1].map(([id,x,y])=>{const handIndex=hand.indexOf(id);if(handIndex<0)throw Error('Route card missing');hand.splice(handIndex,1);return {handIndex,x,y};});return {moves};
   }
   if(i===task.focal)return chooseStrategy(p,opponents,g.settings,g.discard,g.round,phase,phase==='draw'?{...task.options,worlds:1,horizon:0}:task.options).order;
   return phase==='draw'?strategyDraw(p,opponents,g.settings,'balanced'):strategyPlace(p,opponents,g.settings,'balanced',1,task.options.beam);
  });for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);
  if(phase==='place')for(const e of g.resolution.events)if(e.playerId!==null)for(const c of e.changes)if(c.stat==='vp'){const key=e.phase==='final'?'gold':e.phase==='war'?'war':e.phase==='place'?(c.source.includes('ボーナス')?'bonus':'placement'):'recurring';sources[Number(e.playerId)][key]+=c.delta;}
 }
 const all=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];for(const c of CARDS)if(all.filter(id=>id===c.id).length!==c.copies)throw Error('Card conservation failed');
 return {...task,rounds:g.round,completed:g.players[task.focal].bonuses.some(k=>k.endsWith(':job:ruler')),players:g.players.map((p,i)=>({seat:i,vp:p.vp,winShare:g.winners.includes(p.id)?1/g.winners.length:0,gold:p.gold,tech:p.tech,faith:p.faith,board:p.board.map(b=>b.card),sources:sources[i]}))};
}
if(!isMainThread)parentPort.on('message',task=>{try{parentPort.postMessage({result:royalMatch(task)});}catch(e){parentPort.postMessage({error:e.stack});}});
else if(process.argv[1]?.endsWith('benchmark-royal-route.mjs')){
 const dir='research/adaptive-strategy-comparison';await mkdir(dir,{recursive:true});const tasks=[],options={worlds:2,horizon:1,beam:2};for(const count of [2,3,4,5])for(let seed=0;seed<64;seed++)for(const treatment of ['route','adaptive'])tasks.push({id:tasks.length,options,count,seed:500000+seed,focal:seed%count,treatment});
 const source={};for(const p of ['public/js/engine.js','public/js/cards.js','scripts/strategy-policies.mjs','scripts/adaptive-strategies.mjs','scripts/benchmark-royal-route.mjs'])source[p]=createHash('sha256').update(await readFile(p)).digest('hex');
 const path=dir+'/royal.jsonl',cp=dir+'/royal-config.json',existing=await readFile(cp,'utf8').then(JSON.parse).catch(()=>null);if(existing&&JSON.stringify(existing.source)!==JSON.stringify(source))throw Error('Archive royal data before changing code');let combinations=1;const total=CARDS.reduce((s,c)=>s+c.copies,0);for(let i=0;i<5;i++)combinations*= (total-i)/(i+1);const ways=ROYAL_HAND.reduce((s,id)=>s*CARDS.find(c=>c.id===id).copies,1);
 const config={schema:1,createdAt:existing?.createdAt??new Date().toISOString(),games:tasks.length,seeds:64,hand:ROYAL_HAND,handProbability:ways/combinations,options,source,notes:'Ideal starting 5 cards, first 4 rounds scripted vs adaptive on the same ideal hand; balanced opponents. Natural acquisition rate is not measured by this offered-hand experiment.'};await writeFile(cp,JSON.stringify(config,null,2)+'\n');
 const old=await readFile(path,'utf8').catch(()=>''),done=new Set(old.split('\n').filter(Boolean).map(l=>JSON.parse(l).id)),queue=tasks.filter(t=>!done.has(t.id));let pos=0,completed=done.size,writes=Promise.resolve();const start=Date.now();console.log(JSON.stringify({games:tasks.length,resumed:done.size,workers:4}));
 await Promise.all(Array.from({length:Math.min(4,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url));const next=()=>pos<queue.length?w.postMessage(queue[pos++]):w.terminate().then(resolve);w.on('error',reject);w.on('message',m=>{if(m.error){w.terminate();reject(Error(m.error));return;}writes=writes.then(()=>appendFile(path,JSON.stringify(m.result)+'\n'));completed++;if(completed%32===0||completed===tasks.length)console.log(JSON.stringify({completed,total:tasks.length,seconds:Math.round((Date.now()-start)/1000)}));next();});next();})));await writes;
 const persisted=new Set((await readFile(path,'utf8')).split('\n').filter(Boolean).map(l=>JSON.parse(l).id));for(const task of tasks)if(!persisted.has(task.id))await appendFile(path,JSON.stringify(royalMatch(task))+'\n');console.log(JSON.stringify({complete:true,games:tasks.length,seconds:Math.round((Date.now()-start)/1000)}));
}
