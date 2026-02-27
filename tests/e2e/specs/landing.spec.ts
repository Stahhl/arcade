import { expect, test, type Page } from "@playwright/test";

function trackConsoleErrors(page: Page) {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  return consoleErrors;
}

async function advanceTime(page: Page, ms: number) {
  await page.evaluate((stepMs) => {
    const hooks = window as Window & { advanceTime?: (nextMs: number) => void };
    hooks.advanceTime?.(stepMs);
  }, ms);
}

async function readState(page: Page) {
  return page.evaluate(() => {
    const hooks = window as Window & { render_game_to_text?: () => string };
    return hooks.render_game_to_text?.() ?? "";
  });
}

test("launcher profile persists player name/highscore across reload", async ({ page }) => {
  const consoleErrors = trackConsoleErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Arcade" })).toBeVisible();
  await page.getByLabel("Player name").fill("Pam Beesly");
  await page.getByRole("button", { name: "Play Snake" }).click();

  await expect(page.getByRole("heading", { name: "Snake" })).toBeVisible();
  await advanceTime(page, 150);
  await expect(page.getByText("Mode: game_over | Score: 1")).toBeVisible();
  await page.getByRole("button", { name: "Back to launcher" }).click();

  await expect(page.getByLabel("Player name")).toHaveValue("Pam Beesly");
  await expect(page.getByText("Snake: 1")).toBeVisible();
  await expect(page.getByText("First Launch")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Player name")).toHaveValue("Pam Beesly");
  await expect(page.getByText("Snake: 1")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("snake can launch, use pause overlay, and advance deterministically", async ({ page }) => {
  const consoleErrors = trackConsoleErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Arcade" })).toBeVisible();
  await page.getByRole("button", { name: "Play Snake" }).click();

  await expect(page.getByRole("heading", { name: "Snake" })).toBeVisible();
  await expect(page.getByText("Mode: running | Score: 0")).toBeVisible();
  await page.getByRole("button", { name: "Pause / Settings" }).click();
  await expect(page.getByLabel("Pause and settings overlay")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
  await page
    .getByLabel("Pause and settings overlay")
    .getByRole("button", { name: "Resume" })
    .click();
  await expect(page.getByLabel("Pause and settings overlay")).toHaveCount(0);

  await advanceTime(page, 160);

  const textState = await readState(page);

  const parsed = JSON.parse(textState) as { score: number; mode: string };
  expect(parsed.score).toBe(1);
  expect(parsed.mode).toBe("running");
  await expect(page.getByText("Mode: running | Score: 1")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("tetris deterministic state advances after launch", async ({ page }) => {
  const consoleErrors = trackConsoleErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Arcade" })).toBeVisible();
  await page.getByRole("button", { name: "Play Tetris" }).click();

  await expect(page.getByRole("heading", { name: "Tetris" })).toBeVisible();
  const initial = JSON.parse(await readState(page)) as {
    mode: string;
    activePiece?: { anchor?: { y?: number } };
  };
  const initialY = initial.activePiece?.anchor?.y ?? 0;

  await advanceTime(page, 240);
  const next = JSON.parse(await readState(page)) as {
    mode: string;
    activePiece?: { anchor?: { y?: number } };
  };

  expect(next.mode).toBe("running");
  expect((next.activePiece?.anchor?.y ?? 0) > initialY).toBeTruthy();
  expect(consoleErrors).toEqual([]);
});

test("space invaders deterministic state advances after launch", async ({ page }) => {
  const consoleErrors = trackConsoleErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Arcade" })).toBeVisible();
  await page.getByRole("button", { name: "Play Space Invaders" }).click();

  await expect(page.getByRole("heading", { name: "Space Invaders" })).toBeVisible();
  const initial = JSON.parse(await readState(page)) as {
    mode: string;
    invaders?: Array<{ x: number; y: number }>;
  };
  const startX = initial.invaders?.[0]?.x ?? 0;

  await advanceTime(page, 170);
  const next = JSON.parse(await readState(page)) as {
    mode: string;
    invaders?: Array<{ x: number; y: number }>;
  };

  expect(next.mode).toBe("running");
  expect(next.invaders?.[0]?.x).toBe(startX + 1);
  expect(consoleErrors).toEqual([]);
});
