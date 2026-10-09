import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {random} from './adaptive-strategies.mjs';
import {diagnose} from './diagnose-planning.mjs';
import {makeStates,DIR} from './run-planning-diagnosis.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
const value=e=>mean(e.audit.map(x=>x.value));
async function readRows(prefix){
 try{return await readFile(`${DIR}/${prefix}.jsonl`);}catch(e){if(e.code!=='ENOENT')throw e;}
 const a=JSON.parse(await readFile(`${DIR}/archives.json`,'utf8'))[prefix],z=await readFile(`${DIR}/${a.file}`);if(hash(z)!==a.sha256)throw Error('Archive differs');const raw=gunzipSync(z);if(hash(raw)!==a.rawSha256)throw Error('Raw archive differs');return raw;
}
export function pairedDifference(rows,left,right){
 const pairs=rows.map(r=>({seed:r.state.seed,diff:value(r.evaluations.find(e=>e.id===r.choices[left]))-value(r.evaluations.find(e=>e.id===r.choices[right]))})),seeds=[...new Set(pairs.map(p=>p.seed))],clusters=new Map(seeds.map(s=>[s,pairs.filter(p=>p.seed===s)])),rng=random(1050789),samples=[];
 for(let i=0;i<4000;i++){const picked=[];for(let j=0;j<seeds.length;j++)picked.push(...clusters.get(seeds[Math.floor(rng()*seeds.length)]));samples.push(mean(picked.map(p=>p.diff)));}samples.sort((a,b)=>a-b);
 return {states:rows.length,clusters:seeds.length,difference:mean(pairs.map(p=>p.diff)),ci95:[samples[100],samples[3899]]};
}
export function summary(rows){
 const groups={};for(const key of ['baseline1','expanded1','baseline3','expanded3']){
  const chosen=rows.map(r=>r.evaluations.find(e=>e.id===r.choices[key])),outcomes=chosen.flatMap(e=>e.audit),ended=outcomes.filter(x=>x.ended);
  groups[key]={states:rows.length,extra:chosen.filter(e=>e.extra).length,plans:chosen.filter(e=>e.schedule).length,auditValue:mean(chosen.map(value)),auditVP:mean(outcomes.map(x=>x.vp)),auditGap:mean(outcomes.map(x=>x.gap)),terminalFraction:ended.length/outcomes.length,terminalWinShare:ended.length?mean(ended.map(x=>x.winShare)):null};
 }
 let useful=0,missed1=0,missed3=0,harmful1=0,harmful3=0;
 const examples=[];for(const r of rows){
  const old=[...r.evaluations.filter(e=>!e.extra)].sort((a,b)=>value(b)-value(a))[0],extra=[...r.evaluations.filter(e=>e.extra)].sort((a,b)=>value(b)-value(a))[0];
  const c1=r.evaluations.find(e=>e.id===r.choices.expanded1),c3=r.evaluations.find(e=>e.id===r.choices.expanded3),b1=r.evaluations.find(e=>e.id===r.choices.baseline1),b3=r.evaluations.find(e=>e.id===r.choices.baseline3);
  const better=value(extra)>value(old)+1e-9;if(better){useful++;if(!c1.extra)missed1++;if(!c3.extra)missed3++;}
  if(c1.extra&&value(c1)<value(b1)-1e-9)harmful1++;if(c3.extra&&value(c3)<value(b3)-1e-9)harmful3++;
  examples.push({stateId:r.state.id,prefix:r.state.prefix,seed:r.state.seed,count:r.state.count,round:r.state.round,choices:r.choices,bestExisting:old.id,bestExtra:extra.id,extraAdvantage:value(extra)-value(old),selectedExpanded3Audit:value(c3),selectedBaseline3Audit:value(b3),selectedDifference:value(c3)-value(b3),bestExtraSchedule:extra.schedule,hand:r.state.p.hand,board:r.state.p.board});
 }
 const comparisons={};for(const [left,right]of [['expanded1','baseline1'],['expanded3','baseline3'],['baseline3','baseline1'],['expanded3','expanded1']])comparisons[left+'-'+right]=pairedDifference(rows,left,right);
 return {states:rows.length,groups,comparisons,diagnostic:{extraBestBeatsExistingBest:useful,missed1,missed3,harmful1,harmful3},examples};
}
if(process.argv[1]?.endsWith('analyze-planning-diagnosis.mjs')){
 const prefixes=['results','validation'],all=[],parts={},replays=[];
 for(const prefix of prefixes){const raw=await readRows(prefix),rows=raw.toString().trim().split('\n').map(JSON.parse),config=JSON.parse(await readFile(`${DIR}/${prefix}-config.json`,'utf8')),expected=makeStates(prefix).states;
  if(rows.length!==config.states||new Set(rows.map(r=>r.state.id)).size!==config.states)throw Error('Incomplete records');for(const r of rows){if(JSON.stringify(r.state)!==JSON.stringify(expected[r.state.id]))throw Error('State differs');if(r.evaluations.filter(e=>!e.extra).length!==10||r.evaluations.filter(e=>e.extra).length!==6)throw Error('Candidate count differs');}
  for(const [path,sha]of Object.entries(config.source))if(hash(await readFile(path))!==sha)throw Error('Source differs');
  if(process.argv.includes('--replay')){const old=rows[0],fresh=diagnose(old.state),copy=structuredClone(old);delete fresh.timingMs;delete copy.timingMs;if(JSON.stringify(fresh)!==JSON.stringify(copy))throw Error('Replay differs');replays.push({prefix,id:old.state.id});}
  parts[prefix]=summary(rows);all.push(...rows);await writeFile(`${DIR}/${prefix}-summary.json`,JSON.stringify(parts[prefix],null,2)+'\n');
 }
 const configs=await Promise.all(prefixes.map(p=>readFile(`${DIR}/${p}-config.json`,'utf8').then(JSON.parse)));if(JSON.stringify(configs[0].source)!==JSON.stringify(configs[1].source))throw Error('Sources differ');
 const combined={createdAt:new Date().toISOString(),cards:configs[0].cards,totalCards:configs[0].totalCards,replays,missing:configs.flatMap(c=>c.missing),...summary(all)};
 await writeFile(`${DIR}/summary.json`,JSON.stringify(combined,null,2)+'\n');const archives={};
 for(const prefix of prefixes){const raw=await readRows(prefix),z=gzipSync(raw,{level:9}),file=prefix+'.jsonl.gz';if(!gunzipSync(z).equals(raw))throw Error('Compression differs');await writeFile(`${DIR}/${file}`,z);archives[prefix]={file,states:parts[prefix].states,bytes:z.length,sha256:hash(z),rawSha256:hash(raw)};}
 await writeFile(`${DIR}/archives.json`,JSON.stringify(archives,null,2)+'\n');
 const names={baseline1:'既存候補・配札1通り',expanded1:'候補追加・配札1通り',baseline3:'既存候補・配札3通り',expanded3:'候補追加・配札3通り'},num=n=>n.toFixed(2),pct=n=>(n*100).toFixed(1)+'%';
 let text=`# 長期計画の候補生成・評価の診断\n\n2026-10-09。現在の41種類・102枚。2人・5人の中盤/終盤、別配札による${combined.states}局面。追加目標OFF。方法は [METHOD.md](METHOD.md)。各候補は選択用3通りと独立評価用3通りで処理し、各局面の既存10候補と追加6候補を記録した。\n\n`;
 text+='## 独立した配札で選択を確かめる\n\n評価値は旧CPUと同じ尺度。終了時は勝利分配を大きく重視し、未終了時は均衡評価。値の差はVP差ではない。終局時の勝利シェアは終了した仮想対戦だけの条件付き値であり、実際のゲーム勝率ではない。\n\n| 選択方法 | 追加計画採用 | 全計画採用 | 独立評価値 | 独立評価のVP差 | 仮想対戦終了率 | 終局時勝利シェア |\n|---|---:|---:|---:|---:|---:|---:|\n';
 for(const [key,g]of Object.entries(combined.groups))text+=`| ${names[key]} | ${g.extra}/${g.states} | ${g.plans}/${g.states} | ${num(g.auditValue)} | ${num(g.auditGap)} | ${pct(g.terminalFraction)} | ${g.terminalWinShare===null?'—':pct(g.terminalWinShare)} |\n`;
 text+='\n## 同じ局面での独立評価値の差\n\n同じ配札番号の人数・ラウンドをまとめた再標本化。\n\n| 比較 | 本比較 | 別配札の追加検証 | 合算 | 合算95%区間 |\n|---|---:|---:|---:|---:|\n';
 for(const [key,p]of Object.entries(combined.comparisons)){const [left,right]=key.split('-');text+=`| ${names[left]} − ${names[right]} | ${num(parts.results.comparisons[key].difference)} | ${num(parts.validation.comparisons[key].difference)} | ${num(p.difference)} | ${p.ci95.map(num).join(' ～ ')} |\n`;}
 const d=combined.diagnostic;text+=`\n## 候補生成と選択の観察\n\n独立評価で追加候補の最高値が既存候補の最高値を上回った局面は${d.extraBestBeatsExistingBest}/${combined.states}。このうち追加候補を選ばなかったのは1通り評価で${d.missed1}件、3通り評価で${d.missed3}件。追加候補を選んだ結果、同じ評価通り数の既存候補の選択より独立評価が下がったのは1通りで${d.harmful1}件、3通りで${d.harmful3}件。\n\n独立評価自体の最高値を選んだ参考上限は楽観的。3通りの仮想配札内の観察であり、良い計画が存在しないことや評価の真の誤りを証明するものではない。候補を追加しただけでは採用候補の質が保証されず、複数配札の評価も局面によって選択を変える。\n\n`;
 text+='## 診断例\n\n差が最も悪かった例と、追加候補の参考上限が最も高かった例を、勝敗ではなく診断値から選ぶ。全例はsummary.jsonに記録。\n\n';
 for(const e of [[...combined.examples].sort((a,b)=>a.selectedDifference-b.selectedDifference)[0],[...combined.examples].sort((a,b)=>b.extraAdvantage-a.extraAdvantage)[0]])text+=`- 配札${e.seed}、${e.count}人、ラウンド${e.round}：既存3通りが${e.choices.baseline3}、追加3通りが${e.choices.expanded3}を選択。独立評価差${num(e.selectedDifference)}。追加候補の参考上限差${num(e.extraAdvantage)}。\n`;
 text+=`\n## 検証と限界\n\n既存候補の評価が元のchoosePlanningと一致すること、入力を変更しないこと、実際の相手手札を変えても結果が変わらないことをテストした。全${combined.states}局面で16候補×6配札の合法性とカード枚数を検査。代表${replays.length}局面を再実行し、時間以外の全記録が一致。原始記録と枚数・ソースのSHA-256を保存した。欠測は${combined.missing.length}局面。\n\n均衡評価型が作った局面に限定した診断で、全局面や人間のプレイを代表しない。実対戦の勝率比較ではない。独立評価も3通りしかなく、相手モデルや4ラウンドの制限は残る。採用した計画を仮想対戦では継続するため、実際に毎判断で再計画するCPUへの効果は別に検証が必要。ゲーム内CPUを変更していない。\n\n再現：\n\n`+'```sh\nnode scripts/run-planning-diagnosis.mjs\nnode scripts/run-planning-diagnosis.mjs --validation\nnode scripts/analyze-planning-diagnosis.mjs --replay\n```\n\n分析は圧縮記録からもハッシュを照合して実行できる。\n';
 await writeFile(`${DIR}/README.md`,text);console.log(JSON.stringify({states:combined.states,replays:replays.length,groups:combined.groups,comparisons:combined.comparisons,diagnostic:d,archives},null,2));
}
