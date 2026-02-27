import type PhaserNamespace from "phaser";
import type { GameModule, GameOptions } from "@arcade/game-sdk";

type PhaserModule = typeof PhaserNamespace;

type Point = {
  x: number;
  y: number;
};

type SpaceInvadersMode = "running" | "paused" | "game_over";

type SpaceInvadersState = {
  mode: SpaceInvadersMode;
  score: number;
  playerX: number;
  bullet: Point | null;
  invaders: Point[];
  invaderDirection: -1 | 1;
  stepAccumulatorMs: number;
};

type SpaceInvadersUi = {
  root: HTMLDivElement;
  hud: HTMLParagraphElement;
  canvasHost: HTMLDivElement;
  grid: HTMLPreElement;
  legend: HTMLParagraphElement;
};

type SpaceInvadersRenderer = {
  render: (state: SpaceInvadersState) => void;
  destroy: () => void;
  isFallback: boolean;
};

const BOARD_WIDTH = 16;
const BOARD_HEIGHT = 18;
const PLAYER_ROW = BOARD_HEIGHT - 1;
const STEP_MS = 160;
const CELL_SIZE = 22;
const BOARD_PADDING = 12;
const CANVAS_WIDTH = BOARD_WIDTH * CELL_SIZE + BOARD_PADDING * 2;
const CANVAS_HEIGHT = BOARD_HEIGHT * CELL_SIZE + BOARD_PADDING * 2;

let phaserModulePromise: Promise<PhaserModule | null> | null = null;

function loadPhaserModule(): Promise<PhaserModule | null> {
  if (!phaserModulePromise) {
    phaserModulePromise = import("phaser")
      .then((module) => (module.default ?? module) as PhaserModule)
      .catch(() => null);
  }
  return phaserModulePromise;
}

function createInitialInvaders(): Point[] {
  const invaders: Point[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      invaders.push({ x: 2 + column * 2, y: 2 + row * 2 });
    }
  }
  return invaders;
}

function createInitialState(): SpaceInvadersState {
  return {
    mode: "running",
    score: 0,
    playerX: Math.floor(BOARD_WIDTH / 2),
    bullet: null,
    invaders: createInitialInvaders(),
    invaderDirection: 1,
    stepAccumulatorMs: 0
  };
}

function renderTextState(state: SpaceInvadersState): string {
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
    player: {
      x: state.playerX,
      y: PLAYER_ROW
    },
    bullet: state.bullet,
    invaders: state.invaders,
    invaderDirection: state.invaderDirection
  });
}

function renderAsciiGrid(state: SpaceInvadersState): string {
  const invaderCells = new Set(state.invaders.map((invader) => `${invader.x},${invader.y}`));
  const bulletKey = state.bullet ? `${state.bullet.x},${state.bullet.y}` : null;

  const rows: string[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    let row = "";
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (x === state.playerX && y === PLAYER_ROW) {
        row += "A";
      } else if (bulletKey === `${x},${y}`) {
        row += "^";
      } else if (invaderCells.has(`${x},${y}`)) {
        row += "W";
      } else {
        row += ".";
      }
    }
    rows.push(row);
  }

  return rows.join("\n");
}

