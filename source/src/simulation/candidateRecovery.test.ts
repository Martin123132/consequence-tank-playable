import { describe, expect, it } from "vitest";
import { cloneForReset, createRecoveringCandidateSimulation, createSimulation, stepSimulation } from "./warehouse";
import { SCENARIO_PRESETS } from "./scenarios";

function loopState(wide = false) {
  const state = createRecoveringCandidateSimulation(5, SCENARIO_PRESETS[wide ? 1 : 0]);
  state.step = 250;
  state.agents = [{ ...state.agents[0], x: 8, y: 7, carrying: "test", target: { ...state.depot }, path: Array.from({length:16}, (_, i) => ({x:7 + i % 2, y:7})) }];
  state.danger[7][9] = 1;
  return state;
}

describe("public Candidate memory loop recovery", () => {
  it("uses the same local next step with different unseen hazard maps", () => {
    const first = stepSimulation(loopState());
    const wider = stepSimulation(loopState(true));
    expect([first.agents[0].x, first.agents[0].y]).toEqual([wider.agents[0].x, wider.agents[0].y]);
    expect(first.recoveryMetrics).toEqual({ episodes: 1, activeSteps: 1 });
    expect(first.agents[0].recoverySteps).toBe(7);
    expect(first.metrics.energySpent).toBeGreaterThan(0);
  });
  it("never teleports and charges the normal fault/repair costs", () => {
    let state = loopState(true);
    let repairTicks = 0;
    for (let i = 0; i < 100; i++) {
      const previous = state;
      state = stepSimulation(state);
      const before = previous.agents[0];
      const after = state.agents[0];
      expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
      const sinceDamage = state.step - before.lastDamageStep;
      if (sinceDamage > 0 && sinceDamage <= 3) {
        repairTicks++;
        expect(after.recoverySteps).toBe(before.recoverySteps);
      }
    }
    expect(repairTicks).toBeGreaterThan(0);
    expect(state.metrics.damage).toBeCloseTo(state.metrics.faultHits * 2 * state.scenario.damageMultiplier);
    expect(state.metrics.delivered).toBeGreaterThan(0);
  });
  it("leaves legacy policies alone and preserves the new option on reset", () => {
    const legacy = createSimulation("adaptive_candidate_lock", 5);
    expect(legacy.localRecovery).toBeUndefined();
    const initial = createRecoveringCandidateSimulation(5);
    const complete = stepSimulation(initial, 900);
    const reset = cloneForReset(complete);
    expect(reset.recoveryMetrics).toEqual({ episodes: 0, activeSteps: 0 });
    const replay = stepSimulation(reset, 900);
    expect(replay.metrics).toEqual(complete.metrics);
    expect(replay.recoveryMetrics).toEqual(complete.recoveryMetrics);
  });
});
