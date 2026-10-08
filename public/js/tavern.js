import {bounds} from './engine.js?v=14';

// Empty mats reserve the same visible extent as the first placed card and its
// neighbours. These are display bounds only, never additional legal cells.
export function matBounds(board,candidates){
 return bounds(board.length?[...board,...candidates]:[{x:-1,y:-1},{x:1,y:1}]);
}
export function createRefreshments(onChange,{schedule=setTimeout,delay=1100}={}){
 const servings={bread:0,beer:0};
 return {servings,take(kind){
  if(!(kind in servings)||servings[kind]===3)return false;
  servings[kind]++;onChange(kind,false);
  if(servings[kind]===3)schedule(()=>{servings[kind]=0;onChange(kind,true);},delay);
  return true;
 }};
}
export function servingLabel(kind,step){
 const name=kind==='bread'?'パン':'ビール';
 return step===3?(kind==='bread'?'新しいパンの皿を給仕しています':'ビールを注いでいます'):`${name}を${kind==='bread'?'食べる':'飲む'}（あと${3-step}回）`;
}
