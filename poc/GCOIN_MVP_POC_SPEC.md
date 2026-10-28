# Gcoin MVP Proof-of-Concept Spec

**Status:** Draft v0.4 — 2026-10-23, for Matthew's review (v0.2 added §2A full-chain
commitment rule, §9A zkTLS Web2 attestation, ZK-by-default data sharing in §4;
v0.3 adds §8A the Knot graph topology + witness nodes, and §9B MonyTyme.com genesis;
v0.4 adds §9D the trust graph — vouching, external attestation adapters, per-bit
provenance, trust-chain evaluation, institutional stripping — and §9E coin aging:
half-life, the circulation recharger, freeze/death, which supersedes GC persistence)
**Source material:** MattQuarneri/Gcoin (`README.md`, `plans/G-Coin Abstract.md`,
`plans/Gratitude Coin (G-Coin) - idea.md`, `plans/Gratitude Coin Spec v1.0.md`,
`plans/Reimagining the Economy/...`), plus Matthew's 2026-10-19 requirements.
**Goal:** a working, demoable POC of Gcoin on native web tech that proves the five
hard mechanics: 1440-coins/day issuance, smart-contract assignment, separable
provenance, WebAuthn/WebRTC-native transfer, and signature-chained double-spend protection.

---

## 1. Goals / Non-Goals

**Goals**
- A person gets 1440 coins per day — one per mortal minute — in a working demo.
- They can assign coins to a recipient via simple smart contracts (one-off and recurring).
- Coins carry provenance bound to email + photo; the spender can strip provenance to
  make a coin anonymous before/during transfer.
- Transfer authorization uses WebAuthn; peer connection uses WebRTC.
- Every transfer is attested, asserted, and affirmed by chained cryptographic signatures;
  double-spends are rejected.
- The POC runs entirely on native web tech (no plugins, no native apps): a static site,
  WebAuthn, WebRTC DataChannels, and the WebCrypto API.

**Non-goals (POC explicitly excludes)**
- Real production identity verification / proof-of-personhood (mock verifier, see §9).
- A public blockchain deployment — ledger is an append-only hash-chained log with
  pluggable anchoring (§8); anchoring to a testnet is a milestone, not day-one.
- The full thermodynamics model (vitality decay/recharge half-life) from Spec v1.0 §14–15:
  **specified in §9E (v0.4)** — design adopted, POC implementation still excluded.
- The Committed/60%–Liquid/40% float split: the contract model enforces a budget
  ceiling, but the fixed 60/40 rule is a documented extension, not POC behavior.
- Exchange value, pricing, wallets-to-fiat — out of scope entirely.

---

**Currency symbol: ₲** (decided 2026-10-20). Amounts are written ₲1,440, ₲5, etc.;
1 ₲ = 1 Mortal Minute = 60 seconds of ledger accounting (§8B). The Dyme is 10 seconds.

## 2. Core model (where the repo docs and Matthew's asks merge)

The repo converges on one two-state model, and the POC implements it verbatim:

| State | What it is | Rules |
|---|---|---|
| **Mortal Minutes (MM)** | Daily potential. 1440 per verified person per day, one per minute. | Never transferable. Expire at the user's Pay Day boundary, 04:00 local (§3; the repo's Midnight Rule, shifted). A minute can be **spent exactly once**. |
| **Gratitude Coins (GC)** | Realized value. Minted when an MM is spent. | Transferable. No Pay Day expiry — but coins **age**: vitality decays by half-life while idle, circulation recharges, and a coin idle past the freeze age can no longer be transacted (§9E, v0.4 — supersedes plain persistence). Carries provenance unless the spender strips it. |

**Key invariant (First Law of Human-Time Economics, Spec v1.0 §13):**
every GC originates from exactly one voluntarily spent MM; every MM mints exactly once.
This invariant *is* the double-spend protection — MM are consumed on spend, so there
is no coin that exists in two wallets.

**The transfer the repo describes vs. what Matthew asked:**
- Repo: Alice *spends* MM → Bob *receives* minted GC (MM→GC is a conversion, not a move).
- Matthew: coins get *transferred* to recipients, with provenance attached.
- POC reconciliation: **both.** Spending MM mints GC for a recipient (gratitude flow);
  GC already held can be transferred to another recipient with the provenance rules below
  (gift flow). Both are single signed-transfer events on the ledger.

---

---

## 2A. Everything is connected on-chain with signed hashes — YES (Matthew, 2026-10-19)

**Decision:** every state-changing thing in the network is committed to the chain by
hash + signature. Concretely, four rules:

1. **Every event is signed.** Identity registration, attestations, contract create/
   execute/cancel, spends, transfers, provenance strips, key rotations — each is a
   canonical-JSON event signed by its actor's key (WebAuthn-bound, §6–7).
2. **Every event is hash-linked.** Each event carries `prev_event_hash` for its actor's
   strand and is woven into the ledger graph (§8A — per-person strands braided by
   dual-signed transfers; there is no single global chain). Nothing exists in the
   system that isn't reachable by hash from strand heads and anchored checkpoints.
3. **Hashes go on-chain, data stays off-chain.** Events batch into a Merkle tree;
   the batch **Merkle root is anchored on a public blockchain** (the §7/§8 anchor step,
   promoted from "extension" to core POC behavior in v0.2 — at minimum a testnet
   anchor in M6, signed checkpoint file before that). Anyone can verify any event:
   recompute its hash → Merkle proof → anchored root → it happened, in that order,
   signed by that key.
4. **Private payloads are never on-chain.** What is anchored is `SHA-256(payload)` +
   signatures + ZK proofs (§4) — never emails, photos, or message plaintext. The chain
   proves *that* things happened and *who signed them*, not *what they said*.

This is the honest version of "everything on the blockchain": putting 1440 events/day/person
raw on a public chain doesn't scale and would be a privacy disaster; hash-anchoring
gives the same tamper-evidence and ordering guarantees at a fraction of the cost.

## 3. Issuance: 1440/day, one per mortal minute — UTC clock, 04:00 "Pay Day," TZ-shifted windows

**Decisions (Matthew, 2026-10-19):** per-minute accrual (not a lump drop); the ledger
clock is **UTC**; each person's day window is **anchored at 04:00 in their own timezone**
(the timezone-based shift); the window boundary is **Pay Day** — the settlement moment.

- **Window:** person P's Gcoin day = `[04:00 P-local, 04:00 P-local next day)`.
  Expressed on the ledger entirely in UTC: e.g. a user in America/Los_Angeles (UTC−7
  in October) has windows starting 11:00 UTC. Nobody reasons in UTC — the wallet does
  the shift; the ledger only ever sees UTC epochs.
- **Tick:** 1 MM accrues per elapsed minute inside the window, capped at 1440.
  Deterministic from the window start: `accrued = min(1440, minutes since window start)`,
  so an offline wallet recomputes exactly on next sync — no server trust needed.
- **Pay Day (04:00 local):** at the boundary the books close (a signed `payday.close`
  event): unspent MM of the closing window are burned, the window's events are
  Merkle-batched for anchoring (§2A), and the new window opens. GC (cash) carries
  forward untouched.
- **MM identity / nullifier:** `mm:<window_start_utc_epoch>:<minute-index 0..1439>:<holder-DID>`.
  Each nullifier is spendable exactly once, ever.
