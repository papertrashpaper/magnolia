import {candidatesFor as originalCandidates,evaluateCandidate,selectCandidate} from './diagnose-planning.mjs';
import {knownHandPlans} from './planning-strategies.mjs';
import {geometryPlans} from './geometry-plans.mjs';
export function candidatesFor(state){
 const {p,opponents,settings}=state;
 const baseline=originalCandidates(p,opponents,settings).filter(c=>!c.extra);
 const added=[];
 for(const [group,generate]of [['wide',knownHandPlans],['geometry',geometryPlans]])for(const frontline of [false,true]){
  const plans=generate(p,opponents,settings,{rounds:4,beam:16,finalists:3,frontline});
  plans.forEach((plan,i)=>added.push({...plan,id:group+'-'+(frontline?'front':'balanced')+'-'+i,key:'balanced',extra:true,group}));
 }
 return [...baseline,...added];
}
export function diagnose(state){
 const start=performance.now(),candidates=candidatesFor(state),generatedMs=performance.now()-start,cache=new Map();
 const {p,opponents,settings,discard,round,phase}=state;
 const evaluations=candidates.map(candidate=>{
  const key=JSON.stringify([candidate.schedule??null,candidate.schedule?'balanced':candidate.key]);
  if(!cache.has(key))cache.set(key,{train:[0,1,2].map(w=>evaluateCandidate(p,opponents,settings,discard,round,phase,candidate,w)),audit:[100,101,102].map(w=>evaluateCandidate(p,opponents,settings,discard,round,phase,candidate,w))});
  return {...candidate,...cache.get(key)};
 });
 const choices={};for(const group of ['baseline','wide','geometry'])for(const worlds of [1,3]){
  const allowed=evaluations.filter(e=>!e.extra||e.group===group);choices[group+worlds]=selectCandidate(allowed,{expanded:true,worlds}).id;
 }
 return {state,evaluations,choices,generatedMs,timingMs:performance.now()-start,uniqueCandidates:cache.size};
}
