import type { GameModule } from "@arcade/game-sdk";

export const spaceInvadersGame: GameModule = {
  metadata: {
    id: "space-invaders",
    name: "Space Invaders",
    version: "0.1.0",
    description: "Initial Space Invaders package scaffold."
  },
  createGame(_container, _options) {
    return {
      destroy() {},
      pause() {},
      resume() {},
      restart() {},
      render_game_to_text() {
        return JSON.stringify({ mode: "not_implemented" });
      },
      advanceTime(_ms: number) {}
    };
  }
};
