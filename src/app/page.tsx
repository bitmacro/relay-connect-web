"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Puzzle, RefreshCw, Smartphone } from "lucide-react";
import { signerFetch } from "@/lib/relaySigner";
import {
  getOrCreateAppKeypair,
  parsePairingSecretFromNostrConnectUri,
} from "@/lib/nostrAppKeys";
import { watchNip46Bridge } from "@/lib/nip46Bridge";
import { resolveBridgeWss } from "@/lib/relayUrl";
import { fetchNip07ProfileBundle, STORAGE_NIP07_PROFILE_KEY } from "@/lib/nip07Metadata";
import { igError, igLog, igWarn } from "@/lib/igLog";

const STORAGE_PUBKEY = "relay_connect_display_pubkey";
/** When no NIP-07 extension is present, send users to pick a signer app. */
const NOSTR_APPS_SIGNERS_URL = "https://nostrapps.com/#signers";

const POLL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;
const POLL_LOG_EVERY = 5;

type UiPhase =
  | "idle"
  | "loading"
  | "qr"
  | "waiting"
  | "failure"
  | "redirecting";

type FailureReason =
  | "timeout"
  | "revoked"
  | "config"
  | "connect"
  | "complete"
  | "unknown";

type RelayRow = {
  id: string;
  name: string | null;
  endpoint: string;
  agent_relay_id: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [failureReason, setFailureReason] = useState<FailureReason | null>(null);
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  const [nostrconnectUri, setNostrconnectUri] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string>("");

  const sessionIdRef = useRef<string | null>(null);
  const pairingSecretRef = useRef<string | null>(null);
  const completeSentRef = useRef(false);
  const unsubBridgeRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollLoggedActiveRef = useRef(false);
  const pollTickRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (unsubBridgeRef.current) {
      unsubBridgeRef.current();
      unsubBridgeRef.current = null;
    }
  }, []);

  const callComplete = useCallback(async (): Promise<boolean> => {
    const sid = sessionIdRef.current;
    const secret = pairingSecretRef.current;
    if (!sid || !secret || completeSentRef.current) return false;
    completeSentRef.current = true;
    igLog("[complete] POST /signer/session/…/complete", { session_id: sid });
    const res = await signerFetch(`/session/${sid}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairing_secret: secret }),
    });
    igLog("[complete] response", { status: res.status, ok: res.ok });
    if (!res.ok) {
      completeSentRef.current = false;
      const j = await res.json().catch(() => ({}));
      const detail = typeof j?.detail === "string" ? j.detail : res.statusText;
      igError("[complete] failed", res.status, detail, j);
      setFailureReason("complete");
      setFailureDetail(detail || `HTTP ${res.status}`);
      setPhase("failure");
      return false;
    }
    return true;
  }, []);

  const pollSessions = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    pollTickRef.current += 1;
    const tick = pollTickRef.current;
    const res = await signerFetch(`/sessions`);
    if (!res.ok) {
      igWarn("[poll] GET /signer/sessions not OK", res.status);
      return;
    }
    const data = (await res.json()) as {
      sessions?: Array<{ id: string; status: string; app_pubkey?: string }>;
    };
    const row = data.sessions?.find((s) => s.id === sid);
    if (!row) {
      igWarn("[poll] session missing from list", { session_id: sid, tick });
      return;
    }
    if (tick === 1 || tick % POLL_LOG_EVERY === 0) {
      igLog("[poll] tick", tick, { status: row.status, session_id: sid.slice(0, 8) + "…" });
    }
    if (row.status === "active") {
      if (!pollLoggedActiveRef.current) {
        pollLoggedActiveRef.current = true;
        igLog("[poll] status=active → navigate /success", { ticks: tick });
      }
      clearTimers();
      const pk = row.app_pubkey ?? getOrCreateAppKeypair().appPubkeyHex;
      sessionStorage.removeItem(STORAGE_NIP07_PROFILE_KEY);
      sessionStorage.setItem(STORAGE_PUBKEY, pk);
      setPhase("redirecting");
      router.push("/success");
      return;
    }
    if (row.status === "revoked") {
      igWarn("[poll] status=revoked", { ticks: tick });
      clearTimers();
      setFailureReason("revoked");
      setFailureDetail(null);
      setPhase("failure");
    }
  }, [clearTimers, router]);

  const startWaitingLoop = useCallback(
    (bridgeWss: string, appPubkeyHex: string) => {
      completeSentRef.current = false;
      pollTickRef.current = 0;
      igLog("[flow] waiting loop start", {
        poll_ms: POLL_MS,
        timeout_ms: TIMEOUT_MS,
        bridge_wss: bridgeWss,
      });

      unsubBridgeRef.current = watchNip46Bridge({
        bridgeWss,
        appPubkeyHex,
        onEvent: () => {
          void (async () => {
            igLog("[flow] bridge event → try complete");
            const ok = await callComplete();
            if (ok) await pollSessions();
          })();
        },
      });

      pollRef.current = setInterval(() => {
        void pollSessions();
      }, POLL_MS);

      timeoutRef.current = setTimeout(() => {
        igWarn("[flow] session wait timeout", { timeout_ms: TIMEOUT_MS });
        clearTimers();
        setFailureReason("timeout");
        setFailureDetail(null);
        setPhase("failure");
      }, TIMEOUT_MS);
    },
    [callComplete, clearTimers, pollSessions]
  );

  const handleConnect = async () => {
    sessionStorage.removeItem(STORAGE_NIP07_PROFILE_KEY);
    setFailureReason(null);
    setFailureDetail(null);
    setPhase("loading");
    igLog("[ui] phase → loading");
    setNostrconnectUri(null);
    setStatusLine("");
    pollLoggedActiveRef.current = false;

    igLog("[connect] start — public env", {
      NEXT_PUBLIC_RELAY_CONFIG_ID: process.env.NEXT_PUBLIC_RELAY_CONFIG_ID
        ? "(set)"
        : "(unset → prefer relay with agent_relay_id public)",
      NEXT_PUBLIC_RELAY_BRIDGE_WSS: process.env.NEXT_PUBLIC_RELAY_BRIDGE_WSS
        ? "(set)"
        : "(unset → resolve from agent_relay_id / endpoint)",
    });
    igLog(
      "[connect] Server-side auth only: ensure RELAY_API_KEY and SIGNER_PROVIDER_USER_ID in .env, then restart `npm run dev`."
    );

    try {
      const { appPubkeyHex } = getOrCreateAppKeypair();
      igLog("[config] GET /signer/config (via proxy)…");
      const tCfg = typeof performance !== "undefined" ? performance.now() : Date.now();
      const cfgRes = await signerFetch("/config");
      const cfgMs =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - tCfg;
      igLog("[config] response", { status: cfgRes.ok, ms: Math.round(cfgMs) });
      if (!cfgRes.ok) {
        const j = await cfgRes.json().catch(() => ({}));
        igError("[config] failed", cfgRes.status, j);
        setFailureReason("config");
        setFailureDetail(
          typeof j?.error === "string" ? j.error : `HTTP ${cfgRes.status}`
        );
        setPhase("failure");
        igLog("[ui] phase → failure", { reason: "config" });
        return;
      }

      const cfg = (await cfgRes.json()) as { relays?: RelayRow[] };
      const relays = cfg.relays ?? [];
      igLog("[config] OK", { relay_count: relays.length });
      const envRelayId = process.env.NEXT_PUBLIC_RELAY_CONFIG_ID?.trim();
      const relay = envRelayId
        ? relays.find((r) => r.id === envRelayId) ?? relays[0]
        : relays.find((r) => r.agent_relay_id === "public") ?? relays[0];

      if (!relay) {
        igError("[config] empty relay list or relay not found");
        setFailureReason("config");
        setFailureDetail(
          "No relays for this account. Create a relay in the panel or set NEXT_PUBLIC_RELAY_CONFIG_ID."
        );
        setPhase("failure");
        igLog("[ui] phase → failure", { reason: "config", detail: "no relay" });
        return;
      }

      const bridgeWss = resolveBridgeWss(relay) || "";
      igLog("[relay] selected", {
        id: relay.id,
        name: relay.name,
        agent_relay_id: relay.agent_relay_id,
        endpoint: relay.endpoint,
        bridge_wss: bridgeWss,
      });

      if (!bridgeWss || !/^wss:\/\//i.test(bridgeWss)) {
        igError("[relay] bridge_wss invalid or empty");
        setFailureReason("config");
        setFailureDetail(
          "Set NEXT_PUBLIC_RELAY_BRIDGE_WSS=wss://… (Nostr relay WebSocket for NIP-46)."
        );
        setPhase("failure");
        igLog("[ui] phase → failure", { reason: "config", detail: "bridge_wss" });
        return;
      }

      igLog("[connect] POST /signer/connect (via proxy)…", {
        relay_config_id: relay.id,
        app_pubkey: `${appPubkeyHex.slice(0, 12)}…`,
      });
      const tConn = typeof performance !== "undefined" ? performance.now() : Date.now();
      const connectRes = await signerFetch("/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relay_config_id: relay.id,
          app_pubkey: appPubkeyHex,
          client_name: "BitMacro Relay Connect",
          bridge_wss: bridgeWss,
        }),
      });
      const connMs =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - tConn;
      igLog("[connect] HTTP done", { status: connectRes.status, ms: Math.round(connMs) });

      const connectJson = (await connectRes.json()) as {
        session_id?: string;
        nostrconnect_uri?: string;
        error?: string;
        detail?: string;
      };

      if (!connectRes.ok || !connectJson.session_id || !connectJson.nostrconnect_uri) {
        igError("[connect] failed", connectRes.status, {
          error: connectJson.error,
          detail: connectJson.detail,
        });
        setFailureReason("connect");
        setFailureDetail(
          connectJson.detail ||
            connectJson.error ||
            `HTTP ${connectRes.status}`
        );
        setPhase("failure");
        igLog("[ui] phase → failure", { reason: "connect" });
        return;
      }

      const secret = parsePairingSecretFromNostrConnectUri(
        connectJson.nostrconnect_uri
      );
      if (!secret) {
        igError("[connect] nostrconnect_uri missing secret in query");
        setFailureReason("connect");
        setFailureDetail("Invalid nostrconnect URI (no secret).");
        setPhase("failure");
        igLog("[ui] phase → failure", { reason: "connect", detail: "uri" });
        return;
      }

      igLog("[connect] OK", {
        session_id: connectJson.session_id,
        nostrconnect_uri_chars: connectJson.nostrconnect_uri.length,
        note: "full URI not logged (contains secret)",
      });

      sessionIdRef.current = connectJson.session_id;
      pairingSecretRef.current = secret;
      setNostrconnectUri(connectJson.nostrconnect_uri);
      setPhase("qr");
      igLog("[ui] phase → qr");

      setTimeout(() => {
        setPhase("waiting");
        igLog("[ui] phase → waiting");
        igLog("[flow] NIP-46 bridge watch + polling");
        startWaitingLoop(bridgeWss, appPubkeyHex);
      }, 400);
    } catch (e) {
      igError("[connect] exception", e);
      setFailureReason("unknown");
      setFailureDetail(e instanceof Error ? e.message : String(e));
      setPhase("failure");
      igLog("[ui] phase → failure", { reason: "unknown" });
    }
  };

  /** NIP-07: browser extension (`window.nostr`). No relay-api session. */
  const handleNip07 = async () => {
    if (typeof window === "undefined") return;
    const nip = window.nostr;
    if (!nip || typeof nip.getPublicKey !== "function") {
      igLog("[nip07] window.nostr missing — redirect", NOSTR_APPS_SIGNERS_URL);
      window.location.assign(NOSTR_APPS_SIGNERS_URL);
      return;
    }
    setFailureReason(null);
    setFailureDetail(null);
    setPhase("loading");
    igLog("[nip07] calling getPublicKey()");
    try {
      const pk = await nip.getPublicKey();
      const hex = typeof pk === "string" ? pk.trim() : "";
      if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error("Extension did not return a valid 64-char hex pubkey.");
      }
      const normalized = hex.toLowerCase();
      const bundle = await fetchNip07ProfileBundle(normalized, nip);
      sessionStorage.setItem(STORAGE_PUBKEY, bundle.pubkey);
      sessionStorage.setItem(STORAGE_NIP07_PROFILE_KEY, JSON.stringify(bundle));
      setPhase("redirecting");
      router.push("/success");
    } catch (e) {
      igError("[nip07] getPublicKey failed", e);
      setFailureReason("unknown");
      setFailureDetail(e instanceof Error ? e.message : String(e));
      setPhase("failure");
    }
  };

  const handleRetry = () => {
    igLog("[flow] retry — reset state");
    clearTimers();
    completeSentRef.current = false;
    pollLoggedActiveRef.current = false;
    pollTickRef.current = 0;
    sessionIdRef.current = null;
    pairingSecretRef.current = null;
    setNostrconnectUri(null);
    setPhase("idle");
    igLog("[ui] phase → idle");
    setStatusLine("");
    setFailureReason(null);
    setFailureDetail(null);
  };

  const handleManualComplete = async () => {
    setStatusLine("Finishing…");
    igLog("[flow] manual complete clicked");
    const ok = await callComplete();
    if (ok) await pollSessions();
  };

  useEffect(() => {
    igLog(
      "Page ready — logs use prefix [relay-connect]; proxy errors also appear in the terminal running `npm run dev`."
    );
    return () => clearTimers();
  }, [clearTimers]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      {phase === "idle" && (
        <div className="flex w-full max-w-xs flex-col items-stretch gap-3">
          <button
            type="button"
            onClick={() => void handleConnect()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-10 py-3.5 text-[15px] font-medium tracking-tight text-primary-foreground shadow-sm transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Smartphone className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden />
            Use remote signer
          </button>
          <button
            type="button"
            onClick={() => void handleNip07()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-600 bg-zinc-900/80 px-10 py-3.5 text-[15px] font-medium tracking-tight text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Puzzle className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden />
            Use browser extension
          </button>
          <p className="text-center text-[11px] leading-snug text-zinc-600">
            No extension? The second button opens a list of signer apps at{" "}
            <span className="break-all text-zinc-500">nostrapps.com</span>.
          </p>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex flex-col items-center gap-4 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin stroke-[1.5]" aria-hidden />
        </div>
      )}

      {(phase === "qr" || phase === "waiting") && nostrconnectUri && (
        <div className="flex w-full max-w-[280px] flex-col items-center gap-8">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-800/80">
            <QRCodeSVG value={nostrconnectUri} size={240} level="M" />
          </div>
          {phase === "waiting" && (
            <div className="flex w-full flex-col items-center gap-6">
              <p className="text-center text-[13px] leading-relaxed text-zinc-500">
                Open your remote signer app and approve the connection.
              </p>
              <div className="flex items-center gap-2 text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span className="text-[13px]">Waiting…</span>
              </div>
              <button
                type="button"
                onClick={() => void handleManualComplete()}
                className="text-[13px] text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-400"
              >
                I already approved — finish
              </button>
              {statusLine ? (
                <p className="text-center text-[12px] text-zinc-600">{statusLine}</p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {phase === "failure" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
          <p className="text-[15px] font-medium text-zinc-200">
            {failureReason === "timeout" && "Timed out"}
            {failureReason === "revoked" && "Session revoked"}
            {failureReason === "config" && "Configuration error"}
            {failureReason === "connect" && "Connection failed"}
            {failureReason === "complete" && "Could not finish"}
            {failureReason === "unknown" && "Error"}
          </p>
          {failureDetail ? (
            <p className="break-words font-mono text-[11px] leading-relaxed text-zinc-600">
              {failureDetail}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-transparent px-6 py-2.5 text-[13px] font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
        </div>
      )}

      {phase === "redirecting" && (
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span className="text-[13px]">Redirecting…</span>
        </div>
      )}
    </main>
  );
}
