import { generateSecretKey, getPublicKey } from "nostr-tools/pure";

const STORAGE_SK = "relay_connect_app_sk_hex";

export function getOrCreateAppKeypair(): { sk: Uint8Array; appPubkeyHex: string } {
  if (typeof window === "undefined") {
    throw new Error("getOrCreateAppKeypair requires browser");
  }
  const existing = sessionStorage.getItem(STORAGE_SK);
  if (existing && /^[0-9a-f]{64}$/i.test(existing)) {
    const sk = hexToBytes(existing);
    return { sk, appPubkeyHex: getPublicKey(sk) };
  }
  const sk = generateSecretKey();
  const hex = bytesToHex(sk);
  sessionStorage.setItem(STORAGE_SK, hex);
  return { sk, appPubkeyHex: getPublicKey(sk) };
}

export function clearAppKeypair(): void {
  sessionStorage.removeItem(STORAGE_SK);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function parsePairingSecretFromNostrConnectUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    const s = u.searchParams.get("secret");
    return s && s.length >= 16 ? s : null;
  } catch {
    return null;
  }
}
