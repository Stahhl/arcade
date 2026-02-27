// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { tetrisGame } from "./index";

describe("tetrisGame", () => {
  it("exposes deterministic hooks and eventually reaches game over", () => {
    const container = document.createElement("div");
    document.body.append(container);

    const onScoreChanged = vi.fn();
    const onGameOver = vi.fn();

    const instance = tetrisGame.createGame(container, {
      on: {
        scoreChanged: onScoreChanged,
        gameOver: onGameOver
      }
    });

    const initialState = JSON.parse(instance.render_game_to_text()) as {
      mode: string;
      activePiece: { anchor: { x: number; y: number } };
    };
    expect(initialState.mode).toBe("running");

    instance.advanceTime(240);
    const steppedState = JSON.parse(instance.render_game_to_text()) as {
      activePiece: { anchor: { x: number; y: number } };
    };
    expect(steppedState.activePiece.anchor.y).toBeGreaterThan(initialState.activePiece.anchor.y);

    instance.advanceTime(60_000);
    const finalState = JSON.parse(instance.render_game_to_text()) as { mode: string };
    expect(finalState.mode).toBe("game_over");
    expect(onScoreChanged).toHaveBeenCalledWith({ gameId: "tetris", score: 0 });
    expect(onGameOver).toHaveBeenCalledOnce();

    instance.destroy();
  });
});
