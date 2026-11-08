import { describe, expect, it } from "vitest";
import { LivenessMonitor, repeatedCellLoop, auditMode } from "./modeLiveness";
import { createSimulation } from "../simulation/warehouse";

describe("mode liveness checks", () => {
  it("keeps the reproduced Candidate memory cases out of repeated-cell loops", () => {
    for (const seed of [5, 27]) {
      const result = auditMode("adaptive_candidate_lock", seed, "normal_shift");
      expect(result.loopAgents).toBe(0);
      expect(result.longGapAgents).toBe(0);
    }
  });
  it("requires 32 active samples in at most four cells", () => {
    const bounce = Array.from({ length: 32 }, (_, i) => ({ x: 8, y: 7 + i % 2 }));
    expect(repeatedCellLoop(bounce)).toBe(true);
    expect(repeatedCellLoop(bounce.slice(1))).toBe(false);
    expect(repeatedCellLoop(Array.from({ length: 32 }, (_, i) => ({ x: i % 8, y: 7 })))).toBe(false);
  });
  it("does not count repair pauses as active loop samples", () => {
    let current = createSimulation("baseline", 42);
    current.agents = [{ ...current.agents[0], x: 8, y: 7, lastDamageStep: 0 }];
    const monitor = new LivenessMonitor(current);
    for (let step = 1; step <= 34; step++) {
      const next = { ...current, step };
      monitor.observe(current, next);
      current = next;
    }
    expect(monitor.results()[0].repairTicks).toBe(3);
    expect(monitor.results()[0].loopEpisodes).toBe(0);
    monitor.observe(current, { ...current, step: 35 });
    expect(monitor.results()[0].loopEpisodes).toBe(1);
  });
  it("clears loop history on a new pickup leg", () => {
    let current = createSimulation("baseline", 42);
    current.agents = [{ ...current.agents[0], x: 8, y: 7 }];
    const monitor = new LivenessMonitor(current);
    for (let step = 1; step <= 31; step++) {
      const next = { ...current, step };
      monitor.observe(current, next); current = next;
    }
    const next = { ...current, step: 32, agents: [{ ...current.agents[0], carrying: "new", target: current.depot }] };
    monitor.observe(current, next);
    expect(monitor.results()[0].loopEpisodes).toBe(0);
  });
  it("rejects skipped observations and detects individual-agent service", () => {
    const state = createSimulation("baseline", 42);
    expect(() => new LivenessMonitor(state).observe(state, { ...state, step: 2 })).toThrow("consecutive");
    const audit = auditMode("baseline", 42, "normal_shift");
    expect(audit.agents.reduce((sum, agent) => sum + agent.deliveries, 0)).toBe(audit.metrics.delivered);
    expect(audit.deliveryWindows.reduce((sum, value) => sum + value, 0)).toBe(audit.metrics.delivered);
  });
});
