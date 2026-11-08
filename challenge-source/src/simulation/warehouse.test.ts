import { describe, expect, it } from "vitest";
import { createSimulation, runToEnd, runToStep, stepSimulation } from "./warehouse";

describe("warehouse simulation", () => {
  it("is deterministic for the same seed and mode", () => {
    const first = runToEnd("adaptive_candidate_efficient", 42, 650);
    const second = runToEnd("adaptive_candidate_efficient", 42, 650);

    expect(second).toEqual(first);
  });

  it("lets consequence mode reduce harm versus baseline in the default scenario", () => {
    const baseline = runToEnd("baseline", 42, 900);
    const efficient = runToEnd("adaptive_candidate_efficient", 42, 900);

    expect(efficient.damage).toBeLessThan(baseline.damage);
    expect(efficient.faultHits).toBeLessThan(baseline.faultHits);
  });

  it("keeps the efficient candidate mode ahead on completed-run throughput", () => {
    const baseline = runToEnd("baseline", 42, 900);
    const efficient = runToEnd("adaptive_candidate_efficient", 42, 900);

    expect(efficient.delivered).toBeGreaterThan(baseline.delivered);
    expect(efficient.postDelivered).toBeGreaterThan(baseline.postDelivered);
  });

  it("can seek by replaying to the requested step", () => {
    const replayed = runToStep("adaptive_candidate_efficient", 42, 432);
    const stepped = stepSimulation(createSimulation("adaptive_candidate_efficient", 42), 432);

    expect(replayed.step).toBe(432);
    expect(replayed.metrics).toEqual(stepped.metrics);
  });
});
