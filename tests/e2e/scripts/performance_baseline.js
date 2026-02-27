import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const DIST_DIR = path.join(REPO_ROOT, "apps/web/dist");
const BUDGETS_PATH = path.join(REPO_ROOT, "docs/performance-budgets.json");
const OUTPUT_DIR = path.join(REPO_ROOT, "output/performance");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "baseline-latest.json");
const PREVIEW_URL = "http://127.0.0.1:4173";

function listFilesRecursively(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function collectAssetMetrics() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Missing dist directory at ${DIST_DIR}. Run "pnpm build" first.`);
  }

  const files = listFilesRecursively(DIST_DIR);
  const assets = files.map((filePath) => {
    const bytes = fs.statSync(filePath).size;
    const extension = path.extname(filePath).toLowerCase();
    return {
      file: path.relative(REPO_ROOT, filePath),
      bytes,
      extension
    };
  });

  const totalDistBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  const totalJsBytes = assets
    .filter((asset) => asset.extension === ".js")
    .reduce((sum, asset) => sum + asset.bytes, 0);
  const totalCssBytes = assets
    .filter((asset) => asset.extension === ".css")
    .reduce((sum, asset) => sum + asset.bytes, 0);
  const largestAsset = assets.reduce(
    (largest, current) => (current.bytes > largest.bytes ? current : largest),
    { file: "", bytes: 0, extension: "" }
  );

  return {
    assets,
    totals: {
      totalDistBytes,
      totalJsBytes,
      totalCssBytes,
      largestAsset
    }
  };
}

function loadBudgets() {
  if (!fs.existsSync(BUDGETS_PATH)) {
    throw new Error(`Missing budget config at ${BUDGETS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(BUDGETS_PATH, "utf8"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function startPreviewServer() {
  const child = spawn(
    "pnpm",
    ["--filter", "@arcade/web", "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
    {
      cwd: REPO_ROOT,
      stdio: "pipe"
    }
  );

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForUrl(PREVIEW_URL, 30_000);
    return child;
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(
      `Failed to start preview server: ${error instanceof Error ? error.message : String(error)}\n${stderr}`
    );
  }
}

function stopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) {
      resolve(undefined);
      return;
    }
    child.once("exit", () => resolve(undefined));
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 3_000);
  });
}

async function collectRuntimeMetrics() {
  const games = [
    { id: "snake", buttonLabel: "Play Snake", heading: "Snake" },
    { id: "tetris", buttonLabel: "Play Tetris", heading: "Tetris" },
    {
      id: "space-invaders",
      buttonLabel: "Play Space Invaders",
      heading: "Space Invaders"
    }
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: PREVIEW_URL });
  const page = await context.newPage();
  const perGame = [];
  const runtimeBudgets = loadBudgets().runtimeBudgets;
  const simulationStepMs = runtimeBudgets.simulationStepMs;

  for (const game of games) {
    await page.goto("/");
    await page.getByRole("button", { name: game.buttonLabel }).click();
    await page.getByRole("heading", { name: game.heading }).waitFor();

    const samples = [];
    for (let sample = 0; sample < 5; sample += 1) {
      await page.getByRole("button", { name: "Restart" }).click();
      const elapsedMs = await page.evaluate((stepMs) => {
        const hooks = window;
        const start = performance.now();
        (hooks.advanceTime)?.(stepMs);
        return performance.now() - start;
      }, simulationStepMs);
      samples.push(elapsedMs);
    }

    const textState = await page.evaluate(() => {
      const hooks = window;
      return (hooks.render_game_to_text)?.() ?? "";
    });

    const avgMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const maxMs = Math.max(...samples);
    const minMs = Math.min(...samples);
    const estimatedFps = avgMs > 0 ? (simulationStepMs * 60) / avgMs : 0;

    perGame.push({
      gameId: game.id,
      samplesMs: samples,
      simulationStepMs,
      averageAdvanceTimeSampleMs: avgMs,
      minAdvanceTimeSampleMs: minMs,
      maxAdvanceTimeSampleMs: maxMs,
      estimatedFpsCapacity: estimatedFps,
      textStateBytes: Buffer.byteLength(textState, "utf8")
    });
  }

  await context.close();
  await browser.close();

  return { perGame };
}

