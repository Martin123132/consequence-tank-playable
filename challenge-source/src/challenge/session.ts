import { CONTROLLED_COSTS } from "../simulation/controlledExperiment";
import { DEFAULT_SCENARIO } from "../simulation/scenarios";
import type { SimState } from "../simulation/types";
import { createControlledSimulation, DISRUPTION_STEP, MAX_STEPS, stepSimulation } from "../simulation/warehouse";

export const CHALLENGE_VERSION = "gate-v1";
export const MIN_CHANGE_STEP = 260;
export const MAX_CHANGE_STEP = 800;
export const GATE_ROWS = { before: [6, 7, 8, 11, 12, 13], after: [2, 3, 4, 11, 12, 13] };
export interface ChallengeConfig { seed: number; change: number; step: number }
export interface ChallengeSession { config: ChallengeConfig; direct: SimState; memory: SimState }
export const DEFAULT_CHALLENGE: ChallengeConfig = { seed: 42, change: 520, step: 0 };

export const MATCHED_RULES = {
  movementEnergyPerAttempt: CONTROLLED_COSTS.movementEnergy,
  damagePerHit: CONTROLLED_COSTS.damagePerHit,
  repairSteps: CONTROLLED_COSTS.repairSteps,
  agents: DEFAULT_SCENARIO.agentCount,
  observation: "Position, target and own local movement history; no hazard map or future change time.",
  difference: "Only Success memory writes and reads the shared field of completed delivery routes (pull 1.1, decay 0.998 per step). Damaged trips also reinforce it.",
  randomness: "paired-v1: movement noise keyed by seed/agent/step; task draws keyed by seed/agent/assignment ordinal, not global RNG consumption.",
  workload: "Same initial agents/packages/depot; same per-agent task stream. Task arrival times can diverge with policy behaviour.",
};
export const CHALLENGE_LIMITS = [
  "Synthetic units, not real energy or a safety assessment. One seed is not a benchmark.",
  "Gate closure changes safe cells into damaging cells, not impassable walls. The southern gate remains safe. Shelves are visual landmarks.",
  "No collisions, queues, realistic charging or compute/memory cost. Equal per-event costs do not imply equal totals.",
  "Matched observations and costs; the memory mechanism is intentionally different. Neither policy uses Oracle planning or the hazard map.",
];

function validInteger(value: number, min: number, max: number) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
export function validateChallenge(config: ChallengeConfig): ChallengeConfig {
  if (!validInteger(config.seed, 1, 9999) || !validInteger(config.change, MIN_CHANGE_STEP, MAX_CHANGE_STEP) || !validInteger(config.step, 0, MAX_STEPS)) {
    throw new Error("Invalid challenge: seed 1-9999, gate change 260-800, step 0-900; whole numbers only.");
  }
  return { seed: config.seed, change: config.change, step: config.step };
}
export function parseChallenge(hash: string): ChallengeConfig {
  if (!hash || hash === "#") return { ...DEFAULT_CHALLENGE };
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.getAll("challenge").length !== 1 || params.get("challenge") !== CHALLENGE_VERSION) throw new Error("Unsupported replay version. This build accepts gate-v1 challenges only.");
  const values = ["seed", "change", "step"].map(key => {
    const entries = params.getAll(key);
    if (entries.length !== 1 || !/^\d+$/.test(entries[0])) throw new Error(`Invalid replay parameter: ${key}.`);
    return Number(entries[0]);
  });
  return validateChallenge({ seed: values[0], change: values[1], step: values[2] });
}
export function challengeHash(config: ChallengeConfig): string {
  const valid = validateChallenge(config);
  return new URLSearchParams({ challenge: CHALLENGE_VERSION, seed: String(valid.seed), change: String(valid.change), step: String(valid.step) }).toString();
}
export function challengeLink(config: ChallengeConfig, href: string): string {
  const url = new URL(href);
  url.search = "";
  url.username = url.password = "";
  url.hash = challengeHash(config);
  return url.href;
}
export function createChallenge(config: ChallengeConfig): ChallengeSession {
  const valid = validateChallenge(config);
  const create = (success: boolean) => createControlledSimulation(valid.seed, DEFAULT_SCENARIO, {
    memory: { danger: false, success, candidate: false }, hazardsEnabled: true, randomness: "paired-v1",
    environment: { changeAtStep: valid.change, openGateRows: GATE_ROWS },
  });
  return advanceChallenge({ config: { ...valid, step: 0 }, direct: create(false), memory: create(true) }, valid.step);
}
export function advanceChallenge(session: ChallengeSession, steps: number): ChallengeSession {
  if (!validInteger(steps, 0, MAX_STEPS)) throw new Error("Invalid playback step count.");
  const direct = stepSimulation(session.direct, steps);
  const memory = stepSimulation(session.memory, steps);
  return { config: { ...session.config, step: direct.step }, direct, memory };
}
export function gatePhase(config: ChallengeConfig): string {
  return config.step < DISRUPTION_STEP ? "Before hazards" : config.step < config.change ? "Centre + south safe" : "North + south safe";
}
function totals(state: SimState) {
  return {
    deliveries: state.metrics.delivered, damage: state.metrics.damage, energy: state.metrics.energySpent,
    postChangeDeliveries: state.metrics.postDelivered, postChangeDamage: state.metrics.postDamage,
    firstPostChangeDeliveryStep: state.metrics.firstPostShiftDeliveryStep,
    energyPerDelivery: state.metrics.delivered ? state.metrics.energySpent / state.metrics.delivered : null,
    movementAttempts: state.experimentMetrics!.movementAttempts, repairTicks: state.experimentMetrics!.repairTicks,
  };
}
export function challengeReport(session: ChallengeSession) {
  return {
    schema: "consequence-tank-gate-challenge", version: CHALLENGE_VERSION,
    configuration: session.config, completed: session.config.step === MAX_STEPS,
    environment: { scenario: "normal_shift", hazardStart: DISRUPTION_STEP, openGateRows: GATE_ROWS, totalSteps: MAX_STEPS },
    matchedRules: MATCHED_RULES, limitations: CHALLENGE_LIMITS,
    direct: totals(session.direct), memory: totals(session.memory),
  };
}
