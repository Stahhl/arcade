export type GameId = string;

export type GameMetadata = {
  id: GameId;
  name: string;
  version: string;
  description: string;
  thumbnail?: string;
};

export type ScoreChangedEvent = {
  gameId: GameId;
  score: number;
};

export type GameOverEvent = {
  gameId: GameId;
  finalScore: number;
  reason?: string;
};

export type AchievementUnlockedEvent = {
  gameId: GameId;
  achievementId: string;
};

export type GameErrorEvent = {
  gameId: GameId;
  message: string;
};

export type GameEvents = {
  scoreChanged: (payload: ScoreChangedEvent) => void;
  gameOver: (payload: GameOverEvent) => void;
  achievementUnlocked: (payload: AchievementUnlockedEvent) => void;
  error: (payload: GameErrorEvent) => void;
};

export type GameOptions = {
  on?: Partial<GameEvents>;
};

export type GameInstance = {
  destroy: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  render_game_to_text: () => string;
  advanceTime: (ms: number) => void;
};

export type GameModule = {
  metadata: GameMetadata;
  createGame: (container: HTMLElement, options: GameOptions) => GameInstance;
};
