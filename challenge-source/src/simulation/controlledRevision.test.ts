import { describe, expect, it } from "vitest";
import { SUCCESS_VETO_STEPS } from "./controlledExperiment";
import { DEFAULT_SCENARIO } from "./scenarios";
import { cloneForReset, createControlledSimulation, createSimulation, stepSimulation } from "./warehouse";
import { physicalDetour } from "./physicalDetour";
import type { Point } from "./types";

function guarded(hazardsEnabled = false) {
  const state = createControlledSimulation(42, DEFAULT_SCENARIO, {
    memory: { danger: false, success: true, candidate: false }, hazardsEnabled, successEvidence: "harm-veto",
  });
  state.agents = [state.agents[0]];
  return state;
}
function arriving(damaged = false) {
  const state = guarded();
  state.step = 300;
  Object.assign(state.agents[0], { x: 17, y: 7, carrying: "test", target: { ...state.depot }, tripHadHarm: damaged, path: [{ x: 10, y: 7 }, { x: 11, y: 7 }] });
  return state;
}

describe("observed-harm success veto", () => {
  it("clears only the observed harmful cell and records a bounded veto after entry", () => {
    const state = guarded(true);
    state.step = 219;
    state.success[7][9] = 0.8;
    state.success[7][11] = 0.8;
    Object.assign(state.agents[0], { x: 8, y: 7, carrying: "test", target: { ...state.depot } });
    expect(state.successVetoUntil![7][9]).toBe(0);
    const after = stepSimulation(state);
    expect(after.agents[0]).toMatchObject({ x: 9, y: 7, tripHadHarm: true });
    expect(after.metrics.faultHits).toBe(1);
    expect(after.success[7][9]).toBe(0);
    expect(after.successVetoUntil![7][9]).toBe(220 + SUCCESS_VETO_STEPS);
    expect(after.success[7][11]).toBeCloseTo(0.8 * 0.998);
    expect(after.successVetoUntil![7][11]).toBe(0);
    expect(after.successEvidenceMetrics).toMatchObject({ harmEvents: 1, clearedCells: 1 });
  });

  it("does not reinforce a damaged delivery but keeps the delivery and physical costs", () => {
    const after = stepSimulation(arriving(true));
    expect(after.metrics.delivered).toBe(1);
    expect(after.metrics.energySpent).toBeCloseTo(0.92);
    expect(after.success.flat().every((value) => value === 0)).toBe(true);
    expect(after.successEvidenceMetrics?.unreinforcedDamagedTrips).toBe(1);
    expect(after.agents[0].tripHadHarm).toBe(false);
  });

  it("prevents direct and neighbouring reinforcement until expiry, then permits new clean evidence", () => {
    const active = arriving();
    active.successVetoUntil![7][10] = 302;
    const after = stepSimulation(active);
    expect(after.success[7][10]).toBe(0);
    expect(after.success[7][11]).toBeGreaterThan(0);
    expect(after.successEvidenceMetrics!.rejectedWrites).toBeGreaterThan(0);
    const expired = arriving();
    expired.successVetoUntil![7][10] = 301;
    expect(stepSimulation(expired).success[7][10]).toBeGreaterThan(0);
  });

  it("starts a fresh harm flag at pickup and counts a harmful pickup cell", () => {
    const safe = guarded();
    Object.assign(safe.agents[0], { x: 1, y: 3, target: { x: 2, y: 3 }, tripHadHarm: true });
    expect(stepSimulation(safe).agents[0].tripHadHarm).toBe(false);
    const harmful = guarded(true);
    harmful.step = 219;
    Object.assign(harmful.agents[0], { x: 8, y: 7, target: { x: 9, y: 7 } });
    const after = stepSimulation(harmful);
    expect(after.agents[0].carrying).not.toBeNull();
    expect(after.agents[0].tripHadHarm).toBe(true);
  });

  it("resets experimental evidence and leaves ordinary app states unextended", () => {
    const reset = cloneForReset(stepSimulation(arriving(true)));
    expect(reset.successVetoUntil!.flat().every((value) => value === 0)).toBe(true);
    expect(Object.values(reset.successEvidenceMetrics!).every((value) => value === 0)).toBe(true);
    const normal = createSimulation("adaptive_candidate_lock", 42);
    expect(normal.successVetoUntil).toBeUndefined();
    expect(normal.successEvidenceMetrics).toBeUndefined();
    expect(normal.agents.every((agent) => agent.detour === undefined && agent.tripHadHarm === undefined)).toBe(true);
  });
});

describe("physical detours", () => {
  it("follows a shortest orthogonal route around a wall, checked against an independent breadth-first search", () => {
    const agent = { ...guarded().agents[0], x: 1, y: 3, target: { x: 5, y: 3 } };
    const blocked = [{ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }];
    const queue = [{ x: agent.x, y: agent.y, distance: 0 }];
    const seen = new Set([`${agent.x},${agent.y}`]);
    let shortest = -1;
    for (let i = 0; i < queue.length; i += 1) {
      const at = queue[i];
      if (at.x === agent.target.x && at.y === agent.target.y) { shortest = at.distance; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = at.x + dx; const y = at.y + dy; const key = `${x},${y}`;
        if (x < 0 || y < 0 || x >= 7 || y >= 7 || seen.has(key) || blocked.some((cell) => cell.x === x && cell.y === y)) continue;
        seen.add(key); queue.push({ x, y, distance: at.distance + 1 });
      }
    }
    let moves = 0;
    while (agent.x !== agent.target.x || agent.y !== agent.target.y) {
      const next = physicalDetour(agent, blocked, 7, 7)!;
      expect(next).not.toBeNull();
      expect(Math.abs(next.x - agent.x) + Math.abs(next.y - agent.y)).toBe(1);
      expect(blocked).not.toContainEqual(next);
      Object.assign(agent, next);
      expect(++moves).toBeLessThan(50);
    }
    expect(moves).toBe(shortest);
  });

  it("replans when the target or wall changes, permits an exit from a new wall and rejects unreachable goals", () => {
    const agent = { ...guarded().agents[0], x: 2, y: 2, target: { x: 4, y: 2 } };
    expect(physicalDetour(agent, [{ x: 2, y: 2 }], 5, 5)).toEqual({ x: 3, y: 2 });
    Object.assign(agent, { x: 3, y: 2, target: { x: 3, y: 4 } });
    expect(physicalDetour(agent, [], 5, 5)).toEqual({ x: 3, y: 3 });
    Object.assign(agent, { x: 3, y: 3 });
    expect(physicalDetour(agent, [{ x: 3, y: 4 }], 5, 5)).toBeNull();
    const wall: Point[] = Array.from({ length: 5 }, (_, y) => ({ x: 2, y }));
    Object.assign(agent, { x: 1, y: 2, target: { x: 4, y: 2 } });
    expect(physicalDetour(agent, wall, 5, 5)).toBeNull();
  });

  it("does nothing before a physical closure, including in hazardous scenarios", () => {
    const base = { memory: { danger: false, success: true, candidate: false }, hazardsEnabled: true,
      environment: { changeAtStep: 520, blockedCells: [{ x: 10, y: 7 }] } };
    const a = stepSimulation(createControlledSimulation(42, DEFAULT_SCENARIO, base), 519);
    const b = stepSimulation(createControlledSimulation(42, DEFAULT_SCENARIO, { ...base, navigation: "physical-astar" }), 519);
    expect(b.agents).toEqual(a.agents);
    expect(b.metrics).toEqual(a.metrics);
    expect(b.success).toEqual(a.success);
  });
});
