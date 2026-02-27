# Roadmap

## Phase 0: Foundation

- Define monorepo structure.
- Create shell app + shared SDK package.
- Add first game (`snake`) as proof of contract.
- Establish deterministic test harness.

## Phase 1: Multi-Game Local Arcade

- Add `tetris` and `space-invaders`.
- Build launcher with filtering/sorting.
- Local profile persistence:
  - player name
  - per-game high scores
  - unlocked local achievements

## Phase 2: Quality and Scale

- Shared pause/settings overlays.
- Strong e2e regression suite across all games.
- Performance baselines and asset budgets.

## Phase 3: Backend Introduction

- Add `apps/api` with score/profile endpoints.
- Move persistence behind repository abstraction.
- Add authenticated profiles and server leaderboards.

## Phase 4: Community Features

- Leaderboard seasons/events.
- Achievement sync and progression pages.
- Optional social/share features.
