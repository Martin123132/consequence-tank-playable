import { describe, expect, it } from "vitest";
import { createControlledSimulation, stepSimulation } from "../simulation/warehouse";
import { DEFAULT_SCENARIO } from "../simulation/scenarios";
import {
  advanceChallenge, challengeHash, challengeLink, challengeReport, createChallenge,
  DEFAULT_CHALLENGE, GATE_ROWS, gatePhase, parseChallenge,
} from "./session";

describe("versioned gate challenge replays", () => {
  it("round-trips every setting and current step, including boundary inputs", () => {
    expect(parseChallenge("")).toEqual(DEFAULT_CHALLENGE);
    for (const seed of [1, 42, 9999]) for (const change of [260, 520, 800]) for (const step of [0, change - 1, change, 900]) {
      const config = { seed, change, step };
      expect(parseChallenge(`#${challengeHash(config)}`)).toEqual(config);
    }
  });
  it("rejects unsupported, missing, duplicate and malformed parameters", () => {
    for (const hash of ["#seed=42", "#challenge=gate-v2&seed=42&change=520&step=0", "#challenge=gate-v1&seed=42&change=520",
      "#challenge=gate-v1&seed=42&change=520&step=0&seed=42", "#challenge=gate-v1&challenge=gate-v1&seed=42&change=520&step=0"]) {
      expect(() => parseChallenge(hash)).toThrow();
    }
    for (const value of ["-1", "1.2", "1e3", "NaN", "", "9999999999999999999999"]) {
      expect(() => parseChallenge(`#challenge=gate-v1&seed=${value}&change=520&step=0`)).toThrow();
    }
    for (const config of [{ seed: 0 }, { seed: 10000 }, { change: 259 }, { change: 801 }, { step: -1 }, { step: 901 }]) {
      expect(() => createChallenge({ ...DEFAULT_CHALLENGE, ...config })).toThrow();
    }
  });
  it("drops unrelated URL query, credentials and hash fields but retains nested hosting paths", () => {
    const link = challengeLink(DEFAULT_CHALLENGE, "https://user:pass@example.test/tank/challenge/?secret=value#private=thing");
    expect(link).toBe(`https://example.test/tank/challenge/#${challengeHash(DEFAULT_CHALLENGE)}`);
    expect(parseChallenge(new URL(link).hash)).toEqual(DEFAULT_CHALLENGE);
  });
  it("reproduces synchronized playback, scrubbing and completion exactly", () => {
    const config = { seed: 73, change: 333, step: 0 };
    let played = createChallenge(config);
    for (let i = 0; i < 150; i++) played = advanceChallenge(played, 6);
    const replay = createChallenge(parseChallenge(challengeHash(played.config)));
    expect(JSON.stringify(played)).toBe(JSON.stringify(replay));
    expect(played.direct.step).toBe(900);
    expect(played.memory.step).toBe(900);
    expect(advanceChallenge(played, 8).config.step).toBe(900);
    expect(() => advanceChallenge(played, NaN)).toThrow();
  });
  it("does not mutate either previous state, including fields or RNG, when React repeats an updater", () => {
    const session = createChallenge({ ...DEFAULT_CHALLENGE, step: 550 });
    const before = JSON.stringify(session);
    const first = advanceChallenge(session, 8);
    expect(JSON.stringify(session)).toBe(before);
    const repeated = advanceChallenge(session, 8);
    expect(JSON.stringify(first)).toBe(JSON.stringify(repeated));
    expect(session.direct.success).not.toBe(session.memory.success);
    expect(first.memory.success).not.toBe(session.memory.success);
  });
});

