import { Rng } from "./rng";
import { CONTROLLED_COSTS, SUCCESS_VETO_STEPS, type ControlledExperiment } from "./controlledExperiment";
import { physicalDetour } from "./physicalDetour";
import { DEFAULT_SCENARIO, type ScenarioConfig } from "./scenarios";
import type { AgentState, HistoryPoint, Metrics, ModeName, PackageMarker, Point, SimState } from "./types";

export const ROWS = 16;
export const COLS = 20;
export const DISRUPTION_STEP = 220;
export const SHIFT_STEP = 520;
export const MAX_STEPS = 900;

const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const MODE_CONFIG: Record<
  ModeName,
  {
    dangerPenalty: number;
    successPull: number;
    candidatePull: number;
    oracle: boolean;
    writesDanger: boolean;
    writesSuccess: boolean;
    candidateMode: boolean;
    efficient: boolean;
  }
> = {
  baseline: {
    dangerPenalty: 0,
    successPull: 0,
    candidatePull: 0,
    oracle: false,
    writesDanger: false,
    writesSuccess: false,
    candidateMode: false,
    efficient: false,
  },
  adaptive_blunt: {
    dangerPenalty: 8.5,
    successPull: 0.8,
    candidatePull: 0,
    oracle: false,
    writesDanger: true,
    writesSuccess: true,
    candidateMode: false,
    efficient: false,
  },
  adaptive_candidate_lock: {
    dangerPenalty: 9.5,
    successPull: 1.1,
    candidatePull: 1.2,
    oracle: false,
    writesDanger: true,
    writesSuccess: true,
    candidateMode: true,
    efficient: false,
  },
  adaptive_candidate_efficient: {
    dangerPenalty: 9.2,
    successPull: 1.35,
    candidatePull: 1.5,
    oracle: false,
    writesDanger: true,
    writesSuccess: true,
    candidateMode: true,
    efficient: true,
  },
  oracle: {
    dangerPenalty: 0,
    successPull: 0,
    candidatePull: 0,
    oracle: true,
    writesDanger: false,
    writesSuccess: false,
    candidateMode: false,
    efficient: false,
  },
};

export function createSimulation(mode: ModeName, seed: number, scenario: ScenarioConfig = DEFAULT_SCENARIO): SimState {
  const rng = new Rng(seed);
  const packages = makePackages(scenario);
  const depot = { x: 18, y: 7 };
  const agents = makeAgents(rng, packages, scenario.agentCount);

  return {
    mode,
    seed,
    scenario,
    step: 0,
    rng,
    rows: ROWS,
    cols: COLS,
    agents,
    packages,
    depot,
    danger: field(0),
    success: field(0),
    candidate: field(0),
    faultMap: makeFaultMap(0, scenario),
    metrics: emptyMetrics(),
    history: [{ step: 0, damage: 0, energyPerDelivery: 0, delivered: 0, faultHits: 0 }],
  };
}

export function cloneForReset(state: SimState): SimState {
  if (state.experiment) return createControlledSimulation(state.seed, state.scenario, state.experiment);
  if (state.oracleNavigation) return createPlannedOracleSimulation(state.seed, state.scenario);
  if (state.localRecovery) return createRecoveringCandidateSimulation(state.seed, state.scenario);
  return createSimulation(state.mode, state.seed, state.scenario);
}

// Opt-in so frozen research runs retain the original greedy oracle semantics.
export function createPlannedOracleSimulation(seed: number, scenario: ScenarioConfig = DEFAULT_SCENARIO): SimState {
  return { ...createSimulation("oracle", seed, scenario), oracleNavigation: "hazard-astar-v1" };
}

export function createRecoveringCandidateSimulation(seed: number, scenario: ScenarioConfig = DEFAULT_SCENARIO): SimState {
  return { ...createSimulation("adaptive_candidate_lock", seed, scenario), localRecovery: "visit-penalty-v1", recoveryMetrics: { episodes: 0, activeSteps: 0 } };
}

