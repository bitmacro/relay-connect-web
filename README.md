# relay-connect-web

[![CI](https://github.com/bitmacro/relay-connect-web/actions/workflows/ci.yml/badge.svg)](https://github.com/bitmacro/relay-connect-web/actions/workflows/ci.yml)
[![version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/bitmacro/relay-connect-web/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![SDK](https://img.shields.io/npm/v/@bitmacro/relay-connect?label=%40bitmacro%2Frelay-connect)](https://www.npmjs.com/package/@bitmacro/relay-connect)

**[→ Relay Panel](https://relay-panel.bitmacro.io)**  
**[→ BitMacro: bitmacro.io](https://bitmacro.io)**

Minimal **Next.js** app for **NIP-46 (Nostr Connect)** and optional **NIP-07 (browser extension)** sign-in. NIP-46 uses **relay-api** `/signer` (session + QR + bridge); NIP-07 is client-only except for metadata fetched from relays. Part of the [BitMacro Relay Manager](https://bitmacro.io) ecosystem.

**Branding:** **BitMacro Connect** is the product name; the npm package is **`@bitmacro/relay-connect`**. The footer shows `BitMacro Connect · v… · @bitmacro/relay-connect`.

| Project | Role | License |
|---------|------|---------|
| **relay-connect-web** | This repo — auth / connect UI + API proxy | MIT |
| [@bitmacro/relay-connect](https://github.com/bitmacro/relay-connect) | TypeScript SDK (NIP-46 / NIP-07 client logic) | MIT |
| [relay-agent](https://github.com/bitmacro/relay-agent) | strfry REST on the operator’s server | MIT |
| [relay-panel](https://github.com/bitmacro/relay-panel) | Relay management UI | BSL 1.1 |
| relay-api | Central hub (Supabase, `/signer`, proxy to agents) | Private |

**Roadmap:** shared logic moves into **`@bitmacro/relay-connect`**; **relay-connect-web** stays the reference UI. After publishing a new SDK version, run `npm update @bitmacro/relay-connect` (CI installs the SDK from the [relay-connect](https://github.com/bitmacro/relay-connect) repo when the registry is behind).

---

## What it does

- Server-only auth to **relay-api** (NIP-46 path): `RELAY_API_KEY` + `SIGNER_PROVIDER_USER_ID` (GitHub numeric id, same as `relay_configs.provider_user_id`).
- Browser calls **Next.js** `/api/signer/*`, which proxies to `RELAY_API_URL/signer/*`.
- **NIP-46 (remote signer):** `POST /signer/connect`, QR from `nostrconnect_uri`, polling `GET /signer/sessions`, bridge subscribe (`kind` 24133), `POST /signer/session/:id/complete`. Creates rows in Supabase **`relay.nip46_sessions`** via relay-api.
- **NIP-07 (browser extension):** uses [`window.nostr`](https://github.com/nostr-protocol/nips/blob/master/07.md) (`getPublicKey`). **No** calls to `/signer` and **no** writes to Supabase for that path. If no extension is detected, the user is redirected to **[nostrapps.com signers](https://nostrapps.com/#signers)** to choose a signer app.
- After NIP-07, the app loads **kind 0** profile metadata from configurable relays (`NEXT_PUBLIC_NIP07_METADATA_RELAYS` and/or `NEXT_PUBLIC_RELAY_BRIDGE_WSS` + defaults), optional `getRelays()` introspection when the extension supports it, then `/success` shows **npub** (NIP-19), QR, and technical details.

### NIP-46 vs NIP-07 (summary)

| | NIP-46 | NIP-07 |
|---|--------|--------|
| **relay-api / proxy** | Yes | No (only relay reads for profile) |
| **Supabase** | `nip46_sessions` | Not used |
| **Typical pubkey shown** | App keypair (NIP-46 client) for the session | User’s pubkey from the extension |
| **Profile enrichment** | Optional (kind 0 for that pubkey) | Yes — kind 0 + extension hints when available |

- **BitMacro relays (NIP-46):** when `relay_configs.endpoint` is `https://relay-agent.bitmacro.io`, `bridge_wss` is resolved from `agent_relay_id` (`public` → `wss://relay.bitmacro.cloud`, etc.). Override with `NEXT_PUBLIC_RELAY_BRIDGE_WSS` if needed.

---

## Quick start

```bash
cd relay-connect-web
cp .env.example .env
# Edit .env: RELAY_API_KEY, SIGNER_PROVIDER_USER_ID, optional RELAY_API_URL / NEXT_PUBLIC_*
npm install
npm run dev
# http://localhost:3000
```

Requires a **relay-api** deployment with `/signer` routes and Supabase table **`relay.nip46_sessions`** (see relay-api migrations).

**SDK version:** `package.json` pins `@bitmacro/relay-connect` from npm (`^0.1.1`). Publish that package version ([relay-connect](https://github.com/bitmacro/relay-connect) repo, then `npm publish`) before expecting `npm ci` / Vercel to resolve it. For local dev with sibling clones before publish: `npm install ../relay-connect`.

### Migrating from `identity-gate`

This app was previously named **identity-gate**, then lived in the **relay-connect** repo name before the SDK split. Stop any dev server, remove stale clones if needed, work from **`relay-connect-web/`**, and run `npm install`. Browser storage keys use the prefix `relay_connect_*` (new sessions after upgrade).

---

## Environment variables

| Variable | Scope | Description |
|----------|--------|-------------|
| `RELAY_API_URL` | Server | relay-api base URL (default `https://relay-api.bitmacro.io`) |
| `RELAY_API_KEY` | Server | Same key as relay-api `RELAY_API_KEY` |
| `SIGNER_PROVIDER_USER_ID` | Server | GitHub user id string (`provider_user_id` in `relay_configs`) |
| `SIGNER_PROXY_TIMEOUT_MS` | Server | Optional. Proxy fetch timeout (ms), default 60000 |
| `NEXT_PUBLIC_RELAY_BRIDGE_WSS` | Client | Optional. Force NIP-46 bridge `wss://…`; also used as first relay when fetching kind 0 after NIP-07 |
| `NEXT_PUBLIC_NIP07_METADATA_RELAYS` | Client | Optional. Comma/space-separated `wss://` URLs to query kind 0 after NIP-07 (defaults + bridge above) |
| `NEXT_PUBLIC_RELAY_CONFIG_ID` | Client | Optional. UUID of `relay_configs` row to use |

Never expose `RELAY_API_KEY` in the browser; keep it in `.env` for the Next server only.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |

---

## Logging

- **App / relay-api:** console prefix **`[relay-connect]`** in the browser; **`[relay-connect][proxy]`** in the terminal running `npm run dev` for upstream relay-api calls.
- **BitMacro Connect SDK:** `src/components/RelayConnectLogBridge.tsx` registers `setRelayConnectLogSink` and prints structured lines such as `[BitMacro Connect][info] …`. In your own app, replace that with a handler that pushes `RelayConnectLogEntry` into React state, a toast strip, or telemetry — see the SDK README.

---

## Security

- Run **relay-api** with TLS; use strong `RELAY_API_KEY`.
- `SIGNER_PROVIDER_USER_ID` identifies the operator account whose relays are used for `/signer/config` and `/signer/connect`; treat deployment env as confidential.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs are welcome; keep changes focused.
