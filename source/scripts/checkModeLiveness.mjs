import { createServer } from "vite";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!/^D:/i.test(root)) throw new Error("Liveness audit must stay on D:");
const args = process.argv.slice(2);
if (args.some(arg => arg !== "--validation")) throw new Error("Only --validation is supported");
const validation = args.includes("--validation");
const seeds = validation ? Array.from({length:50}, (_, i) => 200 + i) : [...Array.from({length:40}, (_, i) => i + 1), 42, 73, 99, 101, 256, 1024, 2048, 4096, 9000, 9999];
const runRoot = path.join(root, ".tmp", "mode-liveness", new Date().toISOString().replace(/[:.]/g, "-"));
process.env.TEMP = process.env.TMP = path.join(root, ".tmp");
await fs.mkdir(runRoot, { recursive: true });
const sourceNames = ["src/evaluation/modeLiveness.ts", "src/playground/session.ts", "src/simulation/warehouse.ts", "src/simulation/types.ts", "src/simulation/rng.ts", "src/simulation/scenarios.ts", "src/simulation/physicalDetour.ts", "src/simulation/controlledExperiment.ts", "package-lock.json", "scripts/checkModeLiveness.mjs"];
const source = {};
for (const name of sourceNames) {
  const bytes = await fs.readFile(path.join(root, name));
  await fs.mkdir(path.dirname(path.join(runRoot, "source", name)), { recursive: true });
  await fs.writeFile(path.join(runRoot, "source", name), bytes);
  source[name] = createHash("sha256").update(bytes).digest("hex");
}
const server = await createServer({ configFile: false, root, logLevel: "error", server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
try {
  const { auditMode, LIVENESS_LIMITS } = await server.ssrLoadModule("/src/evaluation/modeLiveness.ts");
  const { SCENARIO_PRESETS } = await server.ssrLoadModule("/src/simulation/scenarios.ts");
  const { MODES } = await server.ssrLoadModule("/src/simulation/types.ts");
  const { PLAYGROUND_VERSION } = await server.ssrLoadModule("/src/playground/session.ts");
  const protocol = { version: PLAYGROUND_VERSION, validation, seeds, modes: MODES, scenarios: SCENARIO_PRESETS, limits: LIVENESS_LIMITS, steps: 900, source, notes: ["Long delivery gaps are screening flags, not automatically bugs.", "Loop windows exclude repair ticks and reset on pickup, delivery or target change.", "A finite audit is not a proof for every seed or environment."] };
  await fs.writeFile(path.join(runRoot, "protocol.json"), JSON.stringify(protocol, null, 2));
  console.log(`Frozen audit: ${runRoot}`);
  const rows = [];
  const file = await fs.open(path.join(runRoot, "runs.jsonl"), "wx");
  try {
    for (const scenario of SCENARIO_PRESETS) for (const mode of MODES) {
      for (const seed of seeds) {
        const row = auditMode(mode, seed, scenario.id);
        rows.push(row); await file.write(`${JSON.stringify(row)}\n`);
      }
      console.log(`${rows.length}/1000: ${scenario.id} / ${mode}`);
    }
  } finally { await file.sync(); await file.close(); }
  const summary = MODES.map(mode => {
    const runs = rows.filter(row => row.mode === mode);
    return { mode, runs: runs.length, loopRuns: runs.filter(row => row.loopAgents).length, longGapRuns: runs.filter(row => row.longGapAgents).length, missingDeliveryRuns: runs.filter(row => !row.allDelivered).length, maxDeliveryGap: Math.max(...runs.map(row => row.maxDeliveryGap)), examples: runs.filter(row => row.loopAgents || row.longGapAgents).slice(0, 3).map(({scenario,seed,loopAgents,longGapAgents,maxDeliveryGap}) => ({scenario,seed,loopAgents,longGapAgents,maxDeliveryGap})) };
  });
  await fs.writeFile(path.join(runRoot, "summary.json"), JSON.stringify(summary, null, 2));
  await fs.writeFile(path.join(root, ".tmp", "mode-liveness", "latest.json"), JSON.stringify({ runRoot }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally { await server.close(); }
