import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const base = "https://martin123132.github.io/consequence-tank-playable/challenge/";
function near(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-6, `${label}: ${actual} != ${expected}`);
}
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { n: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: (sorted[Math.floor((values.length - 1) / 2)] + sorted[Math.floor(values.length / 2)]) / 2,
    min: sorted[0], max: sorted.at(-1) };
}
const metrics = ["Deliveries", "Damage", "Energy", "Post100Deliveries", "Post100Damage", "Post100Energy", "PostDeliveries", "PostDamage", "PostEnergy"];

// Independent arithmetic from raw checkpoints; no report-analysis helper is imported.
export function verifySavedResults(protocol, runs, summary, csv) {
  assert.equal(protocol.version, "gate-report-v1");
  assert.equal(protocol.ruleVersion, "gate-v1");
  assert.deepEqual(protocol.seeds, Array.from({ length: 20 }, (_, i) => i + 5000));
  assert.deepEqual(protocol.changes, [260, 520, 800]);
  assert.equal(protocol.steps, 900);
  assert.equal(protocol.postWindow, 100);
  assert.equal(runs.length, 60);
  assert.equal(summary.comparisons, 60);
  assert.equal(summary.policyRuns, 120);
  assert.equal(summary.seedCount, 20);
  assert.equal(summary.rows.length, 60);
  const expected = new Set(protocol.changes.flatMap(change => protocol.seeds.map(seed => `${seed}:${change}`)));
  for (const run of runs) {
    assert.ok(expected.delete(`${run.seed}:${run.change}`), "Duplicate or unexpected case");
    const row = summary.rows.find(row => row.seed === run.seed && row.change === run.change);
    assert.ok(row, "Missing comparison row");
    assert.equal(row.postSteps, 901 - run.change);
    for (const [checkpoint, step] of [["before", run.change - 1], ["post100", run.change + 99], ["final", 900]]) {
      assert.deepEqual(run[checkpoint].configuration, { seed: run.seed, change: run.change, step });
      assert.equal(run[checkpoint].version, "gate-v1");
      assert.equal(run[checkpoint].completed, checkpoint === "final");
    }
    for (const policy of ["direct", "memory"]) {
      const b = run.before[policy], p = run.post100[policy], f = run.final[policy];
      for (const snapshot of [b, p, f]) {
        for (const key of ["deliveries", "damage", "movementAttempts", "repairTicks", "postChangeDeliveries", "postChangeDamage"]) assert.ok(Number.isSafeInteger(snapshot[key]) && snapshot[key] >= 0, key);
        near(snapshot.energy, snapshot.movementAttempts * 0.92, "Movement energy accounting");
      }
      assert.equal(b.postChangeDeliveries, 0);
      assert.equal(b.postChangeDamage, 0);
      for (const [suffix, field] of [["Deliveries", "deliveries"], ["Damage", "damage"], ["Energy", "energy"]]) {
        assert.ok(p[field] >= b[field] && f[field] >= p[field], "Decreasing cumulative metric");
        near(row[policy + suffix], f[field], "Full-run metric");
        near(row[policy + "Post100" + suffix], p[field] - b[field], "First-100 metric");
        near(row[policy + "Post" + suffix], f[field] - b[field], "All-post-change metric");
        if (suffix !== "Energy") {
          near(p["postChange" + suffix], p[field] - b[field], "Inclusive window accounting");
          near(f["postChange" + suffix], f[field] - b[field], "Inclusive final accounting");
        }
      }
      if (f.deliveries) near(row[policy + "EnergyPerDelivery"], f.energy / f.deliveries, "Energy/delivery");
      else assert.equal(row[policy + "EnergyPerDelivery"], null);
      assert.equal(row[policy + "FirstPostDelivery"], f.firstPostChangeDeliveryStep);
    }
    for (const key of metrics) near(row["delta" + key], row["memory" + key] - row["direct" + key], "Paired difference");
    for (const [key, step] of [["replayBefore", run.change - 1], ["replayPost100", run.change + 99], ["replayFinal", 900]]) assert.equal(row[key], `${base}#challenge=gate-v1&seed=${run.seed}&change=${run.change}&step=${step}`);
  }
  assert.equal(expected.size, 0);
  assert.deepEqual(summary.groups.map(group => group.change), [null, 260, 520, 800]);
  for (const group of summary.groups) {
    const selected = summary.rows.filter(row => group.change === null || row.change === group.change);
    assert.equal(group.comparisons, selected.length);
    assert.deepEqual(group.metrics.map(metric => metric.key), metrics);
    for (const metric of group.metrics) {
      for (const side of ["direct", "memory", "delta"]) {
        const calculated = stats(selected.map(row => row[side + metric.key]));
        for (const key of Object.keys(calculated)) near(metric[side][key], calculated[key], `${side}/${metric.key}/${key}`);
      }
      const values = selected.map(row => row["delta" + metric.key]);
      assert.equal(metric.higher, values.filter(value => value > 1e-6).length);
      assert.equal(metric.lower, values.filter(value => value < -1e-6).length);
      assert.equal(metric.equal, values.filter(value => Math.abs(value) <= 1e-6).length);
    }
  }
  const tie = (a, b) => a.seed - b.seed || a.change - b.change;
  const selectors = [(a, b) => b.deltaDeliveries - a.deltaDeliveries, (a, b) => b.deltaPost100Damage - a.deltaPost100Damage,
    (a, b) => Math.abs(a.deltaDeliveries) - Math.abs(b.deltaDeliveries) || Math.abs(a.deltaDamage) - Math.abs(b.deltaDamage) || Math.abs(a.deltaEnergy) - Math.abs(b.deltaEnergy)];
  assert.equal(summary.examples.length, 3);
  selectors.forEach((sort, index) => {
    assert.deepEqual(summary.examples[index].row, [...summary.rows].sort((a, b) => sort(a, b) || tie(a, b))[0]);
    assert.equal(summary.examples[index].rule, protocol.selection[index]);
  });
  const columns = Object.keys(summary.rows[0]);
  const cell = value => value === null ? "" : `"${String(value).replaceAll('"', '""')}"`;
  assert.equal(csv, [columns.map(cell).join(","), ...summary.rows.map(row => columns.map(key => cell(row[key])).join(","))].join("\r\n") + "\r\n");
  return { comparisons: 60, policyRuns: 120, independentArithmetic: true, replayLinks: 180, examples: 3 };
}

