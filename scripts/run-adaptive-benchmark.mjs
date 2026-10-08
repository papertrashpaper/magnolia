import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const validation=process.argv.includes('--validation'),args=process.argv.slice(2).filter(x=>x!=='--validation'),script=validation?'validate-adaptive-retention.mjs':'benchmark-adaptive-strategies.mjs',prefix=validation?'validation':args.includes('--pilot')?'pilot':'results',dir='research/adaptive-strategy-comparison';
for(let attempt=0;attempt<3;attempt++){
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/'+script,...args],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Benchmark exited with '+code)));});
 const config=JSON.parse(await readFile(dir+'/'+prefix+'-config.json','utf8')),rows=(await readFile(dir+'/'+prefix+'.jsonl','utf8')).split('\n').filter(Boolean).map(JSON.parse),ids=new Set(rows.map(r=>r.id));
 if(ids.size!==rows.length)throw Error('Duplicate checkpoint records');
 if(ids.size===config.games&&(config.pilot||Array.from({length:config.games},(_,i)=>i).every(i=>ids.has(i)))){console.log(JSON.stringify({checkpointVerified:true,games:config.games}));break;}
 if(attempt===2)throw Error('Incomplete checkpoint; rerun to resume');console.log(JSON.stringify({retryMissingRecords:true,persisted:ids.size,expected:config.games}));
}