describe("matched policy conditions", () => {
  it("does not expose a future change time through either policy's behaviour", () => {
    const early = createChallenge({ seed: 88, change: 260, step: 259 });
    const late = createChallenge({ seed: 88, change: 800, step: 259 });
    for (const key of ["direct", "memory"] as const) {
      expect(early[key].agents).toEqual(late[key].agents);
      expect(early[key].metrics).toEqual(late[key].metrics);
      expect(early[key].success).toEqual(late[key].success);
    }
  });
  it("charges the same hit and three repair steps to both policies", () => {
    const session = createChallenge(DEFAULT_CHALLENGE);
    for (let state of [session.direct, session.memory]) {
      state.step = 219;
      state.agents = [state.agents[0]];
      state.depot = { x: 18, y: 5 };
      Object.assign(state.agents[0], { x: 8, y: 5, carrying: "test", target: { x: 18, y: 5 } });
      state = stepSimulation(state);
      expect(state.metrics.damage).toBe(2);
      expect(state.metrics.energySpent).toBe(0.92);
      const repaired = stepSimulation(state, 3);
      expect(repaired.agents[0].x).toBe(9);
      expect(repaired.experimentMetrics!.repairTicks).toBe(3);
      expect(repaired.metrics.energySpent).toBe(0.92);
      expect(stepSimulation(repaired).agents[0].x).toBe(10);
    }
  });
  it("freezes the gate-v1 default result so rule changes require deliberate review", () => {
    expect(challengeReport(createChallenge({ ...DEFAULT_CHALLENGE, step: 900 }))).toMatchSnapshot();
  });
  it("differs only in success memory, with identical initial agents and costs", () => {
    const session = createChallenge(DEFAULT_CHALLENGE);
    expect(session.direct.agents).toEqual(session.memory.agents);
    expect(session.direct.packages).toEqual(session.memory.packages);
    const { memory: a, ...left } = session.direct.experiment!;
    const { memory: b, ...right } = session.memory.experiment!;
    expect(left).toEqual(right);
    expect(a).toEqual({ danger: false, candidate: false, success: false });
    expect(b).toEqual({ danger: false, candidate: false, success: true });
    expect(left.randomness).toBe("paired-v1");
    for (const state of [session.direct, session.memory]) {
      expect(state.oracleNavigation).toBeUndefined();
      expect(state.experiment?.navigation).toBeUndefined();
      expect(state.localRecovery).toBeUndefined();
    }
  });
  it("keeps task assignments independent of timing, other agents and global RNG consumption", () => {
    let a = createChallenge(DEFAULT_CHALLENGE).direct;
    let b = createChallenge(DEFAULT_CHALLENGE).memory;
    for (let task = 0; task < 12; task++) {
      for (const [state, step] of [[a, 10], [b, 100]] as const) {
        state.step = step;
        Object.assign(state.agents[0], { x: 17, y: 7, target: state.depot, carrying: "test", lastDamageStep: -999 });
      }
      for (let i = 0; i < 300; i++) b.rng.next();
      b.agents = b.agents.slice(0, 1);
      a = stepSimulation(a);
      b = stepSimulation(b);
      expect(a.agents[0].carrying).toBeNull();
      expect(b.agents[0].carrying).toBeNull();
      expect(a.agents[0].target).toEqual(b.agents[0].target);
      expect(a.agents[0].taskAssignments).toBe(task + 1);
      expect(b.agents[0].taskAssignments).toBe(task + 1);
    }
  });
  it("produces identical results for identical-policy negative controls", () => {
    const args = { memory: { danger: false, success: false, candidate: false }, hazardsEnabled: true, randomness: "paired-v1" as const,
      environment: { changeAtStep: 417, openGateRows: GATE_ROWS } };
    const a = stepSimulation(createControlledSimulation(101, DEFAULT_SCENARIO, args), 900);
    let b = createControlledSimulation(101, DEFAULT_SCENARIO, args);
    for (let i = 0; i < 900; i++) b = stepSimulation(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("accounts for equal per-event movement, damage and repair rules over multiple seeds", () => {
    for (const seed of [1, 5, 42, 99, 9999]) {
      const session = createChallenge({ seed, change: 407, step: 900 });
      for (const state of [session.direct, session.memory]) {
        expect(state.metrics.damage).toBe(state.metrics.faultHits * 2);
        expect(state.metrics.energySpent).toBeCloseTo(state.experimentMetrics!.movementAttempts * 0.92, 7);
        expect(state.experimentMetrics!.movementAttempts + state.experimentMetrics!.repairTicks).toBe(7 * 900);
        expect(state.experimentMetrics!.learnedDangerSurcharge).toBe(0);
        expect(state.agents.every(agent => agent.x >= 0 && agent.x < 20 && agent.y >= 0 && agent.y < 16)).toBe(true);
      }
    }
  });
});

describe("gate timing and post-change metrics", () => {
  it.each([260, 520, 800])("changes the actual gate and metric boundary at step %i", change => {
    const before = createChallenge({ seed: 42, change, step: change - 1 });
    const at = advanceChallenge(before, 1);
    expect(before.direct.faultMap[7][9]).toBe(false);
    expect(before.direct.faultMap[3][9]).toBe(true);
    expect(at.direct.faultMap[7][9]).toBe(true);
    expect(at.direct.faultMap[3][9]).toBe(false);
    expect(at.direct.faultMap).toEqual(at.memory.faultMap);
    expect(gatePhase(before.config)).toBe("Centre + south safe");
    expect(gatePhase(at.config)).toBe("North + south safe");
    const final = createChallenge({ seed: 42, change, step: 900 });
    for (const key of ["direct", "memory"] as const) {
      expect(before[key].metrics.postDelivered).toBe(0);
      expect(before[key].metrics.postDamage).toBe(0);
      expect(before[key].metrics.firstPostShiftDeliveryStep).toBeNull();
      expect(final[key].metrics.postDelivered).toBe(final[key].metrics.delivered - before[key].metrics.delivered);
      expect(final[key].metrics.postDamage).toBe(final[key].metrics.damage - before[key].metrics.damage);
      expect(final[key].metrics.firstPostShiftDeliveryStep).toBeGreaterThanOrEqual(change);
    }
  });
  it("does not use the old 520 gate or reporting boundary for a later change", () => {
    const session = createChallenge({ seed: 42, change: 800, step: 650 });
    expect(session.memory.faultMap[7][9]).toBe(false);
    expect(challengeReport(session).memory.postChangeDeliveries).toBe(0);
    expect(challengeReport(session).memory.firstPostChangeDeliveryStep).toBeNull();
  });
});
