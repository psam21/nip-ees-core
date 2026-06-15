# NIP-EES Core

Minimal reference implementation of **NIP-EES** + **NIP-17** 1:1 direct messages.

The whole project is ~20 files. No production polish, no analytics, no
multi-protocol routing — just the protocol primitives and a working UI to
demonstrate them end-to-end.

This is the smallest possible buildable subset of [chattr.buzz](https://chattr.buzz)
that you can run, audit, and extend.

---

## What is NIP-EES?

A scheme for deriving a **completely independent Nostr messaging identity**
from a regular `nsec` plus a per-context passphrase, such that:

- Same `nsec` + same passphrase = same messaging identity, every time.
- Same `nsec` + **different** passphrase = a completely separate identity
  with no on-wire link to the first.
- Forgetting the passphrase = the derived identity is sealed forever.
  There is no recovery path. The `nsec` alone cannot reconstruct it.

The derivation pipeline:

```
1. salt = SHA256(npubBytes || "nip-ees")
2. passphraseHash = scrypt(passphrase, salt, N=2^19, r=8, p=1, dkLen=32)
3. messagingPrivkey = HKDF-SHA256(nsecBytes, passphraseHash, "nip-ees-messaging", 32)
4. messagingPubkey = secp256k1(messagingPrivkey)
```

Messages are sent as standard **NIP-17 gift wraps** (kind:1059 → kind:13 →
kind:14), with a `["encrypted", "nip-ees", "v1"]` tag on the inner rumor so
NIP-EES-aware clients can recognize the marker and extend behavior.

---

## Run it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

You'll go through:

1. **Sign in** — paste an existing `nsec` or generate a fresh one.
2. **Create** a derived identity — pick a name and a passphrase.
3. **Messaging** — paste a recipient `npub`, send a message, watch it arrive
   from the other side (try opening another browser profile with a
   different identity).

To simulate two users on the same machine:

- Browser A: sign in, create identity A, copy your `npub` from the top bar.
- Browser B (incognito or different profile): sign in with a different
  `nsec`, create identity B, paste A's `npub`, send a hello.
- Switch back to Browser A — A's conversation list will show B's message.

---

## File map

```
src/
  lib/
    crypto.ts       — NIP-EES key derivation (SHA256 → scrypt → HKDF)
    keys.ts         — bech32 helpers (nsec/npub encoding/decoding)
    giftWrap.ts     — NIP-17 rumor → seal → gift-wrap construction + unwrap
    relay.ts        — SimplePool wrapper, publish + subscribe
  stores/
    useAuth.ts      — nsec + parent pubkey (persisted)
    useIdentity.ts  — active derived identity (persisted)
    useMessaging.ts — conversations + messages (in-memory)
  app/
    page.tsx        — landing → routes to signin / create / messaging
    signin/page.tsx — paste/generate nsec
    create/page.tsx — name + passphrase → derive identity
    unlock/page.tsx — passphrase → re-derive existing identity
    messaging/page.tsx — subscribe + send + display conversations
```

That's the entire surface. ~20 files.

---

## Production differences

The full app at [chattr.buzz](https://chattr.buzz) includes — none of which
are in this core demo:

- MLS/Marmot group chat (kind:443/444/445)
- Encrypted Vault (file storage on Blossom)
- Encrypted Email (kind:30078 metadata + SES)
- 1:1 voice/video calls (NIP-100, kind:25050)
- Lightning payments (NWC, Cashu, LNURL-pay)
- Push notifications (web-push, EC2 worker)
- Profile editing (kind:0)
- NIP-05 verification (`@chattr.buzz` handles)
- Backup/recovery flows
- Multi-relay first-success publishing with retry
- Per-epoch fallback decryption
- Two-table event dedup (in-memory + IndexedDB)
- Block / mute / read-receipt UX
- Service worker, PWA install
- Test suite (vitest known-answer + Playwright e2e)

---

## License

This reference implementation is intended for adoption — MIT or your
choice. The protocol itself is what matters; the implementation is a
demonstration.
