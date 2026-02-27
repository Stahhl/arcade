import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders landing heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Arcade" })).toBeInTheDocument();
  });

  it("lists planned games", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Snake" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tetris" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Space Invaders" })
    ).toBeInTheDocument();
  });

  it("launches snake and advances deterministic state", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Play Snake" }));

    expect(screen.getByRole("heading", { name: "Snake" })).toBeInTheDocument();
    expect(screen.getByText("Score: 0")).toBeInTheDocument();

    const hooks = window as Window & {
      advanceTime?: (ms: number) => void;
      render_game_to_text?: () => string;
    };

    act(() => {
      hooks.advanceTime?.(150);
    });

    expect(screen.getByText("Score: 1")).toBeInTheDocument();
    expect(hooks.render_game_to_text).toBeTypeOf("function");
  });

  it("launches tetris and advances deterministic state", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Play Tetris" }));

    expect(screen.getByRole("heading", { name: "Tetris" })).toBeInTheDocument();

    const hooks = window as Window & {
      advanceTime?: (ms: number) => void;
      render_game_to_text?: () => string;
    };

    let state = JSON.parse(hooks.render_game_to_text?.() ?? "{}") as {
      mode?: string;
      activePiece?: { anchor: { y: number } };
    };
    const initialY = state.activePiece?.anchor.y ?? 0;

    act(() => {
      hooks.advanceTime?.(240);
    });

    state = JSON.parse(hooks.render_game_to_text?.() ?? "{}") as {
      mode?: string;
      activePiece?: { anchor: { y: number } };
    };
    expect(state.mode).toBe("running");
    expect((state.activePiece?.anchor.y ?? 0) > initialY).toBe(true);
  });
});
