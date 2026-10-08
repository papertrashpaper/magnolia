import {writeFile} from 'node:fs/promises';
import {planningMatch,NEW_OPTIONS,DIR} from './benchmark-planning.mjs';
// Run after the parallel benchmark, without competing workers. Fixed seeds
// and seats are chosen independently of the observed winning treatments.
const records=[];
for(const seed of [810000,810001])for(const treatment of ['adaptive','planning']){
 const task={id:records.length,group:'timing',count:5,seed,focal:(seed-810000)%5,opponent:'balanced',treatment,options:NEW_OPTIONS};
 const match=planningMatch(task);
 records.push({task,rounds:match.rounds,timing:match.timing,meanDecisionMs:match.timing.totalMs/match.timing.decisions});
}
const result={createdAt:new Date().toISOString(),runtime:process.version,notes:'Single-process Node timing after benchmark workers finish; not browser latency. Two predefined five-player initial deals, paired treatments.',records};
await writeFile(DIR+'/timing.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
