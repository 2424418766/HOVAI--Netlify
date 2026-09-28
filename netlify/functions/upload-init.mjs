import { randomUUID } from 'node:crypto';
import { mediaStore } from '../lib/stores.mjs';
import { isAuthed } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';
const MAX_SIZE=300*1024*1024; const DEFAULT_CHUNK=3*1024*1024;
export default async (req)=>{
  if(!isAuthed(req)) return json({ok:false,error:'Unauthorized'},{status:401});
  let b={}; try{b=await req.json()}catch{return json({ok:false,error:'Invalid JSON'},{status:400})}
  const size=Number(b.size)||0; const chunkSize=Math.min(DEFAULT_CHUNK,Math.max(256*1024,Number(b.chunkSize)||DEFAULT_CHUNK));
  if(size<=0 || size>MAX_SIZE) return json({ok:false,error:'File must be between 1 byte and 300 MB'},{status:400});
  const id=randomUUID(); const totalChunks=Math.ceil(size/chunkSize);
  const manifest={id,name:String(b.name||'upload'),type:String(b.type||'application/octet-stream'),size,chunkSize,totalChunks,complete:false,createdAt:new Date().toISOString()};
  await mediaStore().setJSON(`media/${id}/manifest.json`,manifest);
  return json({ok:true,id,url:`/media/${id}`,chunkSize,totalChunks});
};
export const config={path:'/api/upload/init',method:'POST'};