export async function verifyRelease(folder, engine) {
  const read = async name => JSON.parse(await fs.readFile(path.join(folder, name), "utf8"));
  const manifest = await read("release-manifest.json");
  assert.equal(manifest.schema, "consequence-tank-gate-report-release-v1");
  assert.equal(manifest.engineVersion, "gate-v1");
  assert.deepEqual((await fs.readdir(folder)).sort(), [...Object.keys(manifest.files), "release-manifest.json"].sort(), "Unlisted release files");
  for (const [name, expected] of Object.entries(manifest.files)) {
    assert.ok(/^[A-Za-z0-9_.-]+$/.test(name), "Manifest entries must be plain filenames");
    assert.ok((await fs.lstat(path.join(folder, name))).isFile(), "Release entries must be regular files");
    const bytes = await fs.readFile(path.join(folder, name));
    assert.equal(sha(bytes), expected.sha256, name);
    assert.equal(bytes.length, expected.bytes, name);
  }
  const protocol = await read("protocol.json"), summary = await read("summary.json"), provenance = await read("provenance.json");
  assert.equal(sha(await fs.readFile(path.join(folder, "protocol.json"))), provenance.protocolSha256);
  const runs = (await fs.readFile(path.join(folder, "runs.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  const result = verifySavedResults(protocol, runs, summary, await fs.readFile(path.join(folder, "comparisons.csv"), "utf8"));
  let replayedComparisons = 0;
  if (engine) {
    engine = await fs.realpath(engine);
    for (const [name, expected] of Object.entries(provenance.engineSourceHashes)) {
      assert.ok(!path.isAbsolute(name) && !name.split(/[\\/]/).includes(".."), "Unsafe engine source path");
      assert.equal(sha(await fs.readFile(path.join(engine, name))), expected, `gate-v1 changed: ${name}`);
    }
    const cache = path.join(engine, ".tmp/gate-report-verification");
    process.env.TEMP = process.env.TMP = path.join(cache, "temp");
    await fs.mkdir(process.env.TEMP, { recursive: true });
    const require = createRequire(path.join(engine, "package.json"));
    const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
    const server = await createServer({ root: engine, configFile: false, appType: "custom", logLevel: "error", cacheDir: cache,
      server: { middlewareMode: true, watch: null, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
    try {
      const { createChallenge, challengeReport, advanceChallenge } = await server.ssrLoadModule("/src/challenge/session.ts");
      for (const run of runs) {
        let state = createChallenge({ seed: run.seed, change: run.change, step: run.change - 1 });
        assert.deepEqual(challengeReport(state), run.before);
        state = advanceChallenge(state, 100);
        assert.deepEqual(challengeReport(state), run.post100);
        state = advanceChallenge(state, 900 - state.config.step);
        assert.deepEqual(challengeReport(state), run.final);
        replayedComparisons++;
      }
    } finally { await server.close(); }
    for (const [name, expected] of Object.entries(provenance.engineSourceHashes)) assert.equal(sha(await fs.readFile(path.join(engine, name))), expected, `Engine changed during verification: ${name}`);
  }
  return { ...result, hashesVerified: true, replayedComparisons, previewServerStarted: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--engine"), "Usage: node verify.mjs [--engine <challenge-source-folder>]");
  console.log(JSON.stringify(await verifyRelease(path.dirname(fileURLToPath(import.meta.url)), args[1]), null, 2));
}
