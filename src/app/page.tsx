'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/useAuth';
import { useIdentity } from '@/stores/useIdentity';
import { truncatePubkey, pubkeyToNpub } from '@/lib/keys';

/**
 * Landing page.
 *
 *   - Not signed in        → /signin
 *   - Signed in, no active → /unlock (or /create for first-time)
 *   - Signed in + unlocked → /messaging
 */
export default function HomePage() {
  const router = useRouter();
  const { nsecHex, pubkey, signOut } = useAuth();
  const { active, lock } = useIdentity();

  useEffect(() => {
    if (active) router.replace('/messaging');
  }, [active, router]);

  if (!nsecHex) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        <Header />
        <p className="text-gray-400 max-w-md text-center">
          A minimal reference implementation of{' '}
          <strong className="text-purple-400">NIP-EES</strong>: derive a
          completely separate Nostr messaging identity from your nsec + a
          per-context passphrase. Send NIP-17 gift-wrapped DMs with it.
          Same nsec + different passphrase = different identity.
        </p>
        <Link
          href="/signin"
          className="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold"
        >
          Sign in with nsec
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-4">
      <Header />
      <p className="text-gray-300">
        Signed in as <code className="text-purple-300">{truncatePubkey(pubkey ?? '')}</code>
      </p>
      <p className="text-xs text-gray-500 font-mono break-all max-w-md text-center">
        {pubkey ? pubkeyToNpub(pubkey) : ''}
      </p>
      <div className="flex gap-3 mt-2">
        <Link
          href="/create"
          className="px-5 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold"
        >
          Create derived identity
        </Link>
        <Link
          href="/unlock"
          className="px-5 py-2 rounded-lg border border-gray-700 hover:border-purple-400"
        >
          Unlock derived identity
        </Link>
      </div>
      <button
        type="button"
        onClick={() => {
          lock();
          signOut();
        }}
        className="text-xs text-gray-500 hover:text-gray-300 mt-6 underline"
      >
        Sign out (clears nsec from this browser)
      </button>
    </main>
  );
}

function Header() {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold tracking-tight">
        <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          NIP-EES Core
        </span>
      </h1>
      <p className="text-xs text-gray-500 mt-1 font-mono">
        nsec + passphrase → derived messaging identity
      </p>
    </div>
  );
}
