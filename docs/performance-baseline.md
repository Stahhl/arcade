# Performance Baseline Workflow

## Goal

Provide a repeatable quality gate for:
- built asset size budgets
- deterministic runtime performance baselines

## Command

```bash
pnpm perf:baseline
```

## What It Does

1. Builds `apps/web` production assets.
2. Reads thresholds from `docs/performance-budgets.json`.
3. Validates dist asset sizes (total bytes, JS bytes, CSS bytes, largest asset).
4. Starts a local preview server.
5. Launches headless Chromium and samples deterministic `advanceTime` timings (using `runtimeBudgets.simulationStepMs`) for:
   - `snake`
   - `tetris`
   - `space-invaders`
6. Calculates per-game runtime metrics and budget checks.
7. Writes `output/performance/baseline-latest.json`.

## Budget Model

The current budget file tracks:
- `assetBudgets`
  - `totalDistBytesMax`
  - `totalJsBytesMax`
  - `totalCssBytesMax`
  - `largestAssetBytesMax`
- `runtimeBudgets`
  - `simulationStepMs`
  - `advanceTimeSampleDurationMsMax`
  - `estimatedFpsMin`

The command exits non-zero if any budget is violated.
