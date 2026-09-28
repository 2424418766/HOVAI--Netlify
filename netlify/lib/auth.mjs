import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'hovai_session';
const TTL = 60 * 60 * 24 * 7;

function b64url(buf){ return Buffer.from(buf).toString('base64url'); }
function secret(){ return process.env.SESSION_SECRET || ''; }
function signature(ts){ return b64url(createHmac('sha256', secret()).update(String(ts)).digest()); }
function parseCookies(req){
  const raw=req.headers.get('cookie')||'';
  return Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
}
export function isConfigured(){ return Boolean(process.env.ADMIN_PASSWORD && secret().length >= 24); }
export function passwordMatches(input){
  const expected=String(process.env.ADMIN_PASSWORD||''); const got=String(input||'');
  const a=Buffer.from(expected); const b=Buffer.from(got);
  if(a.length!==b.length) return false;
  return timingSafeEqual(a,b);
}
export function createSessionCookie(req){
  const ts=Math.floor(Date.now()/1000); const value=`${ts}.${signature(ts)}`;
  const secure=new URL(req.url).protocol==='https:' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL}${secure}`;
}
export function clearSessionCookie(req){
  const secure=new URL(req.url).protocol==='https:' ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
export function isAuthed(req){
  if(!isConfigured()) return false;
  const value=parseCookies(req)[COOKIE]; if(!value) return false;
  const [tsRaw,sig]=value.split('.'); const ts=Number(tsRaw);
  if(!Number.isFinite(ts) || !sig || Math.floor(Date.now()/1000)-ts > TTL || ts > Math.floor(Date.now()/1000)+60) return false;
  const expected=signature(ts); const a=Buffer.from(expected); const b=Buffer.from(sig);
  return a.length===b.length && timingSafeEqual(a,b);
}