export function createControlledSimulation(seed: number, scenario: ScenarioConfig, experiment: ControlledExperiment): SimState {
  if ((experiment.randomness && experiment.randomness !== "paired-v1") ||
    (experiment.successEvidence && experiment.successEvidence !== "harm-veto") ||
    (experiment.navigation && experiment.navigation !== "physical-astar")) throw new Error("Unsupported experiment policy option");
  const environment = experiment.environment;
  if (environment) {
    const points = [...(environment.blockedCells ?? []), ...(environment.depotAfterChange ? [environment.depotAfterChange] : [])];
    if (!Number.isInteger(environment.changeAtStep) || environment.changeAtStep < 1 || environment.changeAtStep > MAX_STEPS ||
      points.some((point) => !Number.isInteger(point.x) || !Number.isInteger(point.y) || !inside(point)) ||
      [...(environment.openGateRows?.before ?? []), ...(environment.openGateRows?.after ?? [])].some((row) => !Number.isInteger(row) || row < 0 || row >= ROWS)) {
      throw new Error("Invalid experiment environment");
    }
  }
  return {
    ...createSimulation("adaptive_candidate_lock", seed, scenario),
    experiment: { memory: { ...experiment.memory }, hazardsEnabled: experiment.hazardsEnabled,
      ...(experiment.randomness ? { randomness: experiment.randomness } : {}),
      ...(experiment.successEvidence ? { successEvidence: experiment.successEvidence } : {}),
      ...(experiment.navigation ? { navigation: experiment.navigation } : {}),
      ...(environment ? { environment: structuredClone(environment) } : {}) },
    ...(experiment.successEvidence ? { successVetoUntil: field(0),
      successEvidenceMetrics: { harmEvents: 0, clearedCells: 0, rejectedWrites: 0, unreinforcedDamagedTrips: 0 } } : {}),
    experimentMetrics: { movementAttempts: 0, repairTicks: 0, neutralMovementEnergy: 0, learnedDangerSurcharge: 0 },
  };
}

function configuration(state: SimState): (typeof MODE_CONFIG)[ModeName] {
  if (!state.experiment) return MODE_CONFIG[state.mode];
  const memory = state.experiment.memory;
  const reference = MODE_CONFIG.adaptive_candidate_lock;
  return {
    ...reference,
    dangerPenalty: memory.danger ? reference.dangerPenalty : 0,
    successPull: memory.success ? reference.successPull : 0,
    candidatePull: memory.candidate ? reference.candidatePull : 0,
    writesDanger: memory.danger,
    writesSuccess: memory.success,
    candidateMode: memory.candidate,
  };
}

export function stepSimulation(current: SimState, stepCount = 1): SimState {
  let state = current;
  for (let i = 0; i < stepCount && state.step < MAX_STEPS; i += 1) {
    state = stepOnce(state);
  }
  return state;
}

export function runToEnd(mode: ModeName, seed: number, steps = MAX_STEPS, scenario: ScenarioConfig = DEFAULT_SCENARIO): Metrics {
  let state = createSimulation(mode, seed, scenario);
  while (state.step < steps) {
    state = stepSimulation(state, 1);
  }
  return state.metrics;
}

export function runToStep(mode: ModeName, seed: number, step: number, scenario: ScenarioConfig = DEFAULT_SCENARIO): SimState {
  const target = Math.max(0, Math.min(MAX_STEPS, Math.round(step)));
  return stepSimulation(createSimulation(mode, seed, scenario), target);
}

export function energyPerDelivery(metrics: Metrics): number {
  return metrics.delivered > 0 ? metrics.energySpent / metrics.delivered : metrics.energySpent;
}

export function recoveryDelay(metrics: Metrics): number {
  if (metrics.firstPostShiftDeliveryStep === null) {
    return MAX_STEPS - SHIFT_STEP;
  }
  return Math.max(0, metrics.firstPostShiftDeliveryStep - SHIFT_STEP);
}

