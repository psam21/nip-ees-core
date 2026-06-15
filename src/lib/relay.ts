/**
 * Relay client.
 *
 * Thin wrapper around `nostr-tools` SimplePool with two operations:
 *   - publish: send to all relays in parallel, resolve on FIRST success
 *   - subscribe: long-lived subscription that streams matching events
 *
 * Production (chattr.buzz) uses 10 relays; this demo uses the same list.
 * Failure of any single relay is non-fatal — first ack wins.
 */
import { SimplePool } from 'nostr-tools/pool';
import type { Filter } from 'nostr-tools';
import type { NostrEvent } from './giftWrap';

const RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://relay.nostr.wirednet.jp',
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://nostr.oxtr.dev',
  'wss://www.nostr.ltd',
];

let pool: SimplePool | null = null;

function getPool(): SimplePool {
  if (!pool) pool = new SimplePool();
  return pool;
}

export function getRelayUrls(): string[] {
  return [...RELAY_URLS];
}

/**
 * Publish to all relays in parallel. Resolves on first ack; remaining
 * relays continue in the background.
 */
export async function publishEvent(event: NostrEvent): Promise<void> {
  const promises = getPool().publish(getRelayUrls(), event);
  // Race on first success; allow background relays to keep trying.
  await Promise.any(promises).catch((err) => {
    throw new Error(`All relays rejected event: ${err}`);
  });
}

export type SubscriptionHandle = { close: () => void };

/**
 * Subscribe to events matching the filter. The callback is invoked for
 * every matching event. Returns a handle with .close() to cancel.
 */
export function subscribeEvents(
  filter: Filter,
  onEvent: (event: NostrEvent) => void,
): SubscriptionHandle {
  const sub = getPool().subscribeMany(getRelayUrls(), filter, {
    onevent(ev) {
      onEvent(ev as NostrEvent);
    },
  });
  return {
    close: () => sub.close(),
  };
}
