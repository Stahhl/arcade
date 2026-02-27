import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

const PROFILE_STORAGE_KEY = "arcade.local-profile.v1";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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

  it("filters games by search term", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "space" }
    });

    expect(screen.getByRole("heading", { name: "Space Invaders" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Snake" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tetris" })).not.toBeInTheDocument();
  });

  it("shows empty state when status filter excludes all games", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "planned" }
    });

    expect(screen.getByText("No games match your current filters.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play Snake" })).not.toBeInTheDocument();
  });

  it("sorts games by name descending", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "name-desc" }
    });

    const orderedHeadings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(orderedHeadings).toEqual(["Tetris", "Space Invaders", "Snake"]);
  });

  it("persists player name in local profile storage", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Player name"), {
      target: { value: "Pam Beesly" }
    });

    const rawProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    expect(rawProfile).toBeTruthy();
    expect(JSON.parse(rawProfile ?? "{}").playerName).toBe("Pam Beesly");
  });

  it("hydrates player profile from local storage", () => {
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        playerName: "Dwight Schrute",
        highScores: {
          snake: 7,
          tetris: 4,
          "space-invaders": 2
        },
        unlockedAchievementIds: ["first-launch", "score-10"]
      })
    );

    render(<App />);

    expect(screen.getByDisplayValue("Dwight Schrute")).toBeInTheDocument();
    expect(screen.getByText("Snake: 7")).toBeInTheDocument();
    expect(screen.getByText("Tetris: 4")).toBeInTheDocument();
    expect(screen.getByText("Space Invaders: 2")).toBeInTheDocument();
    expect(screen.getByText("First Launch")).toBeInTheDocument();
    expect(screen.getByText("Score 10")).toBeInTheDocument();
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

  it("launches space invaders and advances deterministic state", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Play Space Invaders" }));

    expect(screen.getByRole("heading", { name: "Space Invaders" })).toBeInTheDocument();

    const hooks = window as Window & {
      advanceTime?: (ms: number) => void;
      render_game_to_text?: () => string;
    };

    let state = JSON.parse(hooks.render_game_to_text?.() ?? "{}") as {
      mode?: string;
      invaders?: Array<{ x: number; y: number }>;
    };
    const startX = state.invaders?.[0]?.x ?? 0;

    act(() => {
      hooks.advanceTime?.(170);
    });

    state = JSON.parse(hooks.render_game_to_text?.() ?? "{}") as {
      mode?: string;
      invaders?: Array<{ x: number; y: number }>;
    };
    expect(state.mode).toBe("running");
    expect(state.invaders?.[0]?.x).toBe(startX + 1);
  });

  it("updates snake high score and unlocks first-launch achievements", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Play Snake" }));

    const hooks = window as Window & {
      advanceTime?: (ms: number) => void;
    };
    act(() => {
      hooks.advanceTime?.(150);
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to launcher" }));

    expect(screen.getByText("Snake: 1")).toBeInTheDocument();
    expect(screen.getByText("First Launch")).toBeInTheDocument();
    expect(screen.getByText("First Point")).toBeInTheDocument();
  });
});
