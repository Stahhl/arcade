import type PhaserNamespace from "phaser";
import type { GameModule, GameOptions } from "@arcade/game-sdk";

type PhaserModule = typeof PhaserNamespace;

type Point = {
  x: number;
  y: number;
};

type TetrisMode = "running" | "paused" | "game_over";

type TetrisState = {
  mode: TetrisMode;
  score: number;
  board: number[][];
  activeAnchor: Point;
  stepAccumulatorMs: number;
};

type TetrisUi = {
  root: HTMLDivElement;
  hud: HTMLParagraphElement;
  canvasHost: HTMLDivElement;
  grid: HTMLPreElement;
  legend: HTMLParagraphElement;
};

type TetrisRenderer = {
  render: (state: TetrisState) => void;
  destroy: () => void;
  isFallback: boolean;
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 18;
const STEP_MS = 220;
const CELL_SIZE = 24;
const BOARD_PADDING = 12;
const CANVAS_WIDTH = BOARD_WIDTH * CELL_SIZE + BOARD_PADDING * 2;
const CANVAS_HEIGHT = BOARD_HEIGHT * CELL_SIZE + BOARD_PADDING * 2;

const O_SHAPE: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 }
];

let phaserModulePromise: Promise<PhaserModule | null> | null = null;

function loadPhaserModule(): Promise<PhaserModule | null> {
  if (!phaserModulePromise) {
    phaserModulePromise = import("phaser")
      .then((module) => (module.default ?? module) as PhaserModule)
      .catch(() => null);
  }
  return phaserModulePromise;
}

function createEmptyBoard(): number[][] {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => 0)
  );
}

function createInitialState(): TetrisState {
  return {
    mode: "running",
    score: 0,
    board: createEmptyBoard(),
    activeAnchor: { x: 4, y: 0 },
    stepAccumulatorMs: 0
  };
}

function getActiveCells(anchor: Point): Point[] {
  return O_SHAPE.map((cell) => ({ x: anchor.x + cell.x, y: anchor.y + cell.y }));
}

function canPlace(board: number[][], anchor: Point): boolean {
  return getActiveCells(anchor).every((cell) => {
    if (cell.x < 0 || cell.x >= BOARD_WIDTH || cell.y < 0 || cell.y >= BOARD_HEIGHT) {
      return false;
    }
    return board[cell.y]?.[cell.x] === 0;
  });
}

function clearLines(board: number[][]): { board: number[][]; linesCleared: number } {
  const keptRows = board.filter((row) => row.some((cell) => cell === 0));
  const linesCleared = BOARD_HEIGHT - keptRows.length;
  const nextBoard = [
    ...Array.from({ length: linesCleared }, () => Array.from({ length: BOARD_WIDTH }, () => 0)),
    ...keptRows
  ];
  return { board: nextBoard, linesCleared };
}

function lockActivePiece(state: TetrisState): { linesCleared: number } {
  for (const cell of getActiveCells(state.activeAnchor)) {
    if (cell.y >= 0 && cell.y < BOARD_HEIGHT && cell.x >= 0 && cell.x < BOARD_WIDTH) {
      state.board[cell.y]![cell.x] = 1;
    }
  }

  const cleared = clearLines(state.board);
  state.board = cleared.board;
  if (cleared.linesCleared > 0) {
    state.score += cleared.linesCleared * 100;
  }
  return { linesCleared: cleared.linesCleared };
}

function spawnNextPiece(state: TetrisState): void {
  state.activeAnchor = { x: 4, y: 0 };
  if (!canPlace(state.board, state.activeAnchor)) {
    state.mode = "game_over";
  }
}

function renderTextState(state: TetrisState): string {
  const settled: Point[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (state.board[y]?.[x] === 1) {
        settled.push({ x, y });
      }
    }
  }

  return JSON.stringify({
    coordinateSystem: {
      origin: "top-left",
      axis: {
        x: "right-positive",
        y: "down-positive"
      },
      board: { width: BOARD_WIDTH, height: BOARD_HEIGHT }
    },
    mode: state.mode,
    score: state.score,
    activePiece: {
      type: "O",
      anchor: state.activeAnchor,
      cells: getActiveCells(state.activeAnchor)
    },
    settledBlocks: settled
  });
}

function renderAsciiGrid(state: TetrisState): string {
  const activeKey = new Set(getActiveCells(state.activeAnchor).map((cell) => `${cell.x},${cell.y}`));
  const rows: string[] = [];

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    let row = "";
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (activeKey.has(`${x},${y}`)) {
        row += "@";
      } else if (state.board[y]?.[x] === 1) {
        row += "#";
      } else {
        row += ".";
      }
    }
    rows.push(row);
  }

  return rows.join("\n");
}

