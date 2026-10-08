import {CARD,RACES,JOBS} from './cards.js?v=4';
import {previewPlacement,legalCells} from './engine.js?v=14';

// Colors follow the race diamonds and job shields printed on the cards.
export const COMBO_COLORS={race:{human:'#c79235',dwarf:'#969b98',elf:'#729b43',goblin:'#b84b48',golem:'#a79c64',demon:'#956598'},job:{warrior:'#bb473c',merchant:'#c6ac3d',artisan:'#788e89',priest:'#4f8e52',mage:'#79589b',ruler:'#507baf'}};
export function comboStyle(groups){
 const colors=[...new Set(groups.map(g=>COMBO_COLORS[g.type]?.[g.value]).filter(Boolean))];
 if(!colors.length)return '';
 return `--combo-color:${colors[0]};--combo-rings:${colors.map((c,i)=>`0 0 0 ${2+i*3}px ${c}`).join(',')};--combo-band:linear-gradient(90deg,${colors.flatMap((c,i)=>[`${c} ${i/colors.length*100}%`,`${c} ${(i+1)/colors.length*100}%`]).join(',')});`;
}

// Read awarded bonus keys, rather than guessing from stat changes (which can
// be zero at the technology/faith cap). Coordinates stay relative to the mat.
export function completedCombos(player){
 return (player.bonuses??[]).flatMap(key=>{
  const [axis,n,type,value]=key.split(':'),coordinate=Number(n);
  if(!['x','y'].includes(axis)||!['race','job'].includes(type))return [];
  const cells=player.board.filter(c=>c[axis]===coordinate);
  if(cells.length!==3||!cells.every(c=>CARD[c.card]?.[type]===value))return [];
  return [{key,axis,coordinate,type,value,label:`${type==='race'?'種族':'職業'}揃い・${(type==='race'?RACES:JOBS)[value]}`,direction:axis==='y'?'横':'縦',cells}];
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
