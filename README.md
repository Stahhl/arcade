# Arcade

Web-based arcade monorepo for classic games (snake, tetris, space invaders) with deterministic automated testing.

## Stack

- `pnpm` workspaces
- Node LTS (`.nvmrc` set to `lts/*`)
- `Vite` + `React` + `TypeScript` for the shell app
- `Phaser` for game packages
- `Vitest` + `Playwright` for testing

## Repo Structure

```text
apps/
  web/      # SPA launcher + host shell
  api/      # future backend
packages/
  game-sdk/
  game-testing/
  ui/
  games-snake/
  games-tetris/
  games-space-invaders/
tests/
  e2e/
docs/
```

## Quick Start

```bash
nvm use
pnpm install
pnpm dev:web
```

## Core Scripts

- `pnpm dev:web`
- `pnpm web-game:client -- --url http://127.0.0.1:4173 --actions-file /absolute/path/to/actions.json`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`

## Skill-Compatible Playwright Client

If the external skill client cannot import `playwright` in this environment, use the local wrapper:

```bash
pnpm web-game:client -- --url http://127.0.0.1:4173 --click-selector "text=Play" --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json"
```

The wrapper keeps the same CLI shape as the skill client and writes screenshots/state artifacts to the path passed via `--screenshot-dir` (resolved from your current shell directory).

## License

Apache-2.0