function evaluateBudgets(assetMetrics, runtimeMetrics, budgets) {
  const violations = [];
  const assetBudgets = budgets.assetBudgets;
  const runtimeBudgets = budgets.runtimeBudgets;

  if (assetMetrics.totals.totalDistBytes > assetBudgets.totalDistBytesMax) {
    violations.push(
      `totalDistBytes ${assetMetrics.totals.totalDistBytes} exceeded max ${assetBudgets.totalDistBytesMax}`
    );
  }
  if (assetMetrics.totals.totalJsBytes > assetBudgets.totalJsBytesMax) {
    violations.push(
      `totalJsBytes ${assetMetrics.totals.totalJsBytes} exceeded max ${assetBudgets.totalJsBytesMax}`
    );
  }
  if (assetMetrics.totals.totalCssBytes > assetBudgets.totalCssBytesMax) {
    violations.push(
      `totalCssBytes ${assetMetrics.totals.totalCssBytes} exceeded max ${assetBudgets.totalCssBytesMax}`
    );
  }
  if (assetMetrics.totals.largestAsset.bytes > assetBudgets.largestAssetBytesMax) {
    violations.push(
      `largestAssetBytes ${assetMetrics.totals.largestAsset.bytes} exceeded max ${assetBudgets.largestAssetBytesMax} (${assetMetrics.totals.largestAsset.file})`
    );
  }

  for (const gameMetric of runtimeMetrics.perGame) {
    if (
      gameMetric.averageAdvanceTimeSampleMs >
      runtimeBudgets.advanceTimeSampleDurationMsMax
    ) {
      violations.push(
        `${gameMetric.gameId} averageAdvanceTimeSampleMs ${gameMetric.averageAdvanceTimeSampleMs.toFixed(
          2
        )} exceeded max ${runtimeBudgets.advanceTimeSampleDurationMsMax}`
      );
    }
    if (gameMetric.estimatedFpsCapacity < runtimeBudgets.estimatedFpsMin) {
      violations.push(
        `${gameMetric.gameId} estimatedFpsCapacity ${gameMetric.estimatedFpsCapacity.toFixed(
          2
        )} below min ${runtimeBudgets.estimatedFpsMin}`
      );
    }
  }

  return violations;
}

async function main() {
  const budgets = loadBudgets();
  const assetMetrics = collectAssetMetrics();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let previewProcess;
  try {
    previewProcess = await startPreviewServer();
    const runtimeMetrics = await collectRuntimeMetrics();
    const violations = evaluateBudgets(assetMetrics, runtimeMetrics, budgets);

    const report = {
      generatedAt: new Date().toISOString(),
      source: {
        distDir: path.relative(REPO_ROOT, DIST_DIR),
        budgetsFile: path.relative(REPO_ROOT, BUDGETS_PATH),
        previewUrl: PREVIEW_URL
      },
      budgets,
      assetMetrics,
      runtimeMetrics,
      violations
    };
    const timestampLabel = report.generatedAt.replace(/[:.]/g, "-");
    const historyFile = path.join(OUTPUT_DIR, `baseline-${timestampLabel}.json`);

    fs.writeFileSync(historyFile, JSON.stringify(report, null, 2));
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));

    console.log(`Performance baseline report written to ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
    console.log(`Performance baseline history written to ${path.relative(REPO_ROOT, historyFile)}`);
    console.log(`Total dist bytes: ${assetMetrics.totals.totalDistBytes}`);
    console.log(`Total JS bytes: ${assetMetrics.totals.totalJsBytes}`);
    console.log(
      `Largest asset: ${assetMetrics.totals.largestAsset.file} (${assetMetrics.totals.largestAsset.bytes})`
    );
    for (const metric of runtimeMetrics.perGame) {
      console.log(
        `${metric.gameId}: avg advanceTime(${metric.simulationStepMs})=${metric.averageAdvanceTimeSampleMs.toFixed(
          2
        )}ms, estimated fps=${metric.estimatedFpsCapacity.toFixed(2)}`
      );
    }

    if (violations.length > 0) {
      console.error("Performance budget violations:");
      for (const violation of violations) {
        console.error(`- ${violation}`);
      }
      process.exitCode = 1;
      return;
    }
  } finally {
    await stopProcess(previewProcess);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
