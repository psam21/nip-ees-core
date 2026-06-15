# NIP-EES Core

A working **NIP-EES** + **NIP-17** Nostr client.

Sign in with an `nsec`. Pick a passphrase. The nsec and passphrase derive
an independent messaging keypair on your device — used to send and receive
end-to-end encrypted DMs. The nsec never leaves the browser. The passphrase
is never stored anywhere.

Same `nsec` + same passphrase always produces the same messaging identity.
Same `nsec` + a different passphrase produces a completely separate
identity. The two identities have no on-wire relationship.

---

## NIP-EES

Identity derivation:

```
1. salt           = SHA256(npubBytes ‖ "nip-ees")
2. passphraseHash = scrypt(passphrase, salt, N=2^19, r=8, p=1, dkLen=32)
3. messagingPriv  = HKDF-SHA256(nsecBytes, passphraseHash, "nip-ees-messaging", 32)
4. messagingPub   = secp256k1(messagingPriv)
```

The derivation is intentionally one-way and passphrase-bound. If the
passphrase is forgotten, the derived identity is sealed forever — the
nsec alone cannot reconstruct it. There is no recovery path. This is
the primary security property.

Messages are standard **NIP-17** gift wraps (`kind:1059` → `kind:13` →
`kind:14`), with a `["encrypted", "nip-ees", "v1"]` tag on the rumor so
NIP-EES-aware clients recognize the marker.

---

## Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Flow:

1. Sign in with an existing `nsec` or generate a fresh one.
2. Create an identity — name + passphrase.
3. Paste a recipient `npub`, send a message.

To talk to yourself across two identities: open the app in a second
browser profile (or incognito), sign in with a different nsec, create a
second identity, and message between them using each side's `npub`.

---

## Source

```
src/lib/
  crypto.ts       NIP-EES key derivation (SHA256 → scrypt → HKDF)
  giftWrap.ts     NIP-17 rumor → seal → gift wrap, plus unwrap
  keys.ts         bech32 helpers (nsec ↔ npub ↔ hex)
  relay.ts        SimplePool wrapper — publish + subscribe

src/stores/
  useAuth.ts      nsec + parent pubkey
  useIdentity.ts  active derived identity
  useMessaging.ts conversations

src/app/
  page.tsx              landing
  signin/page.tsx       paste/generate nsec
  create/page.tsx       name + passphrase → derive
  unlock/page.tsx       passphrase → re-derive
  messaging/page.tsx    subscribe + send + display
```

14 source files. ~1,200 LOC.

---

## Beyond NIP-EES + NIP-17

Production at [chattr.buzz](https://chattr.buzz) layers additional
protocols on top of the same identity primitive:

- MLS / Marmot group chat (kinds 443, 444, 445)
- Encrypted file vault on Blossom
- Encrypted email over `kind:30078` and SES
- 1:1 voice and video over NIP-100 (`kind:25050`)
- Lightning payments (NWC, Cashu, LNURL-pay)
- Web Push, NIP-05 verification, kind:0 profiles

Each of those builds on the derived messaging identity that this project
implements.

---

## License

MIT.
