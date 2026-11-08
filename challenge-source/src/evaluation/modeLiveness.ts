import { replaySession } from "../playground/session";
import type { ScenarioId } from "../simulation/scenarios";
import type { AgentState, ModeName, Point, SimState } from "../simulation/types";
import { MAX_STEPS, stepSimulation } from "../simulation/warehouse";

export const LIVENESS_LIMITS = Object.freeze({ deliveryGap: 120, activeWindow: 32, maxLoopCells: 4 });
type Visit = Point & { step: number };
export interface AgentLiveness {
  id: number;
  deliveries: number;
  repairTicks: number;
  maxDeliveryGap: number;
  longestGap: { from: number; to: number };
  loopEpisodes: number;
  firstLoop: { from: number; to: number; target: Point; carrying: boolean; cells: Visit[] } | null;
}

export function repeatedCellLoop(visits: readonly Point[]): boolean {
  return visits.length === LIVENESS_LIMITS.activeWindow &&
    new Set(visits.map(({ x, y }) => `${x},${y}`)).size <= LIVENESS_LIMITS.maxLoopCells;
}

export class LivenessMonitor {
  private entries: Map<number, { result: AgentLiveness; lastDelivery: number; visits: Visit[]; inLoop: boolean }>;
  constructor(initial: SimState) {
    this.entries = new Map(initial.agents.map(agent => [agent.id, {
      result: { id: agent.id, deliveries: 0, repairTicks: 0, maxDeliveryGap: 0, longestGap: { from: initial.step, to: initial.step }, loopEpisodes: 0, firstLoop: null },
      lastDelivery: initial.step, visits: [], inLoop: false,
    }]));
  }

  observe(previous: SimState, next: SimState) {
    if (next.step !== previous.step + 1) throw new Error("Liveness monitoring requires consecutive steps");
    const priorAgents = new Map(previous.agents.map(agent => [agent.id, agent]));
    for (const agent of next.agents) {
      const prior = priorAgents.get(agent.id)!;
      const item = this.entries.get(agent.id)!;
      const gap = next.step - item.lastDelivery;
      if (gap > item.result.maxDeliveryGap) {
        item.result.maxDeliveryGap = gap;
        item.result.longestGap = { from: item.lastDelivery, to: next.step };
      }
      if (prior.carrying && !agent.carrying) { item.result.deliveries++; item.lastDelivery = next.step; }
      if (legChanged(prior, agent)) { item.visits = []; item.inLoop = false; }
      const repairSteps = previous.mode === "adaptive_candidate_efficient" ? 1 : 3;
      const sinceDamage = next.step - prior.lastDamageStep;
      if (sinceDamage > 0 && sinceDamage <= repairSteps) { item.result.repairTicks++; continue; }
      item.visits.push({ x: agent.x, y: agent.y, step: next.step });
      if (item.visits.length > LIVENESS_LIMITS.activeWindow) item.visits.shift();
      const looping = repeatedCellLoop(item.visits);
      if (looping && !item.inLoop) {
        item.result.loopEpisodes++;
        item.result.firstLoop ??= { from: item.visits[0].step, to: next.step, target: { ...agent.target }, carrying: Boolean(agent.carrying), cells: [...item.visits] };
      }
      item.inLoop = looping;
    }
  }

  results() { return [...this.entries.values()].map(item => item.result); }
}

function legChanged(before: AgentState, after: AgentState) {
  return Boolean(before.carrying) !== Boolean(after.carrying) ||
    before.target.x !== after.target.x || before.target.y !== after.target.y;
}

export function auditMode(mode: ModeName, seed: number, scenario: ScenarioId) {
  let state = replaySession({ mode, seed, scenario, step: 0 }).selected;
  const monitor = new LivenessMonitor(state);
  const deliveryWindows: number[] = [];
  let previousDelivered = 0;
  for (let step = 1; step <= MAX_STEPS; step++) {
    const previous = state;
    state = stepSimulation(state);
    monitor.observe(previous, state);
    if (step % 100 === 0) { deliveryWindows.push(state.metrics.delivered - previousDelivered); previousDelivered = state.metrics.delivered; }
  }
  const agents = monitor.results();
  return {
    mode, seed, scenario, metrics: state.metrics, agents, deliveryWindows,
    loopAgents: agents.filter(agent => agent.loopEpisodes > 0).length,
    longGapAgents: agents.filter(agent => agent.maxDeliveryGap >= LIVENESS_LIMITS.deliveryGap).length,
    maxDeliveryGap: Math.max(...agents.map(agent => agent.maxDeliveryGap)),
    allDelivered: agents.every(agent => agent.deliveries > 0),
  };
}
