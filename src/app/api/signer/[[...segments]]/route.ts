import http from "node:http";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import { URL as NodeURL } from "node:url";
import { type NextRequest } from "next/server";

const RELAY_API = process.env.RELAY_API_URL ?? "https://relay-api.bitmacro.io";
const LOG = "[relay-connect][proxy]";

/** Avoid hanging forever if relay-api or TLS is unreachable from this host. */
const PROXY_FETCH_MS = Math.min(
  Number(process.env.SIGNER_PROXY_TIMEOUT_MS) || 60_000,
  120_000
);

function relayHeaders(): Record<string, string> {
  return {
    "X-API-Key": process.env.RELAY_API_KEY!,
    "X-Provider-User-Id": process.env.SIGNER_PROVIDER_USER_ID!,
  };
}

/**
 * `fetch()` often uses chunked request bodies. Vercel → Hono has been observed stalling on
 * `c.req.text()` until timeout. HTTP/1.1 with explicit Content-Length avoids that.
 */
function postJsonViaHttp1(
  targetUrl: string,
  authHeaders: Record<string, string>,
  jsonBodyUtf8: string,
  timeoutMs: number
): Promise<{ status: number; text: string }> {
  const payload = Buffer.from(jsonBodyUtf8, "utf8");
  const u = new NodeURL(targetUrl);
  const isHttps = u.protocol === "https:";
  const lib = isHttps ? https : http;
  const defaultPort = isHttps ? 443 : 80;
  const port = u.port ? Number(u.port) : defaultPort;
  const headers: Record<string, string> = {
    ...authHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(payload.length),
    Connection: "close",
    "Accept-Encoding": "identity",
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err: Error | null, result?: { status: number; text: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(result!);
    };

    const onResponse = (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on("data", (ch) => chunks.push(ch));
      res.on("end", () => {
        finish(null, {
          status: res.statusCode ?? 502,
          text: Buffer.concat(chunks).toString("utf8"),
        });
      });
    };

    const opts: http.RequestOptions = {
      hostname: u.hostname,
      port,
      path: `${u.pathname}${u.search}`,
      method: "POST",
      headers,
      agent: false,
      ...(isHttps ? { servername: u.hostname } : {}),
    };

    const nodeReq = lib.request(opts, onResponse);
    nodeReq.on("error", (e) => finish(e));

    const timer = setTimeout(() => {
      nodeReq.destroy();
      const te = new Error("upstream POST timeout");
      te.name = "TimeoutError";
      finish(te);
    }, timeoutMs);

    nodeReq.write(payload);
    nodeReq.end();
  });
}

function targetUrl(req: NextRequest, segments: string[] | undefined): URL {
  const path = segments?.length ? `/${segments.join("/")}` : "";
  const base = `${RELAY_API.replace(/\/$/, "")}/signer${path}`;
  const incoming = new URL(req.url);
  const target = new URL(base);
  incoming.searchParams.forEach((v, k) => {
    target.searchParams.set(k, v);
  });
  return target;
}

function checkServerEnv(): void {
  const hasKey = !!process.env.RELAY_API_KEY?.trim();
  const hasPid = !!process.env.SIGNER_PROVIDER_USER_ID?.trim();
  if (!hasKey || !hasPid) {
    console.error(LOG, "Missing server env (relay-connect `.env` + restart dev):", {
      RELAY_API_KEY: hasKey ? "set" : "MISSING",
      SIGNER_PROVIDER_USER_ID: hasPid ? "set" : "MISSING",
      RELAY_API_URL: process.env.RELAY_API_URL?.trim()
        ? "set (this host)"
        : "unset → default https://relay-api.bitmacro.io",
    });
    throw new Error("missing_relay_auth");
  }
}

function shortReqId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return String(Date.now() % 1e8);
  }
}

