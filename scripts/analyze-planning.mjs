import {readFile,writeFile} from 'node:fs/promises';
import {random} from './adaptive-strategies.mjs';
import {planningMatch,DIR} from './benchmark-planning.mjs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export function summarize(rows){
 const groups={};for(const r of rows){const key=r.group+'/'+r.count;groups[key]??=new Map();const pairKey=r.seed+':'+r.focal+':'+(r.originalCount??r.count);if(!groups[key].has(pairKey))groups[key].set(pairKey,[]);groups[key].get(pairKey).push(r);}
 const summary={};for(const [key,pairs] of Object.entries(groups)){
  const data=[];for(const rs of pairs.values()){const a=rs.find(r=>r.treatment==='planning'),b=rs.find(r=>r.treatment!=='planning');if(!a||!b||rs.length!==2)throw Error('Missing paired treatment');if(JSON.stringify(a.initial)!==JSON.stringify(b.initial))throw Error('Initial deal mismatch');const own=r=>r.players[r.focal];data.push({seed:a.seed,a:own(a).winShare,b:own(b).winShare,vp:own(a).vp-own(b).vp,completeA:own(a).bonuses.some(x=>x.endsWith(':job:ruler')),completeB:own(b).bonuses.some(x=>x.endsWith(':job:ruler')),planDecisions:a.history.filter(h=>h.schedule).length,aMax:a.timing.maxMs,bMax:b.timing.maxMs,aTime:a.timing.totalMs/a.timing.decisions,bTime:b.timing.totalMs/b.timing.decisions});}
  const clusters=new Map();for(const p of data){if(!clusters.has(p.seed))clusters.set(p.seed,[]);clusters.get(p.seed).push(p);}const blocks=[...clusters.values()];
  const mean=f=>data.reduce((n,r)=>n+f(r),0)/data.length,rng=random(726551),boots=[];for(let i=0;i<2000;i++){let n=0,count=0;for(let j=0;j<blocks.length;j++){for(const p of blocks[Math.floor(rng()*blocks.length)]){n+=p.a-p.b;count++;}}boots.push(n/count);}boots.sort((a,b)=>a-b);
  const quantile=(f,q)=>data.map(f).sort((a,b)=>a-b)[Math.min(data.length-1,Math.floor(data.length*q))];
  summary[key]={pairs:data.length,planning:mean(r=>r.a),baseline:mean(r=>r.b),difference:mean(r=>r.a-r.b),ci:[boots[50],boots[1950]],meanVPDifference:mean(r=>r.vp),rulerCompletionPlanning:mean(r=>Number(r.completeA)),rulerCompletionBaseline:mean(r=>Number(r.completeB)),planDecisions:data.reduce((n,r)=>n+r.planDecisions,0),meanDecisionMsPlanning:mean(r=>r.aTime),meanDecisionMsBaseline:mean(r=>r.bTime),p95MatchMaxMsPlanning:quantile(r=>r.aMax,.95),p95MatchMaxMsBaseline:quantile(r=>r.bMax,.95)};
 }return summary;
}
export async function readPlanning(prefix='results'){
 const text=await readFile(DIR+'/'+prefix+'.jsonl','utf8').catch(async e=>{if(e.code!=='ENOENT')throw e;const manifest=JSON.parse(await readFile(DIR+'/archives.json','utf8'))[prefix];if(!manifest)throw Error('Missing planning archive');const bytes=Buffer.concat(await Promise.all(manifest.parts.map(async p=>{const b=await readFile(DIR+'/'+p.file);if(createHash('sha256').update(b).digest('hex')!==p.sha256)throw Error('Archive part mismatch');return b;})));if(createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('Archive mismatch');return gunzipSync(bytes).toString();});
 return text.trim().split('\n').filter(Boolean).map(JSON.parse).sort((a,b)=>a.id-b.id);
}
if(process.argv[1]?.endsWith('analyze-planning.mjs')){
 const prefix=process.argv[2]??'results',rows=prefix==='combined'?[...await readPlanning('results'),...await readPlanning('validation')]:await readPlanning(prefix);
 for(const name of prefix==='combined'?['results','validation']:[prefix]){const part=await readPlanning(name),config=JSON.parse(await readFile(DIR+'/'+name+'-config.json','utf8'));if(part.length!==config.games||new Set(part.map(r=>r.id)).size!==config.games)throw Error('Incomplete benchmark');if(prefix==='combined'){const other=JSON.parse(await readFile(DIR+'/'+(name==='results'?'validation':'results')+'-config.json','utf8'));if(JSON.stringify(config.source)!==JSON.stringify(other.source))throw Error('Cannot combine different source code');}}
 for(const r of rows){if(Math.abs(r.players.reduce((n,p)=>n+p.winShare,0)-1)>1e-9)throw Error('Invalid win shares');}
 const summary=summarize(rows);for(const group of ['natural','production','royal','lookahead']){const selected=rows.filter(r=>r.group===group).map(r=>({...r,originalCount:r.count,count:'all'}));if(selected.length)Object.assign(summary,summarize(selected));}await writeFile(DIR+'/'+prefix+'-summary.json',JSON.stringify({games:rows.length,groups:summary},null,2)+'\n');
 console.log(JSON.stringify({games:rows.length,groups:summary}));
 if(process.argv.includes('--replay')){const chosen=[rows[0],rows.find(r=>r.treatment==='planning'),rows.find(r=>r.group==='royal'&&r.treatment==='planning')].filter(Boolean);for(const saved of chosen){const {history,players,timing,initial,rounds,...task}=saved,r=planningMatch(task);delete r.timing;const copy={...saved};delete copy.timing;if(JSON.stringify(r)!==JSON.stringify(copy))throw Error('Replay mismatch '+saved.id);}console.log(JSON.stringify({reproduced:chosen.map(r=>r.id)}));}
}
