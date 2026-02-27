# Principles

## Product Principles

1. Consistency over novelty in shell UX.
2. Game feel first: responsive controls and clear feedback.
3. Local-first progression, cloud-ready architecture.
4. Accessibility and clarity in menus and controls.

## Engineering Principles

1. Modular games: each game should be independently buildable and testable.
2. Shared contracts: avoid one-off integration logic in the shell app.
3. Determinism in tests: game state should be inspectable and time-steppable.
4. Incremental complexity: start simple, preserve clear migration paths.
5. Fail visibly: test and runtime errors should be easy to diagnose.

## Quality Principles

1. Any gameplay bug gets a regression test.
2. Visual checks plus state-based checks are both required.
3. Avoid flaky test design by preferring deterministic frame/time control.
