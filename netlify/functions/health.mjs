import { json } from '../lib/http.mjs';
export default async () => json({ok:true, service:'hovai', adminPassword:Boolean(process.env.ADMIN_PASSWORD), sessionSecret:Boolean(process.env.SESSION_SECRET)});
export const config={path:'/api/health',method:'GET'};