function createRoot(container: HTMLElement): SpaceInvadersUi {
  container.innerHTML = "";

  const root = document.createElement("div");
  root.className = "space-invaders-root";

  const hud = document.createElement("p");
  hud.className = "space-invaders-hud";

  const canvasHost = document.createElement("div");
  canvasHost.className = "space-invaders-canvas-host";

  const grid = document.createElement("pre");
  grid.className = "space-invaders-grid";

  const legend = document.createElement("p");
  legend.className = "space-invaders-legend";
  legend.textContent = "Legend: A player, ^ bullet, W invader";

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

function createFallbackRenderer(ui: SpaceInvadersUi): SpaceInvadersRenderer {
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

function createPhaserRenderer(
  ui: SpaceInvadersUi,
  phaser: PhaserModule
): SpaceInvadersRenderer {
  let graphics: any = null;
  let destroyed = false;

  const game = new phaser.Game({
    type: phaser.CANVAS,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    parent: ui.canvasHost,
    backgroundColor: "#050b1f",
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

      draw.fillStyle(0x050b1f, 1);
      draw.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      draw.fillStyle(0x0f1f3f, 1);
      draw.fillRect(
        BOARD_PADDING,
        BOARD_PADDING,
        BOARD_WIDTH * CELL_SIZE,
        BOARD_HEIGHT * CELL_SIZE
      );

      draw.lineStyle(1, 0x1f335f, 0.2);
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

      for (const invader of state.invaders) {
        draw.fillStyle(0xf26491, 1);
        draw.fillRoundedRect(
          BOARD_PADDING + invader.x * CELL_SIZE + 3,
          BOARD_PADDING + invader.y * CELL_SIZE + 4,
          CELL_SIZE - 6,
          CELL_SIZE - 8,
          4
        );
      }

      if (state.bullet) {
        draw.fillStyle(0xfaf089, 1);
        draw.fillRect(
          BOARD_PADDING + state.bullet.x * CELL_SIZE + CELL_SIZE / 2 - 2,
          BOARD_PADDING + state.bullet.y * CELL_SIZE + 4,
          4,
          CELL_SIZE - 8
        );
      }

      draw.fillStyle(0x67d5b5, 1);
      draw.fillRoundedRect(
        BOARD_PADDING + state.playerX * CELL_SIZE + 2,
        BOARD_PADDING + PLAYER_ROW * CELL_SIZE + 5,
        CELL_SIZE - 4,
        CELL_SIZE - 10,
        5
      );
    },
    destroy() {
      destroyed = true;
      game.destroy(true);
    }
  };
}

function stepSimulation(state: SpaceInvadersState): void {
  if (state.mode !== "running") {
    return;
  }

  const resolveBulletHit = () => {
    if (!state.bullet) {
      return;
    }

    const hitIndex = state.invaders.findIndex(
      (invader) => invader.x === state.bullet?.x && invader.y === state.bullet?.y
    );
    if (hitIndex >= 0) {
      state.invaders.splice(hitIndex, 1);
      state.bullet = null;
      state.score += 100;
    }
  };

  if (state.bullet) {
    state.bullet = { x: state.bullet.x, y: state.bullet.y - 1 };
    if (state.bullet.y < 0) {
      state.bullet = null;
    }
  }

  resolveBulletHit();

  if (state.invaders.length === 0) {
    state.invaders = createInitialInvaders();
    state.invaderDirection = 1;
  }

  const moved = state.invaders.map((invader) => ({
    x: invader.x + state.invaderDirection,
    y: invader.y
  }));
  const hitWall = moved.some((invader) => invader.x < 0 || invader.x >= BOARD_WIDTH);

  if (hitWall) {
    state.invaderDirection = state.invaderDirection === 1 ? -1 : 1;
    state.invaders = state.invaders.map((invader) => ({ x: invader.x, y: invader.y + 1 }));
  } else {
    state.invaders = moved;
  }

  resolveBulletHit();

  if (state.invaders.some((invader) => invader.y >= PLAYER_ROW)) {
    state.mode = "game_over";
  }
}

export const spaceInvadersGame: GameModule = {
  metadata: {
    id: "space-invaders",
    name: "Space Invaders",
    version: "0.2.0",
    description: "Deterministic Phaser-backed Space Invaders scaffold."
  },
  createGame(container: HTMLElement, options: GameOptions) {
    const state = createInitialState();
    const ui = createRoot(container);
    let renderer: SpaceInvadersRenderer = createFallbackRenderer(ui);

    let destroyed = false;
    let rafId = 0;
    let lastFrame = performance.now();
    let lastMode: SpaceInvadersMode | null = null;
    let lastScore = -1;

    const onScoreChanged = options.on?.scoreChanged;
    const onGameOver = options.on?.gameOver;

    const emitEvents = () => {
      if (state.score !== lastScore) {
        onScoreChanged?.({ gameId: "space-invaders", score: state.score });
        lastScore = state.score;
      }

      if (state.mode !== lastMode && state.mode === "game_over") {
        onGameOver?.({
          gameId: "space-invaders",
          finalScore: state.score,
          reason: "invader_reached_base"
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
        ui.legend.textContent = "Legend: green ship, yellow bullet, pink invaders";
        updateView();
      });
    }

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
        state.playerX = Math.max(0, state.playerX - 1);
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        state.playerX = Math.min(BOARD_WIDTH - 1, state.playerX + 1);
      } else if (event.code === "Space" || event.key === " " || event.key.toLowerCase() === "space") {
        if (!state.bullet && state.mode === "running") {
          state.bullet = { x: state.playerX, y: PLAYER_ROW - 1 };
        }
      } else if (event.key.toLowerCase() === "p") {
        state.mode = state.mode === "paused" ? "running" : "paused";
      } else if (event.key.toLowerCase() === "r") {
        restart();
      }

      updateView();
    };

    const advanceTime = (ms: number) => {
      if (destroyed) {
        return;
      }

      state.stepAccumulatorMs += Math.max(0, ms);
      while (state.stepAccumulatorMs >= STEP_MS) {
        state.stepAccumulatorMs -= STEP_MS;
        stepSimulation(state);
        emitEvents();
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
