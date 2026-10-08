import assert from 'node:assert/strict';
import {readResults} from './analyze-adaptive-strategies.mjs';
import {royalMatch} from './benchmark-royal-route.mjs';
import {adaptiveMatch} from './benchmark-adaptive-strategies.mjs';
const id=Number(process.argv[2]??0),saved=(await readResults(process.argv.includes('--royal')?'royal':process.argv.includes('--validation')?'validation':'results')).find(r=>r.id===id);if(!saved)throw Error('Unknown match ID');
const {options,group,seed,controllers,focal,treatment,card}=saved,task={id,options,group,seed,controllers,focal};if(treatment)task.treatment=treatment;if(card)task.card=card;
if(process.argv.includes('--royal'))assert.deepEqual(royalMatch({id,options:saved.options,count:saved.count,seed:saved.seed,focal:saved.focal,treatment:saved.treatment}),saved);else assert.deepEqual(adaptiveMatch(task),saved);console.log(JSON.stringify({reproduced:true,id,group,seed,rounds:saved.rounds}));