- **Anti-abuse (why the TZ shift can't be gamed):** the anchor timezone is fixed at
  registration and committed to the ledger; changing it is a signed event that only
  takes effect at the *next* window, and issuance is additionally capped globally:
  **≤1440 MM in any rolling 24 hours per identity**, regardless of windows. Timezone-
  hopping therefore cannot mint a 25th hour. (04:00 is also DST-safe: it is never in
  the skipped spring-forward hour nor the repeated fall-back hour.)
- Midnight Rule mapping: the repo docs say "burned if unspent by midnight" — in this
  design midnight is replaced by the user's Pay Day boundary, 04:00 local; the rule's
  intent (use-it-or-lose-it, no hoarding of potential) is unchanged.

### 3.1 Accrual accounting vs cash accounting (the user's two views)

Matthew's framing, made literal — the wallet keeps both books:

| | **Accrual book** (this window) | **Cash book** (settled) |
|---|---|---|
| What it counts | MM as they *accrue*, minute by minute | GC that actually *settled* |
| Balance lines | Accrued so far (e.g. 1,170 of 1,440 at 23:30 PDT for a 04:00-anchored user); Committed (contracts); Spent from accrual; **Spendable now = accrued − committed − spent**; Projected at Pay Day: 1,440 | GC held (persistent balance); GC received today; GC sent today; GC in-flight (attested, not yet affirmed) |
| At Pay Day | Accrual book closes: unspent remainder is written off (burned) — recognized capacity that was never realized | Cash book carries forward; coins age by idle time toward freeze (§9E) — a third view, the *collection*, holds frozen coins |
| Answers | "How much of my life today have I allocated — and how much is still mine to give?" | "What do I actually hold, that others gave me?" |

Spending is the conversion event between the books: an MM leaves the accrual book and
a GC is minted into the recipient's cash book. That is the repo's State 1 → State 2
transition, expressed in accounting language users already understand.

---

## 4. Provenance: email + photo, separable

Each GC carries a **provenance envelope** with two attachment slots, exactly as Matthew specified:

- `email`: the holder's email, stored as `email_hash = SHA-256(salt || email)` on the
  coin; the plaintext email travels only in the encrypted WebRTC transfer payload,
  never on the ledger.
- `photo`: a content-addressed reference (`photo_cid = SHA-256(photo bytes)`), shown in
  the transfer UI as the sender's face next to their coin.

**Data-sharing levels (Matthew, 2026-10-19): the level is set by the two parties to
each transfer, and the default is a zero-knowledge proof.**

- **L0 — ZK only (DEFAULT):** recipient gets a ZK proof of the claims that matter
  ("this coin was minted from a verified person's mortal minute; the sender controls
  a registered wallet; provenance chain is intact") and *no* identifying data at all —
  no email, no photo, no DID linkage beyond the proof.
- **L1 — Pseudonymous:** adds the sender's DID. Continuity/reputation without identity.
- **L2 — Attributed:** adds email hash + photo (the §4 envelope shown in the UI).
- **L3 — Full disclosure:** both parties opt in to plaintext email (+ optional message)
  inside the encrypted WebRTC payload — the "signed Mortal Minute as a collectible" case.

Levels negotiate per transfer: sender proposes, recipient's accept-policy (§4) sets
a floor — e.g. a merchant can require ≥L1, a friend can accept L0. A transfer below
either party's floor is rejected at assertion time. The chosen level is recorded in
the (signed, hashed) transfer event; the disclosed data itself is never on the ledger.

**Provenance modes, chosen by the spender at spend time:**
1. **Attributed** — full envelope travels: recipient sees who gave it (email + photo).
2. **Pseudonymous** — envelope carries the holder's DID only, no email/photo.
3. **Anonymous** — provenance is *stripped*: the coin is re-minted by protocol into a
   fresh GC with an empty envelope. The strip event is recorded (a spend of the old
   coin ID, a mint of a new coin ID, envelope empty) so supply accounting still balances
   — anonymity of *who*, auditability of *how many*.

**Receiving policy:** wallets publish an accept-policy (`anonymous | attributed | both`,
default `both`). A transfer whose provenance mode violates the recipient's policy is
rejected at assertion time (§6).

**Tension with the repo docs (flagged, not resolved):** the `idea.md` note leans toward
DIDs + VCs + ZK selective disclosure ("prove I'm a unique living person without revealing
legal identity"). Matthew's email+photo binding is *more* identifying. The POC keeps
both paths alive: provenance envelope (Matthew's model) and DID-only pseudonymous mode
(repo model). Default per Matthew (2026-10-19): L0 ZK-only, with higher sharing
levels negotiated per transfer between the parties.

---

## 5. Smart contracts: assigning coins

POC contract model is deliberately small — three contract types, all enforced by the
wallet/ledger rules, not by a general VM:

1. **one_time**: "assign N coins to recipient R" — executes once, signed by sender.
2. **recurring**: "assign N coins/day to R at HH:MM" — executes daily from the sender's
   *fresh* MM (never from held GC), auto-expires if the sender's MM are insufficient;
   cancellable by the sender at any time. This is the POC expression of the repo's
   Committed Float idea: the wallet shows `committed_today` vs `liquid_today` and
   rejects a new recurring contract that would over-commit the day's 1440.
3. **stream**: "assign 1 coin per minute to R while active" — the literal mortal-minute
   stream; start/stop signed events; each minute's tick mints directly to R.

Contract lifecycle events are ledger entries signed by the contract owner:
`contract.create`, `contract.execute`, `contract.cancel`. Recipients never need to
pre-approve; unclaimed recurring/stream mints queue for 24h then return to burn.

---

## 6. Transfer protocol: WebAuthn + WebRTC + three signatures

The transfer is a three-verb ceremony, matching Matthew's "attest, assert, and affirm":

1. **ATTEST (sender):** Sender's wallet builds a canonical transfer payload
   (see §7), and the sender **attests** it with **WebAuthn**: `navigator.credentials.get()`
   with a per-wallet passkey. The WebAuthn assertion's `authenticatorData` + `signature`
   binds the human's hardware-backed key to the payload hash. The passkey *is* the
   wallet key — no seed phrases, no browser extension.
2. **ASSERT (recipient):** Payload travels over a **WebRTC DataChannel** (peer-to-peer,
   works on LAN without any server once signaling completes; demo uses a tiny
   copy-paste/manual signaling page — no signaling server required for the POC).
   The recipient's wallet validates, then **asserts** receipt with their own WebAuthn
   signature ("I accept these coins under my receiving policy").
3. **AFFIRM (ledger):** Both signed halves are appended to the hash-chained transfer log.
   The log's head hash over the entry is the **affirmation** — the network's statement
   that this transfer is the canonical spend of those MM/coin IDs. Any conflicting
   transfer referencing the same nullifier is rejected as a double-spend.

**Why WebRTC for a POC:** transfers are peer-to-peer and work offline on a local
network — the demo story ("tap phones together on the same Wi-Fi") needs no backend.
The ledger syncs opportunistically afterwards.

---

## 7. Cryptography & double-spend protection

- **Algorithms:** Ed25519 for coin/ledger signatures (WebCrypto; `Ed25519` in modern
  browsers, X25519 for the WebRTC-adjacent encryption of the email plaintext),
  SHA-256 for hashing, canonical JSON (JCS / RFC 8785) for all signed bytes.
- **WebAuthn binding:** the wallet's credential public key is registered at wallet
  creation; every attest/assert signature must verify against it. Key rotation is a
  signed ledger event.
- **Coin identity:** `coin_id = SHA-256(mint_event)`. Every transfer consumes input
  coin IDs and produces output coin IDs — UTXO-style.
- **Nullifier set:** `mm:<window_start_utc_epoch>:<index>:<DID>` (§3) for MM spends; `coin_id` for GC transfers.
  A nullifier appears once. The ledger maintains the spent set; any entry reusing a
  nullifier is rejected and the attempt is itself logged (evidence of the attempt).
- **Ledger structure:** append-only, hash-chained event log:
  `entry_n = { seq, prev_hash, event, signatures }`, `hash_n = SHA-256(canonical(entry_n))`.
  Event types: `identity.register`, `mm.tick` (implicit, derived), `mm.spend→mint`,
  `gc.transfer`, `provenance.strip`, `contract.create/execute/cancel`, `key.rotate`,
  `anchor.checkpoint`.
- **Anchoring:** the log head hash is periodically published to an external anchor
  (POC: a signed checkpoint file; extension: OP_RETURN / testnet / timestamping service).
  This is the repo's "distributed event ledger whose integrity is periodically anchored
  into a public blockchain" (Spec v1.0 §10).

---

## 8. Architecture (all native web tech)

```
┌──────────────┐   WebRTC DataChannel   ┌──────────────┐
│  Wallet A    │ ◄════════════════════► │  Wallet B    │
│ (static PWA) │   signed payloads      │ (static PWA) │
└──────┬───────┘                        └──────┬───────┘
       │ WebAuthn                        │ WebAuthn
       │ sign/attest                     │ sign/assert
       ▼                                 ▼
┌──────────────────────────────────────────────────┐
│  Transfer Log (hash-chained, local-first)        │
│  syncs peer-to-peer; head hash anchored remotely │
└──────────────────────────────────────────────────┘
       ▲
       │  mock verifier (POC only)
┌──────┴───────┐
│ Identity     │  issues "one living person" credential
│ Verifier     │  (real verification is post-POC)
└──────────────┘
```

- **Wallet:** single static HTML/JS PWA. IndexedDB for coins, keys (non-extractable
  via WebAuthn anyway), log replica. No build step for the POC.
- **Signaling:** manual (show QR / copy-paste SDP) — zero server.
- **Verifier:** a mock page that issues a signed "unique living person" credential
  after a demo check (POC stand-in for the repo's decentralized trust graph / DIDs / VCs).
- **Ledger replica:** no full replicas (§8A): each wallet holds its own strand plus
  counterparty segments; witness nodes hold broader replicas; sync is anti-entropy
  over WebRTC (exchange strand heads, fetch missing braid segments).

---

---

## 8A. Ledger topology: the Knot — a graph, not one global chain (Matthew, 2026-10-20)

**Decision:** there is **no single global linear blockchain**. The ledger is a
directed acyclic graph — Matthew's "blockchain knot" — built from per-person chains
braided together by transactions. (Precedents for the shape: Nano's block-lattice,
where every account has its own chain and a transfer is a send/receive pair of blocks;
Holochain's per-agent source chains; hashgraph's parent-linked event graph.)

### Strands and braids
- Every wallet owns a **strand**: its own append-only, hash-chained sequence of
  events (`strand_head = SHA-256(prev_head || event)`, every event signed by the owner).
  A strand is small and personal — your chain is only your history.
- A transfer is a **braid**: one event, dual-signed, that references **both** parties'
  current strand heads (sender-parent + recipient-parent, like hashgraph's two-parent
  events). The sender appends it to their strand as a spend; the recipient appends the
  *same* event to theirs as a receipt. The two strands are now cryptographically tied
  at that point — follow braid edges and you walk the entire gratitude graph.
- There is no global ordering and none is needed: the graph gives a **partial order**
  (happens-before, via hash references). Ordering only ever matters *within* one
  sender's strand — and a strand is linear by construction.

### Why double-spend protection gets easier, not harder
- A coin/MM can only be spent from the owner's strand, and a strand has exactly one
  head. Two spends of the same nullifier = two children of the same parent = a **fork
  in the strand**, and both forks are signed by the owner — the fork itself is
  self-proving evidence of the double-spend attempt (§10).
- A recipient verifies a payment by walking the sender's strand back from the braid
  to the last mutually-known or checkpointed head — usually a short walk, because
  people mostly transact with people near them in the graph. "Chain links can be
  smaller": verification cost is proportional to *your neighborhood*, not to the
  size of the whole network. A global chain makes every user carry (or trust)
  everyone's history; the knot makes each link local.
- Cross-checks accumulate for free: every braid is a witness statement by two parties
  about each other's strand heads at that moment, so heads get cross-attested by the
  ordinary flow of trade.

### Finding each other (discovery)
- Wallets are addressed by DID + key, never by domain. Peer lookup uses a
  **Kademlia-style DHT** keyed by `SHA-256(DID)` storing only signed reachability
  records (current WebRTC rendezvous hints) — the same pattern as IPFS/libp2p.
- Your wallet caches its **transaction neighborhood** (past counterparties and their
  recent heads): most lookups resolve locally or in one hop through a mutual
  counterparty — you find people *through the graph*, the way you'd expect to.
- WebRTC still carries the actual transfer (§6); the DHT/gossip layer only introduces
  peers. Gossip also propagates strand-head announcements among neighbors so forks
  surface fast.

### Witness nodes — "super nodes" without privilege
Yes to super nodes, with the authority stripped out:
- A **witness node** (anyone can run one; MonyTyme will run the first) does four
  jobs, all clerical: (1) **availability** — stores replicated copies of strands so a
  lost phone isn't lost history; (2) **rendezvous** — helps peers find each other
  when both are behind NATs (WebRTC signaling/relay fallback); (3) **checkpointing** —
  periodically collects cross-signed strand heads, Merkle-batches them, and anchors
  the root on a public chain (§2A); (4) **fork watch** — announces observed strand
  forks (it can prove them but not create them).
- A witness **cannot** forge (everything is signed by owners), censor durably (any
  other peer or witness can relay the same event; a wallet talks to several), mint,
  reverse, or even *see* private payloads (ZK default, §4; stored copies can be
  client-encrypted). If MonyTyme's witness vanished tomorrow the network loses
  convenience, not truth — strands live with their owners and counterparties.
- This is the deliberate anti-Ripple line: Ripple's design routes trust through
  gateway/domain-identified issuers and a centrally-published validator list, so the
  operator sits *inside* the trust path of transactions. Here, **MonyTyme appears
  exactly once in the protocol — in the genesis event (§9B)** — and as an ordinary,
  replaceable witness afterwards. No transaction payload contains the domain; peers
  verify each other from keys, hashes, and strand history. Genesis attests where the
  knot started; it is not a toll booth on its threads.

### What §7's "log" means now
Read §7's hash-chained log as the *strand-level* structure (plus the checkpoint
 batches): each wallet keeps its own strand + the braid counterparties' relevant
 segments, witness nodes keep fuller replicas, and §2A's "everything signed and
 hash-linked" holds graph-wide — every event is reachable by hash from strand heads,
 and strand heads are reachable from anchored checkpoints.

---

## 8B. Accountant nodes and the Dyme (Matthew, 2026-10-20)

**Accountant nodes** are the network's volunteer supporters — the §8A witness role
under its working name, with two working duties made explicit: (1) **accounting** —
they hold strand replicas, serve **sync deltas** (the events a recovered or stale
wallet is missing since its last checkpoint, delivered against signed checkpoint
receipts), and publish checkpoint anchors; (2) **brokering** — they broker the
WebRTC peer-to-peer network: peers register signed reachability records with a
broker, the broker introduces two parties who want to transact (exchanging their
SDP/ICE signaling), and the actual transfer then flows **directly peer-to-peer over
the WebRTC DataChannel** — the broker is never in the data path, cannot read the
payload (ZK default + DTLS encryption), and can be any accountant or none (manual
signaling still works). Brokering is also a *paid* service under the Dyme split:
introductions performed count toward an accountant's service record. Privacy note:
a broker necessarily learns *that* two DIDs rendezvoused (metadata), not what moved
between them; wallets may rotate brokers per connection, and broker-shopping is a
client policy, not a protocol privilege. A restored backup's first act is to sync
with an accountant: present its last affirmed checkpoint → receive exactly the
missing delta events → verify each hash/signature → apply. Accountants are paid for
this, in Gratitude, by everyone — via the Dyme.

**The Dyme: 10 seconds of everyone's day.**
- Accounting base unit is the **second**: a day issues 86,400 seconds; a Mortal
  Minute (1 coin) = 60 seconds. GC balances are tracked in seconds and displayed as
  coins + seconds, so fractional amounts are exact integers underneath.
- The **first 10 seconds of every person's day-window (seconds 0–9) are pre-committed
  to the Accountant Pool** — the "dyme" (⅙ ₲). They are never spendable by the user; the
  user's spendable accrual is 86,390 seconds/day. The levy's position at the head of
  the day is deliberate: the network's keepers are paid *first*, before any gratitude
  flows — infrastructure as the day's first act of gratitude.
- **Distribution is pro-rata by verified service:** at each Pay Day, the pool
  (10 s × participating identities that day) is split among accountant nodes in
  proportion to their signed service record for that window — deltas served, bytes
  of replica stored, checkpoints anchored — receipts that are themselves strand
  events, so the split is auditable and anyone can recompute it. Matthew's "perhaps
  proportional to how many there are" falls out naturally: more accountants = the
  same pool split more ways (each share shrinks), which also self-limits Sybil
  farming of the pool only if service receipts require real work — receipts must be
  *counter-signed by the wallets served*, so fake service needs fake users, who are
  stopped by the personhood nullifier (§9A).
- Payment is in GC minted from those very seconds: each participant's dyme event
  names the pool; the pool's Pay Day distribution mints/transfers GC-seconds to
  accountant wallets per the split.

**Wallet storage (POC):** the wallet lives in the browser — **IndexedDB** for
structured state (Key List, strand index, balances) and **OPFS** for the append-only
event-log files and photo/blob storage where available. **Export** produces a
portable backup file (identity + Key List + strand + state). Any restored backup is
treated as *stale until synced*: it must reconcile with an accountant node's deltas
before spending (its checkpoint is compared; missing events are pulled and verified;
anything the backup is missing that spends its minutes re-derives the spent set, so
a restored old backup cannot resurrect spent minutes).

## 9. Identity & the email/photo binding (POC pragmatics)

- Wallet creation: user provides email + photo (file input / camera). Stored **locally
  only**. `email_hash` + `photo_cid` go on coins; plaintext leaves the device only
  inside the encrypted WebRTC payload to an attributed-transfer recipient.
- The mock verifier binds `DID ↔ email_hash ↔ photo_cid` and countersigns the wallet's
  registration — this is the POC's "one person, one issuance" enforcement.
- Real proof-of-personhood (the repo's hard problem: one daily issuance per living
  human, §6 of Spec v1.0) is explicitly **out of scope**; the POC demonstrates the
  *mechanism* assuming the verifier's word.

---

---

## 9A. Web2 identity attestation via zkTLS — LinkedIn without LinkedIn (Matthew, 2026-10-19)

**Question:** can a joining person attest "this wallet is the person behind this
LinkedIn profile," anchored in linkedin.com's own HTTPS certificate — with nobody at
LinkedIn involved? **Answer: yes.** The technique is **zkTLS** (a.k.a. web proofs),
and needing no cooperation from the website is its entire point: it works from the
user's side of an ordinary TLS session, so no API key, OAuth app, or partnership.

**How it works**
1. The user logs into linkedin.com *themselves*, in their own browser/session.
   Credentials never touch Gcoin.
2. The TLS session to `linkedin.com` is run with a **notary** participating, in one
   of two production models:
   - **MPC-TLS (TLSNotary / Opacity model):** TLS session keys are split between the
     user and a notary via MPC, so neither can forge the server's response and the
     notary never sees plaintext. Strongest trust model, heavier/slower.
   - **Proxy witness (Reclaim Protocol model):** a proxy witnesses the encrypted
     exchange and attests it went to the real domain (cert checked against the
     domain); ZK proofs over the decrypted content are generated client-side.
     Fast (~2–4s on a phone), weaker/different trust assumption (the witness layer).
3. The browser's TLS stack validates LinkedIn's certificate chain for `linkedin.com`
   as usual — that certificate *is* the anchor: the proof shows "this data was served
   by the holder of linkedin.com's cert, in a session I controlled."
4. A ZK proof then discloses **only the claim**, e.g.:
   "the logged-in profile's public ID hashes to `H(profile_id)`, the profile name
   field matches the wallet's claimed name, account is not new." Passwords, cookies,
   the rest of the page — never revealed.
5. `H(profile_id)` becomes an **identity nullifier**: committed (signed + hashed) to
   the ledger at registration, so one LinkedIn profile can back **exactly one**
   minting identity — the Sybil guard for the 1440/day issuance. The network learns
   a LinkedIn account vouched for this wallet; under the ZK default it does *not*
   learn which one.

**What it proves — and what it doesn't**
- Proves: control of that LinkedIn account at attestation time, and whatever profile
  facts the claim covers. Portable: the same pattern works for any HTTPS site
  (GitHub, a bank, an employer portal) — LinkedIn is just the first provider.
- Doesn't prove: legal identity by itself, or that the account wasn't borrowed/stolen.
  It's one strong attestation in the repo's "decentralized trust graph" (Spec v1.0 §6),
  combinable with others; attestations carry an expiry and can be re-run to refresh.
- Practical caveats: LinkedIn actively fights automation — CAPTCHAs, page/API shape
  changes, and proxy-IP blocking make any given integration fragile and in need of
  maintenance; there's also ToS risk in automated access to a logged-in session.
  None of that blocks a POC; all of it must be disclosed.

**POC path**
- M1 ships the attestation **interface + a simulated zkTLS provider** (same claim
  format, same nullifier commit) so the rest of the system is built against the real
  contract.
- A time-boxed spike in parallel attempts a *real* proof against LinkedIn via
  Reclaim's SDK (fastest path) and/or TLSNotary; if LinkedIn's defenses block it,
  the spike falls back to another HTTPS profile site to prove the mechanism, and
  LinkedIn stays a documented integration target. The POC never depends on the spike.

---

## 9B. Genesis provenance: the chain attested by the MonyTyme domain (Matthew, 2026-10-19)

**Question:** can the blockchain's provenance start with Matthew attesting to it on
behalf of the MonyTyme domain, because he owns that domain? **Answer: yes** — this is
the established **did:web** pattern (W3C DID method): a DID whose document is served
from a domain you control, where DNS + the domain's TLS certificate are the trust root.
Owning the domain *is* the credential.

**The construction (three mutually-binding legs):**
1. **did:web identity for the network:** `did:web:<monytyme-domain>` resolves to
   `https://<monytyme-domain>/.well-known/did.json`, a DID document listing the
   network's **genesis key** (Ed25519) as its verification method. Serving it over
   HTTPS under the domain's certificate is the domain's attestation: "the controller
   of this domain stands behind this key."
2. **Genesis statement:** `https://<monytyme-domain>/.well-known/gcoin.json` carries
   the founding statement — network name, genesis timestamp, the genesis block hash,
   the protocol parameters (1440/day, 04:00 Pay Day, §3) — **signed by the genesis key**.
3. **DNS TXT cross-bind:** a TXT record at `_gcoin.<monytyme-domain>` contains the
   genesis block hash, so the claim exists in DNS as well as on the web host.
4. **Genesis block (event 0)** of the ledger embeds: the domain, `SHA-256(did.json)`,
   `SHA-256(gcoin.json)`, and the genesis signature. **Chain ID =
   `SHA-256(domain || genesis_statement)`** — the chain is cryptographically *named
   after* the domain's attestation. Every later event chains back to event 0 (§2A),
   so the whole network's provenance literally descends from the domain owner's act.

**Trust notes (stated plainly):**
- did:web's trust model is DNS + TLS. If the domain lapses or is hijacked, the
  *human-readable* root rots. Mitigation: at launch, the genesis hash is *also*
  anchored on a public blockchain (§2A) and timestamped — after that, the chain's
  provenance survives even the domain. The domain attestation is the founding
  signature; the public anchor is the permanent witness.
- Genesis under the MonyTyme domain permanently links Gcoin's origin to the MonyTyme
  name. That's the point of the proposal — and it's irreversible once anchored, so
  it's recorded here as a deliberate founding decision.
- Domain confirmed 2026-10-20: **monytyme.com**. Templates in
  `~/workspace/gcoin-poc/genesis/` (did.json, gcoin.json, dns-txt.txt) are filled in
  with `did:web:monytyme.com` — only the genesis key, genesis block hash, timestamp,
  and signature remain to be generated at founding. POC hosting: his existing site
  hosting (Dreamhost) serves `/.well-known/` as static files — no new infrastructure.
- **Why 04:00 (design note, Matthew's rationale + assessment):** a midnight boundary
  lands the use-it-or-lose-it deadline — and a fresh 1,440 — in the middle of people's
  social night, exactly when judgment is loosest. At 04:00 almost everyone is asleep:
  there's no 11:59-style spending rush, nobody can dip into *tomorrow's* minutes at
  1 AM (tonight's window still runs until 04:00), and the new day simply exists when
  you wake up — Pay Day as something you wake to, not a cutoff you race. It's also the
  quietest hour of human activity and DST-safe (§3). Same convention as transit
  "service days" and hotel night-audits, which roll over in the small hours for the
  same reason. Confusion risk is limited to "the date changed but my Gcoin day hasn't"
  between 00:00–04:00; the wallet mitigates by naming the period (e.g. "Tuesday's
  minutes, until 4:00 AM") rather than showing a bare calendar date.

---

## 9C. One wallet, many browsers: Key Lists, device strands, printed-QR recovery (Matthew, 2026-10-20)

**Core principle: the wallet is an identity, not a key.** A wallet = a DID plus a
versioned **Key List** — the signed, hash-linked, checkpointed record of which keys
may act for it. Keys come and go; the identity (and its strand history, balances, and
personhood nullifier) persists. This resolves "split wallets" as follows.

### The Key List
- Entry: `{ key_id, public_key, kind: device|recovery, authenticator: webauthn,
  label: "iPhone Safari", added_in: <keylist_version>, status: active|revoked }`.
- The Key List itself is a strand event series: every version references the hash of
  the previous version and is checkpointed by witnesses (§8A), so any counterparty
  can verify "was this key authorized at the time it signed that event?"
- **Default policy:** routine transfers/contracts — **any 1 active device key**.
  Key-List changes (add/revoke a key, change policy) — **2 device keys, or the
  recovery key** (recovery-initiated changes carry the activation delay below).

### Matthew's three browsers, concretely
WebAuthn passkeys do not roam freely across ecosystems, so the wallet enrolls each
*key*, not each browser:
- **iPhone Safari + Mac Safari** normally share **one synced passkey** via iCloud
  Keychain — a single Key List entry that happens to live on two devices. (Losing the
  phone loses nothing; the Mac still signs. Revoking it affects both — re-enroll.)
- **Mac Chrome** uses its own passkey (Chrome/Google sync or device-bound) — a
  **second, independent entry**.
So 3 browsers = 2 keys = genuine diversity: an Apple-ecosystem failure and a
Google-ecosystem failure can't both happen at once, and any surviving browser can
revoke the lost one and enroll its replacement.

### Enrolling a new device/browser
1. New browser creates its passkey locally (WebAuthn; private key never leaves it).
2. It displays a pairing QR/code; an already-enrolled device scans it, they connect
   over WebRTC (§6), and the existing device verifies and signs the Key-List
   addition (policy: needs the 2nd key only if the enrolling device is the *only* one
   — otherwise 1 existing key + the new key's own proof-of-possession).
3. The new device syncs the strand replica, neighborhood cache, and Key List from the
   enrolling device (and/or witnesses). It can transact immediately.

### The concurrency trap — and the split-wallet rule
Two of *your own* devices spending offline could fork your strand — which the knot
(§8A) is built to read as a double-spend. An honest self-fork must be impossible by
construction, not just detectable:
- Each device keeps a **device strand**; the wallet's strand is the braid of its
  device strands, unified by signed identity-checkpoint events at every sync.
- **Issuance is partitioned:** at each sync, the day's MM index space (0–1439) is
  allotted to devices in disjoint ranges (default: even split, user-adjustable —
  e.g. phone 0–1079, desktop 1080–1439). A device can only spend from its allotment
  while unsynced, so two devices *cannot* spend the same minute, ever.
- GC spends offline are limited to coins whose latest receipt is already in that
  device's synced replica. Everything else waits for sync (seconds, over WebRTC).
- If a collision somehow occurs anyway, normal fork rules apply (§10) — but with both
  forks provably from the same identity's devices, the wallet's own merge logic
  unwinds the later spend with a signed correction instead of a fraud flag.

### Printed QR recovery (lose *all* devices)
- At wallet creation the wallet generates a **256-bit master seed** in-browser (never
  transmitted, never stored digitally by default). From it derives the **recovery
  key**, whose public half sits in the Key List from day one, dormant.
- **The printed sheet** contains one QR encoding the seed **encrypted under a user
  passphrase** (memory-hard KDF → AEAD; the ~100-byte payload fits a single QR with
  room to spare), plus printed fallback text of the ciphertext, the wallet's short
  fingerprint, and plain-English instructions. Paper alone is not enough (passphrase);
  passphrase alone is not enough (paper). Options at print time: a second sheet with
  a **SLIP-39-style Shamir split (e.g. 2-of-3)** for people who want the backup itself
  distributed across locations.
- **Recovery ceremony:** on a fresh device — scan QR → enter passphrase → recovery key
  reconstructed → generate a new device passkey → publish a signed **recovery
  rotation**: all old device keys revoked, new key enrolled, strand history re-fetched
  from witnesses/counterparties (the knot restores the data; the key restores the
  right to act). Identity, DID, personhood nullifier, balances, and tomorrow's 1,440
  are all intact.
- **Theft guard:** a recovery rotation activates after a delay (default 24h, POC
  parameter). During the window, *any still-active device key can cancel it* with one
  tap — so a stolen sheet used while your devices are actually fine gets stopped,
  while a true total-loss recovery proceeds unopposed. (The delay does not apply when
  2 existing device keys co-sign instead.)
- **Setup discipline (in the UX, not just docs):** the wallet makes you *test* the
  sheet at creation — scan it back, verify the fingerprint matches — before it
  considers the wallet backed up; and it warns plainly: never photograph or screenshot
  the sheet; store it like cash.

### Loss matrix
| Loss | Consequence | Fix |
|---|---|---|
| One browser/device | None — other keys unaffected | Revoke its key from any surviving device; enroll replacement |
| All Apple devices (shared synced passkey) | That one key is gone; Chrome key still works | Revoke + re-enroll |
| All devices | No signing possible until recovery | Printed QR + passphrase → recovery rotation |
| Printed sheet (devices fine) | Attack window only if passphrase also leaks | Rotate recovery key from a device; print a new sheet |
| Sheet + passphrase both compromised | Attacker can start a rotation | Cancel it from any device within the delay window |

## 9D. The trust graph: vouching, external attestations, and provenance chains (Matthew, 2026-10-22/23)

§9A answers "how do we know this joiner is one person?" with platform evidence
(zkTLS). Matthew's second door is older and more social: **people vouch for
people.** A member signs an attestation affirming a piece of information a
joiner submitted about themselves — their name, their email, their photo —
the way a mailing list sponsor vouches a new subscriber in. A wallet that
nobody has vouched for can exist, but it cannot *receive* Gratitude until the
trust graph says it is attested. This section specifies that model, how
external trust networks plug into it as evidence, and how identity rides on
coins afterward — per-bit, under the sender's control — so a recipient can
judge whether a coin "came from a liar."

### Attestation events

An attestation is a signed event on the **attester's** strand (event type
`identity.attest`), VC-shaped (W3C Verifiable Credentials data model; §13):

| Field | Content |
|---|---|
| `subject` | The joiner's DID |
| `attribute` | `name` \| `email` \| `photo` (extensible) |
| `attribute_hash` | Salted hash of the attribute value (per §2A, the value itself never goes on a strand) |
| `basis` | How the attester knows: `in-person` \| `video` \| `long-known-online` \| `verified-contact` |
| `expires` | Attestations lapse (proposed POC default: 1 year) unless renewed |
| `signature` | Attester's device key (§9C) |

Joining is a flow, not a form: the joiner publishes an attestation *request*
(their self-submitted attributes, hashed), a friend already in the network
countersigns the pieces they have personally verified, and each countersignature
braids the two strands — the same knot mechanics as a transfer (§8A). One
friend can attest the name, another the photo; **pieces are independent**, so
standing accumulates attribute by attribute, attester by attester.

### Attested standing and the receiving rule

A wallet's **standing** is computed locally from the graph — there is no
central registry and no global score (§8A's no-gatekeeper rule applies to
trust too). A recipient's wallet (and the protocol defaults) ask:

- Are the *receiving* wallet's core attributes (name + photo, or email + photo)
  attested by at least **N distinct attesters** who are themselves in good standing?
- Do those attesters span more than one cluster (not all vouched-into the
  network by the same person — a diversity check against vouch rings)?
- Is any attestation expired, revoked, or under active dispute?

Until standing is reached, incoming Gratitude is held as **pending** (visible,
attested by the sender, not yet affirmed to the recipient). The sender sees
"waiting on attestation," which creates the social pressure that makes the
mailing-list model work: you ask your friend to vouch because a coin is waiting.

### The honest limit, and the discipline around it

Vouching affirms **attributes, not uniqueness**: nothing in a vouch stops one
human from being vouched into three wallets under three names — and
₲1,440/day is exactly what a Sybil farmer wants. So the graph carries
discipline, and this is load-bearing, not garnish:

- **Vouch budgets:** each member may hold only a limited number of live
  vouches (proposed POC default: 10). Scarcity makes members choosy.
- **Attester accountability:** a vouch is public on the attester's strand
  forever. When a wallet is *proven* fraudulent through the dispute process,
  its attesters lose standing — vouching for a fake is permanently expensive.
- **Challenge window:** modeled on Proof of Humanity — a new attestation can
  be disputed during a window (proposed POC default: 7 days); a successful
  dispute revokes and records the revocation as an event.
- **Revocation and expiry** are events, not edits — the graph's history is
  never rewritten, only superseded.
- Vouching **complements** §9A rather than replacing it: §9A's nullifier
  still anchors one-person-one-issuance where platform evidence exists; the
  trust graph stands alone where it doesn't. Either door can raise standing;
  both together raise it further.

### External attestation adapters: import evidence, never authority

Matthew's direction: link into **all** the existing trust networks, because
each independent source of evidence compounds — faking one graph is easy,
faking consistent standing across five unrelated systems is expensive. The
integration pattern is an **adapter**, and §9A's zkTLS is retroactively the
first one:

1. The adapter verifies evidence **natively** in the source system (a VC
   issuer's signature; a BrightID standing check via its node API; the Proof
   of Humanity registry state and vouch events on-chain; an EAS attestation
   via its indexer; PGP key-signing signatures from a keyserver).
2. It then mints a **Gcoin-native** `identity.attest` event on the subject's
   strand recording: source network, evidence hash, result, and timestamp —
   signed by whoever ran the verification (the subject importing their own
   proof, or a witness/accountant countersigning it).
3. The imported attestation carries a **weight cap**: no single external
   source may contribute more than a fixed share of standing, so one
   compromised or low-quality network (PGP keyservers are spam-ridden and
   their bindings self-asserted — lowest weight) cannot manufacture a
   trustworthy wallet alone.

Adapters are read-only and advisory. No external network is queried in the
transaction path, none can veto a wallet, and any client may ignore any
adapter. That is what keeps this consistent with the anti-Ripple line in
§8A/§9B: the networks are *witnesses*, never gatekeepers.

### Per-bit provenance: identity that rides on the coin, under the sender's control

§4 set a disclosure **level** (L0–L3) per transfer. Matthew's refinement:
access rights are set **per bit of identity data on the coin**. Each transfer
attaches a provenance envelope whose fields (sender name, email, photo, DID,
standing snapshot) each carry their own access class:

| Access class | Who can read the bit |
|---|---|
| `public` | Anyone holding or verifying the coin |
| `recipient` | The receiving wallet only |
| `attesters` | The sender's attesters of that attribute (they already know it) |
| `sealed` | No one by default; openable only by the sender re-issuing the key (e.g. in a dispute) |

Mechanics follow the stack already cited in §13: attribute values travel
peer-to-peer (never on a strand, §2A); the strand carries the envelope's
hashes. Selective disclosure uses SD-JWT / BBS+ — the recipient can verify
that a sealed bit *exists and is attested* (its hash matches a signed
attestation) without reading it, and can verify a revealed bit against its
hash. Each bit is encrypted under its own key; the key is wrapped for the
bit's access class. A coin therefore *retains* its sender's identity in
hidden form, exactly as much of it as the sender chose, bit by bit.

### Trust-chain evaluation: "did this coin come from a liar?"

Because transfers braid strands (§8A), every coin has a hash-linked lineage
of wallets. A receiving wallet can walk the coin's provenance chain and
evaluate each hop **as of now** — including retroactively:

- Was every hop's sender in good standing when they sent? Are they still?
- Has any attestation in the chain since been revoked, or any hop proven
  fraudulent in a dispute?
- Does the chain pass through a wallet that later had its vouches stripped?

The answer is a **local acceptance policy**, not a global verdict — e.g.
"auto-accept; warn me if any hop within 3 transfers is now revoked; ask me
before accepting coins whose origin wallet is unattested." Different wallets
will run different policies; that pluralism is the design. What the chain
buys is *accountability, not prevention*: a liar's past coins become
identifiably tainted once the lie is proven, and the proof propagates along
the very graph the lie traveled. Lying is therefore permanently expensive in
a way cash never is — while the minutes themselves remain real gratitude,
whose social value the recipient judges with full information.

### Fungibility and institutional stripping

Provenance creates a tension §4's strip only began to answer: lineage makes
coins **non-fungible in practice** — the mortal minute of a famous person
will be prized over an anonymous one (see §9E: that premium is a feature of
coins as *assets*, and a problem for coins as *currency*). Everyday commerce
needs uniform coins. §4 mode 3 (strip = audited re-mint, amounts conserved,
§10 scenario 5) therefore gains an institutional form:

- A **stripping service** (any institution or accountant node may offer one)
  accepts a provenance-bearing coin, executes the strip, and issues a fresh
  coin with an empty envelope plus the service's own attestation: "we hold
  the sealed provenance; amounts conserved." The service's attestation
  *replaces* the readable chain for downstream wallets.
- Stripped coins re-enter circulation uniform and interchangeable — currency.
  The sealed pre-strip provenance remains provable in a dispute through the
  service, so stripping buys fungibility without buying amnesia for fraud.
- Anyone may strip their *own* coins at any spend (§4); institutional
  stripping matters when a recipient's policy requires it (a merchant whose
  till only accepts uniform coins) — the service is the exchange window
  between the asset world and the currency world.

## 9E. Asset vs currency: coin aging, the half-life, and the circulation recharger (Matthew, 2026-10-23)

Spec v1.0 §14–15's thermodynamics — deferred as hooks in §1 — is now adopted
at the design level, because it resolves the duality §9D names: a coin that
can live forever becomes an *asset* people hoard; Gcoin's minutes are meant
to *move*. So Gratitude Coins **age**, and circulation is what keeps them
young. This section **supersedes** §2's "GC: persistent (no Pay Day expiry)"
and the cash-book line "nothing expires" in §3.1: GC have no *Pay Day*
expiry, but they do have a lifespan. (The POC wallet still treats GC as
persistent; aging is specified here, implemented later.)

### Vitality and half-life

Every coin carries a **vitality** derived from its idle time — the time
since its last transfer (or its mint, if never transferred):

```
vitality = 2 ^ (-(idle_time / half_life))
```

Vitality is a display and policy quantity (the wallet can show a coin
"fresh," "fading," "near frozen"); the hard protocol rule is the **freeze
age**: when a coin's idle time reaches the freeze threshold, the network
will not transact it — wallets must refuse to affirm transfers of frozen
coins, the same way they refuse double-spends (§7). Parameters are
Matthew's to tune (§12); proposed POC defaults for discussion: half-life
**30 days**, freeze at **6 half-lives (~180 days idle, vitality < 1/64)**.

### The circulation recharger

Circulation is the recharger: a completed transfer (the affirm event, §6)
**resets the coin's idle clock** — being given recharges the coin to full
vitality. Two anti-gaming rules keep the recharger honest:

- Recharge requires a transfer between **distinct wallets in good standing**
  (a coin passed between your own wallets, or around a wash ring, does not
  recharge — the trust graph of §9D is what makes "distinct" checkable).
- A coin can be recharged at most once per **recharge cooldown** (proposed:
  24h), so rapid ping-ponging can't keep a hoard artificially young.

Hoarding is therefore not merely discouraged but *impossible in effect*:
value you refuse to circulate dies on schedule, while the network's
generosity (each person's fresh 1,440 minutes tomorrow) is untouched.

### Freeze and death: the collector's ending

A frozen coin is not deleted and not confiscated. It stays in its wallet —
visible, verifiable, its provenance envelope and trust chain intact — but
**inert**: excluded from spendable balance, refused by the transfer
protocol, playing no further role in the network. Wallets show frozen coins
in a **collection** view, distinct from the cash book (§3.1 gains a third
line: *collection — frozen, held as keepsakes*).

This is deliberate, and it completes the asset/currency split:

- **Live coins are currency** — they circulate, they are recharged by being
  given, stripped coins among them are fungible (§9D).
- **Dead coins are pure assets** — memorabilia. A collector may *want* a
  famous person's mortal minute to die in their wallet: the provenance (§9D)
  is what makes it collectible, the freeze is what makes it final, and its
  death removes it from the monetary supply without anyone seizing it.
- **No revival.** A frozen coin can never be recharged or re-minted back
  into circulation (a strip of a frozen coin is refused like any transfer).
  Revival would resurrect hoarding with extra steps and break the finality
  collectors rely on.

Supply consequence, for the record: issuance is a constant 1,440/day/person
while death is a continuous sink, so the live supply self-limits around
active circulation rather than growing without bound — the thermodynamics
of Spec v1.0 §14–15, arriving where it was always pointing.

## 10. Double-spend scenarios the POC must demonstrate

1. **Same MM spent twice:** two `mm.spend→mint` events, same nullifier → second rejected.
2. **Same GC sent to two recipients:** two `gc.transfer` events consuming the same
   `coin_id` → second rejected; recipient B's wallet shows the conflict proof.
3. **Offline double-spend then sync:** A sends the same coin to B and C while offline;
   on sync, the log orders by (seq, hash) — first-seen wins, loser gets a signed
   rejection receipt they can show.
4. **Replay:** a captured payload re-submitted → nullifier already spent → rejected.
5. **Provenance strip ≠ money printing:** strip is spend+mint with amounts conserved;
   the log shows the linkage of amounts without the linkage of identity.

---

## 11. POC build plan (suggested milestones)

- **M1 — Wallet & identity:** PWA shell, WebAuthn wallet creation, mock verifier,
  email/photo capture, DID issuance. *Demo: "I am a unique person with a wallet."*
- **M2 — Issuance:** mortal-minute tick engine, 1440/day cap, Pay Day (04:00 local)
  window close + burn, accrual-vs-cash dual balance UI (§3.1). *Demo: watch coins accrue one per minute.*
- **M3 — Transfers:** WebRTC DataChannel + manual signaling, attest→assert→affirm
  ceremony, UTXO ledger, nullifier enforcement. *Demo: phone-to-phone transfer.*
- **M4 — Provenance:** attributed/pseudonymous/anonymous modes, strip-to-anonymous,
  recipient accept-policies. *Demo: same coin sent three ways.*
- **M5 — Contracts:** one_time / recurring / stream contracts, commit-vs-liquid
  budget bar, cancel. *Demo: "stream 1 coin/min to the busker while I watch."*
- **M6 — Hardening demo:** the five double-spend scenarios (§10) as a scripted
  test page, plus a signed anchor checkpoint export.

---

## 12. Open decisions for Matthew

1. ~~Tick vs lump~~ **DECIDED 2026-10-19:** per-minute accrual.
2. ~~Day boundary~~ **DECIDED 2026-10-19:** ledger clock is UTC; day windows anchor
   at **04:00 in the user's timezone** ("Pay Day"), with accrual-vs-cash dual books (§3).
3. ~~Default provenance~~ **DECIDED 2026-10-19:** ZK proofs by default; data-sharing
   level (L0–L3, §4) is determined by the two parties to each transfer. Also decided:
   everything is hash-committed and signed on-chain per §2A.
4. **Where should this live?** New branch in MattQuarneri/Gcoin (e.g.
   `agent/gcoin-poc`), keeping `main` untouched per your workflow — recommended.
5. **Scope of M1:** static single-file wallet first, or split files from the start?
   (Unrelated to §9C's "split wallet," which is now defined: one identity, many
   device keys, device strands. Also recorded in §9C: Key-List threshold defaults —
   1-of-n for transfers, 2 keys or recovery for key changes — and the 24h recovery-
   rotation delay; both are POC parameters Matthew may tune.)
6. **Ledger anchoring in POC:** signed checkpoint file only, or also a real testnet
   anchor (adds complexity, adds credibility)?
7. **Trust-graph parameters (§9D, v0.4):** standing threshold N, vouch budget,
   attestation expiry, dispute window — POC defaults proposed in §9D
   (N = 2 clusters, budget 10, 1-year expiry, 7-day window); tune or adopt?
8. **Adapter weights (§9D):** the per-source weight cap and the relative
   weights (VC/EAS and BrightID high; Proof of Humanity mid; PGP low) —
   adopt as proposed, or set a different table?
9. **Aging parameters (§9E):** half-life (proposed 30 days), freeze threshold
   (proposed ~6 half-lives / 180 days idle), recharge cooldown (proposed 24h).
   These set the economy's circulation pressure; they are Matthew's to set.
10. **Institutional stripping (§9D):** who may run a stripping service at
    launch — accountant nodes only, or any institution in good standing?

---

## 13. Requirements traceability

| Matthew's requirement | Repo grounding | POC answer |
|---|---|---|
| ₲1,440/day, one per mortal minute | Spec v1.0 §3, §13 State 1; Abstract §3.1 (1440, 1/min from midnight) | §3: per-minute tick, 1440 cap, Pay Day burn |
| UTC clock, 04:00 Pay Day, TZ-shifted windows, accrual vs cash (2026-10-19) | Abstract §3.1 Midnight Rule (shifted, intent preserved) | §3, §3.1: window `[04:00 local, +24h)` in UTC epochs; rolling-24h anti-abuse cap; dual books |
| Genesis provenance attested by the MonyTyme domain (2026-10-19) | — (new; W3C did:web pattern) | §9B: did:web DID doc + `/.well-known/gcoin.json` + DNS TXT `_gcoin`, genesis block binds all three |
| Graph/knot ledger, not one global chain; witness super-nodes without privilege; domain never in the tx path (2026-10-20) | Spec v1.0 §10 (distributed event ledger, anchored) | §8A: per-person strands + dual-signed braids, DHT discovery, witness = availability/rendezvous/checkpoint/fork-watch only |
| One wallet across Chrome/Safari/iPhone; multi-device = loss protection; printed-QR offline recovery (2026-10-20) | — (new) | §9C: identity = DID + versioned Key List (1-of-n device keys sign; 2-of-n or recovery for key changes), iCloud synced passkey + Chrome passkey as separate entries, device strands + disjoint MM allotments prevent self-forks, encrypted-seed QR sheet + passphrase, recovery rotation with 24h cancel window, optional SLIP-39 split |
| Smart contracts assigning coins | Abstract §3.2 (smart-contract-enforced distribution); Reimagining §3, §5 | §5: one_time / recurring / stream |
| Provenance bound to email + photo | Reimagining §4.1 (identity binding incl. email); Abstract §3.1 ("credits can be attributed… carry providence") | §4: hash-bound envelope, three modes |
| Spender can separate coin from provenance (anonymous) | Abstract §2 ("spend each one either anonymously or with their identity attached"); Spec v1.0 §7 | §4 mode 3: strip = audited re-mint |
| WebAuthn for authorization | — (new; repo is silent on authN mechanics) | §6: passkey = wallet key, attest/assert |
| WebRTC for connection | — (new; repo assumes network abstractly) | §6: DataChannel transfer + sync |
| Blockchained signatures: attest/assert/affirm | Spec v1.0 §10 (immutable ledger, signed transactions) | §6–7: three-verb ceremony, hash-chained log |
| Double-spend protection | Spec v1.0 §13 (MM spent exactly once; First Law) | §7, §10: nullifiers, UTXO, five test scenarios |
| Everything connected on-chain with signed hashes (2026-10-19) | Spec v1.0 §10 (anchored event ledger) | §2A: all events signed + hash-linked; batch Merkle roots anchored on public chain |
| Web2/LinkedIn attestation without LinkedIn's help (2026-10-19) | Spec v1.0 §6 (decentralized trust graph, multiple attestations) | §9A: zkTLS — cert-anchored session proof → ZK claim → profile-nullifier Sybil guard |
| ZK proofs default, data sharing set by the parties (2026-10-19) | idea.md (selective-disclosure VCs, BBS+/SD-JWT) | §4 L0–L3 levels, default L0; §2A rule 4: private data never on-chain |
| Joining by vouching: members attest a joiner's self-submitted name/email/photo; unattested wallets can't receive (2026-10-22) | Spec v1.0 §6 (decentralized trust graph, multiple attestations) | §9D: `identity.attest` events per attribute, standing + pending-receipt rule, vouch budgets, challenge window, attester accountability |
| Link into all external trust networks as compounding evidence (2026-10-23) | — (new; BrightID / Proof of Humanity / EAS / PGP / Human Passport are external systems) | §9D adapters: verify natively, import as weighted Gcoin-native attestations, per-source weight caps; advisory only, never in the tx path |
| Identity retained (hidden) on the coin; sender sets access rights per bit; trust chain exposes liars (2026-10-23) | idea.md (selective-disclosure VCs, BBS+/SD-JWT); §4 L0–L3 (refined, not replaced) | §9D per-bit provenance envelope (public/recipient/attesters/sealed) + trust-chain evaluation as local acceptance policy |
| Institutions strip identity so coins stay fungible (2026-10-23) | Abstract §2; Spec v1.0 §7 | §9D institutional stripping: §4 mode 3 + service attestation replacing the readable chain; sealed pre-strip provenance retained for disputes |
| Coins age with a half-life tied to circulation; frozen at max age; hoarding impossible; collectors may hold dead coins (2026-10-23) | Spec v1.0 §14–15 (thermodynamics: vitality decay/recharge) | §9E: vitality = 2^(−idle/half-life); circulation recharger (distinct-standing wallets, cooldown); freeze = inert collectible in the collection view; no revival |

*Deliberate deviations from repo docs in the POC:* per-minute accrual chosen over
ambiguous lump issuance; 60/40 committed/liquid floats reduced to a budget bar;
vitality decay specified in §9E (v0.4) but not implemented in the POC;
proof-of-personhood mocked.
