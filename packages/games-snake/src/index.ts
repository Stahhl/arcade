import type { GameModule, GameOptions } from "@arcade/game-sdk";

type Point = {
  x: number;
  y: number;
};

type SnakeMode = "running" | "paused" | "game_over";

type SnakeState = {
  mode: SnakeMode;
  score: number;
  snake: Point[];
  direction: Point;
  queuedDirection: Point;
  food: Point;
  stepAccumulatorMs: number;
  spawnCursor: number;
};

const WIDTH = 14;
const HEIGHT = 14;
const STEP_MS = 140;

const UP: Point = { x: 0, y: -1 };
const DOWN: Point = { x: 0, y: 1 };
const LEFT: Point = { x: -1, y: 0 };
const RIGHT: Point = { x: 1, y: 0 };

function isSamePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function isOppositeDirection(current: Point, candidate: Point): boolean {
  return current.x + candidate.x === 0 && current.y + candidate.y === 0;
}

function nextFood(state: SnakeState): Point {
  const occupied = new Set(state.snake.map((segment) => `${segment.x},${segment.y}`));
  const startIndex = state.spawnCursor % (WIDTH * HEIGHT);
  for (let offset = 0; offset < WIDTH * HEIGHT; offset += 1) {
    const index = (startIndex + offset) % (WIDTH * HEIGHT);
    const point = { x: index % WIDTH, y: Math.floor(index / WIDTH) };
    if (!occupied.has(`${point.x},${point.y}`)) {
      state.spawnCursor = index + 1;
      return point;
    }
  }

  return { x: 0, y: 0 };
}

function buildInitialState(): SnakeState {
  const centerX = Math.floor(WIDTH / 2);
  const centerY = Math.floor(HEIGHT / 2);
  const snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY }
  ];
  const state: SnakeState = {
    mode: "running",
    score: 0,
    snake,
    direction: RIGHT,
    queuedDirection: RIGHT,
    food: { x: centerX + 1, y: centerY },
    stepAccumulatorMs: 0,
    spawnCursor: 0
  };
  return state;
}

function renderGrid(state: SnakeState): string {
  const rows: string[] = [];
  const head = state.snake[0];
  for (let y = 0; y < HEIGHT; y += 1) {
    let row = "";
    for (let x = 0; x < WIDTH; x += 1) {
      const point = { x, y };
      if (head && isSamePoint(point, head)) {
        row += "@";
      } else if (isSamePoint(point, state.food)) {
        row += "*";
      } else if (state.snake.some((segment) => isSamePoint(point, segment))) {
        row += "o";
      } else {
        row += ".";
      }
    }
    rows.push(row);
  }
  return rows.join("\n");
}

function createSnakeRoot(container: HTMLElement): {
  root: HTMLDivElement;
  hud: HTMLParagraphElement;
  grid: HTMLPreElement;
  legend: HTMLParagraphElement;
} {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "snake-root";

  const hud = document.createElement("p");
  hud.className = "snake-hud";

  const grid = document.createElement("pre");
  grid.className = "snake-grid";

  const legend = document.createElement("p");
  legend.className = "snake-legend";
  legend.textContent = "Legend: @ head, o body, * food";

  root.append(hud, grid, legend);
  container.append(root);

  return { root, hud, grid, legend };
}

function renderTextState(state: SnakeState): string {
  return JSON.stringify({
    coordinateSystem: {
      origin: "top-left",
      axis: {
        x: "right-positive",
        y: "down-positive"
      },
      board: { width: WIDTH, height: HEIGHT }
    },
    mode: state.mode,
    score: state.score,
    direction: state.direction,
    snake: state.snake,
    food: state.food
  });
}

export const snakeGame: GameModule = {
  metadata: {
    id: "snake",
    name: "Snake",
    version: "0.1.0",
    description: "Playable deterministic Snake vertical slice."
  },
  createGame(container: HTMLElement, options: GameOptions) {
    const state = buildInitialState();
    const ui = createSnakeRoot(container);
    let rafId = 0;
    let lastFrame = performance.now();
    let destroyed = false;
    let lastMode: SnakeMode | null = null;
    let lastScore = -1;

    const onScoreChanged = options.on?.scoreChanged;
    const onGameOver = options.on?.gameOver;

    const emitEvents = () => {
      if (state.score !== lastScore) {
        onScoreChanged?.({ gameId: "snake", score: state.score });
        lastScore = state.score;
      }
      if (state.mode !== lastMode && state.mode === "game_over") {
        onGameOver?.({
          gameId: "snake",
          finalScore: state.score,
          reason: "collision"
        });
      }
      lastMode = state.mode;
    };

    const updateView = () => {
      ui.hud.textContent = `Mode: ${state.mode} | Score: ${state.score}`;
      ui.grid.textContent = renderGrid(state);
    };

    const stepSimulation = () => {
      if (state.mode !== "running") {
        return;
      }

      if (!isOppositeDirection(state.direction, state.queuedDirection)) {
        state.direction = state.queuedDirection;
      }

      const head = state.snake[0];
      if (!head) {
        state.mode = "game_over";
        emitEvents();
        updateView();
        return;
      }

      const newHead = {
        x: head.x + state.direction.x,
        y: head.y + state.direction.y
      };

      const collidesWall =
        newHead.x < 0 || newHead.x >= WIDTH || newHead.y < 0 || newHead.y >= HEIGHT;
      const collidesSelf = state.snake.some((segment) => isSamePoint(segment, newHead));
      if (collidesWall || collidesSelf) {
        state.mode = "game_over";
        emitEvents();
        updateView();
        return;
      }

      state.snake.unshift(newHead);

      if (isSamePoint(newHead, state.food)) {
        state.score += 1;
        state.food = nextFood(state);
      } else {
        state.snake.pop();
      }

      emitEvents();
      updateView();
    };

    const advanceTime = (ms: number) => {
      if (destroyed) {
        return;
      }

      state.stepAccumulatorMs += Math.max(0, ms);
      while (state.stepAccumulatorMs >= STEP_MS) {
        state.stepAccumulatorMs -= STEP_MS;
        stepSimulation();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        state.queuedDirection = UP;
      } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        state.queuedDirection = DOWN;
      } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        state.queuedDirection = LEFT;
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        state.queuedDirection = RIGHT;
      } else if (event.key.toLowerCase() === "p") {
        state.mode = state.mode === "paused" ? "running" : "paused";
      } else if (event.key.toLowerCase() === "r") {
        Object.assign(state, buildInitialState());
      }

      updateView();
    };

    const tick = (timestamp: number) => {
      if (destroyed) {
        return;
      }

      const deltaMs = timestamp - lastFrame;
      lastFrame = timestamp;
      advanceTime(deltaMs);
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("keydown", onKeyDown);
    updateView();
    emitEvents();
    rafId = requestAnimationFrame(tick);

    return {
      destroy() {
        destroyed = true;
        cancelAnimationFrame(rafId);
        window.removeEventListener("keydown", onKeyDown);
        container.innerHTML = "";
      },
      pause() {
        state.mode = "paused";
        updateView();
      },
      resume() {
        if (state.mode !== "game_over") {
          state.mode = "running";
        }
        updateView();
      },
      restart() {
        Object.assign(state, buildInitialState());
        updateView();
        emitEvents();
      },
      render_game_to_text() {
        return renderTextState(state);
      },
      advanceTime
    };
  }
};
