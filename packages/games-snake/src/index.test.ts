// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { snakeGame } from "./index";

describe("snakeGame", () => {
  it("exposes deterministic hooks and emits score/game-over events", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onScoreChanged = vi.fn();
    const onGameOver = vi.fn();

    const instance = snakeGame.createGame(container, {
      on: {
        scoreChanged: onScoreChanged,
        gameOver: onGameOver
      }
    });

    instance.advanceTime(150);
    const firstState = JSON.parse(instance.render_game_to_text()) as { score: number };
    expect(firstState.score).toBe(1);
    expect(onScoreChanged).toHaveBeenCalledWith({ gameId: "snake", score: 1 });

    instance.advanceTime(5_000);
    const lastState = JSON.parse(instance.render_game_to_text()) as { mode: string };
    expect(lastState.mode).toBe("game_over");
    expect(onGameOver).toHaveBeenCalledOnce();

    instance.destroy();
  });
});
