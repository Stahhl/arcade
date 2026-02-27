# Game Module Contract

Each game package should expose a standard interface so the shell can host any game without special-case code.

## Required Metadata

- `id`: stable unique id (example: `snake`).
- `name`: user-facing title.
- `version`: semantic version.
- `description`: short description for launcher UI.
- `thumbnail`: image path or URL for card display.

## Required Runtime API

- `createGame(container: HTMLElement, options: GameOptions): GameInstance`
- `destroy(): void`
- `pause(): void`
- `resume(): void`
- `restart(): void`

## Required Testing Hooks

- `render_game_to_text(): string`
- `advanceTime(ms: number): void`

## Required Events (Game -> Shell)

- `scoreChanged`
- `gameOver`
- `achievementUnlocked` (no-op initially is acceptable)
- `error`

## Optional Features

- Control remapping.
- Difficulty settings.
- Session seed for reproducible runs.

## Contract Rule

If a game cannot implement a required method, the contract should be adjusted centrally in `game-sdk` rather than bypassed in one game.
