import { SimplePool } from "nostr-tools/pool";
import { igLog, igWarn } from "@/lib/igLog";

const KIND_NIP46 = 24133;

/**
 * Subscribes to the relay bridge for NIP-46 traffic mentioning our app pubkey.
 * When the remote signer responds, we can call POST /signer/session/:id/complete — relay-api
 * only flips the session to `active` after that.
 */
export function watchNip46Bridge(params: {
  bridgeWss: string;
  appPubkeyHex: string;
  onEvent: () => void;
}): () => void {
  igLog(
    "[nip46] subscribing bridge",
    params.bridgeWss,
    "app_pubkey",
    `${params.appPubkeyHex.slice(0, 12)}…`
  );

  const pool = new SimplePool({ enablePing: true });
  const sub = pool.subscribeMany(
    [params.bridgeWss],
    {
      kinds: [KIND_NIP46],
      "#p": [params.appPubkeyHex],
    },
    {
      onevent: (ev) => {
        if (ev.pubkey === params.appPubkeyHex) return;
        igLog(
          "[nip46] remote kind 24133",
          "id",
          `${ev.id.slice(0, 12)}…`,
          "from",
          `${ev.pubkey.slice(0, 12)}…`
        );
        params.onEvent();
      },
      onclose: (reasons) => {
        igWarn("[nip46] subscription closed", reasons);
      },
    }
  );

  return () => {
    igLog("[nip46] closing subscription", params.bridgeWss);
    try {
      sub.close();
    } catch {
      /* ignore */
    }
    try {
      pool.close([params.bridgeWss]);
    } catch {
      /* ignore */
    }
  };
}
