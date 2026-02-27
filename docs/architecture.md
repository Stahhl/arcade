# Architecture Overview

## Repo Shape

```text
arcade/
  apps/
    web/                  # SPA launcher and shell UI
    api/                  # future backend services
  packages/
    game-sdk/             # shared game interfaces and adapters
    game-testing/         # shared test helpers and fixtures
    ui/                   # shared shell UI components
    games-snake/          # game package
    games-tetris/         # game package
    games-space-invaders/ # game package
  tests/
    e2e/                  # app-level end-to-end tests
  docs/
```

## Key Boundaries

- `apps/web` owns navigation, game launcher, local profile, and cross-game settings.
- `packages/games-*` own all game-specific runtime logic and assets.
- `packages/game-sdk` defines the contract between shell and games.
- `packages/game-testing` centralizes deterministic simulation/testing utilities.

## Data Flow (Phase 1)

1. Shell loads game catalog metadata.
2. User selects a game.
3. Shell dynamically imports game package and mounts it in a standard host container.
4. Game reports score/session results through SDK events.
5. Shell persists local profile/state.

## Data Flow (Phase 2+)

1. Local writes go through a profile/repository abstraction.
2. Repository can switch from local storage to API-backed storage.
3. Shell and games remain mostly unchanged due to stable SDK contracts.
