"use client";

import {
  RELAY_CONNECT_VERSION,
  relayConnectLog,
  setRelayConnectLogSink,
} from "@bitmacro/relay-connect";
import { useEffect } from "react";

/**
 * Forwards **BitMacro Connect** SDK logs to the browser console.
 * Replace with your own `setRelayConnectLogSink` handler to feed UI panels or telemetry.
 */
export function RelayConnectLogBridge() {
  useEffect(() => {
    setRelayConnectLogSink((entry) => {
      const line = `[${entry.product}][${entry.level}] ${entry.message}`;
      const detail = entry.context;
      if (entry.level === "error") console.error(line, detail ?? "");
      else if (entry.level === "warn") console.warn(line, detail ?? "");
      else if (entry.level === "debug") console.debug(line, detail ?? "");
      else console.info(line, detail ?? "");
    });

    relayConnectLog("info", "BitMacro Connect log sink active", {
      sdkVersion: RELAY_CONNECT_VERSION,
    });

    return () => setRelayConnectLogSink(null);
  }, []);

  return null;
}
