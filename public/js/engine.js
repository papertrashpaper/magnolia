import {CARD,CARDS,RACE_BONUS,JOB_BONUS} from './cards.js';
export const level=n=>n===15?4:n>=7?3:n>=3?2:n>=1?1:0;
export const clone=x=>structuredClone(x);
export const DEFAULT_SETTINGS={warVP:[5,3,0,0,0],targetVP:40};
export function normalizeSettings(settings={},count=2){
 const warVP=settings.warVP??(count===2?[4,0]:[5,3,0,0,0]);
 if(!Array.isArray(warVP)||warVP.length<count||warVP.some(n=>!Number.isInteger(n)||n<0||n>50))throw Error('戦争VPは各順位に0～50の整数を設定してください。');
 return {warVP:warVP.slice(0,count),targetVP:40};
}
export function shuffle(cards,rng=Math.random){
 const a=[...cards];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
export function makePlayer(id,name,cpu=false){return {id,name,cpu,gold:5,tech:0,faith:0,vp:0,hand:[],board:[],bonuses:[],power:0,rank:0,warVP:0};}
export function newGame(seats,settings={},rng=Math.random){
 if(seats.length<2||seats.length>5)throw Error('人数は2～5人です。');
 const g={players:seats.map(s=>makePlayer(s.id,s.name,s.cpu)),settings:normalizeSettings(settings,seats.length),round:1,phase:'draw',deck:shuffle(CARDS.flatMap(c=>Array(c.copies).fill(c.id)),rng),discard:[],orders:{},logs:[],revision:0};
 for(const p of g.players)drawToFive(g,p,rng);return g;
}
function drawToFive(g,p,rng=Math.random){
 while(p.hand.length<5){if(!g.deck.length){if(!g.discard.length)throw Error('山札と捨て札が空です。');g.deck=shuffle(g.discard,rng);g.discard=[];}p.hand.push(g.deck.pop());}
}
export function bounds(board){if(!board.length)return {minX:0,maxX:0,minY:0,maxY:0};return {minX:Math.min(...board.map(c=>c.x)),maxX:Math.max(...board.map(c=>c.x)),minY:Math.min(...board.map(c=>c.y)),maxY:Math.max(...board.map(c=>c.y))};}
export function legalCells(board){
 if(!board.length)return [{x:0,y:0}];
 const found=new Map();
 for(const c of board)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
  const x=c.x+dx,y=c.y+dy;if(board.some(b=>b.x===x&&b.y===y))continue;
  const b=bounds([...board,{x,y}]);if(b.maxX-b.minX<=2&&b.maxY-b.minY<=2)found.set(`${x},${y}`,{x,y});
 }return [...found.values()].sort((a,b)=>a.y-b.y||a.x-b.x);
}
export function amount(p,c,eff){
 let scale=1;
 switch(eff.scale){
  case 'techLevel':scale=level(p.tech);break;case 'faithLevel':scale=level(p.faith);break;
  case 'race':scale=p.board.filter(b=>CARD[b.card].race===c.race).length;break;
  case 'jobTypes':scale=new Set(p.board.map(b=>CARD[b.card].job)).size;break;
  case 'cost4Plus':scale=p.board.filter(b=>CARD[b.card].cost>=4).length;break;
  case 'cost3Minus':scale=p.board.filter(b=>CARD[b.card].cost<=3).length;break;
  case 'basePower4Plus':scale=p.board.filter(b=>CARD[b.card].power>=4).length;break;
 }return eff.amount*scale;
}
function add(p,stat,n){p[stat]+=n;if(stat==='tech'||stat==='faith')p[stat]=Math.min(15,p[stat]);}
function effects(p,phase){
 for(const b of p.board){const c=CARD[b.card];for(const eff of c.effects)if(eff.phase===phase){
  if(eff.stat==='equalize')p.tech=p.faith=Math.max(p.tech,p.faith);else add(p,eff.stat,amount(p,c,eff));
 }}
}
function bonusLines(p){
 const lines=[];const {minX,maxX,minY,maxY}=bounds(p.board);
 for(let y=minY;y<=maxY;y++){const cards=p.board.filter(b=>b.y===y);if(cards.length===3)lines.push({key:`y:${y}`,cards});}
 for(let x=minX;x<=maxX;x++){const cards=p.board.filter(b=>b.x===x);if(cards.length===3)lines.push({key:`x:${x}`,cards});}
 return lines;
}
export function bonusMultiplier(p){return 2**p.board.filter(b=>CARD[b.card].effects.some(e=>e.stat==='doubleBonus')).length;}
export function placeOne(p,move){
 if(!move||!Number.isInteger(move.handIndex)||!Number.isInteger(move.x)||!Number.isInteger(move.y))throw Error('配置データが不正です。');
 const id=p.hand[move.handIndex],c=CARD[id];if(!c)throw Error('手札のカードを選んでください。');
 if(!legalCells(p.board).some(b=>b.x===move.x&&b.y===move.y))throw Error('上下左右につなげ、縦横3マス以内に配置してください。');
 if(p.gold<c.cost)throw Error('配置コストが足りません。');
 p.gold-=c.cost;p.hand.splice(move.handIndex,1);p.board.push({card:id,x:move.x,y:move.y});
 for(const eff of c.effects)if(eff.phase==='place'){
  if(eff.stat==='equalize')p.tech=p.faith=Math.max(p.tech,p.faith);else add(p,eff.stat,amount(p,c,eff));
 }
 // 成立した全列の報酬を同時に集計してから付与する。
 const rewards={gold:0,tech:0,faith:0,vp:0},newBonuses=[];
 for(const line of bonusLines(p))for(const type of ['race','job']){
  const value=CARD[line.cards[0].card][type],key=`${line.key}:${type}:${value}`;
  if(p.bonuses.includes(key)||!line.cards.every(b=>CARD[b.card][type]===value))continue;
  p.bonuses.push(key);newBonuses.push({type,value});
  const reward=(type==='race'?RACE_BONUS:JOB_BONUS)[value];
  for(const [stat,n]of Object.entries(reward))rewards[stat]+=n*bonusMultiplier(p);
 }
 for(const [stat,n]of Object.entries(rewards))add(p,stat,n);
 return {card:id,bonuses:newBonuses,rewards};
}
export function previewPlacement(player,moves){
 if(!Array.isArray(moves)||moves.length>2)throw Error('配置は最大2枚です。');
 const p=clone(player),placed=[];for(const move of moves)placed.push(placeOne(p,move));
 return {player:p,placed};
}
export function power(p){
 let total=0;
 for(const b of p.board){const c=CARD[b.card];const front=!p.board.some(other=>other.x===b.x&&other.y<b.y);
  if(front||c.effects.some(e=>e.phase==='alwaysPower'))total+=c.power+c.effects.filter(e=>e.phase==='power').reduce((s,e)=>s+amount(p,c,e),0);
 }return total;
}
function log(g,message){g.logs.push({round:g.round,message});}
export function resolveRound(g){
 const before=g.players.map(p=>({id:p.id,gold:p.gold,tech:p.tech,faith:p.faith,vp:p.vp}));
 for(const p of g.players)p.power=power(p);
 for(const p of g.players){
  p.rank=1+g.players.filter(q=>q.power>p.power).length;p.warVP=g.settings.warVP[p.rank-1]??0;add(p,'vp',p.warVP);
  effects(p,p.warVP>0?'war':'noWar');
  log(g,`${p.name}：戦力${p.power}・${p.rank}位、戦争${p.warVP}VP${p.warVP>0?'（追加効果も処理）':''}`);
 }
 for(const phase of ['develop','income','vp'])for(const p of g.players){if(phase==='income')add(p,'gold',3);effects(p,phase);}
 for(const p of g.players){const b=before.find(x=>x.id===p.id);log(g,`${p.name}：ラウンド処理でVP +${p.vp-b.vp}、お金 +${p.gold-b.gold}、技術 +${p.tech-b.tech}、信仰 +${p.faith-b.faith}`);}
 if(g.players.some(p=>p.vp>=40||p.board.length===9)){
  g.phase='ended';for(const p of g.players){const kings=p.board.filter(b=>CARD[b.card].effects.some(e=>e.stat==='tripleGold')).length;
   p.finalGoldVP=Math.floor(p.gold/3)*3**kings;add(p,'vp',p.finalGoldVP);log(g,`${p.name}：残金${p.gold}金 → ${p.finalGoldVP}VP、最終${p.vp}VP`);
  }const best=Math.max(...g.players.map(p=>p.vp));g.winners=g.players.filter(p=>p.vp===best).map(p=>p.id);
 }else g.phase='round';g.orders={};
}
export function submit(g,id,order,rng=Math.random){
 if(!['draw','place'].includes(g.phase))throw Error('このフェイズでは操作できません。');
 if(g.orders[id])throw Error('既に確定済みです。');
 const p=g.players.find(p=>p.id===id);if(!p)throw Error('参加者が見つかりません。');
 if(g.phase==='draw'){
  if(!order||!Array.isArray(order.discard)||new Set(order.discard).size!==order.discard.length||order.discard.some(i=>!Number.isInteger(i)||i<0||i>=p.hand.length))throw Error('捨てるカードの指定が不正です。');
  g.orders[id]={discard:[...order.discard]};
 }else{previewPlacement(p,order?.moves);g.orders[id]={moves:clone(order.moves)};}
 g.revision++;
 if(!g.players.every(p=>g.orders[p.id]))return;
 if(g.phase==='draw'){
  // 全員の捨て札を先に集めてから配る。手札は補充前に選ぶ。
  for(const p of g.players){const remove=new Set(g.orders[p.id].discard);g.discard.push(...p.hand.filter((_,i)=>remove.has(i)));p.hand=p.hand.filter((_,i)=>!remove.has(i));}
  for(const p of g.players)drawToFive(g,p,rng);g.phase='place';g.orders={};
 }else{
  for(const p of g.players){const moves=g.orders[p.id].moves;const result=previewPlacement(p,moves);
   Object.assign(p,result.player);p.gold+=2-moves.length;
   log(g,`${p.name}：${result.placed.map(x=>CARD[x.card].name).join(' → ')||'配置なし'}${2-moves.length?`、${2-moves.length}金獲得`:''}`);
   for(const placed of result.placed)if(placed.bonuses.length)log(g,`${p.name}：配置ボーナス ${Object.entries(placed.rewards).filter(([,n])=>n).map(([s,n])=>`${{gold:'金',tech:'技術',faith:'信仰',vp:'VP'}[s]} +${n}`).join(' / ')}`);
  }g.orders={};resolveRound(g);
 }
}
export function nextRound(g){if(g.phase!=='round')throw Error('ラウンドの結果を確認してから進めてください。');g.round++;g.phase='draw';g.orders={};g.revision++;}
export function publicView(g,id){
 const view={round:g.round,phase:g.phase,settings:clone(g.settings),logs:clone(g.logs),winners:g.winners??[],revision:g.revision,deckCount:g.deck.length,discardCount:g.discard.length};
 view.players=g.players.map(p=>{const v=clone(p);v.handCount=v.hand.length;v.ready=!!g.orders[p.id];if(p.id!==id)delete v.hand;return v;});return view;
}
