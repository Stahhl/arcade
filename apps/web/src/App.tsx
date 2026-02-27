import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type AchievementId = "first-launch" | "first-point" | "score-10";
type SharedSettings = {
  autoPauseOnWindowBlur: boolean;
  showTextStatePanel: boolean;
};

type LocalProfile = {
  playerName: string;
  highScores: Record<LaunchableGameId, number>;
  unlockedAchievementIds: AchievementId[];
  settings: SharedSettings;
};

type GameWindowHooks = Window & {
  advanceTime?: (ms: number) => void;
  render_game_to_text?: () => string;
};

const PROFILE_STORAGE_KEY = "arcade.local-profile.v1";
const DEFAULT_SHARED_SETTINGS: SharedSettings = {
  autoPauseOnWindowBlur: true,
  showTextStatePanel: false
};
const DEFAULT_PROFILE: LocalProfile = {
  playerName: "Player 1",
  highScores: {
    snake: 0,
    tetris: 0,
    "space-invaders": 0
  },
  unlockedAchievementIds: [],
  settings: DEFAULT_SHARED_SETTINGS
};

const achievementDefinitions: Array<{
  id: AchievementId;
  name: string;
  description: string;
}> = [
  {
    id: "first-launch",
    name: "First Launch",
    description: "Launch any game from the arcade launcher."
  },
  {
    id: "first-point",
    name: "First Point",
    description: "Score at least one point in any game."
  },
  {
    id: "score-10",
    name: "Score 10",
    description: "Reach a score of 10 in any game."
  }
];

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

