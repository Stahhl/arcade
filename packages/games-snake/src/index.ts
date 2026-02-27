import type PhaserNamespace from "phaser";
import type { GameModule, GameOptions } from "@arcade/game-sdk";

type PhaserModule = typeof PhaserNamespace;

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

type SnakeUi = {
  root: HTMLDivElement;
  hud: HTMLParagraphElement;
  canvasHost: HTMLDivElement;
  grid: HTMLPreElement;
  legend: HTMLParagraphElement;
};

type SnakeRenderer = {
  render: (state: SnakeState) => void;
  destroy: () => void;
  isFallback: boolean;
};

const WIDTH = 14;
const HEIGHT = 14;
const STEP_MS = 140;
const CELL_SIZE = 26;
const BOARD_PADDING = 12;
const CANVAS_WIDTH = WIDTH * CELL_SIZE + BOARD_PADDING * 2;
const CANVAS_HEIGHT = HEIGHT * CELL_SIZE + BOARD_PADDING * 2;

const UP: Point = { x: 0, y: -1 };
const DOWN: Point = { x: 0, y: 1 };
const LEFT: Point = { x: -1, y: 0 };
const RIGHT: Point = { x: 1, y: 0 };

let phaserModulePromise: Promise<PhaserModule | null> | null = null;

function loadPhaserModule(): Promise<PhaserModule | null> {
  if (!phaserModulePromise) {
    phaserModulePromise = import("phaser")
      .then((module) => (module.default ?? module) as PhaserModule)
      .catch(() => null);
  }
  return phaserModulePromise;
}

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

function createSnakeRoot(container: HTMLElement): SnakeUi {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "snake-root";

  const hud = document.createElement("p");
  hud.className = "snake-hud";

  const canvasHost = document.createElement("div");
  canvasHost.className = "snake-canvas-host";

  const grid = document.createElement("pre");
  grid.className = "snake-grid";

  const legend = document.createElement("p");
  legend.className = "snake-legend";
  legend.textContent = "Legend: @ head, o body, * food";

  root.append(hud, canvasHost, grid, legend);
  container.append(root);

  return { root, hud, canvasHost, grid, legend };
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

function canUsePhaserRenderer(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const userAgent = navigator?.userAgent?.toLowerCase() ?? "";
  if (userAgent.includes("jsdom")) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return typeof canvas.getContext === "function";
  } catch {
    return false;
  }
}

function createFallbackRenderer(ui: SnakeUi): SnakeRenderer {
  return {
    isFallback: true,
    render(state) {
      ui.grid.textContent = renderGrid(state);
    },
    destroy() {
      ui.grid.textContent = "";
    }
  };
}

function createPhaserRenderer(ui: SnakeUi, phaser: PhaserModule): SnakeRenderer {
  let graphics: any = null;
  let isDestroyed = false;

  const game = new phaser.Game({
    type: phaser.CANVAS,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: "#0b132b",
    parent: ui.canvasHost,
    banner: false,
    scene: {
      create() {
        const scene = this as any;
        graphics = scene.add.graphics();
      }
    }
  });

  return {
    isFallback: false,
    render(state) {
      if (isDestroyed || !graphics) {
        return;
      }

      const draw = graphics;
      draw.clear();

      draw.fillStyle(0x0b132b, 1);
      draw.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      draw.fillStyle(0x132238, 1);
      draw.fillRect(
        BOARD_PADDING,
        BOARD_PADDING,
        WIDTH * CELL_SIZE,
        HEIGHT * CELL_SIZE
      );

      draw.lineStyle(1, 0x20324d, 0.4);
      for (let x = 0; x <= WIDTH; x += 1) {
        const xPos = BOARD_PADDING + x * CELL_SIZE;
        draw.beginPath();
        draw.moveTo(xPos, BOARD_PADDING);
        draw.lineTo(xPos, BOARD_PADDING + HEIGHT * CELL_SIZE);
        draw.strokePath();
      }
      for (let y = 0; y <= HEIGHT; y += 1) {
        const yPos = BOARD_PADDING + y * CELL_SIZE;
        draw.beginPath();
        draw.moveTo(BOARD_PADDING, yPos);
        draw.lineTo(BOARD_PADDING + WIDTH * CELL_SIZE, yPos);
        draw.strokePath();
      }

      draw.fillStyle(0xf1605d, 1);
      draw.fillRoundedRect(
        BOARD_PADDING + state.food.x * CELL_SIZE + 3,
        BOARD_PADDING + state.food.y * CELL_SIZE + 3,
        CELL_SIZE - 6,
        CELL_SIZE - 6,
        5
      );

      state.snake.forEach((segment, index) => {
        const color = index === 0 ? 0x8ff0a4 : 0x46c96f;
        draw.fillStyle(color, 1);
        draw.fillRoundedRect(
          BOARD_PADDING + segment.x * CELL_SIZE + 3,
          BOARD_PADDING + segment.y * CELL_SIZE + 3,
          CELL_SIZE - 6,
          CELL_SIZE - 6,
          4
        );
      });
    },
    destroy() {
      isDestroyed = true;
      game.destroy(true);
    }
  };
}

export const snakeGame: GameModule = {
  metadata: {
    id: "snake",
    name: "Snake",
    version: "0.2.0",
    description: "Playable deterministic Snake running on Phaser renderer."
  },
  createGame(container: HTMLElement, options: GameOptions) {
    const state = buildInitialState();
    const ui = createSnakeRoot(container);
    let renderer: SnakeRenderer = createFallbackRenderer(ui);

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
      renderer.render(state);
    };

    if (canUsePhaserRenderer()) {
      void loadPhaserModule().then((phaser) => {
        if (!phaser || destroyed) {
          return;
        }

        const nextRenderer = createPhaserRenderer(ui, phaser);
        if (destroyed) {
          nextRenderer.destroy();
          return;
        }

        renderer.destroy();
        renderer = nextRenderer;
        ui.grid.classList.add("is-hidden");
        ui.legend.textContent = "Legend: green snake, red food. Arrows/WASD to steer.";
        updateView();
      });
    }

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
      updateView();
    };

    const restartState = () => {
      Object.assign(state, buildInitialState());
      updateView();
      emitEvents();
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
        restartState();
        return;
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
        renderer.destroy();
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
        restartState();
      },
      render_game_to_text() {
        return renderTextState(state);
      },
      advanceTime
    };
  }
};
