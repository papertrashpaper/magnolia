import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {availableParallelism} from 'node:os';
import {newGame,submit,nextRound,publicPlayer} from '../public/js/engine.js';
import {CARDS} from '../public/js/cards.js';
import {STRATEGIES,strategyDraw,strategyPlace} from './strategy-policies.mjs';
const keys=Object.keys(STRATEGIES);
function rng(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
export function match(task){
 const random=rng(task.seed),g=newGame(task.lineup.map((strategy,i)=>({id:String(i),name:strategy})),{warVP:task.warVP},random);
 const totals=Object.fromEntries(g.players.map(p=>[p.id,{warReward:0,warEffect:0,placementVP:0,bonusVP:0,recurringVP:0,goldVP:0,incomeGold:0,developPoints:0}]));
 while(g.phase!=='ended'){
  if(g.round>30)throw Error('Game did not terminate');
  if(g.phase==='round'){nextRound(g);continue;}
  const phase=g.phase;
  // Freeze all public states before anyone submits, preserving simultaneous decisions.
  const orders=g.players.map((p,i)=>{const opponents=g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]}));return phase==='draw'?strategyDraw(p,opponents,g.settings,task.lineup[i],task.variant):strategyPlace(p,opponents,g.settings,task.lineup[i],task.variant,task.beam);});
  for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],random);
  if(phase==='place')for(const e of g.resolution.events)if(e.playerId)for(const c of e.changes){const t=totals[e.playerId];if(c.stat==='gold'&&e.phase==='income')t.incomeGold+=c.delta;if(['tech','faith'].includes(c.stat)&&e.phase==='develop')t.developPoints+=c.delta;if(c.stat==='vp'){const key=e.phase==='war'?(c.source.includes('報酬')?'warReward':'warEffect'):e.phase==='place'?(c.source.includes('ボーナス')?'bonusVP':'placementVP'):e.phase==='final'?'goldVP':'recurringVP';t[key]+=c.delta;}}
 }
 const cards=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];
 for(const c of CARDS)if(cards.filter(id=>id===c.id).length!==c.copies)throw Error('Card conservation failed');
 return {...task,rounds:g.round,endNine:g.players.some(p=>p.board.length===9),endVP:g.players.some(p=>p.vp>=40),endReason:g.players.some(p=>p.board.length===9)?'nine':'vp',players:g.players.map((p,i)=>({strategy:task.lineup[i],seat:i,vp:p.vp,rank:1+g.players.filter(q=>q.vp>p.vp).length,win:g.winners.includes(p.id),winShare:g.winners.includes(p.id)?1/g.winners.length:0,gold:p.gold,tech:p.tech,faith:p.faith,board:p.board.map(b=>b.card),sources:totals[p.id]}))};
}
if(!isMainThread){parentPort.on('message',task=>{try{parentPort.postMessage({result:match(task)});}catch(e){parentPort.postMessage({error:e.stack,task});}});}
else if(process.argv[1]?.endsWith('benchmark-strategies.mjs')){
 const pilot=process.argv.includes('--pilot'),seeds=Number(process.env.STRATEGY_SEEDS||24),dir='research/strategy-comparison';await mkdir(dir,{recursive:true});
 const source={};for(const p of ['public/js/engine.js','public/js/cards.js','scripts/strategy-policies.mjs','scripts/benchmark-strategies.mjs'])source[p]=createHash('sha256').update(await readFile(p)).digest('hex');
 const tasks=[];let id=0;
 function add(group,lineup,seed,warVP,variant=1,beam=5){tasks.push({id:id++,group,lineup,seed,warVP,variant,beam});}
 for(let a=0;a<keys.length;a++)for(let b=a+1;b<keys.length;b++)for(let seed=1;seed<=seeds;seed++)for(let swap=0;swap<2;swap++)add('duel',swap?[keys[b],keys[a]]:[keys[a],keys[b]],1000+seed,[4,0]);
 function combinations(items,count,start=0,prefix=[]){if(prefix.length===count)return [prefix];return items.slice(start).flatMap((item,i)=>combinations(items,count,start+i+1,[...prefix,item]));}
 for(const count of [3,4,5])for(const [set,selected] of combinations(keys,count).entries()){
  for(let seed=1;seed<=8;seed++)for(let shift=0;shift<count;shift++)add('multiplayer',selected.slice(shift).concat(selected.slice(0,shift)),2000+set*10+seed,[5,3,...Array(count-2).fill(0)]);
 }
 for(const count of [2,5])for(const setting of ['none','winner','generous'])for(let seed=1;seed<=12;seed++)for(let shift=0;shift<count;shift++){
  const lineup=keys.slice(seed%8).concat(keys.slice(0,seed%8)).slice(0,count);
  add('war-'+setting,lineup.slice(shift).concat(lineup.slice(0,shift)),3000+seed,setting==='none'?Array(count).fill(0):setting==='winner'?[8,...Array(count-1).fill(0)]:count===2?[6,3]:[6,4,2,0,0]);
 }
 for(const variant of [.7,1.3])for(let a=1;a<keys.length;a++)for(let seed=1;seed<=12;seed++)for(let swap=0;swap<2;swap++)add('emphasis-'+variant,swap?[keys[a],keys[0]]:[keys[0],keys[a]],4000+seed,[4,0],variant);
 for(const beam of [3,10])for(let a=1;a<keys.length;a++)for(let seed=1;seed<=8;seed++)for(let swap=0;swap<2;swap++)add('beam-'+beam,swap?[keys[a],keys[0]]:[keys[0],keys[a]],5000+seed,[4,0],1,beam);
 const selected=pilot?tasks.filter(t=>t.id%101===0).slice(0,32):tasks;
 const config={schema:1,createdAt:new Date().toISOString(),pilot,seeds,source,strategies:STRATEGIES,games:selected.length,notes:'Seat rotations control hand allocation, not turn advantage. Policies do not access hidden information. Ties split victory credit.'};
 const prefix=pilot?'pilot':'results',jsonl=dir+'/'+prefix+'.jsonl',configPath=dir+'/'+prefix+'-config.json';
 const existing=await readFile(configPath,'utf8').then(JSON.parse).catch(()=>null);
 if(existing&&JSON.stringify(existing.source)!==JSON.stringify(source))throw Error('Existing results have different source hashes. Archive them first.');
 if(existing&&(existing.seeds!==seeds||existing.games!==selected.length))throw Error('Existing results have different configuration. Archive them first.');
 await writeFile(configPath,JSON.stringify(config,null,2)+'\n');
 const old=await readFile(jsonl,'utf8').catch(()=>''),done=new Set(old.trim().split('\n').filter(Boolean).map(x=>JSON.parse(x).id));const queue=selected.filter(t=>!done.has(t.id));
 const start=Date.now(),workers=Number(process.env.STRATEGY_WORKERS||Math.min(4,availableParallelism()));let completed=done.size,position=0;let writes=Promise.resolve();
 console.log(JSON.stringify({total:selected.length,resumed:done.size,workers}));
 await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{
  const w=new Worker(new URL(import.meta.url));function next(){if(position>=queue.length){w.terminate().then(resolve);return;}w.postMessage(queue[position++]);}
  w.on('error',reject);w.on('message',m=>{if(m.error){reject(Error(m.error));w.terminate();return;}writes=writes.then(()=>appendFile(jsonl,JSON.stringify(m.result)+'\n'));completed++;if(completed%50===0||completed===selected.length)console.log(JSON.stringify({completed,total:selected.length,seconds:Math.round((Date.now()-start)/1000)}));next();});next();
 })));await writes;console.log(JSON.stringify({complete:true,games:completed,seconds:Math.round((Date.now()-start)/1000)}));
}
