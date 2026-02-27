# Tech Stack

## Recommended Baseline

- Monorepo: `pnpm` workspaces.
- Front end shell: `Vite` + `React` + `TypeScript`.
- Game engine: `Phaser` (per game package).
- Shared validation/types: `zod` (optional but recommended).
- Testing:
  - Unit: `Vitest`.
  - Browser/e2e: `Playwright`.
  - Game loop automation: deterministic action scripts via `render_game_to_text` and `advanceTime(ms)`.

## Why This Stack

- `Vite` provides fast iteration for game-heavy front ends.
- `React` is suitable for shell UI (routing, launcher, profile screens).
- `Phaser` is mature for 2D arcade mechanics and asset handling.
- `pnpm` workspaces keep shared dependencies manageable while allowing package isolation.

## Future Additions

- Backend API (`apps/api`) for:
  - durable profiles
  - leaderboards
  - achievements
- Database: Postgres + migration tooling.
- Auth: session-based or token-based auth when accounts are introduced.
- Telemetry: client error + performance instrumentation.

## Alternatives Considered

- Next.js or SvelteKit now:
  - Good for SSR/content-heavy sites.
  - Adds complexity not required for game-first local MVP.
- Single giant app:
  - Faster day 1 but harder long-term boundaries for testing and ownership.
