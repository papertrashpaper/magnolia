import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARDS,CARD} from '../public/js/cards.js';
import {newGame,submit,nextRound,publicPlayer,amount,level} from '../public/js/engine.js';
import {cpuDraw,cpuPlace} from '../public/js/cpu.js';
import {random} from './adaptive-strategies.mjs';
import {choosePlanning} from './planning-strategies.mjs';
import {chooseLongTerm,continueLongTerm} from './long-term-strategies.mjs';
import {strategyDraw,strategyPlace} from './strategy-policies.mjs';

export const DIR='research/long-term-strategies';
export const ARMS=['baseline','economy','tech','faith','war','bonus','savings','flexible','committed'];
export const OPTIONS={worlds:1,rounds:4,beam:4,rolloutBeam:1,finalists:2};
export function auditCards(g){
 const ids=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];
 if(ids.length!==CARDS.reduce((s,c)=>s+c.copies,0)||ids.some(id=>!CARD[id]))throw Error('Invalid deck total');
 for(const c of CARDS)if(ids.filter(id=>id===c.id).length!==c.copies)throw Error('Card conservation failed: '+c.id);
}
export function boardFeatures(p){
 const effects=p.board.flatMap(b=>CARD[b.card].effects.map(e=>({card:b.card,...e})));
 return {units:p.board.length,gold:p.gold,tech:p.tech,faith:p.faith,techLevel:level(p.tech),faithLevel:level(p.faith),
  income:3+effects.filter(e=>e.phase==='income').reduce((s,e)=>s+amount(p,CARD[e.card],e),0),
  incomeCards:p.board.filter(b=>CARD[b.card].effects.some(e=>e.phase==='income')).length,
  expensive:p.board.filter(b=>CARD[b.card].cost>=6).length,
  techVP:effects.filter(e=>e.stat==='vp'&&e.scale==='techLevel').length,
  faithVP:effects.filter(e=>e.stat==='vp'&&e.scale==='faithLevel').length,
  warVP:effects.filter(e=>e.phase==='war'&&e.stat==='vp').length,
  bonuses:p.bonuses.length,storm:effects.some(e=>e.stat==='doubleBonus'),
  doubledBonuses:Object.values(p.bonusRewards??{}).filter(r=>r.multiplier>1).length,
  rulers:p.board.filter(b=>CARD[b.card].job==='ruler').length};
}
export function longTermMatch(task){
 const rng=random(task.seed),g=newGame(Array.from({length:task.count},(_,i)=>({id:String(i),name:String(i)})),{},rng);
 const initial=g.players.map(p=>[...p.hand]),history=[],rounds=[],timings=[];let commitment=null;
 auditCards(g);
 while(g.phase!=='ended'){
  if(g.round>30)throw Error('Nonterminating game');if(g.phase==='round'){nextRound(g);continue;}
  const phase=g.phase,focal=g.players[task.focal],before=structuredClone(focal);
  const orders=g.players.map((p,i)=>{
   const opponents=g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]}));
   if(i!==task.focal)return task.opponent==='expert'?(phase==='draw'?cpuDraw({...p,cpuDifficulty:'expert'}):cpuPlace({...p,cpuDifficulty:'expert'},opponents,g.settings)):phase==='draw'?strategyDraw(p,opponents,g.settings,'balanced'):strategyPlace(p,opponents,g.settings,'balanced',1,2);
   const start=performance.now();let decision;
   if(task.arm==='baseline')decision=choosePlanning(p,opponents,g.settings,g.discard,g.round,phase,OPTIONS);
   else{
    if(task.arm==='committed')decision=continueLongTerm(p,opponents,g.settings,phase,commitment);
    if(!decision){decision=chooseLongTerm(p,opponents,g.settings,g.discard,g.round,phase,{...OPTIONS,...(!['flexible','committed'].includes(task.arm)?{profiles:[task.arm]}:{})});
     if(task.arm==='committed')commitment=decision.schedule?{key:decision.key,schedule:decision.schedule,step:0}:null;
    }
   }
   timings.push(performance.now()-start);
   history.push({round:g.round,phase,key:decision.key,planned:decision.planned??!!decision.schedule,continued:!!decision.continued,
    hand:[...p.hand],board:structuredClone(p.board),gold:p.gold,tech:p.tech,faith:p.faith,vp:p.vp,
    opponentMaxUnits:Math.max(...opponents.map(q=>q.board.length)),opponentMaxVP:Math.max(...opponents.map(q=>q.vp)),
    order:decision.order,schedule:decision.schedule??null});
   if(task.arm==='committed'&&phase==='place'&&commitment)commitment.step++;
   return decision.order;
  });
  for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);
  auditCards(g);
  if(phase==='place'){
   const p=g.players[task.focal],events=g.resolution.events.filter(e=>e.playerId===p.id);
   const vpByPhase={};for(const e of events)for(const c of e.changes)if(c.stat==='vp')vpByPhase[e.phase]=(vpByPhase[e.phase]??0)+c.delta;
   if(Math.abs(Object.values(vpByPhase).reduce((s,n)=>s+n,0)-(p.vp-before.vp))>1e-9)throw Error('VP accounting failed');
   rounds.push({round:g.round,before:boardFeatures(before),after:boardFeatures(p),vpByPhase,
    bonusRewards:structuredClone(p.bonusRewards),changes:events.map(e=>({phase:e.phase,card:e.card??null,changes:e.changes})),ended:g.phase==='ended'});
  }
 }
 return {...task,initial,settings:g.settings,rounds:g.round,history,roundHistory:rounds,
  players:g.players.map((p,i)=>({seat:i,vp:p.vp,winShare:g.winners.includes(p.id)?1/g.winners.length:0,board:p.board,bonuses:p.bonuses,bonusRewards:p.bonusRewards,finalGoldVP:p.finalGoldVP,features:boardFeatures(p)})),
  timing:{decisions:timings.length,totalMs:timings.reduce((s,n)=>s+n,0),maxMs:Math.max(...timings)}};
}
export function tasksFor(prefix){
 const pilot=prefix==='pilot',base=prefix==='validation'?920000:pilot?900000:910000,seeds=pilot?1:8,tasks=[];
 for(const count of (pilot?[2,5]:[2,3,4,5]))for(let j=0;j<seeds;j++)for(const arm of ARMS)tasks.push({id:tasks.length,group:'natural',count,seed:base+j,focal:j%count,opponent:'balanced',arm});
 for(const count of [2,5])for(let j=0;j<seeds;j++)for(const arm of ['baseline','flexible'])tasks.push({id:tasks.length,group:'expert',count,seed:base+1000+j,focal:j%count,opponent:'expert',arm});
 return tasks;
}
if(!isMainThread)parentPort.on('message',task=>{try{parentPort.postMessage({result:longTermMatch(task)});}catch(e){parentPort.postMessage({error:e.stack});}});
else if(process.argv[1]?.endsWith('benchmark-long-term.mjs')){
 const prefix=process.argv.includes('--pilot')?'pilot':process.argv.includes('--validation')?'validation':'results',tasks=tasksFor(prefix),source={};
 for(const path of ['public/js/cards.js','public/js/engine.js','public/js/cpu.js','public/js/objectives.js','public/js/review.js','scripts/planning-strategies.mjs','scripts/long-term-strategies.mjs','scripts/benchmark-long-term.mjs','scripts/adaptive-strategies.mjs','scripts/strategy-policies.mjs'])source[path]=createHash('sha256').update(await readFile(path)).digest('hex');
 await mkdir(DIR,{recursive:true});const configPath=`${DIR}/${prefix}-config.json`,path=`${DIR}/${prefix}.jsonl`,existing=await readFile(configPath,'utf8').then(JSON.parse).catch(()=>null);
 if(existing&&JSON.stringify(existing.source)!==JSON.stringify(source))throw Error('Source changed; archive before resuming');
 await writeFile(configPath,JSON.stringify({schema:1,createdAt:existing?.createdAt??new Date().toISOString(),runtime:process.version,games:tasks.length,source,options:OPTIONS,
  cards:CARDS.map(c=>({id:c.id,name:c.name,copies:c.copies,cost:c.cost,power:c.power,race:c.race,job:c.job,effects:c.effects})),totalCards:CARDS.reduce((s,c)=>s+c.copies,0),tasks},null,2)+'\n');
 const rows=(await readFile(path,'utf8').catch(()=>'' )).split('\n').filter(Boolean).map(JSON.parse),records=new Map(rows.map(r=>[r.id,r]));
 if(records.size!==rows.length)throw Error('Duplicate checkpoint');for(const r of rows)if(JSON.stringify(tasks[r.id])!==JSON.stringify(Object.fromEntries(Object.keys(tasks[r.id]).map(k=>[k,r[k]]))))throw Error('Invalid saved task');
 const queue=tasks.filter(t=>!records.has(t.id));let pos=0,completed=records.size,writes=Promise.resolve();const start=Date.now(),workers=Number(process.env.LONG_TERM_WORKERS??6);
 console.log(JSON.stringify({prefix,games:tasks.length,resumed:completed,workers}));
 await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{
  const w=new Worker(new URL(import.meta.url));const next=()=>pos<queue.length?w.postMessage(queue[pos++]):w.terminate().then(resolve);
  w.on('error',reject);w.on('message',m=>{if(m.error){w.terminate();reject(Error(m.error));return;}if(records.has(m.result.id))throw Error('Duplicate worker output');
   records.set(m.result.id,m.result);writes=writes.then(()=>appendFile(path,JSON.stringify(m.result)+'\n'));completed++;
   if(completed%16===0||completed===tasks.length)console.log(JSON.stringify({completed,total:tasks.length,seconds:Math.round((Date.now()-start)/1000)}));next();});next();
 })));await writes;
 await writeFile(path,[...records.values()].sort((a,b)=>a.id-b.id).map(r=>JSON.stringify(r)).join('\n')+'\n');
 const persisted=(await readFile(path,'utf8')).trim().split('\n').map(JSON.parse);if(persisted.length!==tasks.length||new Set(persisted.map(r=>r.id)).size!==tasks.length)throw Error('Incomplete benchmark');
 console.log(JSON.stringify({complete:true,prefix,games:persisted.length,seconds:Math.round((Date.now()-start)/1000)}));
}
