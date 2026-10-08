import {OBJECTIVE,objectiveProgress} from './objectives.js?v=3';
// Only public numbers and board counts trigger a letter; no hand search or route suggestions.
export function objectiveAlerts(view,you,draft,{playback=false}={}){
 if(playback||view.phase==='ended')return {own:[],rivals:[]};
 const own=[],rivals=[];
 for(const goal of view.objectives??[]){
  if(goal.claimedBy?.length)continue;
  const o=OBJECTIVE[goal.id];if(!o)continue;
  const progress=objectiveProgress(draft,goal.id);
  if(progress.met||progress.near)own.push({goal,o,progress});
  const players=view.players.filter(p=>p.id!==you).map(p=>({id:p.id,name:p.name,progress:objectiveProgress(p,goal.id)})).filter(p=>p.progress.met||p.progress.near);
  if(players.length)rivals.push({goal,o,players});
 }
 return {own,rivals};
}
