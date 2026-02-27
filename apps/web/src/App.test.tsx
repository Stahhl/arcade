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
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

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
});
