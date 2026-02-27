import { useEffect, useMemo, useRef, useState } from "react";
import type { GameInstance, GameModule } from "@arcade/game-sdk";
import { snakeGame } from "@arcade/games-snake";
import { spaceInvadersGame } from "@arcade/games-space-invaders";
import { tetrisGame } from "@arcade/games-tetris";

type LaunchableGameId = "snake" | "tetris" | "space-invaders";

type GameCard = {
  id: string;
  name: string;
  status: "Planned" | "In Development";
  description: string;
  module?: GameModule;
};

type StatusFilter = "all" | "in-development" | "planned";
type SortMode = "featured" | "name-asc" | "name-desc";

type GameWindowHooks = Window & {
  advanceTime?: (ms: number) => void;
  render_game_to_text?: () => string;
};

const games: GameCard[] = [
  {
    id: snakeGame.metadata.id,
    name: snakeGame.metadata.name,
    status: "In Development",
    description: "Classic grid movement and score chasing.",
    module: snakeGame
  },
  {
    id: tetrisGame.metadata.id,
    name: tetrisGame.metadata.name,
    status: "In Development",
    description: "Deterministic O-piece scaffold with line clear mechanics.",
    module: tetrisGame
  },
  {
    id: spaceInvadersGame.metadata.id,
    name: spaceInvadersGame.metadata.name,
    status: "In Development",
    description: "Deterministic wave movement and shooting scaffold.",
    module: spaceInvadersGame
  }
];

function toLaunchableGameId(gameId: string): LaunchableGameId | null {
  if (gameId === "snake" || gameId === "tetris" || gameId === "space-invaders") {
    return gameId;
  }

  return null;
}

export default function App() {
  const [activeGameId, setActiveGameId] = useState<LaunchableGameId | null>(null);
  const [score, setScore] = useState(0);
  const [lastGameOver, setLastGameOver] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameInstanceRef = useRef<GameInstance | null>(null);

  const activeGame = useMemo(
    () => games.find((game) => game.id === activeGameId),
    [activeGameId]
  );

  const visibleGames = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const filteredGames = games.filter((game) => {
      if (statusFilter === "in-development" && game.status !== "In Development") {
        return false;
      }
      if (statusFilter === "planned" && game.status !== "Planned") {
        return false;
      }
      if (!normalizedSearchTerm) {
        return true;
      }

      return (
        game.name.toLowerCase().includes(normalizedSearchTerm) ||
        game.description.toLowerCase().includes(normalizedSearchTerm)
      );
    });

    if (sortMode === "featured") {
      return filteredGames;
    }

    const sortedGames = [...filteredGames];
    sortedGames.sort((a, b) => {
      const result = a.name.localeCompare(b.name);
      return sortMode === "name-asc" ? result : result * -1;
    });
    return sortedGames;
  }, [searchTerm, sortMode, statusFilter]);

  useEffect(() => {
    const host = hostRef.current;
    const selectedModule = activeGame?.module;
    const hooksWindow = window as GameWindowHooks;
    if (!host || !selectedModule) {
      hooksWindow.advanceTime = undefined;
      hooksWindow.render_game_to_text = undefined;
      return undefined;
    }

    setScore(0);
    setLastGameOver(null);

    const gameInstance = selectedModule.createGame(host, {
      on: {
        scoreChanged: ({ score: nextScore }) => setScore(nextScore),
        gameOver: ({ finalScore, reason }) =>
          setLastGameOver(
            reason ? `Game over (${reason}), score ${finalScore}` : `Game over, score ${finalScore}`
          )
      }
    });

    gameInstanceRef.current = gameInstance;
    hooksWindow.advanceTime = (ms) => gameInstance.advanceTime(ms);
    hooksWindow.render_game_to_text = () => gameInstance.render_game_to_text();

    return () => {
      gameInstanceRef.current?.destroy();
      gameInstanceRef.current = null;
      hooksWindow.advanceTime = undefined;
      hooksWindow.render_game_to_text = undefined;
    };
  }, [activeGame]);

  const handleLaunch = (gameId: string) => {
    const launchableGameId = toLaunchableGameId(gameId);
    if (!launchableGameId) {
      return;
    }

    setActiveGameId(launchableGameId);
  };

  const handleBackToLauncher = () => {
    setActiveGameId(null);
    setScore(0);
    setLastGameOver(null);
  };

  const restartGame = () => {
    gameInstanceRef.current?.restart();
    setLastGameOver(null);
  };

  return (
    <main className="page">
      <header>
        <h1>Arcade</h1>
        <p>Choose a game to begin. More titles and profiles are coming.</p>
      </header>
      {activeGame ? (
        <section aria-label="Game host" className="game-host">
          <div className="game-toolbar">
            <div>
              <h2>{activeGame.name}</h2>
              <p>Score: {score}</p>
              {lastGameOver ? (
                <p>{lastGameOver}</p>
              ) : activeGame.id === "tetris" ? (
                <p>Use arrows/WASD to move and drop.</p>
              ) : activeGame.id === "space-invaders" ? (
                <p>Move with arrows/WASD and fire with Space.</p>
              ) : (
                <p>Use arrow keys to steer.</p>
              )}
            </div>
            <div className="actions">
              <button onClick={restartGame} type="button">
                Restart
              </button>
              <button onClick={handleBackToLauncher} type="button">
                Back to launcher
              </button>
            </div>
          </div>
          <div className="game-container" ref={hostRef} />
        </section>
      ) : (
        <section aria-label="Game catalog" className="grid">
          <section aria-label="Catalog controls" className="catalog-controls">
            <label htmlFor="game-search-input">
              Search
              <input
                id="game-search-input"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Find a game..."
                type="search"
                value={searchTerm}
              />
            </label>
            <label htmlFor="game-status-filter">
              Status
              <select
                id="game-status-filter"
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                value={statusFilter}
              >
                <option value="all">All</option>
                <option value="in-development">In Development</option>
                <option value="planned">Planned</option>
              </select>
            </label>
            <label htmlFor="game-sort-mode">
              Sort
              <select
                id="game-sort-mode"
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                value={sortMode}
              >
                <option value="featured">Featured</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </select>
            </label>
          </section>
          {visibleGames.length > 0 ? (
            visibleGames.map((game) => (
              <article className="card" key={game.id}>
                <h2>{game.name}</h2>
                <p>{game.description}</p>
                <p>
                  <strong>Status:</strong> {game.status}
                </p>
                <button
                  aria-label={`Play ${game.name}`}
                  disabled={game.status !== "In Development"}
                  onClick={() => handleLaunch(game.id)}
                  type="button"
                >
                  {game.status === "In Development" ? "Play" : "Coming Soon"}
                </button>
              </article>
            ))
          ) : (
            <p className="empty-catalog">No games match your current filters.</p>
          )}
        </section>
      )}
    </main>
  );
}
