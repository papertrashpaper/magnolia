import {CARD,RACES,JOBS} from './cards.js?v=3';
import {previewPlacement,legalCells} from './engine.js?v=12';

// Read awarded bonus keys, rather than guessing from stat changes (which can
// be zero at the technology/faith cap). Coordinates stay relative to the mat.
export function completedCombos(player){
 return (player.bonuses??[]).flatMap(key=>{
  const [axis,n,type,value]=key.split(':'),coordinate=Number(n);
  if(!['x','y'].includes(axis)||!['race','job'].includes(type))return [];
  const cells=player.board.filter(c=>c[axis]===coordinate);
  if(cells.length!==3||!cells.every(c=>CARD[c.card]?.[type]===value))return [];
  return [{key,axis,coordinate,type,value,label:`${axis==='y'?'横':'縦'} · ${(type==='race'?RACES:JOBS)[value]}（${type==='race'?'種族':'職業'}）`,cells}];
 });
}
export function newCombos(before,after){
 const previous=new Set(before.bonuses??[]);
 return completedCombos(after).filter(c=>!previous.has(c.key));
}
export function placementComboHints(player){
 const hints=[];
 for(let handIndex=0;handIndex<player.hand.length;handIndex++){
  if(CARD[player.hand[handIndex]].cost>player.gold)continue;
  for(const cell of legalCells(player.board)){
   const after=previewPlacement(player,[{handIndex,...cell}]).player;
   const combos=newCombos(player,after);
   if(combos.length)hints.push({handIndex,...cell,combos});
  }
 }
 return hints;
}
