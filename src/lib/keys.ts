/**
 * Bech32 (nsec/npub) helpers.
 *
 * All `nip19` access is centralized here so the rest of the codebase
 * works with hex-encoded keys.
 */
import { nip19 } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { getPublicKey, generateSecretKey } from 'nostr-tools/pure';

/** Convert a hex pubkey to bech32-encoded npub. */
export function pubkeyToNpub(pubkeyHex: string): string {
  return nip19.npubEncode(pubkeyHex);
}

/** Convert a hex secret key to bech32-encoded nsec. */
export function nsecHexToNsec(nsecHex: string): string {
  return nip19.nsecEncode(hexToBytes(nsecHex));
}

/** Decode an nsec (bech32) → hex secret key. Throws on invalid input. */
export function decodeNsec(nsec: string): string {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') {
    throw new Error(`Expected nsec, got ${decoded.type}`);
  }
  return bytesToHex(decoded.data);
}

/** Decode an npub (bech32) → hex pubkey. Throws on invalid input. */
export function decodeNpub(npub: string): string {
  const decoded = nip19.decode(npub);
  if (decoded.type !== 'npub') {
    throw new Error(`Expected npub, got ${decoded.type}`);
  }
  return decoded.data;
}

/** Validate that a string is a syntactically correct nsec. */
export function isValidNsec(nsec: string): boolean {
  try {
    decodeNsec(nsec);
    return true;
  } catch {
    return false;
  }
}

/** Validate that a string is a syntactically correct npub. */
export function isValidNpub(npub: string): boolean {
  try {
    decodeNpub(npub);
    return true;
  } catch {
    return false;
  }
}

/** Truncate a hex pubkey for display: `abcd1234…wxyz5678`. */
export function truncatePubkey(pubkey: string): string {
  if (!pubkey || pubkey.length < 16) return pubkey;
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`;
}

/** Generate a fresh random nsec and return its hex form. */
export function generateNsecHex(): string {
  return bytesToHex(generateSecretKey());
}

/** Derive a hex pubkey from an nsec hex secret key. */
export function pubkeyFromNsec(nsecHex: string): string {
  return getPublicKey(hexToBytes(nsecHex));
}
