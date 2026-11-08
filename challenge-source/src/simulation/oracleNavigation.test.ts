import { describe, expect, it } from "vitest";
import { SCENARIO_PRESETS } from "./scenarios";
import { cloneForReset, createPlannedOracleSimulation, createSimulation, stepSimulation } from "./warehouse";

describe("planned public Oracle", () => {
  it("takes a longer safe route when the direct route is hazardous", () => {
    let state = createPlannedOracleSimulation(42);
    state.step = 220;
    state.agents = [{ ...state.agents[0], x: 8, y: 7, carrying: "test", target: state.depot }];
    let movedAway = false;
    for (let i = 0; i < 60 && !state.metrics.delivered; i++) {
      const before = state.agents[0];
      state = stepSimulation(state);
      const after = state.agents[0];
      expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
      expect(state.faultMap[after.y][after.x]).toBe(false);
      movedAway ||= Math.abs(after.y - state.depot.y) > 0;
    }
    expect(movedAway).toBe(true);
    expect(state.metrics.delivered).toBe(1);
    expect(state.metrics.faultHits).toBe(0);
  });

  it("invalidates the cached route when the gate changes", () => {
    let state = createPlannedOracleSimulation(42);
    state.step = 518;
    state.agents = [{ ...state.agents[0], x: 8, y: 3, carrying: "test", target: state.depot }];
    state = stepSimulation(state);
    const oldRoute = state.agents[0].detour?.key;
    state = stepSimulation(state);
    expect(state.agents[0].detour?.key).not.toBe(oldRoute);
    state = stepSimulation(state, 80);
    expect(state.metrics.delivered).toBeGreaterThan(0);
  });

  it("escapes a gate closing around it without teleporting or damage immunity", () => {
    let state = createPlannedOracleSimulation(42);
    state.step = 519;
    state.agents = [{ ...state.agents[0], x: 10, y: 3, carrying: "test", target: state.depot }];
    for (let i = 0; i < 80 && !state.metrics.delivered; i++) {
      const before = state.agents[0];
      state = stepSimulation(state);
      const after = state.agents[0];
      expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    }
    expect(state.metrics.faultHits).toBeGreaterThan(0);
    expect(state.metrics.damage).toBe(state.metrics.faultHits * 2);
    expect(state.metrics.delivered).toBe(1);
  });

  it("waits on a safe cell if the target is completely cut off", () => {
    const scenario = { ...SCENARIO_PRESETS[0], faultBandStart: 0, faultBandEnd: 19 };
    let state = createPlannedOracleSimulation(42, scenario);
    state.step = 220;
    state.agents = [{ ...state.agents[0], x: 8, y: 3, carrying: "test", target: state.depot }];
    state = stepSimulation(state, 10);
    expect([state.agents[0].x, state.agents[0].y]).toEqual([8, 3]);
    expect(state.metrics.faultHits).toBe(0);
  });

  it("preserves the planner through reset and replays deterministically", () => {
    const initial = createPlannedOracleSimulation(42);
    const first = stepSimulation(initial, 900);
    const reset = cloneForReset(first);
    expect(reset.oracleNavigation).toBe("hazard-astar-v1");
    expect(stepSimulation(reset, 900).metrics).toEqual(first.metrics);
    expect(createSimulation("oracle", 42).oracleNavigation).toBeUndefined();
  });

  it("keeps every agent completing trips across all presets and fixed seeds", () => {
    for (const scenario of SCENARIO_PRESETS) for (const seed of [1, 7, 42, 73, 99]) {
      let state = createPlannedOracleSimulation(seed, scenario);
      const lastDelivery = new Map(state.agents.map(agent => [agent.id, 0]));
      for (let step = 1; step <= 900; step++) {
        const previous = state;
        state = stepSimulation(state);
        for (const [index, agent] of state.agents.entries()) {
          if (previous.agents[index].carrying && !agent.carrying) lastDelivery.set(agent.id, step);
          expect(step - lastDelivery.get(agent.id)!, `${scenario.id}/${seed} agent ${agent.id}`).toBeLessThan(120);
        }
      }
      expect(state.metrics.postDelivered).toBeGreaterThan(0);
    }
  });
});
