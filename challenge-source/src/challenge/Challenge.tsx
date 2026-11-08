import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link, Pause, Play, RotateCcw, SkipBack, SkipForward, Warehouse } from "lucide-react";
import { WarehouseGrid } from "../components/WarehouseGrid";
import { DISRUPTION_STEP, formatMetric, MAX_STEPS } from "../simulation/warehouse";
import {
  advanceChallenge, CHALLENGE_LIMITS, CHALLENGE_VERSION, challengeLink, challengeReport,
  createChallenge, DEFAULT_CHALLENGE, gatePhase, MATCHED_RULES, MAX_CHANGE_STEP,
  MIN_CHANGE_STEP, parseChallenge, type ChallengeConfig,
} from "./session";

function restore() {
  try { return { session: createChallenge(parseChallenge(window.location.hash)), error: "" }; }
  catch (error) { return { session: createChallenge(DEFAULT_CHALLENGE), error: `Replay not loaded. ${String((error as Error).message)} Default setup shown.` }; }
}

export function Challenge() {
  const [loaded, setLoaded] = useState(restore);
  const { session, error: replayError } = loaded;
  const { config, direct, memory } = session;
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [seedDraft, setSeedDraft] = useState(String(config.seed));
  const [changeDraft, setChangeDraft] = useState(String(config.change));
  const [inputError, setInputError] = useState("");
  const [fields, setFields] = useState(true);
  const [routes, setRoutes] = useState(true);
  const [copied, setCopied] = useState("");
  const [link, setLink] = useState("");
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLTextAreaElement>(null);
  const finished = config.step === MAX_STEPS;
  const report = challengeReport(session);
  const json = JSON.stringify(report, null, 2);

  useEffect(() => {
    if (!running || finished) return;
    const timer = window.setInterval(() => setLoaded(current => ({ ...current, session: advanceChallenge(current.session, speed * 2) })), 90);
    return () => window.clearInterval(timer);
  }, [running, finished, speed]);
  useEffect(() => { if (finished) setRunning(false); }, [finished]);
  useEffect(() => {
    const onHashChange = () => {
      const next = restore();
      setRunning(false); setLoaded(next); setInputError(""); setCopied(""); setLink("");
      setSeedDraft(String(next.session.config.seed)); setChangeDraft(String(next.session.config.change));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => { setSeedDraft(String(config.seed)); setChangeDraft(String(config.change)); }, [config.seed, config.change]);
  useEffect(() => { setCopied(""); setLink(""); }, [config.seed, config.change, config.step]);
  useEffect(() => { if (link) { linkRef.current?.focus(); linkRef.current?.select(); } }, [link]);
  useEffect(() => { if (snapshotOpen && copied === "Result selected") { resultRef.current?.focus(); resultRef.current?.select(); } }, [snapshotOpen, copied]);

  function replay(changes: Partial<ChallengeConfig>) {
    setRunning(false);
    setInputError("");
    setLoaded({ session: createChallenge({ ...config, ...changes }), error: "" });
  }
  function commitInput(key: "seed" | "change", value: string) {
    const number = /^\d+$/.test(value) ? Number(value) : NaN;
    const min = key === "seed" ? 1 : MIN_CHANGE_STEP;
    const max = key === "seed" ? 9999 : MAX_CHANGE_STEP;
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      setInputError(`${key === "seed" ? "Seed" : "Gate change"} must be a whole number from ${min} to ${max}. Previous value kept.`);
      setSeedDraft(String(config.seed)); setChangeDraft(String(config.change));
      return;
    }
    setInputError("");
    if (number !== config[key]) replay({ [key]: number, step: 0 });
  }
  async function share() {
    setRunning(false);
    const url = challengeLink(config, window.location.href);
    setLink(url);
    try { await navigator.clipboard.writeText(url); setCopied("Replay link copied"); }
    catch { setCopied("Replay link selected"); }
  }
  async function copyResult() {
    setRunning(false);
    try { await navigator.clipboard.writeText(json); setCopied("Result copied"); }
    catch { setSnapshotOpen(true); setCopied("Result selected"); }
  }
  const display = { showFields: fields, showRoutes: routes, showShelves: true };
  const columns = [report.direct, report.memory];

  return <div className="playground challenge-app">
    <header className="play-header">
      <div className="brand"><Warehouse size={25} aria-hidden="true" /><div><h1>Consequence Tank</h1><span>TWO HANDS NETWORK LTD</span></div></div>
      <span className="challenge-tag">Gate-change challenge</span>
      <button className="icon-button" title="Copy replay link" aria-label="Copy replay link" disabled={!!replayError} onClick={() => void share()}><Link size={18} /></button>
    </header>
    <div className="challenge-controls">
      <div className="transport">
        <button className="primary-button" disabled={!!replayError} onClick={() => {
          if (finished) setLoaded({ session: createChallenge({ ...config, step: 0 }), error: "" });
          setRunning(value => !value);
        }} aria-label={running ? "Pause" : finished ? "Replay" : "Run"}>{running ? <Pause size={17} /> : <Play size={17} />}{running ? "Pause" : finished ? "Replay" : "Run"}</button>
        <button className="icon-button" title="Reset challenge" aria-label="Reset challenge" onClick={() => replay({ step: 0 })}><RotateCcw size={17} /></button>
      </div>
      <label className="seed-control">Seed<input aria-label="Seed" type="number" inputMode="numeric" min={1} max={9999} step={1} value={seedDraft}
        onChange={e => { setRunning(false); setSeedDraft(e.target.value); setInputError(""); }} onBlur={() => commitInput("seed", seedDraft)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
      <label>Speed<select aria-label="Speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[1, 2, 4].map(value => <option key={value} value={value}>{value}x</option>)}</select></label>
      <div className="change-control">
        <label htmlFor="gate-step">Gate changes at step</label>
        <input id="gate-step" aria-label="Gate change step" type="number" inputMode="numeric" min={MIN_CHANGE_STEP} max={MAX_CHANGE_STEP} step={1} value={changeDraft}
          onChange={e => { setRunning(false); setChangeDraft(e.target.value); setInputError(""); }} onBlur={() => commitInput("change", changeDraft)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        <input type="range" aria-label="Gate change timing" min={MIN_CHANGE_STEP} max={MAX_CHANGE_STEP} step={1} value={config.change} onChange={e => replay({ change: Number(e.target.value), step: 0 })} />
      </div>
    </div>
    {(inputError || replayError) && <p className="seed-error" role="alert">{inputError || replayError}</p>}
    <div className="play-status"><span>Matched costs and observations <b>/</b> {gatePhase(config)}</span><output data-testid="step" aria-live="off">Step {config.step} / {MAX_STEPS} · {finished ? "Complete" : running ? "Running" : "Paused"}</output></div>
    {link && <div className="share-row"><label htmlFor="challenge-link">Replay link</label><input id="challenge-link" ref={linkRef} readOnly value={link} /></div>}
    <main className="challenge-main">
      <section className="challenge-timeline" aria-label="Shared timeline">
        <div className="timeline-actions">
          <h2>Gate change <span>{config.change}</span></h2>
          <button onClick={() => replay({ step: config.change - 1 })}><SkipBack size={15} />Before change</button>
          <button onClick={() => replay({ step: config.change })}><SkipForward size={15} />At change</button>
          <button onClick={() => replay({ step: MAX_STEPS })}><Check size={15} />Finish</button>
        </div>
        <input className="timeline-range" aria-label="Timeline step" type="range" min={0} max={MAX_STEPS} step={1} value={config.step} onChange={e => replay({ step: Number(e.target.value) })} />
        <div className="challenge-markers">
          <span className="timeline-start">Start 0</span><span className="timeline-end">Finish {MAX_STEPS}</span>
          <span className="timeline-event hazard-event" data-step={DISRUPTION_STEP} style={{ left: `${DISRUPTION_STEP / MAX_STEPS * 100}%` }}><span>Hazards {DISRUPTION_STEP}</span></span>
          <span className="timeline-event gate-event" data-step={config.change} style={{ left: `${config.change / MAX_STEPS * 100}%` }}><span>Gate {config.change}</span></span>
        </div>
      </section>
      <div className="challenge-display"><div className="play-legend"><span><i className="agent-key" />Agents</span><span><i className="package-key" />Packages</span><span><i className="gate-danger-key" />Harmful cells</span><span><i className="success-key" />Success memory</span></div>
        <label><input type="checkbox" checked={fields} onChange={e => setFields(e.target.checked)} />Memory fields</label><label><input type="checkbox" checked={routes} onChange={e => setRoutes(e.target.checked)} />Route trails</label>
      </div>
      <section className="challenge-maps" aria-label="Synchronized policy comparison">
        {([ [direct, "Direct routing", "direct"], [memory, "Success memory", "memory"] ] as const).map(([state, title, key]) => <article key={key} className={`policy-map ${key}`}>
          <header><h2>{title}</h2><span>{state.metrics.delivered} deliveries <b>/</b> {formatMetric(state.metrics.damage)} damage</span></header>
          <WarehouseGrid state={state} activeAgentId={1} displaySettings={display} label={`${title} warehouse`} statusLabel={gatePhase(config)} />
        </article>)}
      </section>
      <section className="challenge-results" aria-label="Matched results">
        <div className="challenge-scoreboard"><h2>{finished ? "Completed comparison" : "Current comparison"}</h2>
          <table><caption>Seed {config.seed} · gate change {config.change} · step {config.step}</caption><thead><tr><th scope="col">Metric</th><th scope="col">Direct</th><th scope="col">Memory</th></tr></thead><tbody>
            {([ ["Deliveries", "deliveries"], ["Damage", "damage"], ["Energy", "energy"], ["Energy / delivery", "energyPerDelivery"], [`Deliveries from ${config.change}`, "postChangeDeliveries"], [`Damage from ${config.change}`, "postChangeDamage"], ["First delivery after change", "firstPostChangeDeliveryStep"] ] as const).map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{columns.map((column, index) => <td key={index}>{column[key] === null ? "N/A" : formatMetric(column[key], key === "energy" || key === "energyPerDelivery" ? 1 : 0)}</td>)}</tr>)}
          </tbody></table><span className="unit-note">Synthetic units · No combined winner score</span>
        </div>
        <div className="challenge-evidence">
          <details className="model-notes"><summary>Matched rules and limits</summary>
            <dl>{Object.entries(MATCHED_RULES).map(([key, value]) => <div key={key}><dt>{({ movementEnergyPerAttempt: "Energy / attempt", damagePerHit: "Damage / hit", repairSteps: "Repair steps", agents: "Agents", observation: "Observation", difference: "Policy difference", randomness: "Paired randomness", workload: "Workload" } as Record<string, string>)[key]}</dt><dd>{value}</dd></div>)}</dl>
            <ul>{CHALLENGE_LIMITS.map(text => <li key={text}>{text}</li>)}</ul>
          </details>
          <div className="result-heading"><h2>Replay evidence</h2><button onClick={() => void copyResult()} disabled={!!replayError}><Copy size={16} />Copy result</button></div>
          <details className="snapshot" open={snapshotOpen} onToggle={e => setSnapshotOpen(e.currentTarget.open)}><summary>Result JSON</summary><textarea aria-label="Result JSON" ref={resultRef} readOnly value={json} spellCheck={false} /></details>
        </div>
      </section>
    </main>
    <footer className="play-footer"><span>Interactive prototype · {CHALLENGE_VERSION}</span><span>Replay links require this challenge build</span><a href="./LICENSE.txt">Licence</a><a href="./COMMERCIAL-LICENSE.txt">Commercial use</a><a href="./THIRD-PARTY-NOTICES.txt">Dependencies</a><span role="status">{copied || "Session only · No telemetry"}</span></footer>
  </div>;
}
