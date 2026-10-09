import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARDS} from '../public/js/cards.js';
import {newGame,submit,nextRound,publicPlayer} from '../public/js/engine.js';
import {random} from './adaptive-strategies.mjs';
import {strategyDraw,strategyPlace} from './strategy-policies.mjs';
import {guaranteedEnd,auditCards,study} from './endgame-decisions.mjs';
export const DIR='research/endgame-decisions';
export function makeStates(prefix){
 const base=prefix==='validation'?1500000:prefix==='pilot'?1300000:1400000,quota=prefix==='pilot'?1:4,counts=prefix==='pilot'?[2]:[2,3,4,5],profiles=prefix==='pilot'?['balanced']:['balanced','war','bonus','savings'],states=[],sampling=[];
 for(const count of counts)for(const [index,profile]of profiles.entries()){
  let found=0,attempted=0;for(let j=0;j<32&&found<quota;j++){
   attempted++;const seed=base+count*10000+index*100+j,rng=random(seed),g=newGame(Array.from({length:count},(_,i)=>({id:String(i),name:String(i)})),{},rng),focal=j%count;let captured=null;
   while(g.phase!=='ended'&&g.round<=16){if(g.phase==='round'){nextRound(g);continue;}auditCards(g);
    if(g.phase==='place'&&guaranteedEnd(g.players)){const p=g.players[focal];captured={id:states.length,prefix,seed,count,profile,focal,round:g.round,phase:'place',p:structuredClone(p),opponents:g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]})),settings:g.settings,discard:[...g.discard]};break;}
    const phase=g.phase,orders=g.players.map(p=>{const others=g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]}));return phase==='draw'?strategyDraw(p,others,g.settings,profile):strategyPlace(p,others,g.settings,profile,1,2);});for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);
   }
   if(captured){states.push(captured);found++;}
  }sampling.push({count,profile,found,quota,attempted});
 }return {states,sampling};
}
if(!isMainThread)parentPort.on('message',state=>{try{parentPort.postMessage({result:study(state)});}catch(e){parentPort.postMessage({error:e.stack});}});
else if(process.argv[1]?.endsWith('run-endgame-decisions.mjs')){
 const prefix=process.argv.includes('--pilot')?'pilot':process.argv.includes('--validation')?'validation':'results',{states,sampling}=makeStates(prefix),source={};
 for(const path of ['public/js/cards.js','public/js/engine.js','public/js/objectives.js','public/js/review.js','scripts/strategy-policies.mjs','scripts/adaptive-strategies.mjs','scripts/endgame-decisions.mjs','scripts/run-endgame-decisions.mjs'])source[path]=createHash('sha256').update(await readFile(path)).digest('hex');
 await mkdir(DIR,{recursive:true});const cp=`${DIR}/${prefix}-config.json`,path=`${DIR}/${prefix}.jsonl`,prior=await readFile(cp,'utf8').then(JSON.parse).catch(()=>null);if(prior&&JSON.stringify(prior.source)!==JSON.stringify(source))throw Error('Source changed');
 await writeFile(cp,JSON.stringify({createdAt:prior?.createdAt??new Date().toISOString(),source,cards:CARDS.map(c=>({id:c.id,name:c.name,copies:c.copies})),totalCards:CARDS.reduce((s,c)=>s+c.copies,0),states:states.length,sampling,trainWorlds:Array.from({length:8},(_,i)=>i),auditWorlds:Array.from({length:16},(_,i)=>100+i),models:['balanced','war']},null,2)+'\n');
 const saved=(await readFile(path,'utf8').catch(()=>'' )).trim().split('\n').filter(Boolean).map(JSON.parse),records=new Map(saved.map(r=>[r.state.id,r]));if(records.size!==saved.length)throw Error('Duplicate states');for(const r of saved)if(JSON.stringify(r.state)!==JSON.stringify(states[r.state.id]))throw Error('State changed');
 const queue=states.filter(s=>!records.has(s.id));let pos=0,done=records.size,writes=Promise.resolve();const start=Date.now(),workers=Number(process.env.ENDGAME_WORKERS??4);console.log(JSON.stringify({prefix,states:states.length,sampling,workers}));
 await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url));const next=()=>pos<queue.length?w.postMessage(queue[pos++]):w.terminate().then(resolve);w.on('error',reject);w.on('message',m=>{if(m.error){w.terminate();reject(Error(m.error));return;}records.set(m.result.state.id,m.result);writes=writes.then(()=>appendFile(path,JSON.stringify(m.result)+'\n'));done++;if(done%4===0||done===states.length)console.log(JSON.stringify({done,total:states.length,seconds:Math.round((Date.now()-start)/1000)}));next();});next();})));await writes;await writeFile(path,[...records.values()].sort((a,b)=>a.state.id-b.state.id).map(r=>JSON.stringify(r)).join('\n')+'\n');if(records.size!==states.length)throw Error('Incomplete');console.log(JSON.stringify({complete:true,prefix}));
}
