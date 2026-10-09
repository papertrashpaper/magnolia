import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARDS} from '../public/js/cards.js';
import {newGame,submit,nextRound,publicPlayer} from '../public/js/engine.js';
import {random} from './adaptive-strategies.mjs';
import {strategyDraw,strategyPlace} from './strategy-policies.mjs';
import {pairFor,targetFor,candidates,study} from './strategic-timing.mjs';
import {auditCards,guaranteedEnd} from './endgame-decisions.mjs';
export const DIR='research/strategic-timing';
const PROFILES={investment:['balanced','economy','tech','faith'],holding:['balanced','bonus','faith','savings'],ending:['balanced','bonus','rush','savings']};
export function makeStates(kind,prefix){
 const base=prefix==='validation'?1800000:prefix==='pilot'?1900000:1700000,quota=prefix==='pilot'?1:2,counts=prefix==='pilot'?[2]:[2,3,4,5],profiles=prefix==='pilot'?[PROFILES[kind][0]]:PROFILES[kind],states=[],sampling=[];
 for(const count of counts)for(const [index,profile]of profiles.entries()){
  let found=0,attempted=0;for(let j=0;j<64&&found<quota;j++){
   attempted++;const seed=base+['investment','holding','ending'].indexOf(kind)*1000000+count*10000+index*100+j,rng=random(seed),g=newGame(Array.from({length:count},(_,i)=>({id:String(i),name:String(i)})),{},rng),focal=j%count;let captured=null;
   while(g.phase!=='ended'&&g.round<=12){
    if(g.phase==='round'){nextRound(g);continue;}auditCards(g);const p=g.players[focal],others=g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]}));
    if(!guaranteedEnd(g.players)){
     const state={id:states.length,kind,prefix,seed,count,profile,focal,round:g.round,phase:g.phase,p:structuredClone(p),opponents:others,settings:g.settings,discard:[...g.discard]};
     if(kind==='investment'&&g.phase==='place'&&[2,3].includes(g.round)&&p.board.length<=5){const pair=pairFor(p,others,g.settings,seed);if(pair)captured={...state,pair};}
     if(kind==='holding'&&g.phase==='draw'&&g.round>=2&&p.board.length<=6){const target=targetFor(p);if(target)captured={...state,target};}
     if(kind==='ending'&&g.phase==='place'&&[7,8].includes(p.board.length)){const c=candidates(state);if(c.some(a=>a.label==='finishNow')&&c.some(a=>a.label==='defer'))captured=state;}
    }
    if(captured)break;
    const phase=g.phase,orders=g.players.map(q=>{const publicOthers=g.players.filter(t=>t!==q).map(t=>({...publicPlayer(t),hand:[]}));return phase==='draw'?strategyDraw(q,publicOthers,g.settings,profile):strategyPlace(q,publicOthers,g.settings,profile,1,2);});for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);
   }
   if(captured){states.push(captured);found++;}
  }sampling.push({count,profile,found,quota,attempted});
 }return {states,sampling};
}
if(!isMainThread)parentPort.on('message',state=>{try{parentPort.postMessage({result:study(state)});}catch(e){parentPort.postMessage({error:e.stack});}});
else if(process.argv[1]?.endsWith('run-strategic-timing.mjs')){
 const kind=process.argv.find(a=>a.startsWith('--kind='))?.split('=')[1]??'investment';if(!Object.hasOwn(PROFILES,kind))throw Error('Unknown kind');const prefix=process.argv.includes('--pilot')?'pilot':process.argv.includes('--validation')?'validation':'results',{states,sampling}=makeStates(kind,prefix),source={};
 for(const path of ['public/js/cards.js','public/js/engine.js','public/js/objectives.js','public/js/review.js','scripts/strategy-policies.mjs','scripts/adaptive-strategies.mjs','scripts/endgame-decisions.mjs','scripts/strategic-timing.mjs','scripts/run-strategic-timing.mjs'])source[path]=createHash('sha256').update(await readFile(path)).digest('hex');
 const dir=DIR+'/'+kind;await mkdir(dir,{recursive:true});const cp=`${dir}/${prefix}-config.json`,path=`${dir}/${prefix}.jsonl`,prior=await readFile(cp,'utf8').then(JSON.parse).catch(()=>null);if(prior&&JSON.stringify(prior.source)!==JSON.stringify(source))throw Error('Source changed');
 await writeFile(cp,JSON.stringify({createdAt:prior?.createdAt??new Date().toISOString(),source,cards:CARDS.map(c=>({id:c.id,name:c.name,copies:c.copies})),totalCards:CARDS.reduce((s,c)=>s+c.copies,0),states:states.length,sampling,trainWorlds:[0,1,2,3],auditWorlds:[100,101,102,103,104,105,106,107],models:['balanced','war'],limit:12},null,2)+'\n');
 const saved=(await readFile(path,'utf8').catch(()=>'' )).split('\n').filter(Boolean).map(JSON.parse),records=new Map(saved.map(r=>[r.state.id,r]));if(records.size!==saved.length)throw Error('Duplicate');for(const r of saved)if(JSON.stringify(r.state)!==JSON.stringify(states[r.state.id]))throw Error('State changed');const queue=states.filter(s=>!records.has(s.id));let pos=0,done=records.size,writes=Promise.resolve();const start=Date.now(),workers=Number(process.env.TIMING_WORKERS??2);console.log(JSON.stringify({kind,prefix,states:states.length,sampling,workers}));
 await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url));const next=()=>pos<queue.length?w.postMessage(queue[pos++]):w.terminate().then(resolve);w.on('error',reject);w.on('message',m=>{if(m.error){w.terminate();reject(Error(m.error));return;}records.set(m.result.state.id,m.result);writes=writes.then(()=>appendFile(path,JSON.stringify(m.result)+'\n'));done++;if(done%4===0||done===states.length)console.log(JSON.stringify({done,total:states.length,seconds:Math.round((Date.now()-start)/1000)}));next();});next();})));await writes;await writeFile(path,[...records.values()].sort((a,b)=>a.state.id-b.state.id).map(r=>JSON.stringify(r)).join('\n')+'\n');if(records.size!==states.length)throw Error('Incomplete');console.log(JSON.stringify({complete:true,kind,prefix}));
}
