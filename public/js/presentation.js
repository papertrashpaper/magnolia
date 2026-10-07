import {clone,STAT_NAMES,statChanges,level} from './engine.js?v=3';
export const PHASE_NAMES={draw:'ドロー',place:'配置',war:'戦争',develop:'発展',income:'収入',vp:'VP',final:'最終得点'};
export function scoreRank(players,player){return 1+players.filter(p=>p.vp>player.vp).length;}
export function changeSentence(change){const {source,stat,delta,before,after}=change;return `${source}によって${STAT_NAMES[stat]}が${Math.abs(delta)}${delta>0?'増加':'減少'}！ (${before} → ${after})`;}
export function levelChangeSentence(change){
 if(!['tech','faith'].includes(change.stat))return '';
 const name=change.stat==='tech'?'技術':'信仰',before=level(change.before),after=level(change.after);
 return before===after?`${name}レベルはLv.${after}のまま。`:`${name}レベルも${Math.abs(after-before)}${after>before?'上昇':'低下'}！ (Lv.${before} → Lv.${after})`;
}
export function levelProgress(points){
 const thresholds=[0,1,3,7,15],lv=level(points),next=thresholds[lv+1]??null;
 return {level:lv,percent:lv===4?100:(lv+(points-thresholds[lv])/(next-thresholds[lv]))*25,next,remaining:next===null?0:next-points};
}
export function battleRank(players,p){return 1+players.filter(q=>q.power>p.power).length;}
export function resolutionView(view,index){
 const r=view.resolution;if(!r)return view;
 const result={...view,logs:view.logs.filter(l=>l.round<r.round),players:r.before.map(p=>({...clone(p),...(p.id===view.you||p.id==='human'?{hand:view.players.find(q=>q.id===p.id)?.hand??[]}:{}),ready:false}))};
 for(const event of r.events.slice(0,index+1))if(event.after){const i=result.players.findIndex(p=>p.id===event.playerId);result.players[i]={...result.players[i],...clone(event.after)};}
 result.phase=r.events[index]?.phase??r.events[0]?.phase;return result;
}
export function undoChanges(before,after){return statChanges(before,after,'仮配置の取り消し');}
