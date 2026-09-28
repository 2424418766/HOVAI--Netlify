import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createHandler } from '../netlify/functions/api-core.mjs';
import { SEED_DATA, applyImports, validate } from '../netlify/functions/catalog.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const stores = new Map();
function makeStore(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const map = stores.get(name);
  return {
    async get(key, options = {}) {
      const item = map.get(key); if (!item) return null;
      return options.type === 'arrayBuffer' ? item.value.buffer.slice(item.value.byteOffset, item.value.byteOffset + item.value.byteLength) : new TextDecoder().decode(item.value);
    },
    async getWithMetadata(key) {
      const item = map.get(key); return item ? { data: new TextDecoder().decode(item.value), etag: item.etag } : null;
    },
    async set(key, value, options = {}) {
      const prior = map.get(key);
      if (options.onlyIfNew && prior) return { modified: false };
      if (options.onlyIfMatch && prior?.etag !== options.onlyIfMatch) return { modified: false };
      const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value);
      const etag = `"test-${crypto.randomUUID()}"`;
      map.set(key, { value: bytes, etag }); return { modified: true, etag };
    },
    async delete(key) { map.delete(key); },
  };
}
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.SESSION_SECRET = 'test-session-secret-long-enough';
const handler = createHandler({ getStore: makeStore, seed: SEED_DATA, applyImports, validate });
const request = (path, method = 'GET', body, headers = {}) => new Request(`https://portfolio.example${path}`, { method, body, headers });

const initial = await handler(request('/api/portfolio'));
assert.equal(initial.status, 200);
const initialBody = await initial.json();
assert.equal(initialBody.canEdit, false);
assert.ok(initialBody.data.projects.length > 0);

assert.equal((await handler(request('/api/portfolio', 'PUT', JSON.stringify(initialBody.data), { 'Content-Type': 'application/json', 'If-Match': 'seed' }))).status, 401);
const login = await handler(request('/api/auth/login', 'POST', JSON.stringify({ password: 'test-admin-password' }), { 'Content-Type': 'application/json' }));
assert.equal(login.status, 200);
const { token } = await login.json();
const auth = { Authorization: `Bearer ${token}` };
const editable = await handler(request('/api/portfolio', 'GET', undefined, auth));
assert.equal((await editable.json()).canEdit, true);

const saved = await handler(request('/api/portfolio', 'PUT', JSON.stringify(initialBody.data), { ...auth, 'Content-Type': 'application/json', 'If-Match': 'seed' }));
assert.equal(saved.status, 200);
const savedBody = await saved.json();
assert.ok(savedBody.etag);
const conflict = await handler(request('/api/portfolio', 'PUT', JSON.stringify(initialBody.data), { ...auth, 'Content-Type': 'application/json', 'If-Match': 'seed' }));
assert.equal(conflict.status, 409);

const bytes = new Uint8Array(4 * 1024 * 1024 + 32); bytes.set([0, 0, 0, 24, 102, 116, 121, 112], 0);
const start = await handler(request('/api/upload/start', 'POST', JSON.stringify({ contentType: 'video/mp4', size: bytes.length, name: 'sample.mp4' }), { ...auth, 'Content-Type': 'application/json' }));
assert.equal(start.status, 200);
const session = await start.json();
for (let part = 0; part < session.parts; part++) {
  const chunk = bytes.subarray(part * session.chunkSize, Math.min(bytes.length, (part + 1) * session.chunkSize));
  const response = await handler(request(`/api/upload/chunk/${session.id}/${part}`, 'PUT', chunk, auth));
  assert.equal(response.status, 200);
}
const finished = await handler(request(`/api/upload/finish/${session.id}`, 'POST', undefined, auth));
assert.equal(finished.status, 200);
const media = await (await finished.json()).src;
const ranged = await handler(request(media, 'GET', undefined, { Range: 'bytes=0-99' }));
assert.equal(ranged.status, 206);
assert.equal((await ranged.arrayBuffer()).byteLength, 100);
console.log('Netlify API smoke tests passed: public portfolio, password login, protected save, atomic conflict detection, chunk upload, video byte ranges.');
