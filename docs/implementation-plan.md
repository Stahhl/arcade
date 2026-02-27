# Implementation Plan

This plan converts the roadmap into execution-ready milestones with concrete deliverables and acceptance criteria.

## Planning Assumptions

- Team starts with a single developer or very small team.
- Local-first profile/state is the first persistence target.
- Core priority is playable quality + testability, not feature breadth.
- Target stack: `pnpm` workspaces, `Vite` + `React` + `TypeScript`, `Phaser`, `Vitest`, `Playwright`.

## Delivery Structure

Work is organized into milestones (M0-M4). Each milestone has:

- scope
- deliverables
- acceptance criteria
- explicit out-of-scope items

## Milestone M0: Repo Foundation

## Scope

- Monorepo scaffolding and baseline tooling.
- CI-ready scripts for linting, type-checking, and tests.

## Deliverables

1. Workspace layout from architecture doc.
2. Root scripts:
   - `dev:web`
   - `test`
   - `test:e2e`
   - `lint`
   - `typecheck`
3. Base TypeScript configs and package conventions.
4. Basic CI workflow that runs on pull requests.

## Acceptance Criteria

1. Fresh clone can install and run `apps/web` with one command.
2. CI executes lint + type-check + unit tests successfully on sample code.
3. Workspace dependency boundaries are documented in README.

## Out of Scope

- Real gameplay depth.
- Backend services.

## Milestone M1: Shell + SDK + Snake Vertical Slice

## Scope

- End-to-end playable loop for one game (`snake`) through shared contract.

## Deliverables

1. `apps/web` shell with:
   - landing page
   - game card launcher
   - game host route/container
2. `packages/game-sdk` with:
   - game metadata types
   - runtime API interfaces
   - event contracts
3. `packages/games-snake`:
   - playable game loop
   - pause/resume/restart
   - score + game-over emission
4. Deterministic hooks in snake:
   - `render_game_to_text()`
   - `advanceTime(ms)`

## Acceptance Criteria

1. Snake launches from the shell and returns to launcher cleanly.
2. Snake emits contract events consumed by shell (score and game-over).
3. Automated e2e smoke test can start game, play input burst, and assert text state.
4. No uncaught console errors in smoke path.

## Out of Scope

- Additional games.
- Achievements UI beyond event plumbing.

## Milestone M2: Multi-Game Local Arcade

## Scope

- Add `tetris` and `space-invaders` on same host contract.
- Introduce local profile + local high scores.

## Deliverables

1. `packages/games-tetris` and `packages/games-space-invaders`.
2. Launcher enhancements:
   - search/filter/sort
   - last played and personal best display
3. Local profile repository abstraction:
   - `playerName`
   - per-game high score
   - unlocked achievements (local)
4. Shared pause/settings overlay in shell.

## Acceptance Criteria

1. All three games run through the same SDK contract with no per-game shell hacks.
2. Profile and scores persist across reloads.
3. Each game has deterministic test hooks and e2e smoke coverage.
4. Local state migration strategy exists (versioned schema).

## Out of Scope

- Remote leaderboards.
- Authentication.

## Milestone M3: Quality and Hardening

## Scope

- Stabilize, reduce regressions, and enforce performance and QA gates.

## Deliverables

1. Regression suites per game:
   - controls
   - score/lives/resource transitions
   - game-over + restart
2. Shared game testing helpers in `packages/game-testing`.
3. Performance budgets:
   - asset size budget
   - runtime FPS targets for baseline hardware profile
4. Error telemetry plumbing (client-side logging strategy).

## Acceptance Criteria

1. Flake-resistant e2e runs in CI across multiple retries (documented threshold).
2. Critical gameplay flows covered by automated tests for all games.
3. Performance baseline report is generated and tracked.

## Out of Scope

- Full backend rollout.

## Milestone M4: Backend Introduction

## Scope

- Add `apps/api` and switch persistence from local-only to local+remote capable.

## Deliverables

1. API skeleton with profile/score/achievement endpoints.
2. Repository adapter pattern in front end:
   - local adapter
   - API adapter
3. Auth strategy decision and initial implementation.
4. Leaderboard API + shell leaderboard view.

## Acceptance Criteria

1. Front end can run in local-only mode and API mode via config flag.
2. Score submissions and profile reads work through API integration tests.
3. Contract tests prevent breaking API changes.

## Out of Scope

- Community/social features.

## Cross-Cutting Workstreams

1. Developer Experience
   - fast start scripts
   - lint/type/test conventions
   - clear contribution docs
2. Testing and CI
   - deterministic hooks required in all games
   - screenshot + text-state artifacts on e2e failures
3. Design System
   - shared shell components in `packages/ui`
   - consistent interaction model (menu, pause, restart, back)
4. Data and Compatibility
   - local profile schema versioning
   - migration scripts as schema evolves

## Initial Backlog (Execution Order)

## Sprint 1

1. Scaffold monorepo and base tooling.
2. Create `apps/web` shell skeleton.
3. Define and publish `game-sdk` interfaces.
4. Add CI pipeline for lint/typecheck/unit smoke.

## Sprint 2

1. Implement `games-snake`.
2. Integrate snake into launcher.
3. Add deterministic hooks.
4. Add first Playwright deterministic e2e smoke test.

## Sprint 3

1. Implement local profile repository + schema versioning.
2. Add per-game high score persistence.
3. Implement pause/settings overlay contract in shell.
4. Add regression tests for snake restart + game-over flows.

## Sprint 4

1. Implement `games-tetris`.
2. Implement `games-space-invaders`.
3. Extend launcher browsing and metadata display.
4. Add smoke e2e for all three games.

## Definition of Done (Per Ticket)

1. Code merged with passing lint, typecheck, unit, and relevant e2e tests.
2. Contract changes reflected in `game-sdk` docs.
3. Tests include at least one deterministic state assertion.
4. No new uncaught console errors in affected gameplay paths.

## Top Risks and Mitigations

1. Risk: test flakiness from frame timing and async rendering.
   - Mitigation: enforce `advanceTime(ms)` and deterministic step-based tests.
2. Risk: shell-to-game contract drift.
   - Mitigation: centralize interfaces in `game-sdk` and add contract tests.
3. Risk: local profile schema churn.
   - Mitigation: versioned schema and migration layer from the first persistence release.
4. Risk: expanding scope too early.
   - Mitigation: strict milestone out-of-scope enforcement.
