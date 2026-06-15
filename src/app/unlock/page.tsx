'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuth';
import { useIdentity } from '@/stores/useIdentity';
import { deriveMessagingKeypair } from '@/lib/crypto';

/**
 * Unlock — same derivation as create, but no separate confirm field.
 *
 * Note: there's no "verify the passphrase is correct" check by design.
 * If the wrong passphrase is entered, the user gets a different derived
 * identity. There's no way for us to know which one is "right" — the
 * passphrase IS the identity.
 */
export default function UnlockPage() {
  const router = useRouter();
  const nsecHex = useAuth((s) => s.nsecHex);
  const setActive = useIdentity((s) => s.setActive);

  const [name, setName] = useState('My identity');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!nsecHex) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-gray-400">You need to sign in first.</p>
        <Link href="/signin" className="text-purple-300">→ Sign in</Link>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passphrase) return setError('Enter your passphrase.');
    setBusy(true);
    try {
      const { privkey, pubkey } = await deriveMessagingKeypair(
        nsecHex,
        passphrase,
      );
      setActive({ name: name.trim() || 'My identity', privkey, pubkey });
      setPassphrase('');
      router.replace('/messaging');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Derivation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-4">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">
          ← back
        </Link>
        <h1 className="text-2xl font-semibold">Unlock your identity</h1>
        <p className="text-sm text-gray-400">
          Enter the passphrase you used when you created this identity.
          Same passphrase = same messaging keypair, every time.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
          <input
            type="text"
            placeholder="Display name (you only)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 focus:border-purple-400 outline-none"
          />
          <input
            type="password"
            autoComplete="off"
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 focus:border-purple-400 outline-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold disabled:opacity-40"
          >
            {busy ? 'Deriving…' : 'Unlock'}
          </button>
        </form>
      </div>
    </main>
  );
}
