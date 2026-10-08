import assert from 'node:assert/strict';
import {records} from './analyze-strategies.mjs';
import {match} from './benchmark-strategies.mjs';
const id=Number(process.argv[2]??0),saved=(await records()).find(r=>r.id===id);
if(!saved)throw Error('Unknown match ID: '+id);
const {group,lineup,seed,warVP,variant,beam}=saved;
assert.deepEqual(match({id,group,lineup,seed,warVP,variant,beam}),saved);
console.log(JSON.stringify({reproduced:true,id,lineup,seed,rounds:saved.rounds,winners:saved.players.filter(p=>p.win).map(p=>p.strategy)}));
