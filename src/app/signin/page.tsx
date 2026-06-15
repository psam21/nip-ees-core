'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuth';
import { decodeNsec, generateNsecHex, isValidNsec, nsecHexToNsec } from '@/lib/keys';

export default function SignInPage() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signIn);
  const [nsecInput, setNsecInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidNsec(nsecInput)) {
      setError('That doesn’t look like a valid nsec.');
      return;
    }
    const hex = decodeNsec(nsecInput);
    signIn(hex);
    router.replace('/');
  };

  const handleGenerate = () => {
    const hex = generateNsecHex();
    setNsecInput(nsecHexToNsec(hex));
    setError(null);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-4">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">
          ← back
        </Link>
        <h1 className="text-2xl font-semibold">Sign in with your nsec</h1>
        <p className="text-sm text-gray-400">
          Your nsec stays in this browser. The site never sees it. To make
          NIP-EES identities, your nsec is combined with a passphrase
          locally — the passphrase is the secret that unlocks each
          messaging identity.
        </p>

        <form onSubmit={handleSignIn} className="flex flex-col gap-3 mt-2">
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="nsec1..."
            value={nsecInput}
            onChange={(e) => setNsecInput(e.target.value.trim())}
            className="px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 focus:border-purple-400 outline-none font-mono text-sm"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={!nsecInput}
            className="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold disabled:opacity-40"
          >
            Continue
          </button>
        </form>

        <div className="border-t border-gray-800 pt-4 mt-2">
          <p className="text-xs text-gray-500 mb-2">No nsec yet?</p>
          <button
            type="button"
            onClick={handleGenerate}
            className="text-sm text-purple-300 hover:text-purple-200"
          >
            Generate a fresh one →
          </button>
        </div>
      </div>
    </main>
  );
}
