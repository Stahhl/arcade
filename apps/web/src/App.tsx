import { useEffect, useMemo, useRef, useState } from "react";
import type { GameInstance, GameModule } from "@arcade/game-sdk";
import { snakeGame } from "@arcade/games-snake";
import { tetrisGame } from "@arcade/games-tetris";

type LaunchableGameId = "snake" | "tetris";

type GameCard = {
  id: string;
  name: string;
  status: "Planned" | "In Development";
  description: string;
  module?: GameModule;
};

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
    id: "space-invaders",
    name: "Space Invaders",
    status: "Planned",
    description: "Arcade shooter with wave-based alien patterns."
  }
];

function toLaunchableGameId(gameId: string): LaunchableGameId | null {
  if (gameId === "snake" || gameId === "tetris") {
    return gameId;
  }

  return null;
}

export default function App() {
  const [activeGameId, setActiveGameId] = useState<LaunchableGameId | null>(null);
  const [score, setScore] = useState(0);
  const [lastGameOver, setLastGameOver] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameInstanceRef = useRef<GameInstance | null>(null);

  const activeGame = useMemo(
    () => games.find((game) => game.id === activeGameId),
    [activeGameId]
  );

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
          {games.map((game) => (
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
          ))}
        </section>
      )}
    </main>
  );
}
