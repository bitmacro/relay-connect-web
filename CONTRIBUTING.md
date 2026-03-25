# Contributing to relay-connect

Thanks for helping improve **relay-connect**.

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

This app is the **reference UI** for relay-api `/signer`. Shared client logic is planned to move into **`@bitmacro/connect`**; keep new “business” helpers ready to extract where it makes sense.
