import { mediaStore } from '../lib/stores.mjs';
const MAX_RESPONSE=4*1024*1024;
function parseRange(h,total){
  if(!h || !h.startsWith('bytes=')) return null;
  const m=/bytes=(\d*)-(\d*)/.exec(h); if(!m) return null;
  let start=m[1]?Number(m[1]):0; let end=m[2]?Number(m[2]):total-1;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||start>=total||end<start) return null;
  end=Math.min(end,total-1,start+MAX_RESPONSE-1); return {start,end};
}
async function readSpan(store,manifest,start,end){
  const first=Math.floor(start/manifest.chunkSize), last=Math.floor(end/manifest.chunkSize); const parts=[];
  for(let i=first;i<=last;i++){
    const ab=await store.get(`media/${manifest.id}/chunks/${String(i).padStart(6,'0')}`,{type:'arrayBuffer'});
    if(!ab) throw new Error(`Missing media chunk ${i}`);
    const chunkStart=i*manifest.chunkSize; const from=Math.max(0,start-chunkStart), to=Math.min(ab.byteLength,end-chunkStart+1);
    parts.push(new Uint8Array(ab,from,Math.max(0,to-from)));
  }
  const len=parts.reduce((n,p)=>n+p.byteLength,0); const out=new Uint8Array(len); let pos=0; for(const p of parts){out.set(p,pos);pos+=p.byteLength} return out;
}
export default async (req,context)=>{
  const id=context.params?.id; if(!id) return new Response('Not found',{status:404});
  try{
    const store=mediaStore(); const manifest=await store.get(`media/${id}/manifest.json`,{type:'json'});
    if(!manifest?.complete) return new Response('Not found',{status:404});
    const common={'content-type':manifest.type||'application/octet-stream','accept-ranges':'bytes','cache-control':'public, max-age=31536000, immutable','content-disposition':`inline; filename*=UTF-8''${encodeURIComponent(manifest.name||'media')}`};
    if(req.method==='HEAD') return new Response(null,{status:200,headers:{...common,'content-length':String(manifest.size)}});
    const asked=parseRange(req.headers.get('range'),manifest.size);
    const range=asked || (manifest.size>MAX_RESPONSE?{start:0,end:Math.min(manifest.size-1,MAX_RESPONSE-1)}:{start:0,end:manifest.size-1});
    const bytes=await readSpan(store,manifest,range.start,range.end);
    const partial=Boolean(asked)||manifest.size>MAX_RESPONSE;
    const headers={...common,'content-length':String(bytes.byteLength)};
    if(partial) headers['content-range']=`bytes ${range.start}-${range.end}/${manifest.size}`;
    return new Response(bytes,{status:partial?206:200,headers});
  }catch(err){console.error(err);return new Response('Media error',{status:500})}
};
export const config={path:'/media/:id',method:['GET','HEAD']};
