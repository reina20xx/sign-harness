import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { sha256Hex, generateSignatureSeal } from './crypto/signature';
import { AGENT_TOOLS, handleAgentToolCall } from './agent/mcp';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'sign-harness', timestamp: new Date().toISOString() });
});

// List Contracts & Summary
app.get('/api/contracts', async (c) => {
  const contracts = await c.env.DB
    .prepare('SELECT * FROM contracts ORDER BY created_at DESC')
    .all();

  const logs = await c.env.DB
    .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 30')
    .all();

  return c.json({
    organization: c.env.ORGANIZATION_NAME || 'Harness Legal & Corp',
    contracts: contracts.results,
    recent_audit_logs: logs.results
  });
});

// Create Contract
app.post('/api/contracts', async (c) => {
  const body = await c.req.json();
  const { title, counterparty_name, counterparty_email, content_body } = body;

  if (!title || !counterparty_name || !counterparty_email || !content_body) {
    return c.json({ error: 'All contract fields are required' }, 400);
  }

  const res = await handleAgentToolCall('create_contract', {
    title,
    counterparty_name,
    counterparty_email,
    content_body
  }, c.env);

  return c.json({ success: true, ...res });
});

// Execute Digital Signature on Contract
app.post('/api/contracts/:id/sign', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const db = c.env.DB;

  const contract = await db
    .prepare('SELECT * FROM contracts WHERE id = ?')
    .bind(id)
    .first<any>();

  if (!contract) return c.json({ error: 'Contract not found' }, 404);
  if (contract.status === 'signed') {
    return c.json({ error: 'Contract is already signed' }, 400);
  }

  const signedAtIso = new Date().toISOString();
  const signerIp = c.req.header('cf-connecting-ip') || body.signer_ip || '127.0.0.1';
  const userAgent = c.req.header('user-agent') || 'SignHarness-Client/1.0';

  const sealHash = await generateSignatureSeal({
    contractId: id,
    documentSha256: contract.document_sha256,
    counterpartyEmail: contract.counterparty_email,
    signedAtIso,
    signerIp,
    secretKey: c.env.SIGNING_SECRET || 'default-secret'
  });

  await db
    .prepare(
      `UPDATE contracts 
       SET status = 'signed', signature_seal_hash = ?, signed_at = ?, signer_ip = ?, signer_user_agent = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(sealHash, signedAtIso, signerIp, userAgent, id)
    .run();

  await db
    .prepare(
      `INSERT INTO audit_logs (id, contract_id, event_type, actor_email, actor_ip, metadata_json)
       VALUES (?, ?, 'signed', ?, ?, ?)`
    )
    .bind(
      `aud_${crypto.randomUUID().slice(0, 8)}`,
      id,
      contract.counterparty_email,
      signerIp,
      JSON.stringify({ signature_seal_hash: sealHash, signed_at: signedAtIso, user_agent: userAgent })
    )
    .run();

  return c.json({
    success: true,
    contract_id: id,
    status: 'signed',
    document_sha256: contract.document_sha256,
    signature_seal_hash: sealHash,
    signed_at: signedAtIso
  });
});

// Verify Cryptographic Integrity
app.get('/api/contracts/:id/verify', async (c) => {
  const id = c.req.param('id');
  try {
    const verification = await handleAgentToolCall('verify_contract_integrity', { contract_id: id }, c.env);
    return c.json({ success: true, verification });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 404);
  }
});

// AI Agent MCP Endpoints
app.get('/api/agent/tools', (c) => c.json({ tools: AGENT_TOOLS }));

app.post('/api/agent/call', async (c) => {
  const { tool, arguments: args } = await c.req.json();
  try {
    const result = await handleAgentToolCall(tool, args, c.env);
    return c.json({ success: true, result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default app;
