import { expect, test } from "@playwright/test";

test("snake can launch and advance deterministically", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Arcade" })).toBeVisible();
  await page.getByRole("button", { name: "Play" }).click();

  await expect(page.getByRole("heading", { name: "Snake" })).toBeVisible();
  await expect(page.getByText("Mode: running | Score: 0")).toBeVisible();

  await page.evaluate(() => {
    const hooks = window as Window & { advanceTime?: (ms: number) => void };
    hooks.advanceTime?.(160);
  });

  const textState = await page.evaluate(() => {
    const hooks = window as Window & { render_game_to_text?: () => string };
    return hooks.render_game_to_text?.() ?? "";
  });

  const parsed = JSON.parse(textState) as { score: number; mode: string };
  expect(parsed.score).toBe(1);
  expect(parsed.mode).toBe("running");
  await expect(page.getByText("Mode: running | Score: 1")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
