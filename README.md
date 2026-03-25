# @bitmacro/relay-connect

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[→ Relay Panel](https://relay-panel.bitmacro.io)**  
**[→ BitMacro](https://bitmacro.io)**

Minimal **Next.js** app for **NIP-46 (Nostr Connect)** flows against **relay-api** `/signer` (session + QR + bridge). Part of the [BitMacro Relay Manager](https://bitmacro.io) ecosystem.

| Project | Role | License |
|---------|------|---------|
| **relay-connect** | This repo — auth / connect UI + API proxy | MIT |
| [relay-agent](https://github.com/bitmacro/relay-agent) | strfry REST on the operator’s server | MIT |
| [relay-panel](https://github.com/bitmacro/relay-panel) | Relay management UI | BSL 1.1 |
| relay-api | Central hub (Supabase, `/signer`, proxy to agents) | Private |

**Roadmap:** logic will move into **`@bitmacro/connect`** (npm) as a shared client between this app, **relay-panel**, and other frontends; **relay-connect** stays the reference UI and integration example.

---

## What it does

- Server-only auth to **relay-api**: `RELAY_API_KEY` + `SIGNER_PROVIDER_USER_ID` (GitHub numeric id, same as `relay_configs.provider_user_id`).
- Browser calls **Next.js** `/api/signer/*`, which proxies to `RELAY_API_URL/signer/*`.
- **NIP-46:** `POST /signer/connect`, QR from `nostrconnect_uri`, polling `GET /signer/sessions`, optional bridge subscribe (`kind` 24133), `POST /signer/session/:id/complete`.
- **BitMacro relays:** when `relay_configs.endpoint` is `https://relay-agent.bitmacro.io`, `bridge_wss` is resolved from `agent_relay_id` (`public` → `wss://relay.bitmacro.cloud`, etc.). Override with `NEXT_PUBLIC_RELAY_BRIDGE_WSS` if needed.

---

## Quick start

```bash
cd relay-connect
cp .env.example .env
# Edit .env: RELAY_API_KEY, SIGNER_PROVIDER_USER_ID, optional RELAY_API_URL / NEXT_PUBLIC_*
npm install
npm run dev
# http://localhost:3000
```

Requires a **relay-api** deployment with `/signer` routes and Supabase table **`relay.nip46_sessions`** (see relay-api migrations).

### Migrating from `identity-gate`

This app was previously named **identity-gate**. Stop any dev server, remove the old `identity-gate` folder if it is still present, work only from **`relay-connect/`**, and run `npm install`. Browser storage keys use the prefix `relay_connect_*` (new sessions after upgrade).

---

## Environment variables

| Variable | Scope | Description |
|----------|--------|-------------|
| `RELAY_API_URL` | Server | relay-api base URL (default `https://relay-api.bitmacro.io`) |
| `RELAY_API_KEY` | Server | Same key as relay-api `RELAY_API_KEY` |
| `SIGNER_PROVIDER_USER_ID` | Server | GitHub user id string (`provider_user_id` in `relay_configs`) |
| `SIGNER_PROXY_TIMEOUT_MS` | Server | Optional. Proxy fetch timeout (ms), default 60000 |
| `NEXT_PUBLIC_RELAY_BRIDGE_WSS` | Client | Optional. Force NIP-46 bridge `wss://…` |
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

Console prefix **`[relay-connect]`** in the browser; **`[relay-connect][proxy]`** in the terminal running `npm run dev` for upstream relay-api calls.

---

## Security

- Run **relay-api** with TLS; use strong `RELAY_API_KEY`.
- `SIGNER_PROVIDER_USER_ID` identifies the operator account whose relays are used for `/signer/config` and `/signer/connect`; treat deployment env as confidential.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs are welcome; keep changes focused.
