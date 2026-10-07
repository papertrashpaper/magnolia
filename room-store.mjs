import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {deflateSync,inflateSync} from 'node:zlib';
export const ROOM_TTL=7*24*3600000;
export function roomData(room){const {streams,backup,...data}=room;return data;}
export function makeRoomStore({key=process.env.ROOM_BACKUP_KEY,file=process.env.ROOM_STORE_FILE}={}){
 const secret=key?Buffer.from(key,'hex'):randomBytes(32);
 if(secret.length!==32)throw Error('ROOM_BACKUP_KEY must be 32 bytes in hex');
 const seal=data=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);const bytes=Buffer.concat([cipher.update(deflateSync(Buffer.from(JSON.stringify(data)))),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64url');};
 const open=token=>{
  try{const bytes=Buffer.from(String(token),'base64url');const decipher=createDecipheriv('aes-256-gcm',secret,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));const data=JSON.parse(inflateSync(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]),{maxOutputLength:4000000}));
   if(!data.code||!Array.isArray(data.members)||Date.now()-data.updated>ROOM_TTL)throw Error();return data;
  }catch{throw Error('保存データを復元できません。保存期限は最後の操作から7日間です。');}
 };
 return {seal,open,
  load(){if(!file)return [];try{return JSON.parse(readFileSync(file,'utf8')).map(open);}catch(e){if(e.code==='ENOENT')return [];throw e;}},
  save(rooms){if(!file)return;mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';writeFileSync(temp,JSON.stringify([...rooms.values()].map(r=>seal(roomData(r)))),{mode:0o600});renameSync(temp,file);}
 };
}
