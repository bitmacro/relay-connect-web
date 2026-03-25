# Contributing to relay-connect-web

Thanks for helping improve **relay-connect-web**.

## Local setup

1. Clone the repository and enter the project directory.
2. `npm install`
3. `cp .env.example .env` — set `RELAY_API_KEY`, `SIGNER_PROVIDER_USER_ID`, and optionally `RELAY_API_URL`.
4. `npm run dev`

## Checks before a PR

- `npm run lint`
- `npm run build`

## Commits

Prefer [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.).

## Context

This app is the **reference UI** for relay-api `/signer`. Shared client logic lives in **`@bitmacro/relay-connect`** ([SDK repo](https://github.com/bitmacro/relay-connect)); keep new “business” helpers ready to extract there where it makes sense.
