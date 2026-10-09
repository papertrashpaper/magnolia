import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARDS} from '../public/js/cards.js';
import {newGame,submit,nextRound,publicPlayer} from '../public/js/engine.js';
import {random} from './adaptive-strategies.mjs';
import {strategyDraw,strategyPlace} from './strategy-policies.mjs';
import {diagnose} from './diagnose-geometry.mjs';
export const DIR='research/geometry-planning';
function audit(g){const ids=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];for(const c of CARDS)if(ids.filter(id=>id===c.id).length!==c.copies)throw Error('Wrong card counts');}
export function makeStates(prefix){
 const base=prefix==='validation'?1070000:prefix==='pilot'?1050000:1060000,seeds=prefix==='pilot'?1:8,states=[],missing=[];
 for(const count of [2,5])for(let j=0;j<seeds;j++){
  const seed=base+j,focal=j%count,rng=random(seed),g=newGame(Array.from({length:count},(_,i)=>({id:String(i),name:String(i)})),{},rng);audit(g);const captured=[];
  while(g.phase!=='ended'&&g.round<=4){
   if(g.phase==='round'){nextRound(g);continue;}
   const phase=g.phase;if(phase==='draw'&&[2,4].includes(g.round)){const p=g.players[focal];states.push({id:states.length,prefix,seed,count,focal,round:g.round,phase,p:structuredClone(p),opponents:g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]})),settings:g.settings,discard:[...g.discard]});captured.push(g.round);}
   const orders=g.players.map(p=>{const others=g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]}));return phase==='draw'?strategyDraw(p,others,g.settings,'balanced'):strategyPlace(p,others,g.settings,'balanced',1,2);});
   for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);audit(g);
  }
  for(const round of [2,4])if(!captured.includes(round))missing.push({seed,count,focal,round});
 }
 return {states,missing};
}
if(!isMainThread)parentPort.on('message',state=>{try{parentPort.postMessage({result:diagnose(state)});}catch(e){parentPort.postMessage({error:e.stack});}});
else if(process.argv[1]?.endsWith('run-geometry-diagnosis.mjs')){
 const prefix=process.argv.includes('--pilot')?'pilot':process.argv.includes('--validation')?'validation':'results',{states,missing}=makeStates(prefix),source={};
 for(const path of ['public/js/cards.js','public/js/engine.js','public/js/objectives.js','public/js/review.js','scripts/planning-strategies.mjs','scripts/long-term-strategies.mjs','scripts/strategy-policies.mjs','scripts/adaptive-strategies.mjs','scripts/diagnose-planning.mjs','scripts/geometry-plans.mjs','scripts/diagnose-geometry.mjs','scripts/run-geometry-diagnosis.mjs'])source[path]=createHash('sha256').update(await readFile(path)).digest('hex');
 await mkdir(DIR,{recursive:true});const configPath=`${DIR}/${prefix}-config.json`,path=`${DIR}/${prefix}.jsonl`,prior=await readFile(configPath,'utf8').then(JSON.parse).catch(()=>null);
 if(prior&&JSON.stringify(prior.source)!==JSON.stringify(source))throw Error('Source changed');
 await writeFile(configPath,JSON.stringify({createdAt:prior?.createdAt??new Date().toISOString(),source,cards:CARDS.map(c=>({id:c.id,name:c.name,copies:c.copies,effects:c.effects})),totalCards:CARDS.reduce((s,c)=>s+c.copies,0),states:states.length,missing,trainWorlds:[0,1,2],auditWorlds:[100,101,102]},null,2)+'\n');
 const saved=(await readFile(path,'utf8').catch(()=>'' )).split('\n').filter(Boolean).map(JSON.parse),records=new Map(saved.map(r=>[r.state.id,r]));if(records.size!==saved.length)throw Error('Duplicate saved states');
 for(const r of saved)if(JSON.stringify(r.state)!==JSON.stringify(states[r.state.id]))throw Error('Saved state differs');
 const queue=states.filter(s=>!records.has(s.id));let pos=0,done=records.size,writes=Promise.resolve();const start=Date.now(),workers=Number(process.env.DIAGNOSIS_WORKERS??4);console.log(JSON.stringify({prefix,states:states.length,resumed:done,workers}));
 await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url));const next=()=>pos<queue.length?w.postMessage(queue[pos++]):w.terminate().then(resolve);w.on('error',reject);w.on('message',m=>{if(m.error){w.terminate();reject(Error(m.error));return;}records.set(m.result.state.id,m.result);writes=writes.then(()=>appendFile(path,JSON.stringify(m.result)+'\n'));done++;if(done%8===0||done===states.length)console.log(JSON.stringify({done,total:states.length,seconds:Math.round((Date.now()-start)/1000)}));next();});next();})));await writes;
 await writeFile(path,[...records.values()].sort((a,b)=>a.state.id-b.state.id).map(r=>JSON.stringify(r)).join('\n')+'\n');if(records.size!==states.length)throw Error('Incomplete diagnosis');console.log(JSON.stringify({complete:true,prefix,states:records.size}));
}
