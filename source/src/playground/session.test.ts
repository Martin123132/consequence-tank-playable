import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Timeline } from "../components/Timeline";
import { DEFAULT_SESSION, advanceSession, parseSeedInput, parseSession, replaySession, scenarioLabel, sessionConfig, sessionHash, sessionReport } from "./session";

describe("public playground sessions", () => {
  it("validates complete seed input without coercing blanks or scientific notation", () => {
    for (const input of ["", " ", "0", "10000", "1.5", "-5", "1e2", "Infinity", "abc"]) expect(parseSeedInput(input)).toBeNull();
    expect(parseSeedInput("1")).toBe(1);
    expect(parseSeedInput("9999")).toBe(9999);
    expect(parseSeedInput("0042")).toBe(42);
  });
  it("uses one public scenario label without claiming traffic physics", () => {
    expect(scenarioLabel("high_traffic")).toBe("More agents");
    expect(scenarioLabel("normal_shift")).toBe("Normal shift");
  });
  it("retains Candidate recovery and its caveat in copied results", () => {
    const report = sessionReport(replaySession({ ...DEFAULT_SESSION, mode: "adaptive_candidate_lock", seed: 5, step: 900 }));
    expect(report.localRecoveryPolicy).toBe("visit-penalty-v1");
    expect(report.localRecovery).toEqual({ episodes: 1, activeSteps: 8 });
    expect(report.limitations.join(" ")).toContain("Recovery can increase damage");
  });
  it("keeps Oracle delivering through the previously stalled middle shift", () => {
    const session = replaySession({ ...DEFAULT_SESSION, mode: "oracle", step: 320 });
    const later = advanceSession(session, 100);
    expect(later.selected.metrics.delivered).toBeGreaterThan(session.selected.metrics.delivered);
  });
  it("bounds untrusted shared-link values", () => {
    expect(parseSession("#seed=Infinity&step=999999999&mode=unknown&scenario=unknown")).toEqual(DEFAULT_SESSION);
    expect(parseSession("#seed=-1&step=NaN")).toEqual(DEFAULT_SESSION);
    expect(parseSession("#seed=4.4&step=-20")).toEqual(DEFAULT_SESSION);
  });
  it("round trips a complete replay without unrelated URL values", () => {
    const config = { ...DEFAULT_SESSION, seed: 9000, step: 520, scenario: "heavy_fault_band" as const };
    expect(parseSession(`#${sessionHash(config)}&token=not-retained`)).toEqual(config);
    expect(sessionHash(parseSession(`#${sessionHash(config)}&token=not-retained`))).not.toContain("token");
  });
  it("replaying matches advancing both modes with the same seed and scenario", () => {
    const config = { ...DEFAULT_SESSION, scenario: "sparse_packages" as const };
    const advanced = advanceSession(replaySession(config), 520);
    const replayed = replaySession({ ...config, step: 520 });
    expect(advanced.selected.metrics).toEqual(replayed.selected.metrics);
    expect(advanced.baseline.metrics).toEqual(replayed.baseline.metrics);
    expect(sessionConfig(advanced)).toEqual({ ...config, step: 520 });
  });
  it("stops both simulations at the end and exports only a bounded summary", () => {
    const session = advanceSession(replaySession({ ...DEFAULT_SESSION, step: 898 }), 8);
    expect(session.selected.step).toBe(900);
    expect(session.baseline.step).toBe(900);
    const report = sessionReport(session);
    expect(report.completed).toBe(true);
    expect(report.limitations).toHaveLength(4);
    expect(report).not.toHaveProperty("agents");
    expect(report).not.toHaveProperty("path");
  });
  it("baseline versus itself is equal across every metric", () => {
    const session = replaySession({ ...DEFAULT_SESSION, mode: "baseline", step: 900 });
    expect(session.selected.metrics).toEqual(session.baseline.metrics);
  });
  it("uses a shared damage scale for the overlaid comparison", () => {
    const session = replaySession(DEFAULT_SESSION);
    session.selected.history = [{ step: 900, damage: 5, delivered: 1, faultHits: 1, energyPerDelivery: 1 }];
    session.baseline.history = [{ step: 900, damage: 10, delivered: 1, faultHits: 1, energyPerDelivery: 1 }];
    const html = renderToStaticMarkup(createElement(Timeline, { selectedState: session.selected, baselineState: session.baseline, onSeek: () => {} }));
    expect(html).toContain('points="860,78"');
    expect(html).toContain('points="860,90"');
  });
});