function loadProfile(): LocalProfile {
  try {
    const rawValue = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_PROFILE;
    }
    const parsedValue = JSON.parse(rawValue) as Partial<LocalProfile> | null;
    if (!parsedValue || typeof parsedValue !== "object") {
      return DEFAULT_PROFILE;
    }

    const playerName =
      typeof parsedValue.playerName === "string" && parsedValue.playerName.trim().length > 0
        ? parsedValue.playerName
        : DEFAULT_PROFILE.playerName;

    const highScores: LocalProfile["highScores"] = { ...DEFAULT_PROFILE.highScores };
    if (parsedValue.highScores && typeof parsedValue.highScores === "object") {
      for (const [gameId, score] of Object.entries(parsedValue.highScores)) {
        const launchableGameId = toLaunchableGameId(gameId);
        if (!launchableGameId) {
          continue;
        }
        if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
          continue;
        }
        highScores[launchableGameId] = Math.floor(score);
      }
    }

    const unlockedAchievementIds = Array.isArray(parsedValue.unlockedAchievementIds)
      ? parsedValue.unlockedAchievementIds.filter(
          (achievementId): achievementId is AchievementId =>
            achievementId === "first-launch" ||
            achievementId === "first-point" ||
            achievementId === "score-10"
        )
      : [];
    const settings: SharedSettings = {
      autoPauseOnWindowBlur:
        typeof parsedValue.settings?.autoPauseOnWindowBlur === "boolean"
          ? parsedValue.settings.autoPauseOnWindowBlur
          : DEFAULT_SHARED_SETTINGS.autoPauseOnWindowBlur,
      showTextStatePanel:
        typeof parsedValue.settings?.showTextStatePanel === "boolean"
          ? parsedValue.settings.showTextStatePanel
          : DEFAULT_SHARED_SETTINGS.showTextStatePanel
    };

    return {
      playerName,
      highScores,
      unlockedAchievementIds,
      settings
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export default function App() {
  const [activeGameId, setActiveGameId] = useState<LaunchableGameId | null>(null);
  const [score, setScore] = useState(0);
  const [lastGameOver, setLastGameOver] = useState<string | null>(null);
  const [isPauseOverlayOpen, setIsPauseOverlayOpen] = useState(false);
  const [textStateSnapshot, setTextStateSnapshot] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [profile, setProfile] = useState<LocalProfile>(() => loadProfile());
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameInstanceRef = useRef<GameInstance | null>(null);
  const displayPlayerName = profile.playerName.trim() || DEFAULT_PROFILE.playerName;

  const activeGame = useMemo(
    () => games.find((game) => game.id === activeGameId),
    [activeGameId]
  );
  const activeLaunchableGameId = useMemo(
    () => (activeGame ? toLaunchableGameId(activeGame.id) : null),
    [activeGame]
  );
  const unlockedAchievements = useMemo(
    () =>
      achievementDefinitions.filter((achievement) =>
        profile.unlockedAchievementIds.includes(achievement.id)
      ),
    [profile.unlockedAchievementIds]
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

  const unlockAchievement = (achievementId: AchievementId) => {
    setProfile((currentProfile) => {
      if (currentProfile.unlockedAchievementIds.includes(achievementId)) {
        return currentProfile;
      }
      return {
        ...currentProfile,
        unlockedAchievementIds: [...currentProfile.unlockedAchievementIds, achievementId]
      };
    });
  };

  const recordHighScore = (gameId: LaunchableGameId, nextScore: number) => {
    if (!Number.isFinite(nextScore) || nextScore < 0) {
      return;
    }

    setProfile((currentProfile) => {
      const roundedScore = Math.floor(nextScore);
      if (roundedScore <= currentProfile.highScores[gameId]) {
        return currentProfile;
      }
      return {
        ...currentProfile,
        highScores: {
          ...currentProfile.highScores,
          [gameId]: roundedScore
        }
      };
    });

    if (nextScore >= 1) {
      unlockAchievement("first-point");
    }
    if (nextScore >= 10) {
      unlockAchievement("score-10");
    }
  };

  const refreshTextStateSnapshot = useCallback(() => {
    const snapshot = gameInstanceRef.current?.render_game_to_text() ?? "";
    setTextStateSnapshot(snapshot);
  }, []);

  const openPauseOverlay = () => {
    setIsPauseOverlayOpen(true);
    gameInstanceRef.current?.pause();
    refreshTextStateSnapshot();
  };

  const closePauseOverlay = () => {
    setIsPauseOverlayOpen(false);
    if (!lastGameOver) {
      gameInstanceRef.current?.resume();
    }
  };

  const stepPausedGame = () => {
    const instance = gameInstanceRef.current;
    if (!instance || lastGameOver) {
      return;
    }
    instance.resume();
    instance.advanceTime(250);
    instance.pause();
    refreshTextStateSnapshot();
  };

  const updateSetting = <K extends keyof SharedSettings>(
    settingKey: K,
    settingValue: SharedSettings[K]
  ) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      settings: {
        ...currentProfile.settings,
        [settingKey]: settingValue
      }
    }));
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore local persistence errors (private mode/quota), keep in-memory profile.
    }
  }, [profile]);

  useEffect(() => {
    if (!activeGame || !profile.settings.showTextStatePanel) {
      return undefined;
    }

    refreshTextStateSnapshot();
    const intervalId = window.setInterval(() => {
      refreshTextStateSnapshot();
    }, 200);
    return () => window.clearInterval(intervalId);
  }, [activeGame, profile.settings.showTextStatePanel, refreshTextStateSnapshot]);

  useEffect(() => {
    if (!activeGame) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setIsPauseOverlayOpen((isOpen) => {
        if (isOpen) {
          if (!lastGameOver) {
            gameInstanceRef.current?.resume();
          }
          return false;
        }

        gameInstanceRef.current?.pause();
        refreshTextStateSnapshot();
        return true;
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeGame, lastGameOver, refreshTextStateSnapshot]);

  useEffect(() => {
    if (!activeGame || !profile.settings.autoPauseOnWindowBlur) {
      return undefined;
    }

    const onBlur = () => {
      setIsPauseOverlayOpen((isOpen) => {
        if (isOpen) {
          return isOpen;
        }
        gameInstanceRef.current?.pause();
        refreshTextStateSnapshot();
        return true;
      });
    };

    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [activeGame, profile.settings.autoPauseOnWindowBlur, refreshTextStateSnapshot]);

  useEffect(() => {
    const host = hostRef.current;
    const selectedModule = activeGame?.module;
    const selectedGameId = activeGame?.id;
    const hooksWindow = window as GameWindowHooks;
    if (!host || !selectedModule || !selectedGameId) {
      hooksWindow.advanceTime = undefined;
      hooksWindow.render_game_to_text = undefined;
      return undefined;
    }
    const launchableGameId = toLaunchableGameId(selectedGameId);
    if (!launchableGameId) {
      hooksWindow.advanceTime = undefined;
      hooksWindow.render_game_to_text = undefined;
      return undefined;
    }

    setScore(0);
    setLastGameOver(null);
    setIsPauseOverlayOpen(false);
    setTextStateSnapshot("");

    const gameInstance = selectedModule.createGame(host, {
      on: {
        scoreChanged: ({ score: nextScore }) => {
          setScore(nextScore);
          recordHighScore(launchableGameId, nextScore);
        },
        gameOver: ({ finalScore, reason }) => {
          recordHighScore(launchableGameId, finalScore);
          setLastGameOver(
            reason ? `Game over (${reason}), score ${finalScore}` : `Game over, score ${finalScore}`
          );
        }
      }
    });

    gameInstanceRef.current = gameInstance;
    hooksWindow.advanceTime = (ms) => {
      gameInstance.advanceTime(ms);
      refreshTextStateSnapshot();
    };
    hooksWindow.render_game_to_text = () => {
      const rendered = gameInstance.render_game_to_text();
      setTextStateSnapshot(rendered);
      return rendered;
    };
    refreshTextStateSnapshot();

    return () => {
      gameInstanceRef.current?.destroy();
      gameInstanceRef.current = null;
      hooksWindow.advanceTime = undefined;
      hooksWindow.render_game_to_text = undefined;
      setIsPauseOverlayOpen(false);
      setTextStateSnapshot("");
    };
  }, [activeGame, refreshTextStateSnapshot]);

  const handleLaunch = (gameId: string) => {
    const launchableGameId = toLaunchableGameId(gameId);
    if (!launchableGameId) {
      return;
    }

    unlockAchievement("first-launch");
    setIsPauseOverlayOpen(false);
    setActiveGameId(launchableGameId);
  };

  const handleBackToLauncher = () => {
    setIsPauseOverlayOpen(false);
    setActiveGameId(null);
    setScore(0);
    setLastGameOver(null);
    setTextStateSnapshot("");
  };

  const restartGame = () => {
    gameInstanceRef.current?.restart();
    if (!lastGameOver && !isPauseOverlayOpen) {
      gameInstanceRef.current?.resume();
    }
    setLastGameOver(null);
    refreshTextStateSnapshot();
  };

  const restartFromOverlay = () => {
    gameInstanceRef.current?.restart();
    gameInstanceRef.current?.pause();
    setLastGameOver(null);
    refreshTextStateSnapshot();
  };

  const handleBackFromOverlay = () => {
    setIsPauseOverlayOpen(false);
    handleBackToLauncher();
  };

  const handlePlayerNameChange = (nextName: string) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      playerName: nextName.slice(0, 40)
    }));
  };

  return (
    <main className="page">
      <header>
        <h1>Arcade</h1>
        <p>Choose a game to begin. Local profiles stay on this device.</p>
      </header>
      {activeGame ? (
        <section aria-label="Game host" className="game-host">
          <div className="game-toolbar">
            <div>
              <h2>{activeGame.name}</h2>
              <p>Player: {displayPlayerName} | Best: {activeLaunchableGameId ? profile.highScores[activeLaunchableGameId] : 0}</p>
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
              <button
                onClick={isPauseOverlayOpen ? closePauseOverlay : openPauseOverlay}
                type="button"
              >
                {isPauseOverlayOpen ? "Resume" : "Pause / Settings"}
              </button>
              <button onClick={restartGame} type="button">
                Restart
              </button>
              <button onClick={handleBackToLauncher} type="button">
                Back to launcher
              </button>
            </div>
          </div>
          <div className="game-surface">
            <div className="game-container" ref={hostRef} />
            {isPauseOverlayOpen ? (
              <section aria-label="Pause and settings overlay" className="pause-overlay">
                <h3>Paused</h3>
                <p>Adjust shared settings here. Press `Esc` to resume.</p>
                <div className="pause-actions">
                  <button onClick={closePauseOverlay} type="button">
                    Resume
                  </button>
                  <button onClick={stepPausedGame} type="button">
                    Step +1 tick
                  </button>
                  <button onClick={restartFromOverlay} type="button">
                    Restart
                  </button>
                  <button onClick={handleBackFromOverlay} type="button">
                    Back to launcher
                  </button>
                </div>
                <fieldset className="settings-grid">
                  <legend>Shared Settings</legend>
                  <label>
                    <input
                      checked={profile.settings.autoPauseOnWindowBlur}
                      onChange={(event) =>
                        updateSetting("autoPauseOnWindowBlur", event.target.checked)
                      }
                      type="checkbox"
                    />
                    Auto-pause when browser loses focus
                  </label>
                  <label>
                    <input
                      checked={profile.settings.showTextStatePanel}
                      onChange={(event) =>
                        updateSetting("showTextStatePanel", event.target.checked)
                      }
                      type="checkbox"
                    />
                    Show deterministic text-state panel
                  </label>
                </fieldset>
              </section>
            ) : null}
          </div>
          {profile.settings.showTextStatePanel ? (
            <section aria-label="Deterministic text state" className="text-state-panel">
              <h3>Deterministic Text State</h3>
              <pre>{textStateSnapshot || "No state snapshot yet."}</pre>
            </section>
          ) : null}
        </section>
      ) : (
        <section aria-label="Game catalog" className="grid">
          <section aria-label="Local profile" className="profile-panel">
            <h3>Local Profile</h3>
            <label className="profile-name-input" htmlFor="player-name-input">
              Player name
              <input
                id="player-name-input"
                maxLength={40}
                onChange={(event) => handlePlayerNameChange(event.target.value)}
                placeholder="Player name"
                type="text"
                value={profile.playerName}
              />
            </label>
            <div className="profile-columns">
              <section>
                <h4>High Scores</h4>
                <ul className="profile-list">
                  {games.map((game) => {
                    const launchableGameId = toLaunchableGameId(game.id);
                    return (
                      <li key={`${game.id}-best`}>
                        {game.name}: {launchableGameId ? profile.highScores[launchableGameId] : 0}
                      </li>
                    );
                  })}
                </ul>
              </section>
              <section>
                <h4>Achievements</h4>
                {unlockedAchievements.length > 0 ? (
                  <ul className="profile-list">
                    {unlockedAchievements.map((achievement) => (
                      <li key={achievement.id}>
                        <strong>{achievement.name}</strong>: {achievement.description}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="profile-empty">No achievements unlocked yet.</p>
                )}
              </section>
            </div>
          </section>
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
            visibleGames.map((game) => {
              const launchableGameId = toLaunchableGameId(game.id);
              const bestScore = launchableGameId ? profile.highScores[launchableGameId] : 0;
              return (
                <article className="card" key={game.id}>
                  <h2>{game.name}</h2>
                  <p>{game.description}</p>
                  <p>
                    <strong>Best:</strong> {bestScore}
                  </p>
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
              );
            })
          ) : (
            <p className="empty-catalog">No games match your current filters.</p>
          )}
        </section>
      )}
    </main>
  );
}
