import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

function parseArgs(argv) {
  const args = {
    url: null,
    iterations: 3,
    pauseMs: 250,
    headless: true,
    screenshotDir: "output/web-game",
    actionsFile: null,
    actionsJson: null,
    click: null,
    clickSelector: null
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--url" && next) {
      args.url = next;
      i += 1;
    } else if (arg === "--iterations" && next) {
      args.iterations = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--pause-ms" && next) {
      args.pauseMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--headless" && next) {
      args.headless = next !== "0" && next !== "false";
      i += 1;
    } else if (arg === "--screenshot-dir" && next) {
      args.screenshotDir = next;
      i += 1;
    } else if (arg === "--actions-file" && next) {
      args.actionsFile = next;
      i += 1;
    } else if (arg === "--actions-json" && next) {
      args.actionsJson = next;
      i += 1;
    } else if (arg === "--click" && next) {
      const parts = next.split(",").map((value) => Number.parseFloat(value.trim()));
      if (parts.length === 2 && parts.every((value) => Number.isFinite(value))) {
        args.click = { x: parts[0], y: parts[1] };
      }
      i += 1;
    } else if (arg === "--click-selector" && next) {
      args.clickSelector = next;
      i += 1;
    }
  }
  if (!args.url) {
    throw new Error("--url is required");
  }
  return args;
}

function resolveCliPath(inputPath) {
  if (!inputPath) {
    return inputPath;
  }
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  const invokerCwd = process.env.INIT_CWD || process.cwd();
  return path.resolve(invokerCwd, inputPath);
}

const buttonNameToKey = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  enter: "Enter",
  space: "Space",
  a: "KeyA",
  b: "KeyB"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(filePath) {
  fs.mkdirSync(filePath, { recursive: true });
}

function makeVirtualTimeShim() {
  return `(() => {
    const pending = new Set();
    const origSetTimeout = window.setTimeout.bind(window);
    const origSetInterval = window.setInterval.bind(window);
    const origRequestAnimationFrame = window.requestAnimationFrame.bind(window);

    window.__vt_pending = pending;

    window.setTimeout = (fn, t, ...rest) => {
      const task = {};
      pending.add(task);
      return origSetTimeout(() => {
        pending.delete(task);
        fn(...rest);
      }, t);
    };

    window.setInterval = (fn, t, ...rest) => {
      const task = {};
      pending.add(task);
      return origSetInterval(() => {
        fn(...rest);
      }, t);
    };

    window.requestAnimationFrame = (fn) => {
      const task = {};
      pending.add(task);
      return origRequestAnimationFrame((ts) => {
        pending.delete(task);
        fn(ts);
      });
    };

    window.advanceTime = (ms) => {
      return new Promise((resolve) => {
        const start = performance.now();
        function step(now) {
          if (now - start >= ms) return resolve();
          origRequestAnimationFrame(step);
        }
        origRequestAnimationFrame(step);
      });
    };

    window.__drainVirtualTimePending = () => pending.size;
  })();`;
}

async function getCanvasHandle(page) {
  const handle = await page.evaluateHandle(() => {
    let best = null;
    let bestArea = 0;
    for (const canvas of document.querySelectorAll("canvas")) {
      const area = (canvas.width || canvas.clientWidth || 0) * (canvas.height || canvas.clientHeight || 0);
      if (area > bestArea) {
        bestArea = area;
        best = canvas;
      }
    }
    return best;
  });
  return handle.asElement();
}

async function captureCanvasPngBase64(canvas) {
  return canvas.evaluate((value) => {
    if (!value || typeof value.toDataURL !== "function") {
      return "";
    }
    const dataUrl = value.toDataURL("image/png");
    const commaIndex = dataUrl.indexOf(",");
    return commaIndex === -1 ? "" : dataUrl.slice(commaIndex + 1);
  });
}

async function isCanvasTransparent(canvas) {
  if (!canvas) {
    return true;
  }
  return canvas.evaluate((value) => {
    try {
      const width = value.width || value.clientWidth || 0;
      const height = value.height || value.clientHeight || 0;
      if (!width || !height) {
        return true;
      }

      const sampleSize = Math.max(1, Math.min(16, width, height));
      const probe = document.createElement("canvas");
      probe.width = sampleSize;
      probe.height = sampleSize;
      const context = probe.getContext("2d");
      if (!context) {
        return true;
      }
      context.drawImage(value, 0, 0, sampleSize, sampleSize);
      const data = context.getImageData(0, 0, sampleSize, sampleSize).data;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] !== 0) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  });
}