function createRoot(container: HTMLElement): TetrisUi {
  container.innerHTML = "";

  const root = document.createElement("div");
  root.className = "tetris-root";

  const hud = document.createElement("p");
  hud.className = "tetris-hud";

  const canvasHost = document.createElement("div");
  canvasHost.className = "tetris-canvas-host";

  const grid = document.createElement("pre");
  grid.className = "tetris-grid";

  const legend = document.createElement("p");
  legend.className = "tetris-legend";
  legend.textContent = "Legend: @ active piece, # settled block";

  root.append(hud, canvasHost, grid, legend);
  container.append(root);

  return { root, hud, canvasHost, grid, legend };
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

function createFallbackRenderer(ui: TetrisUi): TetrisRenderer {
  return {
    isFallback: true,
    render(state) {
      ui.grid.textContent = renderAsciiGrid(state);
    },
    destroy() {
      ui.grid.textContent = "";
    }
  };
}

function createPhaserRenderer(ui: TetrisUi, phaser: PhaserModule): TetrisRenderer {
  let graphics: any = null;
  let destroyed = false;

  const game = new phaser.Game({
    type: phaser.CANVAS,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    parent: ui.canvasHost,
    backgroundColor: "#081427",
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
      if (destroyed || !graphics) {
        return;
      }

      const draw = graphics;
      draw.clear();

      draw.fillStyle(0x081427, 1);
      draw.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      draw.fillStyle(0x102544, 1);
      draw.fillRect(
        BOARD_PADDING,
        BOARD_PADDING,
        BOARD_WIDTH * CELL_SIZE,
        BOARD_HEIGHT * CELL_SIZE
      );

      draw.lineStyle(1, 0x1d3960, 0.35);
      for (let x = 0; x <= BOARD_WIDTH; x += 1) {
        const xPos = BOARD_PADDING + x * CELL_SIZE;
        draw.beginPath();
        draw.moveTo(xPos, BOARD_PADDING);
        draw.lineTo(xPos, BOARD_PADDING + BOARD_HEIGHT * CELL_SIZE);
        draw.strokePath();
      }
      for (let y = 0; y <= BOARD_HEIGHT; y += 1) {
        const yPos = BOARD_PADDING + y * CELL_SIZE;
        draw.beginPath();
        draw.moveTo(BOARD_PADDING, yPos);
        draw.lineTo(BOARD_PADDING + BOARD_WIDTH * CELL_SIZE, yPos);
        draw.strokePath();
      }

      for (let y = 0; y < BOARD_HEIGHT; y += 1) {
        for (let x = 0; x < BOARD_WIDTH; x += 1) {
          if (state.board[y]?.[x] === 1) {
            draw.fillStyle(0x4f8ff7, 1);
            draw.fillRoundedRect(
              BOARD_PADDING + x * CELL_SIZE + 2,
              BOARD_PADDING + y * CELL_SIZE + 2,
              CELL_SIZE - 4,
              CELL_SIZE - 4,
              4
            );
          }
        }
      }

      for (const cell of getActiveCells(state.activeAnchor)) {
        draw.fillStyle(0xf5d547, 1);
        draw.fillRoundedRect(
          BOARD_PADDING + cell.x * CELL_SIZE + 2,
          BOARD_PADDING + cell.y * CELL_SIZE + 2,
          CELL_SIZE - 4,
          CELL_SIZE - 4,
          4
        );
      }
    },
    destroy() {
      destroyed = true;
      game.destroy(true);
    }
  };
}

export const tetrisGame: GameModule = {
  metadata: {
    id: "tetris",
    name: "Tetris",
    version: "0.2.0",
    description: "Deterministic Phaser-backed Tetris scaffold (O-piece vertical slice)."
  },
  createGame(container: HTMLElement, options: GameOptions) {
    const state = createInitialState();
    const ui = createRoot(container);
    let renderer: TetrisRenderer = createFallbackRenderer(ui);
    let destroyed = false;
    let rafId = 0;
    let lastFrame = performance.now();
    let lastMode: TetrisMode | null = null;
    let lastScore = -1;

    const onScoreChanged = options.on?.scoreChanged;
    const onGameOver = options.on?.gameOver;

    const emitEvents = () => {
      if (state.score !== lastScore) {
        onScoreChanged?.({ gameId: "tetris", score: state.score });
        lastScore = state.score;
      }
      if (state.mode !== lastMode && state.mode === "game_over") {
        onGameOver?.({
          gameId: "tetris",
          finalScore: state.score,
          reason: "stacked_out"
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
        ui.legend.textContent = "Legend: yellow active piece, blue settled blocks";
        updateView();
      });
    }

    const tryMove = (deltaX: number, deltaY: number): boolean => {
      const target = {
        x: state.activeAnchor.x + deltaX,
        y: state.activeAnchor.y + deltaY
      };

      if (!canPlace(state.board, target)) {
        return false;
      }

      state.activeAnchor = target;
      return true;
    };

    const step = () => {
      if (state.mode !== "running") {
        return;
      }

      if (tryMove(0, 1)) {
        updateView();
        return;
      }

      lockActivePiece(state);
      spawnNextPiece(state);
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
        step();
      }
      updateView();
    };

    const restart = () => {
      Object.assign(state, createInitialState());
      updateView();
      emitEvents();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (state.mode === "game_over") {
        if (event.key.toLowerCase() === "r") {
          restart();
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        tryMove(-1, 0);
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        tryMove(1, 0);
      } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        step();
      } else if (event.key.toLowerCase() === "p") {
        state.mode = state.mode === "paused" ? "running" : "paused";
      } else if (event.key.toLowerCase() === "r") {
        restart();
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
      restart,
      render_game_to_text() {
        return renderTextState(state);
      },
      advanceTime
    };
  }
};