export function formatMetric(value: number, digits = 0): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function stepOnce(current: SimState): SimState {
  const state: SimState = {
    ...current,
    // Paired replays are immutable, including React's repeated updater calls.
    ...(current.experiment?.randomness === "paired-v1" ? {
      rng: current.rng.clone(),
      danger: current.danger.map(row => [...row]),
      success: current.success.map(row => [...row]),
      candidate: current.candidate.map(row => [...row]),
      ...(current.successVetoUntil ? { successVetoUntil: current.successVetoUntil.map(row => [...row]) } : {}),
    } : {}),
    step: current.step + 1,
    agents: current.agents.map((agent) => ({ ...agent, path: [...agent.path], recent: [...agent.recent] })),
    metrics: { ...current.metrics },
    history: [...current.history],
    ...(current.experimentMetrics ? { experimentMetrics: { ...current.experimentMetrics } } : {}),
    ...(current.successEvidenceMetrics ? { successEvidenceMetrics: { ...current.successEvidenceMetrics } } : {}),
    ...(current.recoveryMetrics ? { recoveryMetrics: { ...current.recoveryMetrics } } : {}),
  };

  const config = configuration(state);
  const environment = state.experiment?.environment;
  const changed = environment && state.step >= environment.changeAtStep;
  if (changed && environment.depotAfterChange) state.depot = { ...environment.depotAfterChange };
  const openRows = environment?.openGateRows?.[changed ? "after" : "before"];
  state.faultMap = makeFaultMap(state.experiment?.hazardsEnabled === false ? 0 : state.step, state.scenario, openRows);
  const oracleBlocked = state.oracleNavigation ? state.faultMap.flatMap((row, y) =>
    row.flatMap((hazard, x) => hazard ? [{ x, y }] : [])) : undefined;
  decayField(state.danger, 0.996);
  decayField(state.success, 0.998);
  decayField(state.candidate, 0.997);

  for (const agent of state.agents) {
    if (isRepairing(agent, state, config)) {
      if (state.experimentMetrics) state.experimentMetrics.repairTicks += 1;
      continue;
    }

    ensureTarget(agent, state);
    moveAgent(agent, state, config, oracleBlocked);
    resolveAgentCell(agent, state, config);
  }

  if (state.step % 6 === 0) {
    pushHistory(state);
  }

  return state;
}

function isRepairing(
  agent: AgentState,
  state: SimState,
  config: (typeof MODE_CONFIG)[ModeName],
): boolean {
  const stepsSinceDamage = state.step - agent.lastDamageStep;
  if (stepsSinceDamage <= 0) {
    return false;
  }

  const repairSteps = state.experiment ? CONTROLLED_COSTS.repairSteps : config.efficient ? 1 : 3;
  return stepsSinceDamage <= repairSteps;
}

function makeAgents(rng: Rng, packages: PackageMarker[], agentCount: number): AgentState[] {
  return Array.from({ length: agentCount }, (_, index) => {
    const pkg = packages[index % packages.length];
    return {
      id: index + 1,
      x: rng.int(1, 3),
      y: rng.int(2, ROWS - 3),
      battery: 100,
      carrying: null,
      target: { x: pkg.x, y: pkg.y },
      routeType: "direct",
      risk: 0,
      path: [],
      recent: [],
      lastDamageStep: -999,
      candidateSeen: false,
    };
  });
}

function makePackages(scenario: ScenarioConfig): PackageMarker[] {
  const packages = [
    { id: "PKG-8124", x: 2, y: 3 },
    { id: "PKG-2381", x: 3, y: 5 },
    { id: "PKG-4419", x: 2, y: 10 },
    { id: "PKG-7302", x: 4, y: 8 },
    { id: "PKG-1198", x: 3, y: 13 },
  ];

  return packages.slice(0, scenario.packageCount);
}

function emptyMetrics(): Metrics {
  return {
    delivered: 0,
    postDelivered: 0,
    damage: 0,
    postDamage: 0,
    faultHits: 0,
    postFaultHits: 0,
    energySpent: 0,
    candidateCrossings: 0,
    candidatePromotions: 0,
    firstPostShiftDeliveryStep: null,
  };
}

function field(value: number): number[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => value));
}

function makeFaultMap(step: number, scenario: ScenarioConfig, openRows?: number[]): boolean[][] {
  const map = field(0).map((row) => row.map(() => false));
  if (step < DISRUPTION_STEP) {
    return map;
  }

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = scenario.faultBandStart; x <= scenario.faultBandEnd; x += 1) {
      const gateAOpen = step < SHIFT_STEP && y >= 2 && y <= 4;
      const gateBOpen = y >= 11 && y <= 13;
      const gateCOpen = step >= SHIFT_STEP && y >= 6 && y <= 8;
      map[y][x] = openRows ? !openRows.includes(y) : !(gateAOpen || gateBOpen || gateCOpen);
    }
  }

  return map;
}

function ensureTarget(agent: AgentState, state: SimState): void {
  if (agent.carrying) {
    agent.target = state.depot;
    return;
  }

  if (samePoint(agent, agent.target)) {
    const pkg = nextPackage(agent, state);
    agent.target = { x: pkg.x, y: pkg.y };
  }
}

