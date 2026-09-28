import { json } from '../lib/http.mjs';
import { clearSessionCookie } from '../lib/auth.mjs';
export default async (req)=>json({ok:true},{headers:{'set-cookie':clearSessionCookie(req)}});
export const config={path:'/api/auth/logout',method:'POST'};
