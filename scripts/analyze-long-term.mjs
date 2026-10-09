import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {CARD,CARDS} from '../public/js/cards.js';
import {random} from './adaptive-strategies.mjs';
import {DIR,ARMS,tasksFor,longTermMatch} from './benchmark-long-term.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
async function readRecords(prefix){
 try{return await readFile(`${DIR}/${prefix}.jsonl`);}catch(e){if(e.code!=='ENOENT')throw e;}
 const manifest=JSON.parse(await readFile(`${DIR}/archives.json`,'utf8'))[prefix],parts=[];
 for(const part of manifest.parts){const bytes=await readFile(`${DIR}/${part.file}`);if(bytes.length!==part.bytes||hash(bytes)!==part.sha256)throw Error('Archive part differs');parts.push(bytes);}
 const z=Buffer.concat(parts);if(hash(z)!==manifest.sha256)throw Error('Compressed archive differs');
 const raw=gunzipSync(z);if(hash(raw)!==manifest.rawSha256)throw Error('Raw archive differs');return raw;
}
export function metrics(r){
 const p=r.players[r.focal],place=r.history.filter(h=>h.phase==='place'),vp={place:0,war:0,vp:0,final:0};
 let incomeEffectGold=0,incomeCost=0,techEffectVP=0,faithEffectVP=0,bonusVP=0,changes=0,lateChanges=0,lateChances=0,abandoned=0;
 for(const round of r.roundHistory){for(const [phase,n]of Object.entries(round.vpByPhase))vp[phase]=(vp[phase]??0)+n;
  for(const e of round.changes){if(e.card&&CARD[e.card].effects.some(f=>f.phase==='income'))incomeCost+=CARD[e.card].cost;
   for(const c of e.changes){
    if(e.phase==='income'&&c.stat==='gold'&&c.source!=='基本収入')incomeEffectGold+=c.delta;
    if(c.stat==='vp'&&c.source.includes('ボーナス'))bonusVP+=c.delta;
    if(c.stat==='vp'){const card=CARDS.find(x=>c.source===x.name+'の効果');if(card?.effects.some(f=>f.phase===e.phase&&f.scale==='techLevel'))techEffectVP+=c.delta;if(card?.effects.some(f=>f.phase===e.phase&&f.scale==='faithLevel'))faithEffectVP+=c.delta;}
   }
  }
 }
 for(let i=1;i<place.length;i++){
  const prior=place[i-1],next=place[i],late=next.opponentMaxUnits>=7||next.opponentMaxVP>=30;
  if(prior.key!==next.key){changes++;if(late)lateChanges++;}if(late)lateChances++;
  const old=prior.schedule?.slice(1).flat().map(m=>m.card)??[],available=[...(next.schedule?.flat().map(m=>m.card)??[])];
  if(!next.schedule){const hand=[...next.hand];for(const m of next.order.moves)available.push(...hand.splice(m.handIndex,1));}
  if(old.some(id=>{const i=available.indexOf(id);if(i<0)return true;available.splice(i,1);return false;}))abandoned++;
 }
 return {win:p.winShare,vp:p.vp,rounds:r.rounds,...p.features,incomeEffectGold,incomeCost,techEffectVP,faithEffectVP,bonusVP,
  phasePlaceVP:vp.place,phaseWarVP:vp.war,phaseCardVP:vp.vp,finalGoldVP:vp.final,
  changes,lateChanges,lateChances,abandoned,plannedDecisions:r.history.filter(h=>h.planned).length,continuedDecisions:r.history.filter(h=>h.continued).length,
  meanDecisionMs:r.timing.totalMs/r.timing.decisions,maxDecisionMs:r.timing.maxMs,
  incomeToExpensive:r.roundHistory.some(a=>a.changes.some(e=>e.card&&CARD[e.card].effects.some(f=>f.phase==='income'))&&r.roundHistory.some(b=>b.round>a.round&&b.changes.some(e=>e.card&&CARD[e.card].cost>=6)))?1:0,
  grownTechVP:p.features.techVP>0&&p.features.techLevel>=2?1:0,grownFaithVP:p.features.faithVP>0&&p.features.faithLevel>=2?1:0,
  multiBonus:p.features.bonuses>=2?1:0,stormBonus:p.features.doubledBonuses>0?1:0,
  firstProfile:place[0]?.key??null};
}
export function paired(rows,arm,group='natural',count=null,reference='baseline'){
 const chosen=rows.filter(r=>r.group===group&&(count===null||r.count===count)),base=new Map(chosen.filter(r=>r.arm===reference).map(r=>[`${r.seed}:${r.count}:${r.focal}`,r]));
 const pairs=chosen.filter(r=>r.arm===arm).map(r=>{const b=base.get(`${r.seed}:${r.count}:${r.focal}`);if(!b||JSON.stringify(b.initial)!==JSON.stringify(r.initial))throw Error('Unpaired initial deal');return{seed:r.seed,count:r.count,diff:r.players[r.focal].winShare-b.players[b.focal].winShare,vpDiff:r.players[r.focal].vp-b.players[b.focal].vp};});
 const seeds=[...new Set(pairs.map(p=>p.seed))],bySeed=new Map(seeds.map(seed=>[seed,pairs.filter(p=>p.seed===seed)])),rng=random(930123),samples=[];
 for(let n=0;n<4000;n++){const sample=[];for(let j=0;j<seeds.length;j++)sample.push(...bySeed.get(seeds[Math.floor(rng()*seeds.length)]));samples.push(mean(sample.map(p=>p.diff)));}
 samples.sort((a,b)=>a-b);
 return {pairs:pairs.length,seeds:seeds.length,diff:mean(pairs.map(p=>p.diff)),vpDiff:mean(pairs.map(p=>p.vpDiff)),ci95:[samples[100],samples[3899]]};
}
function summarize(rows){
 const arms={};for(const arm of ARMS){const selected=rows.filter(r=>r.group==='natural'&&r.arm===arm),m=selected.map(metrics);arms[arm]={games:m.length};for(const k of Object.keys(m[0]))if(typeof m[0][k]==='number')arms[arm][k]=mean(m.map(x=>x[k]));}
 const comparisons={};for(const group of ['natural','expert'])for(const arm of group==='natural'?ARMS.filter(a=>a!=='baseline'):['flexible'])comparisons[`${group}:${arm}`]=paired(rows,arm,group);
 comparisons['natural:flexible-vs-committed']=paired(rows,'flexible','natural',null,'committed');
 const byCount={};for(const count of [2,3,4,5]){byCount[count]={};for(const arm of ARMS){const a=rows.filter(r=>r.group==='natural'&&r.count===count&&r.arm===arm);byCount[count][arm]={games:a.length,win:mean(a.map(r=>r.players[r.focal].winShare)),vp:mean(a.map(r=>r.players[r.focal].vp))};}for(const arm of ['flexible','committed'])byCount[count][arm].paired=paired(rows,arm,'natural',count);}
 const selected={};for(const r of rows.filter(r=>r.group==='natural'&&r.arm==='flexible')){const m=metrics(r),key=m.firstProfile;selected[key]??={games:0,wins:0,vp:0};selected[key].games++;selected[key].wins+=m.win;selected[key].vp+=m.vp;}
 for(const a of Object.values(selected)){a.win=a.wins/a.games;a.vp/=a.games;}
 const late=rows.filter(r=>r.group==='natural'&&r.arm==='flexible').map(metrics);
 return {arms,comparisons,byCount,firstSelected:selected,late:{opportunities:late.reduce((s,m)=>s+m.lateChances,0),profileChanges:late.reduce((s,m)=>s+m.lateChanges,0)}};
}
if(process.argv[1]?.endsWith('analyze-long-term.mjs')){
 const prefixes=['results','validation'],all=[],verified=[];
 for(const prefix of prefixes){
  const config=JSON.parse(await readFile(`${DIR}/${prefix}-config.json`,'utf8')),raw=await readRecords(prefix),rows=raw.toString().trim().split('\n').map(JSON.parse),tasks=tasksFor(prefix);
  if(rows.length!==tasks.length||new Set(rows.map(r=>r.id)).size!==tasks.length)throw Error('Incomplete data');
  for(const r of rows){for(const k of Object.keys(tasks[r.id]))if(JSON.stringify(r[k])!==JSON.stringify(tasks[r.id][k]))throw Error('Task differs');
   if(r.players.reduce((s,p)=>s+p.winShare,0)!==1)throw Error('Invalid winners');
   const m=metrics(r);if(m.phasePlaceVP+m.phaseWarVP+m.phaseCardVP+m.finalGoldVP!==m.vp)throw Error('VP totals differ');
  }
  if(JSON.stringify(config.cards)!==JSON.stringify(JSON.parse(await readFile(`${DIR}/results-config.json`,'utf8')).cards))throw Error('Card counts differ');
  if(process.argv.includes('--replay'))for(const arm of ['baseline','flexible','committed']){
   const old=rows.find(r=>r.group==='natural'&&r.count===2&&r.arm===arm),task=tasks[old.id],fresh=longTermMatch(task),copy=structuredClone(old);delete fresh.timing;delete copy.timing;
   if(JSON.stringify(fresh)!==JSON.stringify(copy))throw Error('Replay mismatch');verified.push({prefix,id:old.id,arm});
  }
  await writeFile(`${DIR}/${prefix}-summary.json`,JSON.stringify(summarize(rows),null,2)+'\n');all.push(...rows);
 }
 const sources=await Promise.all(prefixes.map(p=>readFile(`${DIR}/${p}-config.json`,'utf8').then(JSON.parse)));if(JSON.stringify(sources[0].source)!==JSON.stringify(sources[1].source))throw Error('Different experiment code');
 const combined={createdAt:new Date().toISOString(),games:all.length,currentCards:sources[0].cards,totalCards:sources[0].totalCards,replays:verified,...summarize(all)};
 await writeFile(`${DIR}/summary.json`,JSON.stringify(combined,null,2)+'\n');
 const manifests={};for(const prefix of prefixes){const raw=await readRecords(prefix),z=gzipSync(raw,{level:9}),parts=[];if(!gunzipSync(z).equals(raw))throw Error('Archive mismatch');
  for(let offset=0,index=0;offset<z.length;offset+=98304,index++){const b=z.subarray(offset,offset+98304),file=`${prefix}.jsonl.gz.part${String(index).padStart(3,'0')}`;await writeFile(`${DIR}/${file}`,b);parts.push({file,bytes:b.length,sha256:hash(b)});}manifests[prefix]={games:tasksFor(prefix).length,rawBytes:raw.length,rawSha256:hash(raw),bytes:z.length,sha256:hash(z),parts};
 }
 await writeFile(`${DIR}/archives.json`,JSON.stringify(manifests,null,2)+'\n');
 const names={baseline:'既存の長期計画',economy:'収入',tech:'技術',faith:'信仰',war:'戦争',bonus:'揃え',savings:'貯金',flexible:'複数方針を再選択',committed:'選んだ計画を継続'},pct=n=>(n*100).toFixed(1)+'%',num=n=>n.toFixed(2),pp=n=>(n*100).toFixed(1)+'pt';
 let text='# 現在のカード枚数での長期戦略研究\n\n2026-10-09。41種類・102枚、自然配札のみ、追加目標OFF。条件は [METHOD.md](METHOD.md)。本比較320対戦と別配札の追加320対戦、合計640対戦を完走。うち均衡評価型相手576、凄腕相手64。\n\n';
 const base=combined.arms.baseline,flex=combined.arms.flexible,commit=combined.arms.committed;
 text+=`## 今回の結論\n\n- 今回の研究CPU実装では、既存の長期計画${pct(base.win)}に対し、再選択${pct(flex.win)}・継続${pct(commit.win)}で改善を確認できなかった。両者の直接比較の平均差は${pp(combined.comparisons['natural:flexible-vs-committed'].diff)}で、本比較と追加検証では差の向きが反転した。\n- 君主以外の長期的な組み合わせは実際の対戦に現れた。技術得点・信仰得点・複数揃え・収入から高額カードへの配置例は [EXAMPLES.md](EXAMPLES.md) に保存した。収入固定群のカード収入は平均${num(combined.arms.economy.incomeEffectGold)}金だが、平均VPと勝利シェアは既存を下回った。資源の成長と勝ちへの変換を分けて評価する必要がある。\n- 6方針を固定した群も既存を上回らなかった。この実装の候補生成・評価の成績であり、人間が使う技術・信仰等の戦略そのものの順位ではない。\n- 再選択CPUで既知手札の配置計画を選んだ判断は1対戦平均${num(flex.plannedDecisions)}回。候補を増やしても計画はほとんど選ばれていない。選択率の低さ、計画候補の質、短期評価との整合、仮想配札1通りの誤差が次の切り分け対象になる。\n\n次は一つの完成筋を覚えさせるより、既存の得点・前線候補を保ったまま多様な計画を追加する比較と、候補を作れているか／作れても評価で落としているかの切り分けを優先する。今回の配札で重みを合わせ込まず、新しい配札で検証する。\n\n`;
 text+='## 方針ごとの実験成績\n\n各群64対戦（各人数16）。勝利シェアは同率1位を分配。差と区間の単位はパーセントポイント（pt）。固定方針も4ラウンド計画を作る。初期配札は対応しているが、行動により以後のドローは異なる。\n\n| 群 | 勝利シェア | 平均VP | 対照との差 | 差の95%区間 | 平均ラウンド |\n|---|---:|---:|---:|---:|---:|\n';
 for(const arm of ARMS){const m=combined.arms[arm],p=combined.comparisons['natural:'+arm];text+=`| ${names[arm]} | ${pct(m.win)} | ${num(m.vp)} | ${p?pp(p.diff):'—'} | ${p?p.ci95.map(pp).join(' ～ '):'—'} | ${num(m.rounds)} |\n`;}
 text+='\n## 実際に得た資源と得点\n\nフェーズ別得点は実際のエンジン記録から集計。戦争フェーズは順位報酬・戦争時効果・非入賞時効果を含む。収入金は基本3金を除くカード効果による累積金額。収入カード購入費は他の能力・揃えの価値を差し引かないため、単純な費用対効果ではない。\n\n| 群 | 収入カード購入費 | 収入効果の累積金 | 技術依存VP | 信仰依存VP | 戦争フェーズVP | 揃えVP | 残金VP |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
 for(const arm of ARMS){const m=combined.arms[arm];text+=`| ${names[arm]} | ${num(m.incomeCost)} | ${num(m.incomeEffectGold)} | ${num(m.techEffectVP)} | ${num(m.faithEffectVP)} | ${num(m.phaseWarVP)} | ${num(m.bonusVP)} | ${num(m.finalGoldVP)} |\n`;}
 text+='\n## 完成形と方針の切り替え\n\n「収入→高額」は収入カードを配置した後のラウンドで6金以上カードを配置した割合。収入投資の因果効果を測ったものではない。「技術/信仰得点」は対応する得点カードがあり最終Lv2以上。「複数揃え」は種族・職業を別々に2件以上数える。\n\n| 群 | 収入→高額 | 技術得点形 | 信仰得点形 | 複数揃え | 嵐による倍化成立 | 配置判断の方針変更/対戦 |\n|---|---:|---:|---:|---:|---:|---:|\n';
 for(const arm of ARMS){const m=combined.arms[arm];text+=`| ${names[arm]} | ${pct(m.incomeToExpensive)} | ${pct(m.grownTechVP)} | ${pct(m.grownFaithVP)} | ${pct(m.multiBonus)} | ${pct(m.stormBonus)} | ${num(m.changes)} |\n`;}
 text+='\n## 本比較と別配札の追加検証\n\n| 比較 | 本比較の差 | 追加検証の差 | 合算の差 | 合算95%区間 |\n|---|---:|---:|---:|---:|\n';
 for(const [group,arm]of [['natural','flexible'],['natural','committed'],['expert','flexible'],['natural','flexible-vs-committed']]){const key=group+':'+arm,p=combined.comparisons[key];const parts=await Promise.all(prefixes.map(prefix=>readFile(`${DIR}/${prefix}-summary.json`,'utf8').then(JSON.parse)));text+=`| ${arm==='flexible-vs-committed'?'再選択 vs 計画継続':`${group==='expert'?'凄腕相手：':''}${names[arm]} vs 既存`} | ${pp(parts[0].comparisons[key].diff)} | ${pp(parts[1].comparisons[key].diff)} | ${pp(p.diff)} | ${p.ci95.map(pp).join(' ～ ')} |\n`;}
 text+='\n## 人数別の勝利シェア\n\n| 群 | 2人 | 3人 | 4人 | 5人 |\n|---|---:|---:|---:|---:|\n';for(const arm of ARMS)text+=`| ${names[arm]} | ${[2,3,4,5].map(n=>pct(combined.byCount[n][arm].win)).join(' | ')} |\n`;
 text+='\n## 再選択CPUが最初に採用した方針\n\n選択後に別方針へ移るため、初回方針だけの勝率ではない。方針名は候補生成の重みであり、完成形の宣言ではない。\n\n| 初回方針 | 件数 | 条件付き勝利シェア |\n|---|---:|---:|\n';for(const [key,m]of Object.entries(combined.firstSelected))text+=`| ${key==='balanced'?'均衡':names[key]} | ${m.games} | ${pct(m.win)} |\n`;
 text+=`\n終盤条件（他者7体以上または30VP以上）の配置判断${combined.late.opportunities}件中、前ラウンドからの方針変更は${combined.late.profileChanges}件。これだけで適切な撤退条件は確定できない。\n\n`;
 text+='## 検証と解釈\n\n640対戦すべてで提出の合法性、全カードの枚数保存、得点内訳の一致、対応する初期配札の一致を検査。本比較・追加検証から各3対戦（既存・再選択・継続）を再実行し、時間以外の記録が一致。原始記録は圧縮分割し、archives.jsonにSHA-256を保存。設定には全41種類の枚数・効果とコードのハッシュを保存。\n\n各人数16配札、凄腕相手は各人数16配札の探索的研究。多数の固定方針を比較しており、数値上の最高群を最強戦略と断定しない。選択方針と完成形を区別する。既知手札の計画、4ラウンド、幅4、仮想配札1通りの範囲に限る。候補数と揃えの近似評価も違うため、候補の多様性だけの効果や同計算量での比較ではない。相手モデルは均衡評価型で、凄腕予測にも限界がある。追加目標ONや人間相手の強さは検証していない。\n\nゲーム内CPUとカード評価は変更していない。次の検証は結果に応じて別配札で行う。\n\n再実行：`node scripts/benchmark-long-term.mjs`、`node scripts/benchmark-long-term.mjs --validation`、`node scripts/analyze-long-term.mjs --replay`。分析は生データがなくてもarchives.jsonの順でpartsを結合し、SHA-256を確認して直接読み込む。\n';
 const examples={};let exampleText='# 長期方針の対戦例\n\n勝敗で選ばず、本比較の乱数種順で、各観察条件を初めて満たした対戦を掲載する。比較群の平均や人間向けの必勝手順ではない。例が見つからない場合も記録する。カード名・配置・実得点は原始記録に対応する。\n\n';
 const criteria={economy:m=>m.incomeToExpensive===1,tech:m=>m.grownTechVP===1,faith:m=>m.grownFaithVP===1,war:m=>m.warVP>=2,bonus:m=>m.multiBonus===1,savings:m=>m.finalGoldVP>=5,flexible:m=>m.changes>=1,committed:m=>m.continuedDecisions>=2};
 for(const [arm,criterion]of Object.entries(criteria)){
  const row=all.filter(r=>r.group==='natural'&&r.arm===arm&&r.seed<920000).sort((a,b)=>a.seed-b.seed||a.count-b.count).find(r=>criterion(metrics(r)));
  exampleText+=`## ${names[arm]}\n\n`;
  if(!row){exampleText+='本比較では観察条件を満たす例なし。\n\n';continue;}
  const m=metrics(row);examples[arm]={seed:row.seed,count:row.count,id:row.id,winShare:m.win,metrics:m};
  exampleText+=`配札${row.seed}・${row.count}人・席${row.focal+1}。最終${m.vp}VP、勝利シェア${pct(m.win)}。初手：${row.initial[row.focal].map(id=>CARD[id].name).join('、')}。\n\n| ラウンド | 候補の方針 | 配置したカード | 戦争VP | カードVP | 配置・揃えVP | 残金VP |\n|---|---|---|---:|---:|---:|---:|\n`;
  for(const round of row.roundHistory){const h=row.history.find(h=>h.phase==='place'&&h.round===round.round),hand=[...h.hand],cards=h.order.moves.map(move=>CARD[hand.splice(move.handIndex,1)[0]].name);exampleText+=`| ${round.round} | ${h.key}${h.continued?'（継続）':''} | ${cards.join('、')||'配置せず'} | ${round.vpByPhase.war??0} | ${round.vpByPhase.vp??0} | ${round.vpByPhase.place??0} | ${round.vpByPhase.final??0} |\n`;}
  exampleText+='\n';
 }
 await writeFile(`${DIR}/examples.json`,JSON.stringify(examples,null,2)+'\n');await writeFile(`${DIR}/EXAMPLES.md`,exampleText);
 await writeFile(`${DIR}/README.md`,text);console.log(JSON.stringify({games:all.length,replays:verified.length,comparisons:combined.comparisons,archives:manifests},null,2));
}
