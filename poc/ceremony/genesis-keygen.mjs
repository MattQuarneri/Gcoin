// genesis-keygen.mjs — Gcoin founding-key ceremony script (spec §9B)
// ---------------------------------------------------------------------------
// RUN THIS ON YOUR OWN MACHINE (your laptop), NOT in a shared/agent workspace.
// It generates the Ed25519 genesis keypair, fills the did.json / gcoin.json
// templates, signs the founding statement, and computes the genesis hashes.
// The private key is printed ONCE to stdout for your offline storage and is
// NEVER written to disk by this script. Never commit it, never paste it in chat.
//
// Usage:  node ceremony/genesis-keygen.mjs [path-to-gcoin-poc-dir]
//   e.g.  node ceremony/genesis-keygen.mjs ~/workspace/gcoin-poc
// Requires Node 22+ (Ed25519 in WebCrypto) — or paste the crypto section into
// the wallet page console in a modern browser (the wallet already uses WebCrypto).
//
// What it does, in order (matches GENESIS_CEREMONY_CHECKLIST.md step 2):
//   1. Generates an Ed25519 keypair (WebCrypto, extractable).
//   2. Exports the public key as multibase base58btc ("z" + base58btc(raw 32B))
//      -> fills did.json's GENESIS_PUBLIC_KEY_MULTIBASE.
//   3. Sets genesis.timestamp_utc to the actual UTC time (ISO 8601).
//   4. Signs canonical JSON (JCS / RFC 8785) of gcoin.json WITHOUT the
//      signature block -> signature.value (base64url).
//   5. genesis_block_hash = SHA-256 hex of the canonical JSON of the fully
//      signed document with genesis.genesis_block_hash itself OMITTED.
//      (Self-consistent and verifiable: anyone can recompute it from the
//      served file by deleting that one field and re-hashing.)
//   6. chain_id = SHA-256 hex of UTF-8("monytyme.com" + statement text),
//      per spec §9B: SHA-256(domain || genesis_statement).
// Writes ./ceremony-out/did.json and ./ceremony-out/gcoin.json (public only).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58btc(bytes) {
  // Bitcoin-style base58 over big-endian bytes; leading 0x00 -> '1'.
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '1'.repeat(zeros);
  let i = digits.length - 1;
  while (i >= 0 && digits[i] === 0) i--; // drop most-significant zero digits
  for (; i >= 0; i--) out += BASE58[digits[i]];
  return out;
}

export function canonicalize(value) {
  // Minimal JCS (RFC 8785) for this payload: recursively sort object keys,
  // no whitespace. Payload is strings/objects only; numbers pass through
  // JSON.stringify as JCS requires for typical values.
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  return '{' + Object.keys(value).sort().map(
    k => JSON.stringify(k) + ':' + canonicalize(value[k])
  ).join(',') + '}';
}

export function b64url(bytes) {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sha256hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function main() {
  const pocDir = resolve(process.argv[2] || '.');
  const genesisDir = join(pocDir, 'genesis');
  const outDir = join(process.cwd(), 'ceremony-out');
  mkdirSync(outDir, { recursive: true });

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto unavailable — need Node 22+ or a modern browser.');

  // 1. Keypair
  let kp;
  try {
    kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  } catch (e) {
    throw new Error('Ed25519 not available in this runtime (' + e.message + '). Use Node 22+.');
  }
  const pubRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey)); // 32 bytes
  const privJwk = await subtle.exportKey('jwk', kp.privateKey);                // {x, d, ...}
  const pubMultibase = 'z' + base58btc(pubRaw);
  const privHex = Buffer.from(privJwk.d, 'base64url').toString('hex');

  // 2. Fill did.json
  const didTpl = readFileSync(join(genesisDir, 'did.json'), 'utf8');
  const didFilled = didTpl.replaceAll('GENESIS_PUBLIC_KEY_MULTIBASE', pubMultibase);
  if (didFilled === didTpl) throw new Error('placeholder GENESIS_PUBLIC_KEY_MULTIBASE not found in did.json');
  writeFileSync(join(outDir, 'did.json'), didFilled + '\n');

  // 3-4. Fill gcoin.json: timestamp, then sign canonical doc without signature block
  const doc = JSON.parse(readFileSync(join(genesisDir, 'gcoin.json'), 'utf8'));
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  doc.genesis.timestamp_utc = ts;
  const unsigned = { ...doc };
  delete unsigned.signature;
  const unsignedCanon = canonicalize(unsigned);
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, kp.privateKey,
    new TextEncoder().encode(unsignedCanon)));
  doc.signature.value = b64url(sig);

  // 5. genesis_block_hash over the signed doc with that field omitted
  const hashable = structuredClone(doc);
  delete hashable.genesis.genesis_block_hash;
  const blockHash = sha256hex(new TextEncoder().encode(canonicalize(hashable)));
  doc.genesis.genesis_block_hash = blockHash;
  doc.dns_cross_bind = doc.dns_cross_bind.replaceAll('GENESIS_BLOCK_HASH_SHA256', blockHash);

  // 6. chain_id = SHA-256("monytyme.com" || statement)
  const chainId = sha256hex(new TextEncoder().encode('monytyme.com' + doc.statement));
  doc.genesis.chain_id = chainId;

  writeFileSync(join(outDir, 'gcoin.json'), JSON.stringify(doc, null, 2) + '\n');

  // Report
  console.log('=== Gcoin genesis ceremony output ===');
  console.log('Wrote public files to: ' + outDir + '/did.json, ' + outDir + '/gcoin.json');
  console.log('');
  console.log('Public key (multibase, already in ceremony-out/did.json):');
  console.log('  ' + pubMultibase);
  console.log('');
  console.log('Genesis block hash (also the DNS TXT value):');
  console.log('  ' + blockHash);
  console.log('Chain ID: ' + chainId);
  console.log('Timestamp: ' + ts);
  console.log('');
  console.log('DNS TXT record — host _gcoin.monytyme.com, type TXT, value:');
  console.log('  gcoin-genesis=' + blockHash + '; founder=did:web:monytyme.com; statement=https://monytyme.com/.well-known/gcoin.json');
  console.log('');
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log('PRIVATE KEY — shown once, never written to disk. Store offline');
  console.log('(USB drive, printed QR, or the §9C passphrase scheme), then');
  console.log('destroy any copy on this machine. Never commit it. Never paste');
  console.log('it into chat or email.');
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log('  hex:    ' + privHex);
  console.log('  base64: ' + privJwk.d);
  console.log('');
  console.log('Verify later (from GENESIS_CEREMONY_CHECKLIST.md step 2.6):');
  console.log('  curl -s https://monytyme.com/.well-known/did.json | sha256sum');
  console.log('  curl -s https://monytyme.com/.well-known/gcoin.json | sha256sum');
  console.log('  dig +short TXT _gcoin.monytyme.com');
  console.log('Recompute block hash from the served file: delete');
  console.log('genesis.genesis_block_hash, canonicalize (sorted keys, no spaces),');
  console.log('SHA-256 — must equal the value above.');
}

const isMain = (() => {
  try { return import.meta.url === pathToFileURL(process.argv[1]).href; }
  catch { return false; }
})();
if (isMain) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
