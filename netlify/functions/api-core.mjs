const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});
const b64url = bytes => Buffer.from(bytes).toString('base64url');
const fromB64url = value => Buffer.from(value, 'base64url');
const equal = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
};
const mimeFor = key => key.endsWith('.mp4') ? 'video/mp4' : key.endsWith('.webm') ? 'video/webm' : 'image/jpeg';
const CHUNK_SIZE = 4 * 1024 * 1024;
const MEDIA_MAX = 80 * 1024 * 1024;
const IMAGE_MAX = 40 * 1024 * 1024;

export function createHandler({ getStore, seed, applyImports, validate, now = () => Date.now() }) {
  async function issueToken(secret) {
    const payload = b64url(Buffer.from(JSON.stringify({ sub: 'admin', exp: now() + 12 * 60 * 60 * 1000 })));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    return `${payload}.${b64url(signature)}`;
  }
  async function validToken(request, secret) {
    if (!secret) return false;
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token || !token.includes('.')) return false;
    const [payload, signature] = token.split('.');
    try {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
      const body = JSON.parse(fromB64url(payload).toString('utf8'));
      return equal(expected, fromB64url(signature)) && body.sub === 'admin' && body.exp > now();
    } catch { return false; }
  }
  async function readPortfolio(store) {
    const saved = await store.getWithMetadata('portfolio.json', { type: 'text', consistency: 'strong' });
    if (!saved) return { data: applyImports(structuredClone(seed)), etag: 'seed' };
    return { data: applyImports(JSON.parse(saved.data)), etag: saved.etag };
  }
  async function metadata(store, id) {
    const text = await store.get(`_uploads/${id}.json`, { type: 'text' });
    return text ? JSON.parse(text) : null;
  }
  async function cleanUpload(store, id, parts) {
    await Promise.all(Array.from({ length: parts }, (_, n) => store.delete(`_uploads/${id}/${n}`)));
    await store.delete(`_uploads/${id}.json`);
  }
  async function upload(request, url, store) {
    if (url.pathname === '/api/upload/start' && request.method === 'POST') {
      const input = await request.json();
      const contentType = String(input.contentType || '').toLowerCase();
      const isVideo = ['video/mp4', 'video/webm'].includes(contentType);
      const max = isVideo ? MEDIA_MAX : IMAGE_MAX;
      if (!(isVideo || contentType === 'image/jpeg') || !Number.isSafeInteger(input.size) || input.size < 4 || input.size > max) return json({ error: `文件格式或大小不正确，最大 ${isVideo ? '80MB' : '40MB'}` }, 400);
      const id = crypto.randomUUID();
      const parts = Math.ceil(input.size / CHUNK_SIZE);
      await store.set(`_uploads/${id}.json`, JSON.stringify({ id, contentType, size: input.size, parts, name: String(input.name || '').slice(0, 300), createdAt: now() }));
      return json({ id, chunkSize: CHUNK_SIZE, parts });
    }
    const chunkMatch = url.pathname.match(/^\/api\/upload\/chunk\/([a-f0-9-]{36})\/(\d+)$/);
    if (chunkMatch && request.method === 'PUT') {
      const [, id, partText] = chunkMatch;
      const meta = await metadata(store, id), part = Number(partText);
      if (!meta || now() - meta.createdAt > 24 * 60 * 60 * 1000 || !Number.isInteger(part) || part < 0 || part >= meta.parts) return json({ error: '上传会话已失效，请重新上传' }, 404);
      const bytes = new Uint8Array(await request.arrayBuffer());
      const expectedLength = part === meta.parts - 1 ? meta.size - part * CHUNK_SIZE : CHUNK_SIZE;
      if (bytes.length !== expectedLength) return json({ error: '分块大小不匹配，请重试' }, 400);
      await store.set(`_uploads/${id}/${part}`, bytes);
      return json({ ok: true });
    }
    const finishMatch = url.pathname.match(/^\/api\/upload\/finish\/([a-f0-9-]{36})$/);
    if (finishMatch && request.method === 'POST') {
      const id = finishMatch[1], meta = await metadata(store, id);
      if (!meta || now() - meta.createdAt > 24 * 60 * 60 * 1000) return json({ error: '上传会话已失效，请重新上传' }, 404);
      const chunks = [];
      for (let part = 0; part < meta.parts; part++) {
        const value = await store.get(`_uploads/${id}/${part}`, { type: 'arrayBuffer' });
        if (!value) return json({ error: `上传中断，请重试第 ${part + 1} 个分块` }, 400);
        chunks.push(new Uint8Array(value));
      }
      const bytes = new Uint8Array(meta.size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const jpeg = meta.contentType === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const mp4 = meta.contentType === 'video/mp4' && bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp';
      const webm = meta.contentType === 'video/webm' && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
      if (!(jpeg || mp4 || webm)) { await cleanUpload(store, id, meta.parts); return json({ error: '文件内容与格式不匹配' }, 400); }
      const ext = jpeg ? 'jpg' : mp4 ? 'mp4' : 'webm';
      const key = `${id}.${ext}`;
      await store.set(key, bytes, { metadata: { contentType: meta.contentType, name: meta.name } });
      await cleanUpload(store, id, meta.parts);
      return json({ src: `/media/${key}` });
    }
    return json({ error: '找不到此操作' }, 404);
  }
  async function media(request, url, store) {
    const match = url.pathname.match(/^\/media\/([a-f0-9-]{36}\.(?:jpg|mp4|webm))$/);
    if (!match || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
    const key = match[1], mime = mimeFor(key), value = await store.get(key, { type: 'arrayBuffer' });
    if (!value) return new Response('Not found', { status: 404 });
    const bytes = new Uint8Array(value), video = mime.startsWith('video/');
    const range = request.headers.get('Range');
    let start = 0, end = bytes.length - 1, status = 200;
    if (video) {
      const parsed = range?.match(/^bytes=(\d*)-(\d*)$/);
      if (parsed) {
        if (parsed[1] === '' && parsed[2] !== '') { const suffix = Math.max(1, Number(parsed[2])); start = Math.max(0, bytes.length - suffix); }
        else { start = Number(parsed[1] || 0); if (parsed[2]) end = Math.min(end, Number(parsed[2])); }
        if (start >= bytes.length || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.length}`, 'Accept-Ranges': 'bytes' } });
        end = Math.min(end, start + CHUNK_SIZE - 1, bytes.length - 1); status = 206;
      } else if (bytes.length > CHUNK_SIZE) { end = CHUNK_SIZE - 1; status = 206; }
    }
    const slice = bytes.subarray(start, end + 1), headers = {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': video ? 'bytes' : 'none',
      'Content-Length': String(slice.length),
    };
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
    return new Response(request.method === 'HEAD' ? null : slice, { status, headers });
  }

  return async request => {
    try {
      const url = new URL(request.url), { pathname } = url;
      if (pathname.startsWith('/media/')) return await media(request, url, getStore('hovai-media'));
      if (!pathname.startsWith('/api/')) return json({ error: '找不到此操作' }, 404);
      const isLogin = pathname === '/api/auth/login' && request.method === 'POST';
      if (isLogin) {
        const { password } = await request.json();
        if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return json({ error: 'Netlify 环境变量尚未配置管理员密码' }, 503);
        if (typeof password !== 'string' || !equal(password, process.env.ADMIN_PASSWORD)) return json({ error: '密码不正确' }, 401);
        return json({ token: await issueToken(process.env.SESSION_SECRET) });
      }
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, PUT, POST, OPTIONS' } });
      if (pathname === '/api/portfolio' && request.method === 'GET') {
        const current = await readPortfolio(getStore('hovai-portfolio'));
        return json({ data: current.data, etag: current.etag, canEdit: await validToken(request, process.env.SESSION_SECRET) }, 200, { ETag: current.etag === 'seed' ? '"seed"' : current.etag });
      }
      const authorized = await validToken(request, process.env.SESSION_SECRET);
      if (!authorized) return json({ error: '管理员登录已失效，请重新登录后再试' }, 401);
      if (pathname === '/api/portfolio' && request.method === 'PUT') {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > 1_000_000) return json({ error: '内容过大' }, 413);
        let data;
        try { data = validate(JSON.parse(raw)); } catch (error) { return json({ error: error.message || '内容格式不正确' }, 400); }
        const store = getStore('hovai-portfolio'), current = await readPortfolio(store), expected = request.headers.get('If-Match');
        if (!expected) return json({ error: '请重新加载网站后再保存' }, 428);
        if (expected !== current.etag) return json({ error: '网站内容已在其他窗口更新。请重新打开页面核对后再保存。' }, 409);
        const result = await store.set('portfolio.json', JSON.stringify(data), current.etag === 'seed' ? { metadata: { contentType: 'application/json' }, onlyIfNew: true } : { metadata: { contentType: 'application/json' }, onlyIfMatch: current.etag });
        if (!result.modified) return json({ error: '网站内容已在其他窗口更新。请重新打开页面核对后再保存。' }, 409);
        return json({ etag: result.etag });
      }
      if (pathname.startsWith('/api/upload/')) return await upload(request, url, getStore('hovai-media'));
      return json({ error: '找不到此操作' }, 404);
    } catch (error) {
      console.error('HOVAI API error', error);
      return json({ error: '暂时无法完成操作，请检查 Netlify 存储配置后重试。当前修改仍保留在页面中。' }, 500);
    }
  };
}