function moveAgent(
  agent: AgentState,
  state: SimState,
  config: (typeof MODE_CONFIG)[ModeName],
  oracleBlocked?: Point[],
): void {
  const currentDistance = manhattan(agent, agent.target);
  let bestPoint = { x: agent.x, y: agent.y };
  let bestScore = -Infinity;
  const visits = state.localRecovery ? agent.path.slice(-16) : [];
  if (state.localRecovery && !agent.recoverySteps && visits.length === 16 &&
    new Set(visits.map(point => `${point.x},${point.y}`)).size <= 4) {
    agent.recoverySteps = 8;
    state.recoveryMetrics!.episodes++;
  }
  const recovering = Boolean(state.localRecovery && agent.recoverySteps);
  const movementRng = state.experiment?.randomness === "paired-v1"
    ? pairedRng(state.seed, agent.id, state.step, 0x13579bdf) : state.rng;

  for (const dir of DIRECTIONS) {
    const next = clampPoint({ x: agent.x + dir.x, y: agent.y + dir.y });
    const distanceGain = currentDistance - manhattan(next, agent.target);
    const danger = state.danger[next.y][next.x];
    const success = state.success[next.y][next.x];
    const candidate = state.candidate[next.y][next.x];
    const hazard = state.faultMap[next.y][next.x];
    const repeated = agent.recent.some((point) => samePoint(point, next));
    const routeProgress = agent.carrying ? next.x - agent.x : agent.x - next.x;

    let score = distanceGain * 5.2 + movementRng.next() * 0.35;

    const environment = state.experiment?.environment;
    if (environment && state.step >= environment.changeAtStep && environment.blockedCells?.some((cell) => samePoint(cell, next))) continue;

    if (config.oracle && hazard) {
      score -= 500;
    }

    score -= config.dangerPenalty * danger;
    score += config.successPull * success;
    score += config.candidatePull * candidate;

    if (config.efficient && agent.carrying) {
      score += routeProgress * 1.55;
      score += distanceGain > 0 ? 0.45 : 0;
      score -= repeated ? 1.65 : 0;
      score -= Math.abs(next.y - agent.target.y) * 0.03;
    } else {
      score -= repeated ? 0.4 : 0;
    }

    if (config.candidateMode && agent.carrying && inStorageBand(next.x)) {
      score += candidate * 1.2;
      score -= danger * 3.5;
    }

    // Only the agent's visited cells influence escape; no hazard-map lookup.
    if (recovering) score -= visits.filter(point => samePoint(point, next)).length * 2;

    if (score > bestScore) {
      bestScore = score;
      bestPoint = next;
    }
  }

  const environment = state.experiment?.environment;
  if (state.experiment?.navigation === "physical-astar" && environment && state.step >= environment.changeAtStep && environment.blockedCells?.length) {
    bestPoint = physicalDetour(agent, environment.blockedCells, state.cols, state.rows) ?? { x: agent.x, y: agent.y };
  }

  if (oracleBlocked) {
    bestPoint = plannedOracleStep(agent, state, oracleBlocked) ?? { x: agent.x, y: agent.y };
  }

  if (recovering) {
    agent.recoverySteps = (agent.recoverySteps ?? 0) - 1;
    state.recoveryMetrics!.activeSteps++;
  }

  agent.x = bestPoint.x;
  agent.y = bestPoint.y;
  agent.path.push({ x: agent.x, y: agent.y });
  if (agent.path.length > 120) {
    agent.path.shift();
  }
  agent.recent.push({ x: agent.x, y: agent.y });
  if (agent.recent.length > 16) {
    agent.recent.shift();
  }

  if (state.experiment && state.experimentMetrics) {
    const energy = CONTROLLED_COSTS.movementEnergy * state.scenario.energyMultiplier;
    state.metrics.energySpent += energy;
    state.experimentMetrics.movementAttempts += 1;
    state.experimentMetrics.neutralMovementEnergy += energy;
    // Keep the original memory-dependent surcharge as a diagnostic, not a physical cost.
    state.experimentMetrics.learnedDangerSurcharge += state.danger[agent.y][agent.x]
      * CONTROLLED_COSTS.learnedDangerSurcharge * state.scenario.energyMultiplier;
  } else {
    const baseEnergy = config.efficient ? 0.72 : 0.92;
    state.metrics.energySpent += (baseEnergy + state.danger[agent.y][agent.x] * 0.18) * state.scenario.energyMultiplier;
  }
  agent.battery = Math.max(0, agent.battery - 0.045 - state.danger[agent.y][agent.x] * 0.015);
}