async function doProxy(
  method: "GET" | "POST" | "DELETE",
  req: NextRequest,
  segments: string[] | undefined,
  reqId: string,
  postBody?: string
): Promise<Response> {
  checkServerEnv();
  const url = targetUrl(req, segments);
  const segmentPath = segments?.length ? segments.join("/") : "(none)";
  console.log(LOG, `req ${reqId} → ${method}`, url.toString(), {
    segmentPath,
    relayApiHost: new URL(RELAY_API).hostname,
    timeoutMs: PROXY_FETCH_MS,
    postBodyChars: method === "POST" ? (postBody?.length ?? 0) : 0,
  });

  const t0 = Date.now();
  const baseHeaders = relayHeaders();

  if (method === "POST" && postBody?.length) {
    try {
      const { status, text } = await postJsonViaHttp1(
        url.toString(),
        baseHeaders,
        postBody,
        PROXY_FETCH_MS
      );
      const ms = Date.now() - t0;
      console.log(LOG, `req ${reqId} ← ${method}`, {
        status,
        ms,
        responseChars: text.length,
        segmentPath,
        via: "node:http1",
      });
      if (status < 200 || status >= 300) {
        console.warn(LOG, `req ${reqId} relay-api error body (truncated):`, text.slice(0, 600));
      }
      return new Response(text, { status, headers: { "content-type": "application/json" } });
    } catch (fetchErr) {
      const ms = Date.now() - t0;
      console.error(LOG, `req ${reqId} POST https threw`, { ms, err: fetchErr });
      throw fetchErr;
    }
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: baseHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_FETCH_MS),
    });
  } catch (fetchErr) {
    const ms = Date.now() - t0;
    console.error(LOG, `req ${reqId} fetch threw`, { ms, err: fetchErr });
    throw fetchErr;
  }

  const text = await res.text();
  const ms = Date.now() - t0;
  console.log(LOG, `req ${reqId} ← ${method}`, {
    status: res.status,
    ms,
    responseChars: text.length,
    segmentPath,
  });
  if (!res.ok) {
    console.warn(LOG, `req ${reqId} relay-api error body (truncated):`, text.slice(0, 600));
  }

  const t = res.headers.get("content-type") ?? "application/json";
  return new Response(text, { status: res.status, headers: { "content-type": t } });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ segments?: string[] }> }) {
  const reqId = shortReqId();
  try {
    const { segments } = await ctx.params;
    return await doProxy("GET", req, segments, reqId);
  } catch (e) {
    console.error(LOG, `req ${reqId} GET failed:`, e instanceof Error ? e.message : e);
    return authOrProxyError(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ segments?: string[] }> }) {
  const reqId = shortReqId();
  try {
    const { segments } = await ctx.params;
    const body = await req.text();
    return await doProxy("POST", req, segments, reqId, body);
  } catch (e) {
    console.error(LOG, `req ${reqId} POST failed:`, e instanceof Error ? e.message : e);
    return authOrProxyError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ segments?: string[] }> }) {
  const reqId = shortReqId();
  try {
    const { segments } = await ctx.params;
    return await doProxy("DELETE", req, segments, reqId);
  } catch (e) {
    console.error(LOG, `req ${reqId} DELETE failed:`, e instanceof Error ? e.message : e);
    return authOrProxyError(e);
  }
}

function authOrProxyError(e: unknown): Response {
  const msg = e instanceof Error ? e.message : String(e);
  const isAbort =
    e instanceof Error &&
    (e.name === "AbortError" || e.name === "TimeoutError" || msg.includes("aborted"));
  if (isAbort) {
    console.error(LOG, "Timeout contacting relay-api", { ms: PROXY_FETCH_MS, detail: msg });
    return Response.json(
      {
        error: "relay_api_timeout",
        detail: `No response from relay-api within ${PROXY_FETCH_MS}ms. If you set SIGNER_PROXY_TIMEOUT_MS low (e.g. 25000), try 60000 — the connect handler can take ~22s plus network. Also check RELAY_API_URL, Vercel logs for POST /signer/connect, and Supabase.`,
      },
      { status: 504 }
    );
  }
  if (msg === "missing_relay_auth") {
    return Response.json(
      {
        error: "missing_relay_auth",
        detail:
          "Set RELAY_API_KEY and SIGNER_PROVIDER_USER_ID in relay-connect `.env` and restart the dev server.",
      },
      { status: 401 }
    );
  }
  console.error(LOG, "proxy_error:", msg);
  return Response.json({ error: "proxy_error", detail: msg }, { status: 500 });
}
