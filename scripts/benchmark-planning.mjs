import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARDS} from '../public/js/cards.js';
import {newGame,submit,nextRound,publicPlayer} from '../public/js/engine.js';
import {cpuDraw,cpuPlace} from '../public/js/cpu.js';
import {chooseStrategy,random} from './adaptive-strategies.mjs';
import {choosePlanning} from './planning-strategies.mjs';
import {strategyDraw,strategyPlace} from './strategy-policies.mjs';
// Keep the fixture here: importing the old worker entrypoint registers another
// parentPort handler and executes a second match for every message.
const ROYAL_HAND=['human_great_marchant','human_marchant','human_king','demon_storm','golem_king'];
export const DIR='research/planning-cpu';
export const OLD_OPTIONS={worlds:2,horizon:1,beam:2};
export const NEW_OPTIONS={worlds:2,rounds:4,beam:8,rolloutBeam:2,finalists:3};
function offer(g,seat,ids){const p=g.players[seat];for(let j=0;j<ids.length;j++){const id=ids[j],i=p.hand.indexOf(id,j);if(i>=0){[p.hand[i],p.hand[j]]=[p.hand[j],p.hand[i]];continue;}const old=p.hand[j],d=g.deck.indexOf(id);if(d>=0)g.deck[d]=old;else{const q=g.players.find(q=>q!==p&&q.hand.includes(id));if(!q)throw Error('Missing offered card');q.hand[q.hand.indexOf(id)]=old;}p.hand[j]=id;}}
export function planningMatch(task){
 const rng=random(task.seed),g=newGame(Array.from({length:task.count},(_,i)=>({id:String(i),name:String(i)})),{},rng);if(task.hand)offer(g,task.focal,task.hand);
 const initial=g.players.map(p=>[...p.hand]),history=[],timings=[];
 while(g.phase!=='ended'){
  if(g.round>30)throw Error('Nonterminating match');if(g.phase==='round'){nextRound(g);continue;}
  const phase=g.phase,orders=g.players.map((p,i)=>{
   const opponents=g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]}));
   if(i!==task.focal)return task.opponent==='expert'?(phase==='draw'?cpuDraw({...p,cpuDifficulty:'expert'}):cpuPlace({...p,cpuDifficulty:'expert'},opponents,g.settings)):phase==='draw'?strategyDraw(p,opponents,g.settings,'balanced'):strategyPlace(p,opponents,g.settings,'balanced',1,2);
   const start=performance.now();let decision;
   if(task.treatment==='planning'||task.treatment==='long')decision=choosePlanning(p,opponents,g.settings,g.discard,g.round,phase,{...(task.options??NEW_OPTIONS),plansEnabled:task.treatment==='planning'});
   else if(task.treatment==='expert')decision={key:'expert',order:phase==='draw'?cpuDraw({...p,cpuDifficulty:'expert'}):cpuPlace({...p,cpuDifficulty:'expert'},opponents,g.settings)};
   else decision=chooseStrategy(p,opponents,g.settings,g.discard,g.round,phase,phase==='draw'?{...OLD_OPTIONS,worlds:1,horizon:0}:OLD_OPTIONS);
   timings.push(performance.now()-start);history.push({round:g.round,phase,key:decision.key,hand:[...p.hand],gold:p.gold,order:decision.order,schedule:decision.schedule??null});return decision.order;
  });for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);
 }
 const all=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];for(const c of CARDS)if(all.filter(id=>id===c.id).length!==c.copies)throw Error('Card conservation failed');
 return {...task,initial,rounds:g.round,history,players:g.players.map((p,i)=>({seat:i,vp:p.vp,winShare:g.winners.includes(p.id)?1/g.winners.length:0,gold:p.gold,tech:p.tech,faith:p.faith,board:p.board,bonuses:p.bonuses})),timing:{decisions:timings.length,totalMs:timings.reduce((a,b)=>a+b,0),maxMs:Math.max(...timings)}};
}
if(!isMainThread)parentPort.on('message',task=>{try{parentPort.postMessage({result:planningMatch(task)});}catch(e){parentPort.postMessage({error:e.stack});}});
else if(process.argv[1]?.endsWith('benchmark-planning.mjs')){
 const pilot=process.argv.includes('--pilot'),validation=process.argv.includes('--validation'),seeds=Number(process.env.PLANNING_SEEDS??(pilot?4:32)),prefix=validation?'validation':pilot?'pilot':'results',base=validation?820000:pilot?800000:810000;
 const tasks=[];for(const count of [2,3,4,5])for(let j=0;j<seeds;j++)for(const treatment of ['adaptive','planning'])tasks.push({id:tasks.length,group:'natural',count,seed:base+j,focal:j%count,opponent:'balanced',treatment,options:NEW_OPTIONS});
 for(const count of [2,5])for(let j=0;j<(pilot?2:Math.max(8,seeds/2));j++)for(const treatment of ['expert','planning'])tasks.push({id:tasks.length,group:'production',count,seed:base+1000+j,focal:j%count,opponent:'expert',treatment,options:NEW_OPTIONS});
 for(const count of [2,5])for(let j=0;j<(pilot?2:Math.max(8,seeds/2));j++)for(const treatment of ['adaptive','planning'])tasks.push({id:tasks.length,group:'royal',hand:ROYAL_HAND,count,seed:base+2000+j,focal:j%count,opponent:'balanced',treatment,options:NEW_OPTIONS});
 for(const count of [2,5])for(let j=0;j<(pilot?2:Math.max(8,seeds/2));j++)for(const treatment of ['long','planning'])tasks.push({id:tasks.length,group:'lookahead',count,seed:base+3000+j,focal:j%count,opponent:'balanced',treatment,options:NEW_OPTIONS});
 const source={};for(const path of ['public/js/cards.js','public/js/engine.js','public/js/cpu.js','scripts/planning-strategies.mjs','scripts/benchmark-planning.mjs','scripts/adaptive-strategies.mjs','scripts/strategy-policies.mjs'])source[path]=createHash('sha256').update(await readFile(path)).digest('hex');
 await mkdir(DIR,{recursive:true});const configPath=DIR+'/'+prefix+'-config.json',path=DIR+'/'+prefix+'.jsonl',existing=await readFile(configPath,'utf8').then(JSON.parse).catch(()=>null);
 if(existing&&(JSON.stringify(existing.source)!==JSON.stringify(source)||existing.games!==tasks.length))throw Error('Archive prior results before changing source or conditions');
 await writeFile(configPath,JSON.stringify({schema:1,createdAt:existing?.createdAt??new Date().toISOString(),games:tasks.length,seeds,pilot,validation,source,newOptions:NEW_OPTIONS,oldOptions:OLD_OPTIONS,notes:'Paired seed and focal seat; simultaneous decisions on pre-submission states. Natural against balanced policy, production against existing expert, royal offered separately. Timings are excluded from deterministic replay.'},null,2)+'\n');
 const saved=await readFile(path,'utf8').catch(()=>''),savedRows=saved.split('\n').filter(Boolean).map(JSON.parse),records=new Map(savedRows.map(r=>[r.id,r]));if(records.size!==savedRows.length)throw Error('Duplicate checkpoint IDs');const done=new Set(records.keys()),queue=tasks.filter(t=>!done.has(t.id));let pos=0,completed=done.size,writes=Promise.resolve();const start=Date.now(),workers=Number(process.env.PLANNING_WORKERS??4);console.log(JSON.stringify({games:tasks.length,resumed:done.size,workers}));
 await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url));const next=()=>pos<queue.length?w.postMessage(queue[pos++]):w.terminate().then(resolve);w.on('error',reject);w.on('message',m=>{if(m.error){w.terminate();reject(Error(m.error));return;}if(records.has(m.result.id)){w.terminate();reject(Error('Duplicate worker result'));return;}records.set(m.result.id,m.result);writes=writes.then(()=>appendFile(path,JSON.stringify(m.result)+'\n'));completed++;if(completed%16===0||completed===tasks.length)console.log(JSON.stringify({completed,total:tasks.length,seconds:Math.round((Date.now()-start)/1000)}));next();});next();})));await writes;
 // Rebuild from all received records before final verification, rather than
 // relying solely on incremental append checkpoints.
 await writeFile(path,[...records.values()].sort((a,b)=>a.id-b.id).map(r=>JSON.stringify(r)).join('\n')+'\n');
 const rows=(await readFile(path,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);if(rows.length!==tasks.length||new Set(rows.map(r=>r.id)).size!==tasks.length)throw Error('Incomplete persisted benchmark');console.log(JSON.stringify({complete:true,games:rows.length}));
}
