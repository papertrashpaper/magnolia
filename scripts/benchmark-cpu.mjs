import {writeFile} from 'node:fs/promises';
import {newGame,submit,nextRound,CPU_LEVELS} from '../public/js/engine.js';
import {cpuDraw,cpuPlace} from '../public/js/cpu.js';
const seeds=Number(process.env.CPU_BENCH_SEEDS||24);
const levels=Object.keys(CPU_LEVELS),pairs=[];let maxThinkMs=0,games=0;
function run(difficulties,seed,warVP){
 let n=seed;const rng=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
 const g=newGame(difficulties.map((cpuDifficulty,i)=>({id:String(i),name:CPU_LEVELS[cpuDifficulty],cpu:true,cpuDifficulty})),{warVP},rng);
 for(let turn=0;g.phase!=='ended'&&turn<120;turn++){
  if(g.phase==='round'){nextRound(g);continue;}
  const phase=g.phase;
  for(const p of g.players){const t=performance.now();const order=phase==='draw'?cpuDraw(p,rng):cpuPlace(p,g.players.filter(q=>q!==p),g.settings,rng);maxThinkMs=Math.max(maxThinkMs,performance.now()-t);submit(g,p.id,order,rng);}
 }
 if(g.phase!=='ended')throw Error('CPU match did not finish');games++;
 return g;
}
for(let i=1;i<levels.length;i++){
 const pairSeeds=i===2?Math.max(80,seeds):seeds;
 const lower=levels[i-1],higher=levels[i],r={lower:CPU_LEVELS[lower],higher:CPU_LEVELS[higher],higherWins:0,lowerWins:0,draws:0,higherVP:0,lowerVP:0,games:pairSeeds};
 for(let seed=1;seed<=pairSeeds;seed++){
  const g=run(seed%2?[lower,higher]:[higher,lower],seed,[4,0]);
  const a=g.players.find(p=>p.cpuDifficulty===higher),b=g.players.find(p=>p.cpuDifficulty===lower);
  if(a.vp===b.vp)r.draws++;else if(a.vp>b.vp)r.higherWins++;else r.lowerWins++;
  r.higherVP+=a.vp;r.lowerVP+=b.vp;
 }
 pairs.push(r);console.log(JSON.stringify(r));
}
const mixed=[];
for(const count of [3,5])for(const warVP of [count===3?[5,3,0]:[5,3,0,0,0],count===3?[8,1,0]:[8,1,0,0,0]]){
 const totals=Object.fromEntries(levels.map(l=>[CPU_LEVELS[l],{games:0,VP:0,wins:0}]));
 for(let seed=1;seed<=5;seed++){
  const rotated=levels.slice(seed%5).concat(levels.slice(0,seed%5)),g=run(rotated.slice(0,count),100+seed,warVP);
  for(const p of g.players){const r=totals[p.name];r.games++;r.VP+=p.vp;if(g.winners.includes(p.id))r.wins++;}
 }
 mixed.push({count,warVP,totals});console.log(JSON.stringify({count,warVP,totals}));
}
const result={seeds,games,maxThinkMs:Math.round(maxThinkMs),pairs,mixed};
await writeFile(new URL('../test/cpu-benchmark-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({games,maxThinkMs:result.maxThinkMs}));
