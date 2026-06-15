/**
 * Auth store — holds the user's nsec (hex) and derived pubkey.
 *
 * Persisted to localStorage. Per NIP-EES design, the nsec is intentionally
 * persisted: it is the "decoy" key — without the per-identity passphrase,
 * the nsec alone reveals nothing about any derived messaging identity.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { pubkeyFromNsec } from '@/lib/keys';

interface AuthState {
  /** Hex nsec — null when not signed in. */
  nsecHex: string | null;
  /** Hex pubkey derived from the nsec — null when not signed in. */
  pubkey: string | null;

  signIn: (nsecHex: string) => void;
  signOut: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      nsecHex: null,
      pubkey: null,

      signIn: (nsecHex) => {
        const pubkey = pubkeyFromNsec(nsecHex);
        set({ nsecHex, pubkey });
      },

      signOut: () => {
        set({ nsecHex: null, pubkey: null });
      },
    }),
    {
      name: 'nip-ees-core-auth',
    },
  ),
);
