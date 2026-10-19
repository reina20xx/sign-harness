import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import * as path from 'node:path';
import * as fs from 'node:fs';
import app from './index';
import { createLocalD1 } from './db/local-d1';
import { Env } from './types';

const PORT = 8789;
const schemaFile = path.resolve(__dirname, '../schema.sql');
const dbFile = path.resolve(__dirname, '../local.db');

console.log('⚡ Initializing local SQLite database for Sign Harness...');
const localD1 = createLocalD1(dbFile, schemaFile);

const localEnv: Env = {
  DB: localD1,
  ORGANIZATION_NAME: 'Harness Legal & Corp',
  SIGNING_SECRET: 'edge-cryptographic-hmac-secret-2026',
  AGENT_API_KEY: 'test-agent-key'
};

app.use('/*', serveStatic({ root: './public' }));
app.get('/', (c) => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf-8');
  return c.html(html);
});

console.log(`
=====================================================
🚀 Sign Harness Local Dev Server Running!
   URL: http://localhost:${PORT}
   Contracts API: http://localhost:${PORT}/api/contracts
   Agent Tools: http://localhost:${PORT}/api/agent/tools
=====================================================
`);

serve({
  fetch: (req) => app.fetch(req, localEnv),
  port: PORT
});
