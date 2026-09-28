import { json, methodNotAllowed } from '../lib/http.mjs';
import { isConfigured, passwordMatches, createSessionCookie } from '../lib/auth.mjs';
export default async (req)=>{
  if(req.method!=='POST') return methodNotAllowed();
  if(!isConfigured()) return json({ok:false,error:'Admin is not configured. Add ADMIN_PASSWORD and SESSION_SECRET in Netlify environment variables.'},{status:503});
  let body={}; try{body=await req.json()}catch{}
  if(!passwordMatches(body.password)) return json({ok:false,error:'Incorrect password'},{status:401});
  return json({ok:true},{headers:{'set-cookie':createSessionCookie(req)}});
};
export const config={path:'/api/auth/login',method:'POST'};
