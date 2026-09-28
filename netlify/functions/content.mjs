import defaults from '../lib/default-content.mjs';
import { contentStore } from '../lib/stores.mjs';
import { isAuthed } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';
const KEY='site.json';
export default async (req)=>{
  if(req.method==='GET'){
    try{
      const stored=await contentStore().get(KEY,{type:'json',consistency:'strong'});
      return json(stored || defaults,{headers:{'x-hovai-storage':stored?'blobs':'default'}});
    }catch(err){
      console.error('content GET fallback',err);
      return json(defaults,{headers:{'x-hovai-storage':'fallback'}});
    }
  }
  if(req.method==='PUT'){
    if(!isAuthed(req)) return json({ok:false,error:'Unauthorized'},{status:401});
    try{
      const body=await req.json();
      if(!body || !Array.isArray(body.categories) || !Array.isArray(body.projects)) return json({ok:false,error:'Invalid content structure'},{status:400});
      body.version=(Number(body.version)||0)+1;
      await contentStore().setJSON(KEY,body);
      return json({ok:true,version:body.version});
    }catch(err){
      console.error(err); return json({ok:false,error:err.message||'Save failed'},{status:500});
    }
  }
  return json({ok:false,error:'Method not allowed'},{status:405});
};
export const config={path:'/api/content',method:['GET','PUT']};
