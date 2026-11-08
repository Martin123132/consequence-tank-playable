import type { HistoryPoint, SimState } from "../simulation/types";
import { DISRUPTION_STEP, MAX_STEPS, SHIFT_STEP } from "../simulation/warehouse";
import { Play } from "lucide-react";

interface TimelineProps {
  selectedState: SimState;
  baselineState: SimState;
  onSeek: (step: number) => void;
}

export function Timeline({ selectedState, baselineState, onSeek }: TimelineProps) {
  const damageMax = Math.max(1, ...selectedState.history.map((point) => point.damage), ...baselineState.history.map((point) => point.damage));
  return (
    <section className="timeline-panel">
      <div className="timeline-title">
        <h2>Timeline</h2>
        <button
          type="button"
          className="mini-play"
          aria-label="Jump forward"
          onClick={() => onSeek(selectedState.step >= MAX_STEPS ? 0 : Math.min(MAX_STEPS, selectedState.step + 60))}
        >
          <Play size={14} />
        </button>
        <input
          className="timeline-range"
          type="range"
          min={0}
          max={MAX_STEPS}
          step={6}
          value={selectedState.step}
          aria-label="Timeline step"
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span className="timeline-step-readout">
          {selectedState.step} / {MAX_STEPS}
        </span>
      </div>
      <svg viewBox="0 0 900 168" className="timeline-svg" role="img" aria-label="Simulation timeline">
        <line x1="70" x2="860" y1="26" y2="26" className="timeline-axis" />
        <Marker step={DISRUPTION_STEP} label="Disruption" y={26} color="#ef4444" />
        <Marker step={SHIFT_STEP} label="Gate shift" y={26} color="#f97316" />
        <line x1={xForStep(selectedState.step)} x2={xForStep(selectedState.step)} y1="18" y2="154" className="current-step" />

        <text x="14" y="58" className="timeline-label">
          Events
        </text>
        {selectedState.history
          .filter((point) => point.step % 36 === 0)
          .map((point, index) => (
            <circle
              key={`event-${point.step}-${index}`}
              cx={xForStep(point.step)}
              cy="55"
              r="2.2"
              fill={point.step >= SHIFT_STEP ? "#f97316" : "#dc2626"}
              opacity="0.85"
            />
          ))}

        <text x="14" y="96" className="timeline-label">
          Damage
        </text>
        <ChartLine history={baselineState.history} metric="damage" yBase={102} color="#f43f5e" opacity={0.34} scaleMax={damageMax} />
        <ChartLine history={selectedState.history} metric="damage" yBase={102} color="#ef4444" opacity={0.9} scaleMax={damageMax} />

        <text x="14" y="136" className="timeline-label">
          Energy / delivery
        </text>
        <ChartLine history={selectedState.history} metric="energyPerDelivery" yBase={140} color="#0f9f8f" opacity={0.9} />
      </svg>
    </section>
  );
}

function Marker({ step, label, y, color }: { step: number; label: string; y: number; color: string }) {
  const x = xForStep(step);
  return (
    <g>
      <line x1={x} x2={x} y1={y - 8} y2="154" stroke={color} strokeWidth="1.4" strokeDasharray="6 5" opacity="0.75" />
      <path d={`M ${x} ${y + 8} l 8 14 h -16 z`} fill={color} />
      <text x={x} y={y + 42} textAnchor="middle" fill={color} className="marker-label">
        {label}
      </text>
    </g>
  );
}

function ChartLine({
  history,
  metric,
  yBase,
  color,
  opacity,
  scaleMax,
}: {
  history: HistoryPoint[];
  metric: "damage" | "energyPerDelivery";
  yBase: number;
  color: string;
  opacity: number;
  scaleMax?: number;
}) {
  const values = history.map((point) => point[metric]);
  const max = scaleMax ?? Math.max(1, ...values);
  const points = history
    .map((point) => {
      const x = xForStep(point.step);
      const y = yBase - (point[metric] / max) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return <polyline points={points} fill="none" stroke={color} strokeWidth="2" opacity={opacity} strokeLinecap="round" />;
}

function xForStep(step: number): number {
  return 70 + (Math.min(MAX_STEPS, step) / MAX_STEPS) * 790;
}
