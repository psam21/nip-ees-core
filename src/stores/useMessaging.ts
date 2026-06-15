/**
 * Messaging store — in-memory conversations + messages.
 *
 * Conversations are keyed by partner pubkey (the other side of the chat).
 * Messages are stored chronologically per-conversation.
 *
 * Not persisted — on reload the messaging page re-subscribes and the
 * relay's NIP-59 backfill window (~48h) populates history.
 */
import { create } from 'zustand';

export interface Message {
  /** Event id of the gift wrap (for dedup). */
  id: string;
  /** Hex pubkey of the message author (the seal pubkey). */
  authorPubkey: string;
  /** Plaintext content of the rumor. */
  content: string;
  /** Rumor created_at (unix seconds). */
  createdAt: number;
  /** True if I sent it (i.e., authorPubkey === my derived identity). */
  outgoing: boolean;
}

interface MessagingState {
  /** Map of partnerPubkey → messages, sorted oldest → newest. */
  conversations: Record<string, Message[]>;
  /** Set of seen gift-wrap event IDs (dedup across re-deliveries). */
  seenIds: Set<string>;

  addMessage: (partnerPubkey: string, message: Message) => void;
  reset: () => void;
}

export const useMessaging = create<MessagingState>()((set, get) => ({
  conversations: {},
  seenIds: new Set(),

  addMessage: (partnerPubkey, message) => {
    const { seenIds, conversations } = get();
    if (seenIds.has(message.id)) return;
    const next = new Set(seenIds);
    next.add(message.id);
    const list = conversations[partnerPubkey] ?? [];
    // Insert chronologically (binary insert is overkill at demo scale).
    const inserted = [...list, message].sort((a, b) => a.createdAt - b.createdAt);
    set({
      conversations: { ...conversations, [partnerPubkey]: inserted },
      seenIds: next,
    });
  },

  reset: () => set({ conversations: {}, seenIds: new Set() }),
}));
