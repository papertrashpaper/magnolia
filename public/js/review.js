const clone=x=>structuredClone(x);
export function roundReview(g){
 const r=g.resolution;
 return {round:g.round,players:g.players.map(p=>{
  const before=r.before.find(q=>q.id===p.id);
  return {id:p.id,name:p.name,before:Object.fromEntries(['gold','tech','faith','vp'].map(k=>[k,before[k]])),after:Object.fromEntries(['gold','tech','faith','vp'].map(k=>[k,p[k]])),steps:r.events.filter(e=>e.playerId===p.id&&e.phase!=='draw').map(e=>({phase:e.phase,title:e.title,changes:clone(e.changes)}))};
 })};
}
