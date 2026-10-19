// E2E Verification Script for Sign Harness
async function runTests() {
  const base = 'http://localhost:8789';

  console.log('--- 1. Testing GET /api/contracts ---');
  const listRes = await fetch(`${base}/api/contracts`);
  const listData = await listRes.json();
  console.log(`Loaded ${listData.contracts.length} initial contracts`);

  console.log('\n--- 2. Testing POST /api/contracts (Create New Contract with SHA-256) ---');
  const createRes = await fetch(`${base}/api/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'ソフトウェア開発業務委託個別契約書',
      counterparty_name: '株式会社フューチャーテック 代表取締役 中村 剛',
      counterparty_email: 'nakamura@futuretech.example.com',
      content_body: '第1条（対象業務）Reserve HarnessおよびEC Harnessの導入カスタマイズ業務。\n第2条（対価）金500,000円（税別）とする。'
    })
  });
  const created = await createRes.json();
  console.log('Created Contract:', created);

  console.log('\n--- 3. Testing POST /api/contracts/:id/sign (Execute Cryptographic Signature) ---');
  const signRes = await fetch(`${base}/api/contracts/${created.contract_id}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signer_ip: '198.51.100.25' })
  });
  const signed = await signRes.json();
  console.log('Signed Result:', signed);

  console.log('\n--- 4. Testing GET /api/contracts/:id/verify (Tamper-Proof Audit Trail Check) ---');
  const verRes = await fetch(`${base}/api/contracts/${created.contract_id}/verify`);
  const verData = await verRes.json();
  console.log('Cryptographic Verification Result:', JSON.stringify(verData.verification, null, 2));

  if (!verData.verification.tamper_free_verified || verData.verification.status !== 'signed') {
    throw new Error('Verification failed!');
  }

  console.log('\n🎉 ALL SIGN HARNESS TESTS PASSED!');
}

runTests().catch(console.error);
