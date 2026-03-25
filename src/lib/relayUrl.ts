/** relay-agent HTTPS = agent REST; NIP-46 needs the strfry WebSocket (public relay). */
const BITMACRO_AGENT_HOSTS = new Set(["relay-agent.bitmacro.io"]);

/** BitMacro relay WSS endpoints (documented ecosystem). */
export const BITMACRO_BRIDGE_WSS: Record<string, string> = {
  public: "wss://relay.bitmacro.cloud",
  private: "wss://relay.bitmacro.io",
  paid: "wss://relay.bitmacro.pro",
};

/** Best-effort: relay dashboard HTTPS URL → WSS (only when the endpoint is a Nostr relay, not the agent). */
export function httpsEndpointToBridgeWss(endpoint: string): string | null {
  try {
    const u = new URL(endpoint);
    if (u.protocol === "https:") {
      const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
      return `wss://${u.host}${path}`;
    }
    if (u.protocol === "http:") {
      const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
      return `ws://${u.host}${path}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Resolve `bridge_wss` for POST /signer/connect.
 * - `NEXT_PUBLIC_RELAY_BRIDGE_WSS` forces the value (override).
 * - If `endpoint` is the BitMacro agent host, pick strfry WSS from `agent_relay_id`.
 * - Otherwise try https → wss on the same host/path.
 */
export function resolveBridgeWss(relay: {
  endpoint: string;
  agent_relay_id: string | null;
}): string | null {
  const env =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_RELAY_BRIDGE_WSS?.trim()
      : undefined;
  if (env) return env;

  try {
    const host = new URL(relay.endpoint).hostname;
    if (
      BITMACRO_AGENT_HOSTS.has(host) &&
      relay.agent_relay_id &&
      BITMACRO_BRIDGE_WSS[relay.agent_relay_id]
    ) {
      return BITMACRO_BRIDGE_WSS[relay.agent_relay_id];
    }
  } catch {
    /* fall through */
  }

  return httpsEndpointToBridgeWss(relay.endpoint);
}
