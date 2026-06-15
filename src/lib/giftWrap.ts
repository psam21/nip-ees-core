/**
 * NIP-17 Gift-Wrapped Direct Messages with NIP-EES marker.
 *
 * Layering:
 *   Rumor (kind:14, unsigned) — the actual message content
 *     ↓ encrypted to recipient via NIP-44
 *   Seal (kind:13, signed by sender)
 *     ↓ encrypted to recipient via NIP-44 with a one-time random key
 *   Gift Wrap (kind:1059, signed by the one-time key)
 *
 * The NIP-EES marker tag `["encrypted", "nip-ees", "v1"]` is added to the
 * rumor so receiving clients can distinguish NIP-EES traffic from generic
 * NIP-17 DMs (epoch routing, future protocol extensions).
 *
 * Sender publishes TWO gift wraps per message: one to the recipient, one
 * to themselves (so they can read their own outgoing message thread).
 */
import {
  finalizeEvent,
  generateSecretKey,
  getEventHash,
  getPublicKey,
  verifyEvent,
} from 'nostr-tools/pure';
import { nip44 } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export type UnsignedEvent = Omit<NostrEvent, 'sig'>;

const KIND_RUMOR = 14;
const KIND_SEAL = 13;
const KIND_GIFT_WRAP = 1059;

/** Random offset between 0 and 48h, used to fuzz seal/gift-wrap timestamps. */
function randomPastOffsetSeconds(): number {
  // 48h × 60m × 60s = 172800s
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % 172800;
}

function nip44Encrypt(
  senderPrivkeyHex: string,
  recipientPubkeyHex: string,
  plaintext: string,
): string {
  const conversationKey = nip44.v2.utils.getConversationKey(
    hexToBytes(senderPrivkeyHex),
    recipientPubkeyHex,
  );
  return nip44.v2.encrypt(plaintext, conversationKey);
}

function nip44Decrypt(
  recipientPrivkeyHex: string,
  senderPubkeyHex: string,
  ciphertext: string,
): string {
  const conversationKey = nip44.v2.utils.getConversationKey(
    hexToBytes(recipientPrivkeyHex),
    senderPubkeyHex,
  );
  return nip44.v2.decrypt(ciphertext, conversationKey);
}

/**
 * Build an unsigned kind:14 NIP-EES rumor.
 */
export function createEESRumor(
  senderPubkeyHex: string,
  recipientPubkeyHex: string,
  content: string,
): UnsignedEvent {
  const created_at = Math.floor(Date.now() / 1000);
  const tags: string[][] = [
    ['p', recipientPubkeyHex],
    ['encrypted', 'nip-ees', 'v1'],
  ];
  const rumorWithoutId = {
    kind: KIND_RUMOR,
    pubkey: senderPubkeyHex,
    created_at,
    tags,
    content,
  };
  const id = getEventHash(rumorWithoutId);
  return { ...rumorWithoutId, id };
}

/**
 * Wrap a rumor as a NIP-17 gift wrap addressed to a single recipient.
 */
export async function createGiftWrappedMessage(
  rumor: UnsignedEvent,
  senderPrivkeyHex: string,
  recipientPubkeyHex: string,
): Promise<NostrEvent> {
  // 1. Seal: encrypt the rumor to the recipient, sign with the sender key.
  const sealContent = nip44Encrypt(
    senderPrivkeyHex,
    recipientPubkeyHex,
    JSON.stringify(rumor),
  );
  const seal = finalizeEvent(
    {
      kind: KIND_SEAL,
      created_at: Math.floor(Date.now() / 1000) - randomPastOffsetSeconds(),
      tags: [],
      content: sealContent,
    },
    hexToBytes(senderPrivkeyHex),
  ) as NostrEvent;

  // 2. Gift wrap: encrypt the seal to the recipient with a one-time key,
  //    sign with that one-time key.
  const ephemeralPrivkey = generateSecretKey();
  const giftContent = nip44Encrypt(
    bytesToHex(ephemeralPrivkey),
    recipientPubkeyHex,
    JSON.stringify(seal),
  );
  const giftWrap = finalizeEvent(
    {
      kind: KIND_GIFT_WRAP,
      created_at: Math.floor(Date.now() / 1000) - randomPastOffsetSeconds(),
      tags: [['p', recipientPubkeyHex]],
      content: giftContent,
    },
    ephemeralPrivkey,
  ) as NostrEvent;

  return giftWrap;
}

/**
 * Unwrap a gift-wrapped message addressed to `recipientPrivkey`.
 *
 * Returns null if any signature is invalid or decryption fails (the gift
 * wrap was for a different recipient or has been tampered with).
 */
export async function unwrapGiftWrap(
  giftWrap: NostrEvent,
  recipientPrivkeyHex: string,
): Promise<{ rumor: UnsignedEvent; sealerPubkey: string } | null> {
  try {
    if (!verifyEvent(giftWrap)) return null;

    const sealJson = nip44Decrypt(
      recipientPrivkeyHex,
      giftWrap.pubkey,
      giftWrap.content,
    );
    const seal = JSON.parse(sealJson) as NostrEvent;
    if (!verifyEvent(seal)) return null;

    const rumorJson = nip44Decrypt(
      recipientPrivkeyHex,
      seal.pubkey,
      seal.content,
    );
    const rumor = JSON.parse(rumorJson) as UnsignedEvent;

    // NIP-17 MUST: seal pubkey is the authoritative sender identity.
    // Use it even if the rumor pubkey differs (anti-impersonation).
    return {
      rumor: { ...rumor, pubkey: seal.pubkey },
      sealerPubkey: seal.pubkey,
    };
  } catch {
    return null;
  }
}

/**
 * Convenience: detect whether a rumor carries the NIP-EES marker tag.
 */
export function isEESRumor(rumor: UnsignedEvent): boolean {
  return rumor.tags.some(
    (t) => t[0] === 'encrypted' && t[1] === 'nip-ees',
  );
}

// Re-export for callers who need to derive sender pubkey from a privkey.
export { getPublicKey };
