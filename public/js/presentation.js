import {clone,STAT_NAMES,statChanges} from './engine.js?v=2';
export const PHASE_NAMES={draw:'ドロー',place:'配置',war:'戦争',develop:'発展',income:'収入',vp:'VP',final:'最終得点'};
export function scoreRank(players,player){return 1+players.filter(p=>p.vp>player.vp).length;}
export function changeSentence(change){const {source,stat,delta,before,after}=change;return `${source}によって${STAT_NAMES[stat]}が${Math.abs(delta)}${delta>0?'増加':'減少'}！ (${before} → ${after})`;}
export function resolutionView(view,index){
 const r=view.resolution;if(!r)return view;
 const result={...view,players:r.before.map(p=>({...clone(p),...(p.id===view.you||p.id==='human'?{hand:view.players.find(q=>q.id===p.id)?.hand??[]}:{}),ready:false}))};
 for(const event of r.events.slice(0,index+1))if(event.after){const i=result.players.findIndex(p=>p.id===event.playerId);result.players[i]={...result.players[i],...clone(event.after)};}
 result.phase=r.events[index]?.phase??r.events[0]?.phase;return result;
}
export function undoChanges(before,after){return statChanges(before,after,'仮配置の取り消し');}
