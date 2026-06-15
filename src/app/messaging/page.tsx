'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/stores/useIdentity';
import { useMessaging, type Message } from '@/stores/useMessaging';
import {
  createEESRumor,
  createGiftWrappedMessage,
  isEESRumor,
  unwrapGiftWrap,
  type NostrEvent,
} from '@/lib/giftWrap';
import { publishEvent, subscribeEvents, type SubscriptionHandle } from '@/lib/relay';
import {
  decodeNpub,
  isValidNpub,
  pubkeyToNpub,
  truncatePubkey,
} from '@/lib/keys';

/**
 * Messaging surface.
 *
 *   - Subscribes to kind:1059 gift wraps for the active derived pubkey.
 *   - Decrypts each one. If the inner rumor carries the NIP-EES marker,
 *     route it into the conversation list keyed by partner pubkey.
 *   - Lets the user paste a partner npub + a message, and sends:
 *       1) a gift wrap to the partner
 *       2) a self-copy gift wrap to themselves (so they see their thread)
 */
export default function MessagingPage() {
  const router = useRouter();
  const active = useIdentity((s) => s.active);
  const lock = useIdentity((s) => s.lock);
  const conversations = useMessaging((s) => s.conversations);
  const addMessage = useMessaging((s) => s.addMessage);
  const reset = useMessaging((s) => s.reset);

  const [partnerNpub, setPartnerNpub] = useState('');
  const [draft, setDraft] = useState('');
  const [activePartner, setActivePartner] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subRef = useRef<SubscriptionHandle | null>(null);

  // Redirect to home if no active identity.
  useEffect(() => {
    if (!active) router.replace('/');
  }, [active, router]);

  // Subscribe to gift wraps addressed to me.
  useEffect(() => {
    if (!active) return;
    reset();
    const myPubkey = active.pubkey;

    subRef.current = subscribeEvents(
      // NIP-59 spec: random past timestamps within ~48h, so no `since` filter.
      { kinds: [1059], '#p': [myPubkey] },
      async (event: NostrEvent) => {
        const result = await unwrapGiftWrap(event, active.privkey);
        if (!result) return; // not for me, or invalid signature
        const { rumor, sealerPubkey } = result;
        if (!isEESRumor(rumor)) return; // not a NIP-EES message

        // Recipient lives in the rumor's `p` tag. The conversation partner
        // is whichever side of (sender, recipient) is NOT me.
        const recipient = rumor.tags.find((t) => t[0] === 'p')?.[1];
        const outgoing = sealerPubkey === myPubkey;
        const partner = outgoing ? recipient : sealerPubkey;
        if (!partner) return;

        const message: Message = {
          id: event.id,
          authorPubkey: sealerPubkey,
          content: rumor.content,
          createdAt: rumor.created_at,
          outgoing,
        };
        addMessage(partner, message);
      },
    );

    return () => {
      subRef.current?.close();
      subRef.current = null;
    };
  }, [active, addMessage, reset]);

  if (!active) return null;

  const partnerList = Object.keys(conversations).sort((a, b) => {
    const ma = conversations[a]!;
    const mb = conversations[b]!;
    const lastA = ma[ma.length - 1]?.createdAt ?? 0;
    const lastB = mb[mb.length - 1]?.createdAt ?? 0;
    return lastB - lastA;
  });

  const visibleMessages = activePartner
    ? conversations[activePartner] ?? []
    : [];

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidNpub(partnerNpub)) {
      setError('Enter a valid npub for the recipient.');
      return;
    }
    const partnerHex = decodeNpub(partnerNpub);
    setActivePartner(partnerHex);
    setPartnerNpub('');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activePartner || !active) return;
    setSending(true);
    setError(null);

    try {
      const rumor = createEESRumor(active.pubkey, activePartner, draft);
      // Wrap once for the recipient, once for self (read your own outbox).
      const giftToPartner = await createGiftWrappedMessage(
        rumor,
        active.privkey,
        activePartner,
      );
      const giftToSelf = await createGiftWrappedMessage(
        rumor,
        active.privkey,
        active.pubkey,
      );
      await publishEvent(giftToPartner);
      // Don't block the UI on the self-copy.
      publishEvent(giftToSelf).catch(() => {
        /* relay flaky — the self-copy is best-effort */
      });
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
        <div>
          <p className="text-sm font-semibold">{active.name}</p>
          <p className="text-xs text-gray-500 font-mono">
            {truncatePubkey(active.pubkey)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(pubkeyToNpub(active.pubkey));
            }}
            className="text-xs text-gray-400 hover:text-gray-200 underline"
            title="Copy your npub so a friend can DM you"
          >
            Copy my npub
          </button>
          <button
            type="button"
            onClick={() => {
              lock();
              router.replace('/');
            }}
            className="text-xs text-gray-400 hover:text-gray-200 underline"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Conversation list */}
        <aside className="w-72 border-r border-gray-800 flex flex-col">
          <form onSubmit={handleStartChat} className="p-3 border-b border-gray-800 flex flex-col gap-2">
            <input
              type="text"
              placeholder="Recipient npub…"
              value={partnerNpub}
              onChange={(e) => setPartnerNpub(e.target.value.trim())}
              className="px-3 py-2 rounded bg-gray-900 border border-gray-700 focus:border-purple-400 outline-none text-xs font-mono"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded bg-purple-500 hover:bg-purple-400 text-white text-sm font-semibold"
            >
              Start chat
            </button>
            {error && <p className="text-[11px] text-red-400">{error}</p>}
          </form>
          <div className="flex-1 overflow-y-auto">
            {partnerList.length === 0 && (
              <p className="text-xs text-gray-500 p-4">
                No conversations yet. Start one above.
              </p>
            )}
            {partnerList.map((partner) => {
              const list = conversations[partner]!;
              const last = list[list.length - 1];
              return (
                <button
                  key={partner}
                  type="button"
                  onClick={() => setActivePartner(partner)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-900 hover:bg-gray-900 ${
                    activePartner === partner ? 'bg-gray-900' : ''
                  }`}
                >
                  <p className="text-sm font-mono text-purple-300">
                    {truncatePubkey(partner)}
                  </p>
                  {last && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {last.outgoing ? '↗ ' : '↘ '}
                      {last.content}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Conversation panel */}
        <section className="flex-1 flex flex-col min-h-0">
          {activePartner ? (
            <>
              <div className="px-4 py-2 border-b border-gray-800">
                <p className="text-xs text-gray-500">talking to</p>
                <p className="text-sm font-mono text-purple-300">
                  {truncatePubkey(activePartner)}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {visibleMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                      m.outgoing
                        ? 'self-end bg-purple-600 text-white'
                        : 'self-start bg-gray-800 text-gray-100'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {visibleMessages.length === 0 && (
                  <p className="text-xs text-gray-500 self-center mt-8">
                    No messages yet — say hi.
                  </p>
                )}
              </div>
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-gray-800 flex gap-2"
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 px-3 py-2 rounded bg-gray-900 border border-gray-700 focus:border-purple-400 outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="px-4 py-2 rounded bg-purple-500 hover:bg-purple-400 text-white text-sm font-semibold disabled:opacity-40"
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-gray-500 text-sm text-center max-w-xs">
                Pick a conversation, or paste a recipient npub on the left to
                start a new one.
                <br />
                <Link href="/" className="text-purple-300 inline-block mt-3">
                  ← home
                </Link>
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
