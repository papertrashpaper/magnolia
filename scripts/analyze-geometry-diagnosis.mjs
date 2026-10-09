import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {pairedDifference} from './analyze-planning-diagnosis.mjs';
import {makeStates,DIR} from './run-geometry-diagnosis.mjs';
import {diagnose} from './diagnose-geometry.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
const audit=e=>mean(e.audit.map(x=>x.value));
export function summarize(rows){
 const groups={},diagnostic={};
 for(const group of ['baseline','wide','geometry'])for(const worlds of [1,3]){
  const key=group+worlds,chosen=rows.map(r=>r.evaluations.find(e=>e.id===r.choices[key])),outcomes=chosen.flatMap(e=>e.audit),ended=outcomes.filter(o=>o.ended);
  groups[key]={states:rows.length,extra:chosen.filter(e=>e.extra).length,plans:chosen.filter(e=>e.schedule).length,value:mean(chosen.map(audit)),vp:mean(outcomes.map(o=>o.vp)),gap:mean(outcomes.map(o=>o.gap)),terminalFraction:ended.length/outcomes.length,terminalShare:ended.length?mean(ended.map(o=>o.winShare)):null};
 }
 for(const group of ['wide','geometry']){
  const d={beatsExistingCeiling:0,missed1:0,missed3:0,harmful1:0,harmful3:0,improved1:0,improved3:0};
  for(const r of rows){const old=Math.max(...r.evaluations.filter(e=>!e.extra).map(audit)),extra=Math.max(...r.evaluations.filter(e=>e.group===group).map(audit));
   const better=extra>old+1e-9;if(better)d.beatsExistingCeiling++;
   for(const worlds of [1,3]){const selected=r.evaluations.find(e=>e.id===r.choices[group+worlds]),base=r.evaluations.find(e=>e.id===r.choices['baseline'+worlds]),diff=audit(selected)-audit(base);if(better&&!selected.extra)d['missed'+worlds]++;if(selected.extra&&diff< -1e-9)d['harmful'+worlds]++;if(diff>1e-9)d['improved'+worlds]++;}
  }diagnostic[group]=d;
 }
 const comparisons={};for(const worlds of [1,3])for(const [left,right]of [['wide','baseline'],['geometry','baseline'],['geometry','wide']])comparisons[left+worlds+'-'+right+worlds]=pairedDifference(rows,left+worlds,right+worlds);
 for(const group of ['baseline','wide','geometry'])comparisons[group+'3-'+group+'1']=pairedDifference(rows,group+'3',group+'1');
 const examples=rows.map(r=>{const old=[...r.evaluations.filter(e=>!e.extra)].sort((a,b)=>audit(b)-audit(a))[0],added=[...r.evaluations.filter(e=>e.group==='geometry')].sort((a,b)=>audit(b)-audit(a))[0],c=r.evaluations.find(e=>e.id===r.choices.geometry3),b=r.evaluations.find(e=>e.id===r.choices.baseline3);return {seed:r.state.seed,count:r.state.count,round:r.state.round,hand:r.state.p.hand,board:r.state.p.board,chosen:c.id,baseline:b.id,bestExisting:old.id,bestGeometry:added.id,ceilingDifference:audit(added)-audit(old),chosenDifference:audit(c)-audit(b),schedule:added.schedule};});
 return {states:rows.length,groups,comparisons,diagnostic,candidateCount:mean(rows.map(r=>r.evaluations.length)),uniqueCandidates:mean(rows.map(r=>r.uniqueCandidates)),generationMs:mean(rows.map(r=>r.generatedMs)),examples};
}
async function readRows(prefix){try{return await readFile(`${DIR}/${prefix}.jsonl`);}catch(e){if(e.code!=='ENOENT')throw e;}const a=JSON.parse(await readFile(`${DIR}/archives.json`,'utf8'))[prefix],z=await readFile(`${DIR}/${a.file}`);if(hash(z)!==a.sha256)throw Error('Archive hash');const raw=gunzipSync(z);if(hash(raw)!==a.rawSha256)throw Error('Raw hash');return raw;}
if(process.argv[1]?.endsWith('analyze-geometry-diagnosis.mjs')){
 const parts={},rows=[],archives={},replays=[];let cards;
 for(const prefix of ['results','validation']){
  const raw=await readRows(prefix),batch=raw.toString().trim().split('\n').map(JSON.parse),config=JSON.parse(await readFile(`${DIR}/${prefix}-config.json`,'utf8')),expected=makeStates(prefix).states;cards=config.cards;
  if(batch.length!==expected.length||new Set(batch.map(r=>r.state.id)).size!==expected.length)throw Error('Missing/duplicate states');
  for(const r of batch){if(JSON.stringify(r.state)!==JSON.stringify(expected[r.state.id]))throw Error('State differs');if(r.evaluations.filter(e=>!e.extra).length!==10||!r.evaluations.some(e=>e.group==='geometry')||!r.evaluations.some(e=>e.group==='wide'))throw Error('Candidate groups differ');}
  for(const [path,sha]of Object.entries(config.source))if(hash(await readFile(path))!==sha)throw Error('Source differs: '+path);
  if(config.totalCards!==102||config.cards.length!==41)throw Error('Card counts differ');
  if(process.argv.includes('--replay')){const a=structuredClone(batch[0]),b=diagnose(a.state);for(const x of [a,b]){delete x.timingMs;delete x.generatedMs;}if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Replay differs');replays.push({prefix,id:a.state.id});}
  parts[prefix]=summarize(batch);rows.push(...batch);await writeFile(`${DIR}/${prefix}-summary.json`,JSON.stringify(parts[prefix],null,2)+'\n');
  const z=gzipSync(raw,{level:9});if(!gunzipSync(z).equals(raw))throw Error('Compression differs');const file=prefix+'.jsonl.gz';await writeFile(`${DIR}/${file}`,z);archives[prefix]={file,states:batch.length,bytes:z.length,sha256:hash(z),rawSha256:hash(raw),missing:config.missing};
 }
 const combined={createdAt:new Date().toISOString(),cards,totalCards:102,replays,...summarize(rows)};
 await writeFile(`${DIR}/summary.json`,JSON.stringify(combined,null,2)+'\n');await writeFile(`${DIR}/archives.json`,JSON.stringify(archives,null,2)+'\n');
 const labels={baseline:'既存候補',wide:'探索拡大',geometry:'探索拡大＋位置保持'},label=k=>labels[k.slice(0,-1)]+'・配札'+k.at(-1)+'通り',num=n=>n.toFixed(2),pct=n=>(100*n).toFixed(1)+'%';
 let text='# 手札から作る配置順・位置の研究\n\n現在の41種類・102枚を固定。新しい配札による2人・5人、ラウンド2・4の64局面。追加目標OFF。各候補の選択用3配札と独立評価用3配札を分離した。実対戦の勝率比較ではない。条件は [METHOD.md](METHOD.md)。\n\n';
 text+='## 選択後の独立評価\n\n| 方法 | 追加計画採用 | 計画採用全体 | 評価値 | 相手最高VPとの差 | 仮想終局の勝利シェア |\n|---|---:|---:|---:|---:|---:|\n';
 for(const [k,g]of Object.entries(combined.groups))text+=`| ${label(k)} | ${g.extra}/${g.states} | ${g.plans}/${g.states} | ${num(g.value)} | ${num(g.gap)} | ${g.terminalShare===null?'—':pct(g.terminalShare)} |\n`;
 text+='\n評価値は既存CPUと同じ勝利重視の尺度で、VPや勝率の差ではない。勝利シェアは終局した仮想対戦のみの値。\n\n## 同じ局面の評価値差\n\n| 比較 | 本比較 | 別配札検証 | 合算 | 合算95%区間 |\n|---|---:|---:|---:|---:|\n';
 for(const [k,v]of Object.entries(combined.comparisons)){const [l,r]=k.split('-');text+=`| ${label(l)} − ${label(r)} | ${num(parts.results.comparisons[k].difference)} | ${num(parts.validation.comparisons[k].difference)} | ${num(v.difference)} | ${v.ci95.map(num).join(' ～ ')} |\n`;}
 text+='\n## 候補生成と選択の診断\n\n| 追加候補群 | 既存の参考上限を超えた局面 | 選択の改善（1/3通り） | 追加計画選択で悪化（1/3通り） | 上限超えの候補があるが既存を選択（1/3通り） |\n|---|---:|---:|---:|---:|\n';
 for(const [group,d]of Object.entries(combined.diagnostic))text+=`| ${labels[group]} | ${d.beatsExistingCeiling}/64 | ${d.improved1}/${d.improved3} | ${d.harmful1}/${d.harmful3} | ${d.missed1}/${d.missed3} |\n`;
 text+='\n独立評価の最高値を後から選ぶ参考上限は楽観的で、真の最適解ではない。改善/悪化は独立評価の平均値で判断し、同じ局面では既存候補を必ず残した。\n\n## 人数・時期別（位置保持、配札3通り）\n\n| 人数 | ラウンド | 局面数 | 既存との差 |\n|---|---:|---:|---:|\n';
 for(const count of [2,5])for(const round of [2,4]){const subset=rows.filter(r=>r.state.count===count&&r.state.round===round),d=pairedDifference(subset,'geometry3','baseline3');text+=`| ${count} | ${round} | ${subset.length} | ${num(d.difference)} |\n`;}
 text+=`\n平均候補数${num(combined.candidateCount)}、同一計画を共有した後の平均評価数${num(combined.uniqueCandidates)}。候補生成の平均所要時間${num(combined.generationMs)}ms（研究環境の並列実行中の実測で、スマホの性能を表さない）。\n\n`;
 text+='## 診断例\n\n最高の参考上限差と最低の選択差の例。全局面と配置順はsummary.json、完全記録は圧縮JSONLに保存。\n\n';
 for(const e of [[...combined.examples].sort((a,b)=>b.ceilingDifference-a.ceilingDifference)[0],[...combined.examples].sort((a,b)=>a.chosenDifference-b.chosenDifference)[0]])text+=`- 配札${e.seed}、${e.count}人、ラウンド${e.round}：選択${e.chosen}、既存選択${e.baseline}。選択の独立評価差${num(e.chosenDifference)}、位置保持候補の参考上限差${num(e.ceilingDifference)}。\n`;
 text+=`\n## 検証と限界\n\n全候補の仮想継続でカード枚数・合法性を確認。配置順の合法性、元の候補の保持、相手の実手札に依存しないことをテスト。代表${replays.length}局面を再実行し時間以外の記録が一致。入力局面は元ゲームから再生成し照合。圧縮記録の原始データ・圧縮データのSHA-256を保存した。\n\n均衡型が作った局面、2人・5人、追加目標OFF、最大4ラウンドの仮想継続に限定。既知手札の計画は将来引くカードを計画に組み込まない。候補生成中は相手が新規配置しない近似が残る。独立評価も3配札のみで、全カードのコンボや実対戦の優劣を証明するものではない。位置保持は同じ探索幅で位置違いを残すため、カード順の多様性との競合がある。ゲーム内CPUは変更していない。\n\n再現：\n\n`+'```sh\nnode scripts/run-geometry-diagnosis.mjs\nnode scripts/run-geometry-diagnosis.mjs --validation\nnode scripts/analyze-geometry-diagnosis.mjs --replay\n```\n';
 await writeFile(`${DIR}/README.md`,text);console.log(JSON.stringify({states:combined.states,replays,groups:combined.groups,comparisons:combined.comparisons,diagnostic:combined.diagnostic,candidateCount:combined.candidateCount,uniqueCandidates:combined.uniqueCandidates,archives},null,2));
}
