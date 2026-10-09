import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARD,CARDS} from '../public/js/cards.js';
import {newGame,submit,nextRound,publicPlayer} from '../public/js/engine.js';
import {random} from './adaptive-strategies.mjs';
import {strategyDraw,strategyPlace,score} from './strategy-policies.mjs';
import {candidates,study} from './strategic-timing.mjs';
import {enumeratePlacements,auditCards,guaranteedEnd} from './endgame-decisions.mjs';
const DIR='research/strategic-timing';
export function makeFocused(prefix){
 const base=prefix==='focused-validation'?4100000:4000000,states=[],sampling=[];
 for(const count of [2,3,4,5])for(const [index,profile]of ['balanced','war','bonus','savings'].entries()){
  let found=0,attempted=0;for(let j=0;j<64&&found<2;j++){
   attempted++;const seed=base+count*10000+index*100+j,rng=random(seed),g=newGame(Array.from({length:count},(_,i)=>({id:String(i),name:String(i)})),{},rng),focal=j%count;let captured=null;
   while(g.phase!=='ended'&&g.round<=12){if(g.phase==='round'){nextRound(g);continue;}auditCards(g);const p=g.players[focal],others=g.players.filter(q=>q!==p).map(q=>({...publicPlayer(q),hand:[]}));
    if(g.phase==='place'&&!guaranteedEnd(g.players)&&[7,8].includes(p.board.length)){const state={id:states.length,kind:'ending',prefix,seed,count,profile,focal,sourceMode:'cheapRush',round:g.round,phase:g.phase,p:structuredClone(p),opponents:others,settings:g.settings,discard:[...g.discard]};const cs=candidates(state);if(cs.some(c=>c.label==='finishNow')&&cs.some(c=>c.label==='defer')){captured=state;break;}}
    const phase=g.phase,orders=g.players.map((q,i)=>{const os=g.players.filter(t=>t!==q).map(t=>({...publicPlayer(t),hand:[]}));if(i!==focal)return phase==='draw'?strategyDraw(q,os,g.settings,profile):strategyPlace(q,os,g.settings,profile,1,2);
     if(phase==='draw')return {discard:q.hand.map((id,i)=>({id,i})).filter(c=>CARD[c.id].cost>3).map(c=>c.i)};
     const all=enumeratePlacements(q);all.sort((a,b)=>b.moves.length-a.moves.length||b.features.remainingGold-a.features.remainingGold||score(b.player,os,g.settings,'balanced')-score(a.player,os,g.settings,'balanced'));return {moves:all[0].moves};
    });for(let i=0;i<g.players.length;i++)submit(g,g.players[i].id,orders[i],rng);
   }if(captured){states.push(captured);found++;}
  }sampling.push({count,profile,found,quota:2,attempted});
 }return {states,sampling};
}
if(!isMainThread)parentPort.on('message',state=>{try{parentPort.postMessage({result:study(state)});}catch(e){parentPort.postMessage({error:e.stack});}});
else if(process.argv[1]?.endsWith('run-focused-ending.mjs')){
 const prefix=process.argv.includes('--validation')?'focused-validation':'focused',{states,sampling}=makeFocused(prefix),source={};
 for(const path of ['public/js/cards.js','public/js/engine.js','public/js/objectives.js','public/js/review.js','scripts/strategy-policies.mjs','scripts/adaptive-strategies.mjs','scripts/endgame-decisions.mjs','scripts/strategic-timing.mjs','scripts/run-strategic-timing.mjs','scripts/run-focused-ending.mjs'])source[path]=createHash('sha256').update(await readFile(path)).digest('hex');
 const dir=DIR+'/ending';await mkdir(dir,{recursive:true});const cp=`${dir}/${prefix}-config.json`,path=`${dir}/${prefix}.jsonl`,prior=await readFile(cp,'utf8').then(JSON.parse).catch(()=>null);if(prior&&JSON.stringify(prior.source)!==JSON.stringify(source))throw Error('Source changed');await writeFile(cp,JSON.stringify({createdAt:prior?.createdAt??new Date().toISOString(),source,cards:CARDS.map(c=>({id:c.id,name:c.name,copies:c.copies})),totalCards:CARDS.reduce((s,c)=>s+c.copies,0),states:states.length,sampling,sourceMode:'cheapRush',trainWorlds:[0,1,2,3],auditWorlds:[100,101,102,103,104,105,106,107],models:['balanced','war'],limit:12},null,2)+'\n');
 const saved=(await readFile(path,'utf8').catch(()=>'' )).split('\n').filter(Boolean).map(JSON.parse),records=new Map(saved.map(r=>[r.state.id,r]));if(records.size!==saved.length)throw Error('Duplicate');for(const r of saved)if(JSON.stringify(r.state)!==JSON.stringify(states[r.state.id]))throw Error('State changed');const queue=states.filter(s=>!records.has(s.id));let pos=0,done=records.size,writes=Promise.resolve();const start=Date.now();console.log(JSON.stringify({prefix,states:states.length,sampling}));
 await Promise.all(Array.from({length:Math.min(2,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url));const next=()=>pos<queue.length?w.postMessage(queue[pos++]):w.terminate().then(resolve);w.on('error',reject);w.on('message',m=>{if(m.error){w.terminate();reject(Error(m.error));return;}records.set(m.result.state.id,m.result);writes=writes.then(()=>appendFile(path,JSON.stringify(m.result)+'\n'));done++;if(done%4===0||done===states.length)console.log(JSON.stringify({done,total:states.length,seconds:Math.round((Date.now()-start)/1000)}));next();});next();})));await writes;await writeFile(path,[...records.values()].sort((a,b)=>a.state.id-b.state.id).map(r=>JSON.stringify(r)).join('\n')+'\n');if(records.size!==states.length)throw Error('Incomplete');console.log(JSON.stringify({complete:true,prefix}));
}
