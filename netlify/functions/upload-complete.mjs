import { mediaStore } from '../lib/stores.mjs';
import { isAuthed } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';
export default async (req,context)=>{
  if(!isAuthed(req)) return json({ok:false,error:'Unauthorized'},{status:401});
  const {id}=context.params||{}; const store=mediaStore();
  const key=`media/${id}/manifest.json`; const manifest=await store.get(key,{type:'json',consistency:'strong'});
  if(!manifest) return json({ok:false,error:'Upload not found'},{status:404});
  const missing=[];
  for(let i=0;i<manifest.totalChunks;i++){
    const meta=await store.getMetadata(`media/${id}/chunks/${String(i).padStart(6,'0')}`,{consistency:'strong'});
    if(!meta) missing.push(i);
    if(missing.length>8) break;
  }
  if(missing.length) return json({ok:false,error:'Upload is incomplete',missing},{status:409});
  manifest.complete=true; manifest.completedAt=new Date().toISOString(); await store.setJSON(key,manifest);
  return json({ok:true,id,url:`/media/${id}`});
};
export const config={path:'/api/upload/complete/:id',method:'POST'};
