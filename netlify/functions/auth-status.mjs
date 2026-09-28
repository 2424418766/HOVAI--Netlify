import { json } from '../lib/http.mjs';
import { isAuthed, isConfigured } from '../lib/auth.mjs';
export default async (req)=>json({ok:true,configured:isConfigured(),authenticated:isAuthed(req)});
export const config={path:'/api/auth/status',method:'GET'};
