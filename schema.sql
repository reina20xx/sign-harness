-- Sign Harness: D1 Database Schema
-- Tamper-Proof E-Signature, SHA-256 Document Hashing & Immutable Audit Trail

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  counterparty_name TEXT NOT NULL,
  counterparty_email TEXT NOT NULL,
  content_body TEXT NOT NULL,
  document_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'pending_signature', 'signed', 'voided')) DEFAULT 'pending_signature',
  signature_seal_hash TEXT,
  signed_at DATETIME,
  signer_ip TEXT,
  signer_user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'created', 'viewed', 'signed', 'verified'
  actor_email TEXT,
  actor_ip TEXT,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_audit_contract ON audit_logs(contract_id);

-- Initial Seed Data
INSERT OR IGNORE INTO contracts (
  id, title, counterparty_name, counterparty_email, content_body, document_sha256, status, signature_seal_hash, signed_at, signer_ip
) VALUES
(
  'cnt_nda_01',
  '秘密保持契約書 (NDA)',
  '株式会社ネクストイノベーション 代表取締役 佐藤 健二',
  'k.sato@next-innov.example.com',
  '第1条（目的）甲および乙は、業務提携の検討にあたり開示される秘密情報の取扱について以下の通り合意する。\n第2条（秘密保持義務）受領者は開示者の書面による事前の承諾なく第三者に開示・漏洩してはならない。\n第3条（有効期間）本契約の有効期間は締結日より2年間とする。',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'signed',
  '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  '2026-10-18 15:30:00',
  '203.0.113.42'
),
(
  'cnt_dev_02',
  'AIシステム開発業務委託基本契約書',
  '合同会社デジタルクラフト 代表 高橋 翔',
  'takahashi@digitalcraft.example.com',
  '第1条（委託業務）甲は乙に対し、Cloudflare Workersを用いた業務自動化システムの設計・開発業務を委託し、乙はこれを受託する。\n第2条（委託料）月額300,000円（税別）とし、毎月末日締め翌月末日払いとする。\n第3条（知的財産権）成果物の著作権は検収完了をもって甲に移転する。',
  '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
  'pending_signature',
  NULL,
  NULL,
  NULL
);
