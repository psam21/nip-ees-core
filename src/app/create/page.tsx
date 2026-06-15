'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuth';
import { useIdentity } from '@/stores/useIdentity';
import { deriveMessagingKeypair } from '@/lib/crypto';
import { truncatePubkey } from '@/lib/keys';

/**
 * Create a NEW derived identity from the current nsec + a fresh passphrase.
 *
 * The user provides:
 *   - a display name (any string, just for UI)
 *   - a passphrase (any string — but in production we recommend 2+ words)
 *
 * We derive `(privkey, pubkey)` for the messaging identity and save it.
 * The passphrase is NEVER persisted.
 */
export default function CreatePage() {
  const router = useRouter();
  const nsecHex = useAuth((s) => s.nsecHex);
  const setActive = useIdentity((s) => s.setActive);

  const [name, setName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
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

    if (!name.trim()) return setError('Pick a display name.');
    if (passphrase.length === 0) return setError('Passphrase cannot be empty.');
    if (passphrase !== confirm) return setError('Passphrases don’t match.');

    setBusy(true);
    try {
      const { privkey, pubkey } = await deriveMessagingKeypair(
        nsecHex,
        passphrase,
      );
      setActive({ name: name.trim(), privkey, pubkey });
      // Clear passphrase from state before navigating.
      setPassphrase('');
      setConfirm('');
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
        <h1 className="text-2xl font-semibold">Create a derived identity</h1>
        <p className="text-sm text-gray-400">
          Same nsec + a NEW passphrase → a brand new messaging identity that
          looks completely unrelated on the wire. Forget the passphrase = the
          identity is sealed forever (no recovery).
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
            autoComplete="new-password"
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 focus:border-purple-400 outline-none"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm passphrase"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 focus:border-purple-400 outline-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold disabled:opacity-40"
          >
            {busy ? 'Deriving (this takes a few seconds)…' : 'Derive identity'}
          </button>
          {busy && (
            <p className="text-xs text-gray-500 text-center">
              Running scrypt(N=2²¹) + HKDF-SHA256 in your browser.
            </p>
          )}
        </form>

        <p className="text-xs text-gray-600 mt-2 font-mono">
          parent: {truncatePubkey(useAuth.getState().pubkey ?? '')}
        </p>
      </div>
    </main>
  );
}
