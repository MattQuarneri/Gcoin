# Gcoin Genesis Ceremony — checklist for the laptop session

Purpose: perform the founding attestation you designed (spec §9B) — the one and
only appearance of monytyme.com in the protocol, in the genesis event. Verified
slot status on 2026-10-20 18:38Z: `https://monytyme.com/.well-known/did.json`
returns 404 today, so nothing occupies the slot.

## 0. Before this: unblock the push (your step, ~2 min)

GitHub → Developer settings → Personal access tokens → fine-grained token Muse uses
→ Repository access: include **Gcoin** → Repository permissions: **Contents: Read and write**
→ save. Then tell me "done" and the prepared single commit lands on Gcoin main
(5 files under `poc/`: spec, `web/wallet.html`, `genesis/did.json`, `genesis/gcoin.json`,
`genesis/dns-txt.txt`). Main was verified at `82be63f4` on 2026-10-20 18:38Z, so the
prepared commit's base is current — it lands clean.

## 1. Eyeball the wallet (~15 min)

WebAuthn only fires in a secure context; `file://` is not one, `localhost` is.
Serve it locally — no cert needed:

```bash
cd ~/workspace/gcoin-poc/web   # or wherever the pushed poc/web lands
python3 -m http.server 8000
# open http://localhost:8000/wallet.html
```

Break things in this order: create wallet → send at L0–L3 → hit the double-spend
button → contracts/stream → Key List enroll/revoke → WebAuthn registration attempt
→ accountant sync (a ₲12 incoming transfer is waiting for your first sync) →
print the QR recovery sheet → recover from it. The ×60 accelerator runs Pay Day
early so you can watch accrual close, unspent minutes burn, and the dyme pay out.

## 2. The genesis ceremony (~20 min)

**Security note first:** the `poc/genesis/*` templates going to GitHub keep their
placeholders. The real key material goes into the copies served from monytyme.com
only — never commit the filled files.

1. Generate an Ed25519 keypair for the genesis key (browser crypto or `ssh-keygen`
   won't fit the multibase form directly). **Ready-made:** run
   `node ceremony/genesis-keygen.mjs ~/workspace/gcoin-poc` **on your laptop**
   (Node 22+; never run it anywhere shared) — it generates the keypair, fills
   `did.json`/`gcoin.json`, signs the statement (JCS/RFC 8785 canonical JSON),
   and computes the genesis block hash + chain ID per spec §9B, writing the two
   filled public files to `ceremony-out/`. The private key is printed once to
   stdout for your offline storage and is never written to disk. Keep it offline.
2. Fill placeholders in your **server copies**:
   - `did.json`: `GENESIS_PUBLIC_KEY_MULTIBASE` → the multibase-encoded public key.
   - `gcoin.json`: `GENESIS_BLOCK_HASH_SHA256` → SHA-256 of the signed founding
     statement; `GENESIS_TIMESTAMP_UTC` → the actual UTC timestamp.
3. Sign the founding statement with the genesis key; the signature lives in
   `gcoin.json`'s signature field.
4. Upload via your Dreamhost FTP to the monytyme.com web root:
   `/.well-known/did.json` and `/.well-known/gcoin.json`.
5. In the Dreamhost DNS panel, add the TXT record from `dns-txt.txt`:
   Host `_gcoin.monytyme.com`, Value
   `gcoin-genesis=<hash>; founder=did:web:monytyme.com; statement=https://monytyme.com/.well-known/gcoin.json`
6. Verify the three-leg bind — all three must agree on the genesis hash:
   ```bash
   curl -s https://monytyme.com/.well-known/did.json | sha256sum
   curl -s https://monytyme.com/.well-known/gcoin.json | sha256sum
   dig +short TXT _gcoin.monytyme.com
   ```
7. Longer-term (launch): anchor the genesis hash on a public chain as the permanent
   witness — the domain is the founding signature, the anchor survives even the domain.

## Still open (your calls)

- Anything you change in the wallet after breaking it: iterate locally or push again — say which.
- Genesis key custody (offline USB, printed QR, or the passphrase-encrypted scheme from §9C).
- Whether the served `gcoin.json` keeps the POC parameters (₲ symbol, 1440/day, 04:00 window,
  dyme = 10s) exactly as templated.
