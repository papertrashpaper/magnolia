import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARD} from '../public/js/cards.js';
import {makePlayer,clone,placeOne,resolveRound,power,level} from '../public/js/engine.js';

const dir='research/adaptive-strategy-comparison';
const cook=[{card:'dwarf_cook',x:0,y:0}];
const opponent=[{card:'demon_destroy',x:0,y:0}];
const play=(card,x=0,y=1)=>({card,x,y});
export const cases=[
 {id:'tech-only',title:'技術Lv.3・信仰Lv.0：ビールか水晶か',tech:7,faith:0,board:cook,hand:['dwarf_beer','golem_cristal'],plans:[[play('dwarf_beer')],[play('golem_cristal')]]},
 {id:'dual-levels',title:'技術Lv.3・信仰Lv.2：ビールか水晶か',tech:7,faith:3,board:cook,hand:['dwarf_beer','golem_cristal'],plans:[[play('dwarf_beer')],[play('golem_cristal')]]},
 {id:'max-levels',title:'技術・信仰ともLv.4：ビールか水晶か',tech:15,faith:15,board:cook,hand:['dwarf_beer','golem_cristal'],plans:[[play('dwarf_beer')],[play('golem_cristal')]]},
 {id:'threshold-source',title:'技術はLv.3・信仰はLv.2まであと1点：育てる先',tech:7,faith:2,board:[...cook,{card:'golem_cristal',x:0,y:1}],hand:['dwarf_pugilist','elf_saint'],plans:[[play('dwarf_pugilist',1,1)],[play('elf_saint',1,1)]]},
 {id:'faith-before-war',title:'今の戦争に間に合う信仰：信奉者か祈り手か',tech:0,faith:2,board:[{card:'elf_mistic',x:0,y:0}],opponent:[{card:'goblin_great_soldier',x:0,y:0}],warVP:[4,0],hand:['elf_follower','elf_saint'],plans:[[play('elf_follower')],[play('elf_saint')]]},
 {id:'war-already-paid',title:'すでに戦争報酬を取れる：百人長か鉄か',tech:0,faith:0,board:[{card:'human_knight',x:0,y:0}],opponent:[{card:'human_knight',x:0,y:0}],warVP:[4,0],hand:['goblin_great_soldier','golem_iron'],plans:[[play('goblin_great_soldier')],[play('golem_iron')]]},
 {id:'war-unlock',title:'報酬圏外：後列の百人長か前線の騎士か',tech:0,faith:0,board:cook,opponent:[{card:'human_knight',x:0,y:0}],warVP:[4,0],hand:['goblin_great_soldier','human_knight'],plans:[[play('goblin_great_soldier')],[play('human_knight',1,0)]]},
 {id:'income-back-row',title:'後列の収入2金：大商人か眼か',tech:0,faith:0,board:cook,hand:['human_great_marchant','demon_eye'],plans:[[play('human_great_marchant')],[play('demon_eye')]]},
 {id:'king-low-gold',title:'終了ラウンド・配置前7金：君主かビールか',gold:7,vp:39,tech:7,faith:0,board:cook,hand:['human_king','dwarf_beer'],plans:[[play('human_king')],[play('dwarf_beer')]]},
 {id:'king-high-gold',title:'終了ラウンド・配置前20金：君主かビールか',gold:20,vp:39,tech:7,faith:0,board:cook,hand:['human_king','dwarf_beer'],plans:[[play('human_king')],[play('dwarf_beer')]]},
 {id:'ruler-line',title:'君主2枚の列：嵐で揃えるかビールか',gold:12,vp:10,tech:7,faith:0,board:[{card:'human_king',x:0,y:0},{card:'golem_king',x:1,y:0},{card:'dwarf_cook',x:0,y:1}],warVP:[4,0],hand:['demon_storm','dwarf_beer'],plans:[[play('demon_storm',2,0)],[play('dwarf_beer',1,1)]]},
];

export function evaluateExample(input,moves){
 const p={...makePlayer('self','自分'),gold:input.gold??12,vp:input.vp??0,tech:input.tech,faith:input.faith,hand:clone(input.hand),board:clone(input.board)};
 const q={...makePlayer('other','相手'),board:clone(input.opponent??opponent)};
 const initial=clone(p);
 for(const move of moves)placeOne(p,{handIndex:p.hand.indexOf(move.card),x:move.x,y:move.y});
 p.gold+=2-moves.length;q.gold+=2;
 const g={players:[p,q],settings:{warVP:input.warVP??[0,0],targetVP:40},round:1,phase:'place',logs:[],orders:{},revision:0};
 resolveRound(g);
 return {label:moves.length?moves.map(m=>CARD[m.card].name).join('→'):'置かない',vpGain:p.vp-initial.vp,gold:p.gold,tech:p.tech,faith:p.faith,techLevel:level(p.tech),faithLevel:level(p.faith),power:p.power,powerAfter:power(p),warRank:p.rank,warVP:p.warVP,ended:g.phase==='ended',finalGoldVP:p.finalGoldVP??null};
}

export async function writeExamples(){
 const results=cases.map(c=>({id:c.id,title:c.title,input:c,outcomes:[evaluateExample(c,[]),...c.plans.map(m=>evaluateExample(c,m))]}));
 const sources={};for(const path of ['public/js/cards.js','public/js/engine.js','scripts/card-decision-examples.mjs']){const {readFile}=await import('node:fs/promises');sources[path]=createHash('sha256').update(await readFile(path)).digest('hex');}
 await writeFile(dir+'/decision-examples.json',JSON.stringify({sources,scope:'Controlled one-round counterfactuals; the opponent does not place cards. These are exact rule calculations, not win-rate trials.',cases:results},null,2)+'\n');
 let md='# 同じ盤面から、出すカードを比べる\n\n資源・盤面を設定した数値例で、相手の盤面を固定して今ラウンドだけをゲームエンジンで処理します。自然な配札から到達する頻度、将来の配札・相手の配置・勝率は比較していません。配置コスト、未配置枠1金、戦争、発展、収入、VP、終了時の残金得点を含みます。金とVPを一つの評価値にはしていません。終了時以外、VPが多い案が長期的にも最善とは限りません。\n\n';
 for(const c of results){md+=`## ${c.title}\n\n開始：${c.input.gold??12}金、${c.input.vp??0}VP、技術${c.input.tech}点・信仰${c.input.faith}点。戦争配点${(c.input.warVP??[0,0]).join('/')}。盤面と配置位置は [条件・全結果](decision-examples.json) に記録しています。\n\n| 配置案 | このラウンドのVP増加 | 置かない案との差 | 処理後のお金 | 戦争時の戦力 | 戦争報酬 | 終了 | 残金から得たVP |\n|---|---:|---:|---:|---:|---:|---|---:|\n`;for(const o of c.outcomes)md+=`| ${o.label} | ${o.vpGain} | ${o.vpGain-c.outcomes[0].vpGain} | ${o.gold} | ${o.power} | ${o.warVP} | ${o.ended?'終了':'継続'} | ${o.finalGoldVP??'—'} |\n`;md+='\n';}
 md+='再計算：`node scripts/card-decision-examples.mjs`。カードやルールの変更後は再実行して、カード別ガイドの判断例も見直してください。\n';
 await writeFile(dir+'/DECISION_EXAMPLES.md',md);return results;
}
if(process.argv[1]?.endsWith('card-decision-examples.mjs'))console.log(JSON.stringify({cases:(await writeExamples()).length}));
