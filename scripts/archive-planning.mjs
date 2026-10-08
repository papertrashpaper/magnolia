import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const dir='research/planning-cpu',manifest={},hash=b=>createHash('sha256').update(b).digest('hex');
for(const prefix of ['results','validation']){
 const raw=await readFile(`${dir}/${prefix}.jsonl`),rows=raw.toString().trim().split('\n').map(JSON.parse);
 const config=JSON.parse(await readFile(`${dir}/${prefix}-config.json`,'utf8'));
 if(rows.length!==config.games||new Set(rows.map(r=>r.id)).size!==config.games)throw Error('Incomplete benchmark');
 const compressed=gzipSync(raw,{level:9}),parts=[];
 if(!gunzipSync(compressed).equals(raw))throw Error('Compression mismatch');
 for(let offset=0,index=0;offset<compressed.length;offset+=98304,index++){
  const bytes=compressed.subarray(offset,offset+98304),file=`${prefix}.jsonl.gz.part${String(index).padStart(3,'0')}`;
  await writeFile(`${dir}/${file}`,bytes);parts.push({file,bytes:bytes.length,sha256:hash(bytes)});
 }
 manifest[prefix]={games:rows.length,bytes:compressed.length,sha256:hash(compressed),rawSha256:hash(raw),parts};
}
await writeFile(`${dir}/archives.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest));
