# Testing Strategy

## Goals

- Catch gameplay regressions early.
- Keep tests deterministic and debuggable.
- Validate both UI behavior and internal game state.

## Test Layers

1. Unit tests (`Vitest`)
   - Pure game logic (collision, scoring, spawn rules, timers).
   - SDK adapters and serializers.
2. Integration tests
   - Game package mounted in host container.
   - Event emission and pause/restart flow.
3. E2E tests (`Playwright`)
   - Launcher flows (browse/select/start/back).
   - In-game control sequences.
   - Score/game-over transitions.

## Deterministic Testing Requirements

Every game should expose:

- `window.render_game_to_text`: concise JSON state snapshot for assertions.
- `window.advanceTime(ms)`: deterministic simulation stepping.

## Minimal Regression Suite Per Game

1. Starts from clean initial state.
2. Accepts expected controls.
3. Updates score/resources correctly.
4. Enters game-over state correctly.
5. Restarts cleanly without leaked state.

## Artifact Expectations

- Save screenshot(s) per scenario.
- Save JSON text-state snapshots at key transitions.
- Fail tests on first new console error.

## CI Expectations (When Added)

- PR gates run unit + e2e smoke suite.
- Nightly can run longer scenario packs.
