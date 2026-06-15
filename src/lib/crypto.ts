/**
 * NIP-EES Key Derivation
 *
 * Pipeline:
 *   1. salt = SHA256(npubBytes || "nip-ees")
 *   2. passphraseHash = scrypt(passphrase, salt, N=2^19, r=8, p=1, dkLen=32)
 *   3. messagingPrivkey = HKDF-SHA256(nsecBytes, passphraseHash, "nip-ees-messaging", 32)
 *   4. messagingPubkey = secp256k1(messagingPrivkey)
 *
 * The same nsec + passphrase always produces the same messaging keypair.
 * The same nsec with a DIFFERENT passphrase produces a completely separate
 * messaging keypair — this is the "epoch shield" property.
 *
 * No recovery by design: forgetting the passphrase = the derived identity
 * is sealed forever. The nsec alone cannot reconstruct it.
 */
import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';
import { scryptAsync } from '@noble/hashes/scrypt';
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from '@noble/hashes/utils';
import { getPublicKey } from 'nostr-tools/pure';

export interface DerivedIdentity {
  /** Hex private key for the derived messaging identity */
  privkey: string;
  /** Hex public key for the derived messaging identity */
  pubkey: string;
}

/** scrypt parameters, fixed by NIP-EES spec. */
const SCRYPT_N = 2 ** 19;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const DK_LEN = 32;

/** Salt domain string. */
const SALT_DOMAIN = 'nip-ees';

/** HKDF info string for the messaging key. */
const HKDF_INFO = 'nip-ees-messaging';

/**
 * Derive the salt = SHA256(pubkeyBytes || "nip-ees").
 * `pubkeyHex` is the npub-pubkey derived from the user's nsec, in hex.
 */
export function deriveSalt(pubkeyHex: string): Uint8Array {
  return sha256(concatBytes(hexToBytes(pubkeyHex), utf8ToBytes(SALT_DOMAIN)));
}

/**
 * Run scrypt(passphrase, salt) → 32-byte hash.
 * Pure JS — runs in the browser, ~2–4s on a modern laptop.
 */
export async function scryptPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  return scryptAsync(passphrase, salt, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    dkLen: DK_LEN,
  });
}

/**
 * Full derivation: nsec + passphrase → derived messaging keypair.
 *
 * @param nsecHex - User's secret key (hex, NOT bech32-encoded)
 * @param passphrase - Per-identity passphrase
 * @returns Derived messaging keypair
 */
export async function deriveMessagingKeypair(
  nsecHex: string,
  passphrase: string,
): Promise<DerivedIdentity> {
  const nsecBytes = hexToBytes(nsecHex);
  const pubkeyHex = getPublicKey(nsecBytes);
  const salt = deriveSalt(pubkeyHex);
  const passphraseHash = await scryptPassphrase(passphrase, salt);

  const messagingPrivkey = hkdf(
    sha256,
    nsecBytes,
    passphraseHash,
    utf8ToBytes(HKDF_INFO),
    DK_LEN,
  );
  const messagingPubkey = getPublicKey(messagingPrivkey);

  return {
    privkey: bytesToHex(messagingPrivkey),
    pubkey: messagingPubkey,
  };
}
