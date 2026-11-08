import { SCENARIO_PRESETS, getScenarioById, type ScenarioId } from "../simulation/scenarios";
import { MODES, type ModeName, type SimState } from "../simulation/types";
import { MAX_STEPS, createPlannedOracleSimulation, createRecoveringCandidateSimulation, runToStep, stepSimulation } from "../simulation/warehouse";

export const PLAYGROUND_VERSION = "0.1.0-preview.4";
export const MODE_LABELS: Record<ModeName, string> = {
  baseline: "Direct routing",
  adaptive_blunt: "Danger + success",
  adaptive_candidate_lock: "Candidate memory",
  adaptive_candidate_efficient: "Efficient candidate",
  oracle: "Oracle (planned)",
};
export const LIMITATIONS = [
  "Synthetic demonstration, not a calibrated warehouse or a safety assessment.",
  "Modes have different built-in energy, damage and repair rules; differences do not isolate the effect of memory. Candidate memory uses local-history loop recovery, without Oracle's hazard knowledge. Recovery can increase damage; it is not a safety guarantee.",
  "Oracle plans routes with full knowledge of the current hazard map, not future changes. Escaping a newly closed gate can cause damage. Shelves are visual landmarks, not physical obstacles.",
  "No collisions, queues, realistic charging or physical units. One seed is not a benchmark.",
];

export interface SessionConfig { mode: ModeName; seed: number; scenario: ScenarioId; step: number }
export interface Session { selected: SimState; baseline: SimState }
export const DEFAULT_SESSION: SessionConfig = {
  mode: "adaptive_candidate_efficient", seed: 42, scenario: "normal_shift", step: 0,
};

function integer(value: string | null, fallback: number, min: number, max: number) {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function parseSeedInput(value: string): number | null {
  const seed = integer(value, -1, 1, 9999);
  return seed === -1 ? null : seed;
}

export function scenarioLabel(id: ScenarioId): string {
  return id === "high_traffic" ? "More agents" : getScenarioById(id).label;
}

export function parseSession(hash: string): SessionConfig {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const mode = params.get("mode") as ModeName;
  const scenario = params.get("scenario") as ScenarioId;
  return {
    mode: MODES.includes(mode) ? mode : DEFAULT_SESSION.mode,
    scenario: SCENARIO_PRESETS.some((item) => item.id === scenario) ? scenario : DEFAULT_SESSION.scenario,
    seed: integer(params.get("seed"), DEFAULT_SESSION.seed, 1, 9999),
    step: integer(params.get("step"), 0, 0, MAX_STEPS),
  };
}

export function sessionHash(config: SessionConfig) {
  return new URLSearchParams({ mode: config.mode, scenario: config.scenario, seed: String(config.seed), step: String(config.step) }).toString();
}

export function replaySession(config: SessionConfig): Session {
  const scenario = getScenarioById(config.scenario);
  const selected = config.mode === "oracle"
    ? stepSimulation(createPlannedOracleSimulation(config.seed, scenario), Math.max(0, Math.min(MAX_STEPS, Math.round(config.step))))
    : config.mode === "adaptive_candidate_lock"
      ? stepSimulation(createRecoveringCandidateSimulation(config.seed, scenario), Math.max(0, Math.min(MAX_STEPS, Math.round(config.step))))
    : runToStep(config.mode, config.seed, config.step, scenario);
  return { selected, baseline: runToStep("baseline", config.seed, config.step, scenario) };
}

export function advanceSession(session: Session, steps: number): Session {
  return { selected: stepSimulation(session.selected, steps), baseline: stepSimulation(session.baseline, steps) };
}

export function sessionConfig(session: Session): SessionConfig {
  const { mode, seed, scenario, step } = session.selected;
  return { mode, seed, scenario: scenario.id, step };
}

export function sessionReport(session: Session) {
  return {
    schema: "consequence-tank-playground-v1", version: PLAYGROUND_VERSION,
    configuration: sessionConfig(session), completed: session.selected.step === MAX_STEPS,
    oraclePolicy: session.selected.oracleNavigation ?? null,
    localRecoveryPolicy: session.selected.localRecovery ?? null,
    localRecovery: session.selected.recoveryMetrics ?? null,
    units: "synthetic simulation units; recovery is in steps", limitations: LIMITATIONS,
    selected: session.selected.metrics, baseline: session.baseline.metrics,
  };
}
