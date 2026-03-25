import { SimplePool } from "nostr-tools/pool";
import type { Event } from "nostr-tools";
import { igLog, igWarn } from "@/lib/igLog";

/** `sessionStorage` key for optional NIP-07 profile JSON (cleared on NIP-46 connect). */
export const STORAGE_NIP07_PROFILE_KEY = "relay_connect_nip07_profile";

/** SessionStorage JSON for NIP-07 success page (no Supabase). */
export type Nip07ProfileBundle = {
  pubkey: string;
  metadata: ProfileFields | null;
  metadata_event?: { id: string; created_at: number } | null;
  extension?: {
    method_names?: string[];
    relays?: string[];
  };
  relays_queried: string[];
  fetched_at: string;
};

export type ProfileFields = {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  website?: string;
  /** Any other keys from kind 0 JSON */
  extra?: Record<string, string | number | boolean | null>;
};

const DEFAULT_METADATA_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
];

function dedupeRelays(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = u.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function nip07MetadataRelayUrls(): string[] {
  const raw = process.env.NEXT_PUBLIC_NIP07_METADATA_RELAYS?.trim();
  const bridge = process.env.NEXT_PUBLIC_RELAY_BRIDGE_WSS?.trim();
  const fromEnv = raw
    ? raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const base = [...DEFAULT_METADATA_RELAYS];
  if (fromEnv.length) return dedupeRelays([...fromEnv, ...base]);
  if (bridge && /^wss:\/\//i.test(bridge)) return dedupeRelays([bridge, ...base]);
  return base;
}

function parseKind0(ev: Event): ProfileFields | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(ev.content || "{}") as Record<string, unknown>;
  } catch {
    return null;
  }
  const pickStr = (k: string): string | undefined => {
    const v = raw[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const known = new Set([
    "name",
    "display_name",
    "about",
    "picture",
    "banner",
    "nip05",
    "lud06",
    "lud16",
    "website",
  ]);
  const extra: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (known.has(k)) continue;
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      extra[k] = v as string | number | boolean | null;
    }
  }
  const meta: ProfileFields = {
    name: pickStr("name"),
    display_name: pickStr("display_name"),
    about: pickStr("about"),
    picture: pickStr("picture"),
    banner: pickStr("banner"),
    nip05: pickStr("nip05"),
    lud06: pickStr("lud06"),
    lud16: pickStr("lud16"),
    website: pickStr("website"),
  };
  if (Object.keys(extra).length) meta.extra = extra;
  const hasAny =
    meta.name ||
    meta.display_name ||
    meta.about ||
    meta.picture ||
    meta.banner ||
    meta.nip05 ||
    meta.lud06 ||
    meta.lud16 ||
    meta.website ||
    (meta.extra && Object.keys(meta.extra).length);
  return hasAny ? meta : null;
}

async function extensionIntrospection(nip: NonNullable<Window["nostr"]>): Promise<{
  method_names?: string[];
  relays?: string[];
}> {
  const rec = nip as unknown as Record<string, unknown>;
  const method_names = Object.keys(rec).filter(
    (k) => typeof rec[k] === "function" && k !== "then"
  );

  let relays: string[] | undefined;
  const getRelays = rec.getRelays;
  if (typeof getRelays === "function") {
    try {
      const r = await (getRelays as () => Promise<unknown>)();
      if (Array.isArray(r)) {
        relays = r.filter((x): x is string => typeof x === "string" && x.length > 0);
      } else if (r && typeof r === "object") {
        relays = Object.keys(r as object).filter((k) => typeof k === "string" && k.startsWith("wss"));
      }
    } catch {
      /* optional */
    }
  }
  return { method_names: method_names.length ? method_names.sort() : undefined, relays };
}

/**
 * Fetch kind 0 from the network + optional extension hints. Does not verify NIP-05.
 */
export async function fetchNip07ProfileBundle(
  pubkeyHex: string,
  nip: NonNullable<Window["nostr"]>
): Promise<Nip07ProfileBundle> {
  const relays_queried = nip07MetadataRelayUrls();
  const extension = await extensionIntrospection(nip);
  igLog("[nip07] metadata relays", relays_queried.length, "extension methods", extension.method_names?.length ?? 0);

  const pool = new SimplePool({ enablePing: true });
  let metadata: ProfileFields | null = null;
  let metadata_event: { id: string; created_at: number } | null = null;

  try {
    const events = await pool.querySync(
      relays_queried,
      { kinds: [0], authors: [pubkeyHex], limit: 24 },
      { maxWait: 14_000 }
    );
    const valid = events.filter(
      (e) => e.pubkey.toLowerCase() === pubkeyHex.toLowerCase()
    );
    const ev =
      valid.length === 0
        ? null
        : [...valid].sort((a, b) => b.created_at - a.created_at)[0];
    if (ev) {
      metadata = parseKind0(ev);
      metadata_event = { id: ev.id, created_at: ev.created_at };
      igLog("[nip07] kind 0 found", { id: `${ev.id.slice(0, 12)}…`, created_at: ev.created_at });
    } else {
      igWarn("[nip07] no kind 0 from any relay (or mismatch)");
    }
  } catch (e) {
    igWarn("[nip07] metadata fetch error", e instanceof Error ? e.message : e);
  } finally {
    try {
      pool.destroy();
    } catch {
      /* ignore */
    }
  }

  return {
    pubkey: pubkeyHex.toLowerCase(),
    metadata,
    metadata_event,
    extension: extension.method_names?.length || extension.relays?.length ? extension : undefined,
    relays_queried,
    fetched_at: new Date().toISOString(),
  };
}
