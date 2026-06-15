/**
 * Identity store — holds the active derived messaging identity.
 *
 * The derived privkey is held in memory + persisted to localStorage so
 * the active identity survives page reload. Lock = clear from memory and
 * storage; the user must re-enter the passphrase to derive it again.
 *
 * IMPORTANT: passphrases are NEVER persisted anywhere.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DerivedIdentity {
  /** Display name for this identity (user-supplied). */
  name: string;
  /** Hex private key (derived). */
  privkey: string;
  /** Hex public key (derived). */
  pubkey: string;
}

interface IdentityState {
  /** Currently active derived identity, or null if locked. */
  active: DerivedIdentity | null;

  setActive: (identity: DerivedIdentity) => void;
  lock: () => void;
}

export const useIdentity = create<IdentityState>()(
  persist(
    (set) => ({
      active: null,
      setActive: (identity) => set({ active: identity }),
      lock: () => set({ active: null }),
    }),
    {
      name: 'nip-ees-core-identity',
    },
  ),
);
