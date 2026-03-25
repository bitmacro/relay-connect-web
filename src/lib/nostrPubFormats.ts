import { npubEncode } from "nostr-tools/nip19";

/** Returns `npub1…` for a 64-char hex pubkey, or `null` if invalid. */
export function hexPubkeyToNpub(hex: string): string | null {
  const h = hex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) return null;
  try {
    return npubEncode(h);
  } catch {
    return null;
  }
}
