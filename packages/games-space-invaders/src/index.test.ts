// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { spaceInvadersGame } from "./index";

describe("spaceInvadersGame", () => {
  it("exposes deterministic hooks and reaches game over over time", () => {
    const container = document.createElement("div");
    document.body.append(container);

    const onScoreChanged = vi.fn();
    const onGameOver = vi.fn();

    const instance = spaceInvadersGame.createGame(container, {
      on: {
        scoreChanged: onScoreChanged,
        gameOver: onGameOver
      }
    });

    const initialState = JSON.parse(instance.render_game_to_text()) as {
      mode: string;
      invaders: Array<{ x: number; y: number }>;
      player: { x: number; y: number };
      bullet: { x: number; y: number } | null;
    };
    expect(initialState.mode).toBe("running");
    expect(initialState.invaders.length).toBeGreaterThan(0);

    instance.advanceTime(170);
    const movedState = JSON.parse(instance.render_game_to_text()) as {
      invaders: Array<{ x: number; y: number }>;
    };
    expect(movedState.invaders[0]?.x).toBe((initialState.invaders[0]?.x ?? 0) + 1);

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " }));
    instance.advanceTime(170);
    const shotState = JSON.parse(instance.render_game_to_text()) as {
      bullet: { x: number; y: number } | null;
    };
    expect(shotState.bullet).not.toBeNull();
    expect((shotState.bullet?.y ?? 999)).toBeLessThan(initialState.player.y - 1);

    instance.advanceTime(20_000);
    const finalState = JSON.parse(instance.render_game_to_text()) as { mode: string };
    expect(finalState.mode).toBe("game_over");
    expect(onScoreChanged).toHaveBeenCalledWith({ gameId: "space-invaders", score: 0 });
    expect(onGameOver).toHaveBeenCalledOnce();

    instance.destroy();
  });
});
