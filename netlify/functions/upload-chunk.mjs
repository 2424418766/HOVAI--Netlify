import { mediaStore } from '../lib/stores.mjs';
import { isAuthed } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';
export default async (req,context)=>{
  if(!isAuthed(req)) return json({ok:false,error:'Unauthorized'},{status:401});
  const {id,index}=context.params||{}; const i=Number(index);
  if(!id || !Number.isInteger(i) || i<0) return json({ok:false,error:'Invalid upload path'},{status:400});
  const store=mediaStore(); const manifest=await store.get(`media/${id}/manifest.json`,{type:'json',consistency:'strong'});
  if(!manifest) return json({ok:false,error:'Upload not found'},{status:404});
  if(i>=manifest.totalChunks) return json({ok:false,error:'Chunk index out of range'},{status:400});
  const ab=await req.arrayBuffer();
  if(ab.byteLength<=0 || ab.byteLength>manifest.chunkSize+1024) return json({ok:false,error:'Invalid chunk size'},{status:400});
  await store.set(`media/${id}/chunks/${String(i).padStart(6,'0')}`,ab);
  return json({ok:true,index:i,bytes:ab.byteLength});
};
export const config={path:'/api/upload/chunk/:id/:index',method:'POST'};