async function captureScreenshot(page, canvas, outputPath) {
  let buffer = null;
  const base64 = canvas ? await captureCanvasPngBase64(canvas) : "";
  if (base64) {
    buffer = Buffer.from(base64, "base64");
    const transparent = canvas ? await isCanvasTransparent(canvas) : false;
    if (transparent) {
      buffer = null;
    }
  }

  if (!buffer && canvas) {
    try {
      buffer = await canvas.screenshot({ type: "png" });
    } catch {
      buffer = null;
    }
  }

  if (!buffer) {
    const box = canvas ? await canvas.boundingBox() : null;
    if (box) {
      buffer = await page.screenshot({ type: "png", omitBackground: false, clip: box });
    } else {
      buffer = await page.screenshot({ type: "png", omitBackground: false });
    }
  }

  fs.writeFileSync(outputPath, buffer);
}

class ConsoleErrorTracker {
  constructor() {
    this.seen = new Set();
    this.errors = [];
  }

  ingest(errorPayload) {
    const key = JSON.stringify(errorPayload);
    if (this.seen.has(key)) {
      return;
    }
    this.seen.add(key);
    this.errors.push(errorPayload);
  }

  drain() {
    const next = [...this.errors];
    this.errors = [];
    return next;
  }
}

async function doChoreography(page, canvas, steps) {
  for (const step of steps) {
    const buttons = new Set(step.buttons || []);

    for (const button of buttons) {
      if (button === "left_mouse_button" || button === "right_mouse_button") {
        const box = canvas ? await canvas.boundingBox() : null;
        if (!box) {
          continue;
        }
        const x = typeof step.mouse_x === "number" ? step.mouse_x : box.width / 2;
        const y = typeof step.mouse_y === "number" ? step.mouse_y : box.height / 2;
        await page.mouse.move(box.x + x, box.y + y);
        await page.mouse.down({ button: button === "left_mouse_button" ? "left" : "right" });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.down(buttonNameToKey[button]);
      }
    }

    const frames = step.frames || 1;
    for (let frame = 0; frame < frames; frame += 1) {
      await page.evaluate(async () => {
        if (typeof window.advanceTime === "function") {
          await window.advanceTime(1000 / 60);
        }
      });
    }

    for (const button of buttons) {
      if (button === "left_mouse_button" || button === "right_mouse_button") {
        await page.mouse.up({ button: button === "left_mouse_button" ? "left" : "right" });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.up(buttonNameToKey[button]);
      }
    }
  }
}

function parseSteps(args) {
  if (args.actionsFile) {
    const raw = fs.readFileSync(args.actionsFile, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && Array.isArray(parsed.steps)) {
      return parsed.steps;
    }
  }

  if (args.actionsJson) {
    const parsed = JSON.parse(args.actionsJson);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && Array.isArray(parsed.steps)) {
      return parsed.steps;
    }
  }

  if (args.click) {
    return [
      {
        buttons: ["left_mouse_button"],
        frames: 2,
        mouse_x: args.click.x,
        mouse_y: args.click.y
      }
    ];
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  args.screenshotDir = resolveCliPath(args.screenshotDir);
  args.actionsFile = resolveCliPath(args.actionsFile);
  ensureDir(args.screenshotDir);

  const browser = await chromium.launch({
    headless: args.headless,
    args: ["--use-gl=angle", "--use-angle=swiftshader"]
  });
  const page = await browser.newPage();
  const errorTracker = new ConsoleErrorTracker();

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    errorTracker.ingest({ type: "console.error", text: message.text() });
  });
  page.on("pageerror", (error) => {
    errorTracker.ingest({ type: "pageerror", text: String(error) });
  });

  await page.addInitScript({ content: makeVirtualTimeShim() });
  await page.goto(args.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("resize"));
  });

  let canvas = await getCanvasHandle(page);

  if (args.clickSelector) {
    try {
      await page.click(args.clickSelector, { timeout: 5000 });
      await page.waitForTimeout(250);
    } catch (error) {
      console.warn("Failed to click selector", args.clickSelector, error);
    }
  }

  const steps = parseSteps(args);
  if (!steps) {
    throw new Error("Actions are required. Use --actions-file, --actions-json, or --click.");
  }

  for (let iteration = 0; iteration < args.iterations; iteration += 1) {
    if (!canvas) {
      canvas = await getCanvasHandle(page);
    }

    await doChoreography(page, canvas, steps);
    await sleep(args.pauseMs);

    const screenshotPath = path.join(args.screenshotDir, `shot-${iteration}.png`);
    await captureScreenshot(page, canvas, screenshotPath);

    const textState = await page.evaluate(() => {
      if (typeof window.render_game_to_text === "function") {
        return window.render_game_to_text();
      }
      return null;
    });
    if (textState) {
      fs.writeFileSync(path.join(args.screenshotDir, `state-${iteration}.json`), textState);
    }

    const freshErrors = errorTracker.drain();
    if (freshErrors.length) {
      fs.writeFileSync(
        path.join(args.screenshotDir, `errors-${iteration}.json`),
        JSON.stringify(freshErrors, null, 2)
      );
      break;
    }
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