function plannedOracleStep(agent: AgentState, state: SimState, blocked: Point[]): Point | null {
  const next = physicalDetour(agent, blocked, state.cols, state.rows);
  if (next || !state.faultMap[agent.y][agent.x]) return next;

  // A gate can close around an agent. Escape to the nearest safe cell one
  // step at a time, paying normal hazard/repair costs on the way out.
  let escape: Point | null = null;
  let distance = Infinity;
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    const candidate = { x, y };
    if (!state.faultMap[y][x] && manhattan(agent, candidate) < distance) {
      escape = candidate;
      distance = manhattan(agent, candidate);
    }
  }
  return escape ? physicalDetour(agent, [], state.cols, state.rows, escape) : null;
}

function resolveAgentCell(
  agent: AgentState,
  state: SimState,
  config: (typeof MODE_CONFIG)[ModeName],
): void {
  const hazard = state.faultMap[agent.y][agent.x];

  if (hazard && (!config.oracle || state.oracleNavigation)) {
    const hit = (state.experiment ? CONTROLLED_COSTS.damagePerHit : config.efficient ? 1.55 : 2) * state.scenario.damageMultiplier;
    state.metrics.damage += hit;
    state.metrics.faultHits += 1;
    agent.lastDamageStep = state.step;
    agent.routeType = "danger";
    agent.risk = 1;

    if (state.successVetoUntil && state.successEvidenceMetrics) {
      state.successEvidenceMetrics.harmEvents += 1;
      if (state.success[agent.y][agent.x] > 0) state.successEvidenceMetrics.clearedCells += 1;
      state.success[agent.y][agent.x] = 0;
      state.successVetoUntil[agent.y][agent.x] = state.step + SUCCESS_VETO_STEPS;
      if (agent.carrying) agent.tripHadHarm = true;
    }

    if (state.step >= metricShiftStep(state)) {
      state.metrics.postDamage += hit;
      state.metrics.postFaultHits += 1;
    }

    if (config.writesDanger) {
      writeAround(state.danger, agent, 2, config.efficient ? 0.92 : 1.15);
      demoteAround(state.success, agent, 2, 0.42);
      demoteAround(state.candidate, agent, 1, 0.5);
    }

    if (config.candidateMode && agent.carrying) {
      writePath(state.candidate, recentStorageSegment(agent.path), config.efficient ? 0.36 : 0.24);
      agent.candidateSeen = true;
    }
  } else {
    agent.risk = state.danger[agent.y][agent.x];
    const success = state.success[agent.y][agent.x];
    const candidate = state.candidate[agent.y][agent.x];
    agent.routeType = config.oracle
      ? "oracle"
      : candidate > 0.35
        ? "candidate"
        : success > 0.35
          ? "success"
          : "direct";
  }

  if (!agent.carrying && samePoint(agent, agent.target)) {
    agent.carrying = `PKG-${state.seed}${agent.id}${state.metrics.delivered + 1}`;
    agent.target = state.depot;
    agent.path = [{ x: agent.x, y: agent.y }];
    agent.candidateSeen = false;
    if (state.localRecovery) agent.recoverySteps = 0;
    if (state.successVetoUntil) agent.tripHadHarm = hazard && !config.oracle;
  }

  if (agent.carrying && crossedStorageToShipping(agent.path)) {
    if (config.candidateMode && state.step > DISRUPTION_STEP) {
      state.metrics.candidateCrossings += 1;
      writePath(state.candidate, recentStorageSegment(agent.path), config.efficient ? 0.22 : 0.18);
      agent.candidateSeen = true;
    }
  }

  if (agent.carrying && samePoint(agent, state.depot)) {
    state.metrics.delivered += 1;
    if (state.step >= metricShiftStep(state)) {
      state.metrics.postDelivered += 1;
      if (state.metrics.firstPostShiftDeliveryStep === null) {
        state.metrics.firstPostShiftDeliveryStep = state.step;
      }
    }

    if (config.writesSuccess) {
      if (state.successEvidenceMetrics && agent.tripHadHarm) {
        state.successEvidenceMetrics.unreinforcedDamagedTrips += 1;
      } else {
        const eligible = state.successVetoUntil ? (x: number, y: number) => {
          const allowed = state.step >= state.successVetoUntil![y][x];
          if (!allowed) state.successEvidenceMetrics!.rejectedWrites += 1;
          return allowed;
        } : undefined;
        const strength = config.efficient ? 0.24 : 0.2;
        writePath(state.success, agent.path, strength, eligible);
        if (agent.candidateSeen && config.candidateMode) {
          state.metrics.candidatePromotions += 1;
          writePath(state.success, recentStorageSegment(agent.path), config.efficient ? 0.44 : 0.34, eligible);
        }
      }
    }

    agent.carrying = null;
    const pkg = nextPackage(agent, state);
    agent.target = { x: pkg.x, y: pkg.y };
    agent.path = [];
    if (state.localRecovery) agent.recoverySteps = 0;
    agent.candidateSeen = false;
    if (state.successVetoUntil) agent.tripHadHarm = false;
    agent.battery = Math.min(100, agent.battery + 4);
  }
}

