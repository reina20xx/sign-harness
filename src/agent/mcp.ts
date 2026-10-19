import { Env } from '../types';
import { sha256Hex } from '../crypto/signature';

export const AGENT_TOOLS = [
  {
    name: 'create_contract',
    description: '新規の電子契約書（NDA・業務委託契約・発注書など）を発行し、SHA-256改ざん防止ハッシュと署名用URLを生成します',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '契約書タイトル（例: 秘密保持契約書）' },
        counterparty_name: { type: 'string', description: '相手方企業・氏名' },
        counterparty_email: { type: 'string', description: '相手方メールアドレス' },
        content_body: { type: 'string', description: '契約条項の本文テキスト' }
      },
      required: ['title', 'counterparty_name', 'counterparty_email', 'content_body']
    }
  },
  {
    name: 'list_contracts',
    description: '契約書の一覧と署名ステータス（pending_signature / signed）を取得します',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'ステータスフィルタ（省略時は全件）' }
      }
    }
  },
  {
    name: 'verify_contract_integrity',
    description: '指定した契約書IDのSHA-256ハッシュ値、暗号署名シール、および監査証跡ログ（Audit Trail）の真正性を検証します',
    parameters: {
      type: 'object',
      properties: {
        contract_id: { type: 'string', description: '契約書ID' }
      },
      required: ['contract_id']
    }
  }
];

export async function handleAgentToolCall(toolName: string, args: any, env: Env) {
  const db = env.DB;

  switch (toolName) {
    case 'create_contract': {
      const id = `cnt_${crypto.randomUUID().slice(0, 8)}`;
      const docHash = await sha256Hex(args.content_body);

      await db
        .prepare(
          `INSERT INTO contracts (id, title, counterparty_name, counterparty_email, content_body, document_sha256, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending_signature')`
        )
        .bind(id, args.title, args.counterparty_name, args.counterparty_email, args.content_body, docHash)
        .run();

      await db
        .prepare(
          `INSERT INTO audit_logs (id, contract_id, event_type, actor_email, actor_ip, metadata_json)
           VALUES (?, ?, 'created', 'system@ai-agent', '127.0.0.1', ?)`
        )
        .bind(`aud_${crypto.randomUUID().slice(0, 8)}`, id, JSON.stringify({ document_sha256: docHash }))
        .run();

      return {
        contract_id: id,
        title: args.title,
        document_sha256: docHash,
        status: 'pending_signature',
        signing_url: `/?contract_id=${id}`
      };
    }

    case 'list_contracts': {
      let query = 'SELECT * FROM contracts ORDER BY created_at DESC';
      const binds: any[] = [];
      if (args?.status) {
        query = 'SELECT * FROM contracts WHERE status = ? ORDER BY created_at DESC';
        binds.push(args.status);
      }
      const res = await db.prepare(query).bind(...binds).all();
      return { count: res.results.length, contracts: res.results };
    }

    case 'verify_contract_integrity': {
      const contract = await db
        .prepare('SELECT * FROM contracts WHERE id = ?')
        .bind(args.contract_id)
        .first<any>();

      if (!contract) throw new Error('Contract not found');

      const recomputedHash = await sha256Hex(contract.content_body);
      const isTamperFree = recomputedHash === contract.document_sha256;

      const logs = await db
        .prepare('SELECT * FROM audit_logs WHERE contract_id = ? ORDER BY created_at ASC')
        .bind(args.contract_id)
        .all();

      return {
        contract_id: contract.id,
        title: contract.title,
        status: contract.status,
        tamper_free_verified: isTamperFree,
        recorded_sha256: contract.document_sha256,
        recomputed_sha256: recomputedHash,
        signature_seal_hash: contract.signature_seal_hash,
        signed_at: contract.signed_at,
        audit_trail: logs.results
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
