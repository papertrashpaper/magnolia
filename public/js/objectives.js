import {CARD} from './cards.js?v=4';
import {power,level,amount} from './engine.js?v=14';
// Printed objective cards: thresholds are inclusive, except exact cash goals.
export const OBJECTIVES=[
 {id:'gold2',title:'所持金2金',phase:'place',target:2,exact:true},
 {id:'income7',title:'収入7金（基本収入を含む）',phase:'income',target:7},
 {id:'cheap3',title:'コスト3以下のユニット3体',phase:'place',target:3},
 {id:'power15',title:'合計戦力15（能力を含む）',phase:'war',target:15},
 {id:'jobs4',title:'職業4種類',phase:'place',target:4},
 {id:'gold12',title:'所持金12金',phase:'all',target:12,exact:true},
 {id:'expensive3',title:'コスト5以上のユニット3体',phase:'place',target:3},
 {id:'columns2',title:'縦に3体置かれた列2つ',phase:'place',target:2},
 {id:'levels2',title:'技術レベル2かつ信仰レベル2',phase:'all',target:2},
 {id:'races4',title:'種族4種類',phase:'place',target:4},
 {id:'tech3',title:'技術レベル3',phase:'all',target:3},
 {id:'faith3',title:'信仰レベル3',phase:'all',target:3}
].map(o=>({...o,vp:3}));
export const OBJECTIVE=Object.fromEntries(OBJECTIVES.map(o=>[o.id,o]));
export const OBJECTIVE_PHASES={place:'配置終了時',war:'戦争終了時',income:'収入終了時',all:'各フェイズ終了時'};
export function objectiveProgress(p,id,context={}){
 const o=OBJECTIVE[id];if(!o)return null;
 const cards=p.board.map(b=>CARD[b.card]);let value=0,detail='';
 switch(id){
  case 'gold2':case 'gold12':value=p.gold;detail=value===o.target?'条件を満たしています':`${o.target}金ちょうどまで${value<o.target?'あと':'減らす分'}${Math.abs(value-o.target)}金`;break;
  case 'income7':value=context.income??(3+cards.reduce((sum,c)=>sum+c.effects.filter(e=>e.phase==='income'&&e.stat==='gold').reduce((s,e)=>s+amount(p,c,e),0),0));detail=`基本収入込み ${value} / 7金`;break;
  case 'cheap3':value=cards.filter(c=>c.cost<=3).length;detail=`${value} / 3体`;break;
  case 'expensive3':value=cards.filter(c=>c.cost>=5).length;detail=`${value} / 3体`;break;
  case 'power15':value=power(p);detail=`戦力 ${value} / 15`;break;
  case 'jobs4':value=new Set(cards.map(c=>c.job)).size;detail=`職業 ${value} / 4種類`;break;
  case 'races4':value=new Set(cards.map(c=>c.race)).size;detail=`種族 ${value} / 4種類`;break;
  case 'columns2':value=[...new Set(p.board.map(b=>b.x))].filter(x=>p.board.filter(b=>b.x===x).length===3).length;detail=`完成した縦列 ${value} / 2列`;break;
  case 'levels2':value=Math.min(level(p.tech),level(p.faith));detail=`技術Lv.${level(p.tech)}（あと${Math.max(0,3-p.tech)}点）・信仰Lv.${level(p.faith)}（あと${Math.max(0,3-p.faith)}点）`;break;
  case 'tech3':value=level(p.tech);detail=`技術Lv.${value}・あと${Math.max(0,7-p.tech)}点`;break;
  case 'faith3':value=level(p.faith);detail=`信仰Lv.${value}・あと${Math.max(0,7-p.faith)}点`;break;
 }
 const met=o.exact?value===o.target:value>=o.target;
 const gap=o.exact?Math.abs(value-o.target):Math.max(0,o.target-value);
 let near=gap<=1;
 if(id==='power15')near=gap<=3;
 if(id==='tech3'||id==='faith3')near=(id==='tech3'?p.tech:p.faith)>=5;
 if(id==='levels2')near=p.tech>=2&&p.faith>=2;
 return {value,target:o.target,met,near:!met&&near,detail,ratio:o.exact?(met?1:Math.max(0,1-gap/o.target)):Math.min(1,value/o.target)};
}
