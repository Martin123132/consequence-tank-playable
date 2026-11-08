import { useEffect, useRef, useState } from "react";
import { BarChart3, Check, Copy, Link, Pause, Play, RotateCcw, Settings2, SkipForward, Warehouse } from "lucide-react";
import { WarehouseGrid } from "../components/WarehouseGrid";
import { Timeline } from "../components/Timeline";
import { SCENARIO_PRESETS } from "../simulation/scenarios";
import { MODES, type ModeName } from "../simulation/types";
import { DISRUPTION_STEP, MAX_STEPS, SHIFT_STEP, formatMetric } from "../simulation/warehouse";
import type { DisplaySettings } from "../appTypes";
import { LIMITATIONS, MODE_LABELS, PLAYGROUND_VERSION, advanceSession, parseSeedInput, parseSession, replaySession, scenarioLabel, sessionConfig, sessionHash, sessionReport, type SessionConfig } from "./session";

export function Playground() {
  const [session, setSession] = useState(() => replaySession(parseSession(window.location.hash)));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [view, setView] = useState<"simulation" | "results">("simulation");
  const [map, setMap] = useState<"selected" | "baseline">("selected");
  const [settings, setSettings] = useState<DisplaySettings>({ showFields: true, showRoutes: true, showShelves: true });
  const [copied, setCopied] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [seedDraft, setSeedDraft] = useState(() => String(session.selected.seed));
  const [seedError, setSeedError] = useState("");
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const shareRef = useRef<HTMLInputElement>(null);
  const { selected, baseline } = session;
  const completed = selected.step === MAX_STEPS;
  const config = sessionConfig(session);
  const report = JSON.stringify(sessionReport(session), null, 2);
  const state = map === "baseline" ? baseline : selected;

  useEffect(() => {
    if (!running || completed) return;
    const timer = window.setInterval(() => setSession((current) => advanceSession(current, speed * 2)), 90);
    return () => window.clearInterval(timer);
  }, [running, completed, speed]);
  useEffect(() => { if (completed) setRunning(false); }, [completed]);
  useEffect(() => { setSeedDraft(String(selected.seed)); setSeedError(""); }, [selected.seed]);
  useEffect(() => {
    const restore = () => { setRunning(false); setView("simulation"); setMap("selected"); setSession(replaySession(parseSession(window.location.hash))); setCopied(""); setShareLink(""); };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  useEffect(() => { setCopied(""); setShareLink(""); }, [selected.step, selected.mode, selected.seed, selected.scenario.id]);
  useEffect(() => {
    if (shareLink) { shareRef.current?.focus(); shareRef.current?.select(); }
  }, [shareLink]);

  function replay(changes: Partial<SessionConfig>) {
    setRunning(false);
    setSession(replaySession({ ...config, ...changes }));
  }
  function commitSeed() {
    const seed = parseSeedInput(seedDraft);
    setSeedDraft(String(seed ?? selected.seed));
    if (seed === null) {
      setSeedError(`Seed must be a whole number from 1 to 9999. Kept seed ${selected.seed}.`);
      return;
    }
    setSeedError("");
    if (seed !== selected.seed) replay({ seed, step: 0 });
  }
  function toggleRun() {
    if (completed) setSession(replaySession({ ...config, step: 0 }));
    setRunning((current) => !current);
  }
  function changeView(next: typeof view) { setRunning(false); setView(next); }
  async function copyReport() {
    try { await navigator.clipboard.writeText(report); setCopied("Result copied"); }
    catch { summaryRef.current?.focus(); summaryRef.current?.select(); setCopied("Result selected"); }
  }
  async function share() {
    setRunning(false);
    // Share only public replay parameters, never the current URL's query string.
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = sessionHash(config);
    setShareLink(url.href);
    try { await navigator.clipboard.writeText(url.href); setCopied("Replay link copied"); }
    catch { setCopied("Replay link selected"); }
  }

  return <div className="playground">
    <header className="play-header">
      <div className="brand"><Warehouse size={25} aria-hidden="true" /><div><h1>Consequence Tank</h1><span>TWO HANDS NETWORK LTD</span></div></div>
      <nav className="segment" aria-label="Workspace">
        <button aria-pressed={view === "simulation"} onClick={() => changeView("simulation")}><Warehouse size={16} />Simulation</button>
        <button aria-pressed={view === "results"} onClick={() => changeView("results")}><BarChart3 size={16} />Results</button>
      </nav>
      <span className="preview-label">Playable preview</span>
      <button className="icon-button" title="Copy replay link" aria-label="Copy replay link" onClick={() => void share()}><Link size={18} /></button>
    </header>
    <div className="play-controls">
      <div className="transport">
        <button className="primary-button" onClick={toggleRun} aria-label={running ? "Pause" : completed ? "Replay" : "Run"}>{running ? <Pause size={17} /> : <Play size={17} />}{running ? "Pause" : completed ? "Replay" : "Run"}</button>
        <button className="icon-button" title="Reset run" aria-label="Reset run" onClick={() => replay({ step: 0 })}><RotateCcw size={17} /></button>
      </div>
      <label>Mode<select value={selected.mode} onChange={(e) => replay({ mode: e.target.value as ModeName })}>{MODES.map((mode) => <option value={mode} key={mode}>{MODE_LABELS[mode]}</option>)}</select></label>
      <label>Scenario<select value={selected.scenario.id} onChange={(e) => replay({ scenario: e.target.value as SessionConfig["scenario"], step: 0 })}>{SCENARIO_PRESETS.map((item) => <option key={item.id} value={item.id}>{scenarioLabel(item.id)}</option>)}</select></label>
      <label>Seed<input aria-label="Seed" aria-describedby={seedError ? "seed-error" : undefined} type="number" inputMode="numeric" min="1" max="9999" step="1" value={seedDraft} onChange={(e) => { setRunning(false); setSeedDraft(e.target.value); setSeedError(""); }} onBlur={commitSeed} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
      <label>Speed<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{[1, 2, 4].map((value) => <option key={value} value={value}>{value}x</option>)}</select></label>
    </div>
    {seedError && <p id="seed-error" className="seed-error" role="alert">{seedError}</p>}
    <div className="play-status"><span>Synthetic simulation <b aria-hidden="true">/</b> Unequal mode costs</span><output data-testid="step" aria-live="off">Step {selected.step} / {MAX_STEPS} · {completed ? "Complete" : running ? "Running" : "Paused"}</output></div>
    {shareLink && <div className="share-row"><label htmlFor="replay-link">Replay link</label><input id="replay-link" ref={shareRef} readOnly value={shareLink} /></div>}
    <main className={view === "simulation" ? "play-workspace" : "play-results"}>
      {view === "simulation" && <section className="play-stage" aria-label="Warehouse simulation">
        <div className="map-toolbar">
          <div className="segment" aria-label="Map view"><button aria-pressed={map === "selected"} onClick={() => setMap("selected")}>Selected</button><button aria-pressed={map === "baseline"} onClick={() => setMap("baseline")}>Baseline</button></div>
          <details className="display-options"><summary><Settings2 size={16} /> Display</summary><div>{([ ["showFields", "Memory fields"], ["showRoutes", "Route trails"], ["showShelves", "Visual shelves"] ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} />{label}</label>)}</div></details>
        </div>
        <WarehouseGrid state={state} activeAgentId={state.agents[0].id} displaySettings={settings} />
        <div className="play-legend"><span><i className="agent-key" />Agents</span><span><i className="package-key" />Packages</span><span><i className="danger-key" />Danger</span><span><i className="success-key" />Success memory</span><span><i className="candidate-key" />Candidate memory</span></div>
        <div className="event-controls" aria-label="Replay milestones">
          <button onClick={() => replay({ step: DISRUPTION_STEP })}><SkipForward size={15} />Disruption <small>220</small></button>
          <button onClick={() => replay({ step: SHIFT_STEP })}><SkipForward size={15} />Gate shift <small>520</small></button>
          <button onClick={() => replay({ step: MAX_STEPS })}><Check size={15} />Finish <small>900</small></button>
        </div>
        <Timeline selectedState={selected} baselineState={baseline} onSeek={(step) => replay({ step })} />
      </section>}
      <aside className="play-comparison" aria-label="Results comparison">
        <h2>{completed ? "Completed run" : "Current run"}</h2>
        <p className="result-context">{MODE_LABELS[selected.mode]}<br />Seed {selected.seed} · {scenarioLabel(selected.scenario.id)}</p>
        <table><caption>Baseline vs selected · step {selected.step}</caption><thead><tr><th>Metric</th><th>Base</th><th>Selected</th></tr></thead><tbody>
          {([ ["Deliveries", "delivered"], ["Damage", "damage"], ["Fault hits", "faultHits"], ["Post-shift deliveries", "postDelivered"], ["Post-shift damage", "postDamage"], ["Energy spent", "energySpent"] ] as const).map(([label, key]) => <tr key={key}><th>{label}</th><td>{formatMetric(baseline.metrics[key], 1)}</td><td>{formatMetric(selected.metrics[key], 1)}</td></tr>)}
          <tr><th>Energy / delivery</th><td>{baseline.metrics.delivered ? formatMetric(baseline.metrics.energySpent / baseline.metrics.delivered, 1) : "N/A"}</td><td>{selected.metrics.delivered ? formatMetric(selected.metrics.energySpent / selected.metrics.delivered, 1) : "N/A"}</td></tr>
        </tbody></table>
        <span className="unit-note">Simulation units, not kWh or real-world costs.</span>
        {selected.recoveryMetrics && <p className="recovery-note">Loop recoveries: <strong>{selected.recoveryMetrics.episodes}</strong> · {selected.recoveryMetrics.activeSteps} active steps. Recovery can increase damage.</p>}
        <details className="model-notes"><summary>Model assumptions</summary><ul>{LIMITATIONS.map((text) => <li key={text}>{text}</li>)}</ul></details>
        {view === "simulation" && <button className="result-button" onClick={() => changeView("results")}><BarChart3 size={16} />Review result</button>}
      </aside>
      {view === "results" && <section className="result-json"><div className="result-heading"><h2>Reproducible snapshot</h2><button onClick={() => void copyReport()}><Copy size={16} />Copy result</button></div><textarea ref={summaryRef} aria-label="Result JSON" readOnly value={report} spellCheck={false} /><button onClick={() => { replay({ step: MAX_STEPS }); }} disabled={completed}><Check size={16} />Complete run</button></section>}
    </main>
    <footer className="play-footer"><span>Consequence Tank {PLAYGROUND_VERSION}</span><a href="./LICENSE.txt">Licence</a><a href="./COMMERCIAL-LICENSE.txt">Commercial use</a><a href="./NOTICE.txt">Attribution</a><a href="./THIRD-PARTY-NOTICES.txt">Dependencies</a><a href="mailto:glyn@twohandsnetwork.co.uk">Contact Glyn</a><span role="status">{copied || "Session only · No telemetry"}</span></footer>
  </div>;
}
