/** Client-side fetch to Next.js API routes (auth is server-side only). */
export function signerFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = init?.method ?? "GET";
  const dev = typeof window !== "undefined" && process.env.NODE_ENV === "development";

  if (dev) {
    console.log("[relay-connect][fetch] start", method, `/api/signer${path}`);
  }

  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

  return (async () => {
    try {
      const res = await fetch(`/api/signer${path}`, init);
      const ms =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
      if (dev) {
        console.log("[relay-connect][fetch] done", method, `/api/signer${path}`, {
          status: res.status,
          ok: res.ok,
          ms: Math.round(ms),
        });
      }
      return res;
    } catch (e) {
      const ms =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
      if (dev) {
        console.error("[relay-connect][fetch] error", method, `/api/signer${path}`, {
          ms: Math.round(ms),
          err: e instanceof Error ? e.message : e,
        });
      }
      throw e;
    }
  })();
}
