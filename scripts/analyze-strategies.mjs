import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {STRATEGIES} from './strategy-policies.mjs';
const dir='research/strategy-comparison';
export async function records(){const data=await readFile(dir+'/results.jsonl').catch(async()=>gunzipSync(await readFile(dir+'/results.jsonl.gz')));return data.toString().trim().split('\n').filter(Boolean).map(JSON.parse).sort((a,b)=>a.id-b.id);}
export function validate(rows,config){
 if(rows.length!==config.games||new Set(rows.map(r=>r.id)).size!==config.games)throw Error('Incomplete or duplicate results');
 for(const [id,r] of rows.entries()){
  if(r.id!==id&&!config.pilot)throw Error('Missing game ID');
  if(Math.abs(r.players.reduce((s,p)=>s+p.winShare,0)-1)>1e-9)throw Error('Victory shares do not sum to one');
  for(const p of r.players){const s=p.sources;if(s.warReward+s.warEffect+s.placementVP+s.bonusVP+s.recurringVP+s.goldVP!==p.vp)throw Error('VP attribution mismatch: '+r.id);if(p.gold<0||p.board.length>9||p.tech>15||p.faith>15)throw Error('Invalid end state');}
 }
}
function rng(seed){let n=seed;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const block=r=>JSON.stringify([r.group,r.lineup.length,r.seed,r.warVP,r.variant,r.beam]);
function interval(values){const random=rng(98765),draws=[];for(let b=0;b<2000;b++){let sum=0;for(let i=0;i<values.length;i++)sum+=values[Math.floor(random()*values.length)];draws.push(sum/values.length);}draws.sort((a,b)=>a-b);return [draws[50],draws[1949]];}
function stats(rows,key){
 const entries=rows.flatMap(r=>r.players.filter(p=>p.strategy===key).map(p=>({r,p})));if(!entries.length)return null;
 const blocks=new Map();for(const {r,p} of entries){const k=block(r);if(!blocks.has(k))blocks.set(k,[]);blocks.get(k).push(p.winShare);}
 const sources=Object.fromEntries(Object.keys(entries[0].p.sources).map(k=>[k,avg(entries.map(e=>e.p.sources[k]))]));
 return {strategy:key,name:STRATEGIES[key].name,games:entries.length,blocks:blocks.size,winShare:avg(entries.map(e=>e.p.winShare)),ci:interval([...blocks.values()].map(avg)),vp:avg(entries.map(e=>e.p.vp)),rank:avg(entries.map(e=>e.p.rank)),rounds:avg(entries.map(e=>e.r.rounds)),cards:avg(entries.map(e=>e.p.board.length)),gold:avg(entries.map(e=>e.p.gold)),tech:avg(entries.map(e=>e.p.tech)),faith:avg(entries.map(e=>e.p.faith)),endNine:avg(entries.map(e=>Number(e.r.endNine))),endVP:avg(entries.map(e=>Number(e.r.players.some(p=>p.vp-p.sources.goldVP>=40)))),sources};
}
const pct=n=>(100*n).toFixed(1)+'%',num=n=>n.toFixed(2);
function table(rows){return '| 方針 | 出場数 | 勝利シェア（95%区間） | 平均VP | 平均順位 | 平均ラウンド |\n|---|---:|---:|---:|---:|---:|\n'+rows.map(s=>`| ${s.name} | ${s.games} | ${pct(s.winShare)}（${pct(s.ci[0])}～${pct(s.ci[1])}） | ${num(s.vp)} | ${num(s.rank)} | ${num(s.rounds)} |`).join('\n');}
if(process.argv[1]?.endsWith('analyze-strategies.mjs')){
 const config=JSON.parse(await readFile(dir+'/results-config.json','utf8')),rows=await records();validate(rows,config);
 for(const [path,hash] of Object.entries(config.source))if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash)throw Error('Source changed since recorded comparison: '+path);
 const keys=Object.keys(STRATEGIES),groups={};
 for(const count of [2,3,4,5]){const subset=rows.filter(r=>['duel','multiplayer'].includes(r.group)&&r.lineup.length===count);groups[count]=keys.map(k=>stats(subset,k)).sort((a,b)=>b.winShare-a.winShare);}
 const pairwise=Object.fromEntries(keys.map(k=>[k,Object.fromEntries(keys.filter(j=>j!==k).map(j=>[j,stats(rows.filter(r=>r.group==='duel'&&r.lineup.includes(k)&&r.lineup.includes(j)),k)]))]));
 const sensitivity={};for(const group of [...new Set(rows.map(r=>r.group))].filter(g=>!['duel','multiplayer'].includes(g)))for(const count of [2,5]){const subset=rows.filter(r=>r.group===group&&r.lineup.length===count);if(subset.length)sensitivity[group+'/'+count]=keys.map(k=>stats(subset,k)).filter(Boolean).sort((a,b)=>b.winShare-a.winShare);}
 const summary={schema:1,config,games:rows.length,groups,pairwise,sensitivity};await writeFile(dir+'/summary.json',JSON.stringify(summary,null,2)+'\n');
 const csv=['group,players,strategy,games,blocks,win_share,ci_low,ci_high,mean_vp,mean_rank,mean_rounds,mean_cards,mean_gold,mean_tech,mean_faith,war_reward,war_effect,placement_vp,bonus_vp,recurring_vp,gold_vp,income_gold,develop_points'];
 for(const [group,statsRows] of [...Object.entries(groups).map(([n,s])=>['standard/'+n,s]),...Object.entries(sensitivity)])for(const s of statsRows)csv.push([group,group.split('/').at(-1),s.strategy,s.games,s.blocks,s.winShare,...s.ci,s.vp,s.rank,s.rounds,s.cards,s.gold,s.tech,s.faith,...Object.values(s.sources)].join(','));await writeFile(dir+'/summary.csv',csv.join('\n')+'\n');
 let md=`# マグノリア戦術比較\n\n${config.createdAt.slice(0,10)}実施。実際のゲームエンジンで **${rows.length.toLocaleString('ja-JP')}対戦**を完走し、8方針を比較しました。これは同じ探索予算の固定方針CPUの実験です。人間の最適戦術や既存CPUの難易度順位を断定するものではありません。\n\n`;
 md+='戦い方への読み替えと注意点は [戦術メモ](TACTICS.md) にまとめています。数値はこの記録、再利用用データはsummary.json／summary.csvを参照してください。\n\n## 人数別の比較\n\n勝利シェアは、単独1位なら1、同点1位が2人なら各0.5を加算した出場対戦あたりの平均です。均等なら2人50%、3人33.3%、4人25%、5人20%になります。各人数内では対戦相手の組み合わせと出場数を揃えています。\n\n';
 for(const [count,s] of Object.entries(groups))md+=`### ${count}人\n\n${table(s)}\n\n`;
 md+='## 2人戦の相性\n\n行の方針が列の方針に対して得た勝利シェアです。各組48対戦（24乱数種×手札割当の入れ替え）。\n\n| 方針 | '+keys.map(k=>STRATEGIES[k].name).join(' | ')+' |\n|---|'+keys.map(()=>'---:|').join('')+'\n';for(const k of keys)md+='| '+STRATEGIES[k].name+' | '+keys.map(j=>k===j?'—':pct(pairwise[k][j].winShare)).join(' | ')+' |\n';
 md+='\n## VPを得た経路\n\n5人戦の1出場あたり平均。合計は平均最終VPになります。技術・信仰の寄与は、利用したカードのフェーズに含まれます。\n\n| 方針 | 戦争報酬 | 戦争時効果 | 配置時効果 | 3枚揃え | VPフェーズ | 終了時の金 |\n|---|---:|---:|---:|---:|---:|---:|\n';for(const s of groups[5])md+=`| ${s.name} | ${['warReward','warEffect','placementVP','bonusVP','recurringVP','goldVP'].map(k=>num(s.sources[k])).join(' | ')} |\n`;
 md+='\n## 条件を変えた比較\n\nwar-none：戦争報酬0。war-winner：1位8VP、他0。war-generous：2人は6/3VP、5人は6/4/2/0/0VP。戦争条件は12乱数種の限定ラインアップを全席で回した比較で、全組み合わせではありません。方針ごとの出場数も併記します。\n\nemphasis：基準からの方針重みの差を0.7倍／1.3倍。beam：探索幅3／10（通常5）。これらは適応型を共通相手にした2人戦です。適応型の出場数は他の方針の7倍になり、全組み合わせの順位と直接比較できません。各条件内の相性として読みます。\n\n';for(const [group,s] of Object.entries(sensitivity))md+=`### ${group}\n\n${table(s)}\n\n`;
 md+='## 実験条件と限界\n\n- 標準報酬は2人4/0VP、3～5人5/3/0…VP。カード枚数・効果は現在のカードデータを使用。\n- 2人は8方針の全28組×24乱数種×2手札割当。3～5人は異なる方針の全組み合わせ×8乱数種×人数分の手札割当。\n- 席の巡回は初期手札の割当を均すためで、先手後手の優位を調べるものではありません。全員の行動を同じ公開状態から決めてから提出します。\n- 同じ乱数種でも、マリガンや配置が違えば後の手札は分岐します。同じ手札で全局面を比較したわけではありません。\n- 各方針は同じ配置探索幅・公開情報・終局評価を使用。相手の手札、山札の順序、同時提出する相手の行動は参照しません。探索は2枚配置までの有限探索です。\n- 技術・信仰は単独でVPになる扱いにせず、対応レベルを使うカードの有無を評価します。収入・将来得点の見積もりは短期的な近似で、各方針そのものの完成度が結果に影響します。\n- 9体型も、共通の終局評価では敗北が見えている9枚目を避けます。貯金型は終了時の金と人間の王を重視する方針で、君主カードの入手は保証しません。\n- 95%区間は同じ条件・乱数種の対戦を1ブロックにまとめた2,000回のブートストラップ。同じ乱数種を複数の相手に使う2人戦では、それらもまとめて再標本化します。同じ配札の席違いを独立標本として数えません。多重比較補正は行っていないため、僅差を確実な優劣とは扱いません。\n- 原始記録のendVPは終了時の金の換算後に40VP以上のプレイヤーがいるか、endReasonは9枚を優先した分類です。終了条件を厳密に調べるときは、各プレイヤーのvpからsources.goldVPを引いて40VP到達を判定してください。集計JSONのendVPはこの換算前の判定を使います。両条件は同時に成立することがあります。\n- 全対戦でカード枚数の保存を確認。分析時に結果の重複・欠落、勝利シェア合計、全VPの発生源、金・点数・盤面上限を検証します。\n\n';
 md+='## 再利用する\n\nNode.js 22以上でリポジトリ直下から実行します。追加パッケージは不要です。\n\n```sh\nnpm run analyze:strategies\nnpm run replay:strategy -- 0\nnpm run benchmark:strategies\nnpm run analyze:strategies\n```\n\n分析は保存済みの圧縮全対戦データも読めます。replayは指定IDの対戦を乱数種から再現し、保存済み結果と照合します。benchmarkは全比較を再実行し、途中結果がある場合は未完了IDから続行します。結果はresults.jsonlに追記されます。完了済み圧縮データを作業用JSONLに戻して再開状態を確認する場合：\n\n```sh\nnode --input-type=module -e "import fs from \'node:fs\'; import z from \'node:zlib\'; fs.writeFileSync(\'research/strategy-comparison/results.jsonl\',z.gunzipSync(fs.readFileSync(\'research/strategy-comparison/results.jsonl.gz\')));"\n```\n\n設定やエンジンを変える場合は、既存results-config.json、results.jsonl、results.jsonl.gzを別フォルダに保管してから再実行してください。異なるソースの混在は拒否します。STRATEGY_WORKERSで並列数、STRATEGY_SEEDSで2人戦の乱数種数を変更できます（3～5人戦と感度分析の数はスクリプト内で固定）。新方針はstrategy-policies.mjsのSTRATEGIESと評価関数に追加します。\n\n- [機械可読の集計](summary.json)\n- [表計算向けCSV](summary.csv)\n- [全対戦の圧縮記録](results.jsonl.gz)\n- [条件・ソースSHA-256](results-config.json)\n- [実行環境・データSHA-256・検証記録](provenance.json)\n- [比較実行](../../scripts/benchmark-strategies.mjs) / [方針](../../scripts/strategy-policies.mjs) / [集計](../../scripts/analyze-strategies.mjs)\n\n### 方針の重み\n\n1が共通の基準。配置済みVPと終局判定は共通です。表のVPは以降のVPフェーズを、配置数は9枚へ進む付加評価を指します。\n\n| 方針 | VP | 収入 | 技術 | 信仰 | 戦争 | 揃え | 金 | 配置数 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n';for(const s of Object.values(STRATEGIES))md+=`| ${s.name} | ${['vp','income','tech','faith','war','bonus','gold','slots'].map(k=>s[k]).join(' | ')} |\n`;
 await writeFile(dir+'/README.md',md);console.log(JSON.stringify({games:rows.length,leaders:Object.fromEntries(Object.entries(groups).map(([n,s])=>[n,s.slice(0,3).map(x=>({name:x.name,winShare:x.winShare}))]))}));
}
