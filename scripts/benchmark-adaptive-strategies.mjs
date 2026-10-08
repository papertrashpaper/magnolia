import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARDS,CARD} from '../public/js/cards.js';
import {newGame,submit,nextRound,publicPlayer,amount} from '../public/js/engine.js';
import {strategyDraw,strategyPlace} from './strategy-policies.mjs';
import {chooseStrategy,random} from './adaptive-strategies.mjs';
export const TARGETS=['human_king','dwarf_king','elf_queen','goblin_king','golem_king','demon_storm','golem_cristal','dwarf_beer','elf_caster'];
export const PACKAGE_LABELS={humanGold:'人間の君主＋残金12以上',techEngine:'技術Lv.3＋技術VP係数2以上',faithEngine:'信仰Lv.3＋信仰VPカード',warStack:'戦争時VPカード3体以上',incomeEngine:'追加収入3金以上',twoBonuses:'3枚揃え2回以上',nine:'9体配置',doubleBonus:'嵐のデーモン＋揃え2回以上',dualCrystal:'水晶＋技術・信仰ともLv.3'};
export function packages(p){const ids=p.board.map(b=>b.card),effs=ids.flatMap(id=>CARD[id].effects),rules={humanGold:ids.includes('human_king')&&p.gold>=12,techEngine:p.tech>=7&&effs.filter(e=>e.phase==='vp'&&e.scale==='techLevel').reduce((s,e)=>s+e.amount,0)>=2,faithEngine:p.faith>=7&&effs.some(e=>e.phase==='vp'&&e.scale==='faithLevel'),warStack:ids.filter(id=>CARD[id].effects.some(e=>e.phase==='war')).length>=3,incomeEngine:p.board.reduce((sum,b)=>sum+CARD[b.card].effects.filter(e=>e.phase==='income').reduce((s,e)=>s+amount(p,CARD[b.card],e),0),0)>=3,twoBonuses:p.bonuses.length>=2,nine:p.board.length===9,doubleBonus:ids.includes('demon_storm')&&p.bonuses.length>=2,dualCrystal:ids.includes('golem_cristal')&&p.tech>=7&&p.faith>=7};return Object.keys(rules).filter(k=>rules[k]);}
const publicOpponent=q=>({...publicPlayer(q),hand:[]});
function offer(g,seat,id,seed){const p=g.players[seat];if(p.hand.includes(id))return;const index=Math.floor(random(seed+9137)()*p.hand.length),old=p.hand[index],d=g.deck.indexOf(id);if(d>=0)g.deck[d]=old;else{const other=g.players.find(q=>q!==p&&q.hand.includes(id));if(!other)throw Error('Offer card missing');other.hand[other.hand.indexOf(id)]=old;}p.hand[index]=id;}
export function adaptiveMatch(task){
 const rng=random(task.seed),count=task.controllers.length,g=newGame(task.controllers.map((controller,i)=>({id:String(i),name:controller})),{},rng);
 if(task.card)offer(g,task.focal,task.card,task.seed);
 const histories=g.players.map(()=>[]),cardStats=g.players.map(()=>Object.fromEntries(CARDS.map(c=>[c.id,{seen:0,kept:0,exchanged:0,placed:0}]))),totals=g.players.map(()=>({war:0,bonus:0,placement:0,recurring:0,gold:0}));
 while(g.phase!=='ended'){
  if(g.round>30)throw Error('Nonterminating match');if(g.phase==='round'){nextRound(g);continue;}
  const phase=g.phase,orders=g.players.map((p,i)=>{
   const opponents=g.players.filter(q=>q!==p).map(publicOpponent),controller=task.controllers[i];let decision;
   if(controller==='adaptive'){decision=chooseStrategy(p,opponents,g.settings,g.discard,g.round,phase,phase==='draw'?{...task.options,worlds:1,horizon:0}:task.options);histories[i].push({round:g.round,phase,key:decision.key,coBest:decision.coBest,evaluations:decision.evaluations,ready:decision.ready,hand:[...p.hand],board:p.board.map(b=>b.card)});}
   let order=controller==='adaptive'?decision.order:phase==='draw'?strategyDraw(p,opponents,g.settings,controller):strategyPlace(p,opponents,g.settings,controller,1,task.options.beam);
   if(phase==='draw'){
    const indices=p.hand.map((id,j)=>id===task.card?j:-1).filter(j=>j>=0);
    if(task.group==='card'&&i===task.focal&&g.round===1)order={discard:task.treatment==='keep'?order.discard.filter(j=>!indices.includes(j)):[...new Set([...order.discard,...indices])].sort((a,b)=>a-b)};
    const removed=new Set(order.discard);for(const id of new Set(p.hand)){const s=cardStats[i][id];s.seen++;if(p.hand.some((v,j)=>v===id&&!removed.has(j)))s.kept++;if(p.hand.some((v,j)=>v===id&&removed.has(j)))s.exchanged++;}
   }if(controller==='adaptive')histories[i].at(-1).order=structuredClone(order);return order;
  });
  for(let i=0;i<count;i++)submit(g,g.players[i].id,orders[i],rng);
  if(phase==='place')for(const e of g.resolution.events)if(e.playerId!==null){const i=Number(e.playerId);if(e.card)cardStats[i][e.card].placed++;for(const c of e.changes)if(c.stat==='vp'){const category=e.phase==='final'?'gold':e.phase==='war'?'war':e.phase==='place'?(c.source.includes('ボーナス')?'bonus':'placement'):'recurring';totals[i][category]+=c.delta;}}
 }
 const all=[...g.deck,...g.discard,...g.players.flatMap(p=>[...p.hand,...p.board.map(b=>b.card)])];for(const c of CARDS)if(all.filter(id=>id===c.id).length!==c.copies)throw Error('Card conservation failed');
 return {...task,rounds:g.round,players:g.players.map((p,i)=>({controller:task.controllers[i],seat:i,vp:p.vp,rank:1+g.players.filter(q=>q.vp>p.vp).length,winShare:g.winners.includes(p.id)?1/g.winners.length:0,gold:p.gold,tech:p.tech,faith:p.faith,board:p.board.map(b=>b.card),packages:packages(p),bonuses:p.bonuses.length,sources:totals[i],history:histories[i],cards:cardStats[i]}))};
}
if(!isMainThread)parentPort.on('message',task=>{try{parentPort.postMessage({result:adaptiveMatch(task)});}catch(e){parentPort.postMessage({error:e.stack,task});}});
else if(process.argv[1]?.endsWith('benchmark-adaptive-strategies.mjs')){
 const dir='research/adaptive-strategy-comparison';await mkdir(dir,{recursive:true});const pilot=process.argv.includes('--pilot'),seeds=Number(process.env.ADAPTIVE_SEEDS||64),cardSeeds=Number(process.env.ADAPTIVE_CARD_SEEDS||32),options={worlds:2,horizon:1,beam:2};
 const tasks=[];const add=(task)=>tasks.push({id:tasks.length,options,...task});
 for(const count of [2,3,4,5])for(let seed=0;seed<seeds;seed++)add({group:'natural',seed:100000+seed,controllers:Array(count).fill('adaptive'),focal:0});
 for(const count of [2,5])for(let seed=0;seed<seeds;seed++)for(const treatment of ['adaptive','savings']){const focal=seed%count,controllers=Array(count).fill('balanced');controllers[focal]=treatment;add({group:'matched',seed:300000+seed,controllers,focal,treatment});}
 for(const count of [2,5])for(const card of TARGETS)for(let seed=0;seed<cardSeeds;seed++)for(const treatment of ['keep','exchange']){const focal=seed%count,controllers=Array(count).fill('balanced');controllers[focal]='adaptive';add({group:'card',seed:200000+seed,controllers,focal,card,treatment});}
 const selected=pilot?[tasks.find(t=>t.group==='natural'&&t.controllers.length===2),tasks.find(t=>t.group==='natural'&&t.controllers.length===5),...tasks.filter(t=>t.group==='card'&&t.card==='human_king'&&t.seed===200000)]:tasks;
 const source={};for(const p of ['public/js/engine.js','public/js/cards.js','scripts/strategy-policies.mjs','scripts/adaptive-strategies.mjs','scripts/benchmark-adaptive-strategies.mjs'])source[p]=createHash('sha256').update(await readFile(p)).digest('hex');
 const prefix=pilot?'pilot':'results',path=dir+'/'+prefix+'.jsonl',cp=dir+'/'+prefix+'-config.json',existing=await readFile(cp,'utf8').then(JSON.parse).catch(()=>null);
 const config={schema:1,createdAt:existing?.createdAt??new Date().toISOString(),seeds,cardSeeds,options,games:selected.length,pilot,source,targets:TARGETS,notes:'Natural all-adaptive games; matched focal adaptive vs fixed savings, balanced opponents; offered-card first-mulligan keep vs exchange, balanced opponents. No real hidden cards or game seed given to planner.'};
 if(existing&&(JSON.stringify(existing.source)!==JSON.stringify(source)||existing.games!==config.games||existing.seeds!==seeds||existing.cardSeeds!==cardSeeds))throw Error('Archive previous results before changing source/config');await writeFile(cp,JSON.stringify(config,null,2)+'\n');
 const old=await readFile(path,'utf8').catch(()=>''),done=new Set(old.split('\n').filter(Boolean).map(l=>JSON.parse(l).id)),queue=selected.filter(t=>!done.has(t.id));let position=0,completed=done.size,writes=Promise.resolve();const start=Date.now(),workers=Number(process.env.ADAPTIVE_WORKERS||8);console.log(JSON.stringify({games:selected.length,resumed:done.size,workers}));
 await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url));const next=()=>position<queue.length?w.postMessage(queue[position++]):w.terminate().then(resolve);w.on('error',reject);w.on('message',m=>{if(m.error){w.terminate();reject(Error(m.error));return;}writes=writes.then(()=>appendFile(path,JSON.stringify(m.result)+'\n'));completed++;if(completed%10===0||completed===selected.length)console.log(JSON.stringify({completed,total:selected.length,seconds:Math.round((Date.now()-start)/1000)}));next();});next();})));await writes;console.log(JSON.stringify({complete:true,games:completed,seconds:Math.round((Date.now()-start)/1000)}));
}
