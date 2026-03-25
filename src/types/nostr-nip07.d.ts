/** NIP-07 — window.nostr (browser extension). See nips/07.md */
export {};

type NostrEventTemplate = {
  kind: number;
  tags?: string[][];
  content?: string;
  created_at?: number;
};

type NostrEvent = NostrEventTemplate & {
  id: string;
  pubkey: string;
  sig: string;
};

interface WindowNostr {
  getPublicKey(): Promise<string>;
  signEvent?(event: NostrEventTemplate): Promise<NostrEvent>;
}

declare global {
  interface Window {
    nostr?: WindowNostr;
  }
}