// Independent counters prevent repairs or other agents from changing task draws.
function pairedRng(seed: number, agentId: number, index: number, channel: number): Rng {
  return new Rng((seed ^ Math.imul(agentId, 0x9e3779b9) ^ Math.imul(index + 1, 0x85ebca6b) ^ channel) >>> 0);
}

function nextPackage(agent: AgentState, state: SimState): PackageMarker {
  if (state.experiment?.randomness !== "paired-v1") return state.rng.choice(state.packages);
  const assignment = agent.taskAssignments ?? 0;
  agent.taskAssignments = assignment + 1;
  return pairedRng(state.seed, agent.id, assignment, 0x2468ace0).choice(state.packages);
}

function metricShiftStep(state: SimState): number {
  return state.experiment?.randomness === "paired-v1"
    ? state.experiment.environment?.changeAtStep ?? SHIFT_STEP : SHIFT_STEP;
}

function pushHistory(state: SimState): void {
  const point: HistoryPoint = {
    step: state.step,
    damage: state.metrics.damage,
    energyPerDelivery: energyPerDelivery(state.metrics),
    delivered: state.metrics.delivered,
    faultHits: state.metrics.faultHits,
  };
  state.history.push(point);
  if (state.history.length > 170) {
    state.history.shift();
  }
}

function decayField(target: number[][], factor: number): void {
  for (let y = 0; y < target.length; y += 1) {
    for (let x = 0; x < target[y].length; x += 1) {
      target[y][x] *= factor;
      if (target[y][x] < 0.01) {
        target[y][x] = 0;
      }
    }
  }
}

function writeAround(target: number[][], center: Point, radius: number, amount: number, eligible?: (x: number, y: number) => boolean): void {
  for (let y = Math.max(0, center.y - radius); y <= Math.min(ROWS - 1, center.y + radius); y += 1) {
    for (let x = Math.max(0, center.x - radius); x <= Math.min(COLS - 1, center.x + radius); x += 1) {
      if (eligible && !eligible(x, y)) continue;
      const distance = Math.abs(center.x - x) + Math.abs(center.y - y);
      const falloff = Math.max(0, 1 - distance / (radius + 1));
      target[y][x] = Math.min(1, target[y][x] + amount * falloff);
    }
  }
}

function demoteAround(target: number[][], center: Point, radius: number, amount: number): void {
  for (let y = Math.max(0, center.y - radius); y <= Math.min(ROWS - 1, center.y + radius); y += 1) {
    for (let x = Math.max(0, center.x - radius); x <= Math.min(COLS - 1, center.x + radius); x += 1) {
      const distance = Math.abs(center.x - x) + Math.abs(center.y - y);
      const falloff = Math.max(0, 1 - distance / (radius + 1));
      target[y][x] = Math.max(0, target[y][x] - amount * falloff);
    }
  }
}

function writePath(target: number[][], path: Point[], amount: number, eligible?: (x: number, y: number) => boolean): void {
  for (const point of path) {
    if (inside(point) && (!eligible || eligible(point.x, point.y))) {
      target[point.y][point.x] = Math.min(1, target[point.y][point.x] + amount);
      writeAround(target, point, 1, amount * 0.35, eligible);
    }
  }
}

function recentStorageSegment(path: Point[]): Point[] {
  return path.filter((point) => inStorageBand(point.x) || point.x === 8 || point.x === 13).slice(-28);
}

function crossedStorageToShipping(path: Point[]): boolean {
  if (path.length < 2) {
    return false;
  }
  const previous = path[path.length - 2];
  const current = path[path.length - 1];
  return previous.x <= 12 && current.x >= 13;
}

function inStorageBand(x: number): boolean {
  return x >= 9 && x <= 12;
}

function clampPoint(point: Point): Point {
  return {
    x: Math.max(0, Math.min(COLS - 1, point.x)),
    y: Math.max(0, Math.min(ROWS - 1, point.y)),
  };
}

function inside(point: Point): boolean {
  return point.x >= 0 && point.x < COLS && point.y >= 0 && point.y < ROWS;
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
