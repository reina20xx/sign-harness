/**
 * Web Crypto API Document Hashing & Digital Signature Seal Engine
 * Provides SHA-256 tamper-proof digests and HMAC-SHA256 cryptographic signature seals.
 */

export async function sha256Hex(content: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(content));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function generateSignatureSeal(params: {
  contractId: string;
  documentSha256: string;
  counterpartyEmail: string;
  signedAtIso: string;
  signerIp: string;
  secretKey: string;
}): Promise<string> {
  const enc = new TextEncoder();
  const payload = `${params.contractId}|${params.documentSha256}|${params.counterpartyEmail}|${params.signedAtIso}|${params.signerIp}`;

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(params.secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
