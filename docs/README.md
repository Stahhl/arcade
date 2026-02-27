# Arcade Docs

This directory defines product and technical direction before implementation.

## Documents

- `mission.md`: Product mission, audience, and success criteria.
- `principles.md`: Engineering and game design principles.
- `tech-stack.md`: Recommended stack now and future evolution.
- `architecture.md`: Monorepo and package boundaries.
- `product-design.md`: Core UX screens, accessibility baseline, and visual direction.
- `game-module-contract.md`: Standard interface each game should implement.
- `testing-strategy.md`: Automated testing approach for deterministic game QA.
- `roadmap.md`: Phased delivery plan from local-first to online features.
- `implementation-plan.md`: Execution-ready milestones, backlog order, and acceptance criteria.

## Current Direction

- Start with a client-side SPA game hub.
- Build each game as an isolated package with shared contracts.
- Use local profiles/state first; add APIs later without rewriting the front end.
- Enforce automated tests from the first playable game.
