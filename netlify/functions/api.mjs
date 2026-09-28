import { getStore } from '@netlify/blobs';
import { createHandler } from './api-core.mjs';
import { SEED_DATA, applyImports, validate } from './catalog.mjs';

const handler = createHandler({ getStore, seed: SEED_DATA, applyImports, validate });
export default handler;
export const config = { path: ['/api/*', '/media/*'] };
