import type { SimState } from "../simulation/types";
import type { DisplaySettings } from "../appTypes";
import { COLS, DISRUPTION_STEP, ROWS, SHIFT_STEP } from "../simulation/warehouse";

interface WarehouseGridProps {
  state: SimState;
  activeAgentId: number;
  displaySettings: DisplaySettings;
}

const CELL = 38;
const TOP = 28;
const LEFT = 34;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;

const SHELVES = [
  [4, 1, 1, 2],
  [5, 1, 1, 2],
  [6, 1, 1, 2],
  [8, 1, 1, 2],
  [13, 1, 1, 2],
  [15, 1, 1, 2],
  [4, 5, 2, 2],
  [7, 5, 1, 2],
  [10, 5, 1, 2],
  [13, 5, 1, 2],
  [15, 5, 1, 2],
  [17, 5, 1, 3],
  [3, 8, 1, 2],
  [5, 8, 1, 2],
  [7, 8, 1, 2],
  [13, 8, 1, 2],
  [15, 8, 1, 2],
  [18, 8, 1, 2],
  [2, 11, 1, 2],
  [4, 11, 1, 2],
  [6, 11, 1, 2],
  [8, 11, 1, 2],
  [13, 11, 1, 2],
  [15, 11, 1, 2],
  [17, 11, 1, 2],
] as const;

export function WarehouseGrid({ state, activeAgentId, displaySettings }: WarehouseGridProps) {
  const viewWidth = WIDTH + LEFT + 12;
  const viewHeight = HEIGHT + TOP + 12;

  return (
    <section className="warehouse-panel">
      <svg className="warehouse-svg" viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-label="Warehouse grid">
        <defs>
          <pattern id="shelf-lines" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 0 4 H 8 M 4 0 V 8" stroke="#aeb9c6" strokeWidth="0.7" opacity="0.6" />
          </pattern>
        </defs>

        <rect x={LEFT} y={TOP} width={WIDTH} height={HEIGHT} fill="#fbfdff" stroke="#243447" strokeWidth="1.4" />

        <Zone x={1} y={1} w={3} h={4} label="RECEIVING" className="receiving-zone" />
        <Zone x={16} y={1} w={3} h={5} label="SHIPPING" className="shipping-zone" />
        <rect
          x={LEFT + state.scenario.faultBandStart * CELL}
          y={TOP}
          width={(state.scenario.faultBandEnd - state.scenario.faultBandStart + 1) * CELL}
          height={HEIGHT}
          fill="#ef4444"
          opacity={state.step >= DISRUPTION_STEP ? 0.12 : 0.04}
        />
        <text x={LEFT + 10 * CELL} y={TOP + 18} className="fault-label">
          STORAGE FAULT BAND
        </text>

        {displaySettings.showFields ? state.danger.map((row, y) =>
          row.map((value, x) =>
            value > 0.03 ? (
              <rect
                key={`danger-${x}-${y}`}
                x={LEFT + x * CELL}
                y={TOP + y * CELL}
                width={CELL}
                height={CELL}
                fill="#ef4444"
                opacity={Math.min(0.36, value * 0.36)}
              />
            ) : null,
          ),
        ) : null}

        {displaySettings.showFields ? state.success.map((row, y) =>
          row.map((value, x) =>
            value > 0.05 ? (
              <rect
                key={`success-${x}-${y}`}
                x={LEFT + x * CELL + 4}
                y={TOP + y * CELL + 4}
                width={CELL - 8}
                height={CELL - 8}
                rx="7"
                fill="#14b8a6"
                opacity={Math.min(0.26, value * 0.28)}
              />
            ) : null,
          ),
        ) : null}

        {displaySettings.showFields ? state.candidate.map((row, y) =>
          row.map((value, x) =>
            value > 0.05 ? (
              <rect
                key={`candidate-${x}-${y}`}
                x={LEFT + x * CELL + 8}
                y={TOP + y * CELL + 8}
                width={CELL - 16}
                height={CELL - 16}
                rx="6"
                fill="#2563eb"
                opacity={Math.min(0.24, value * 0.26)}
              />
            ) : null,
          ),
        ) : null}

        {state.faultMap.map((row, y) =>
          row.map((fault, x) =>
            fault ? (
              <rect
                key={`fault-${x}-${y}`}
                x={LEFT + x * CELL + 3}
                y={TOP + y * CELL + 3}
                width={CELL - 6}
                height={CELL - 6}
                fill="#f97316"
                opacity="0.22"
              />
            ) : null,
          ),
        )}

        {displaySettings.showShelves ? SHELVES.map(([x, y, w, h], index) => (
          <rect
            key={`shelf-${index}`}
            x={LEFT + x * CELL + 6}
            y={TOP + y * CELL + 6}
            width={w * CELL - 12}
            height={h * CELL - 12}
            rx="2"
            fill="url(#shelf-lines)"
            stroke="#a8b4c2"
          />
        )) : null}

        {Array.from({ length: COLS + 1 }, (_, x) => (
          <line
            key={`v-${x}`}
            x1={LEFT + x * CELL}
            x2={LEFT + x * CELL}
            y1={TOP}
            y2={TOP + HEIGHT}
            stroke="#d9e0e8"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: ROWS + 1 }, (_, y) => (
          <line
            key={`h-${y}`}
            x1={LEFT}
            x2={LEFT + WIDTH}
            y1={TOP + y * CELL}
            y2={TOP + y * CELL}
            stroke="#d9e0e8"
            strokeWidth="1"
          />
        ))}

        {Array.from({ length: COLS }, (_, x) => (
          <text key={`col-${x}`} x={LEFT + x * CELL + CELL / 2} y={18} className="axis-label" textAnchor="middle">
            {x + 1}
          </text>
        ))}
        {Array.from({ length: ROWS }, (_, y) => (
          <text key={`row-${y}`} x={16} y={TOP + y * CELL + CELL / 2 + 4} className="axis-label">
            {String.fromCharCode(65 + y)}
          </text>
        ))}

        {displaySettings.showRoutes ? state.agents.map((agent) => {
          const points = agent.path.map((point) => center(point.x, point.y)).join(" ");
          return points.length > 0 ? (
            <polyline
              key={`path-${agent.id}`}
              points={points}
              fill="none"
              stroke={agent.routeType === "candidate" ? "#2563eb" : "#0f9f8f"}
              strokeWidth={agent.id === activeAgentId ? 3 : 1.8}
              strokeDasharray={agent.routeType === "candidate" ? "8 7" : undefined}
              opacity={agent.id === activeAgentId ? 0.9 : 0.38}
            />
          ) : null;
        }) : null}

        <Depot x={state.depot.x} y={state.depot.y} />
        {state.packages.map((pkg) => (
          <Package key={pkg.id} x={pkg.x} y={pkg.y} />
        ))}
        {state.agents.map((agent) => (
          <Agent key={agent.id} x={agent.x} y={agent.y} active={agent.id === activeAgentId} />
        ))}
      </svg>
      <div className="grid-status">
        <span>{state.step < DISRUPTION_STEP ? "pre-disruption" : state.step < SHIFT_STEP ? "fault band active" : "gate shift active"}</span>
        <span>step {state.step}</span>
      </div>
    </section>
  );
}

function Zone({ x, y, w, h, label, className }: { x: number; y: number; w: number; h: number; label: string; className: string }) {
  return (
    <g className={className}>
      <rect
        x={LEFT + x * CELL}
        y={TOP + y * CELL}
        width={w * CELL}
        height={h * CELL}
        fill="transparent"
        strokeWidth="1.6"
        strokeDasharray="6 5"
      />
      <text x={LEFT + x * CELL + 14} y={TOP + y * CELL + 26}>
        {label}
      </text>
    </g>
  );
}

function Depot({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${LEFT + x * CELL + 5}, ${TOP + y * CELL + 5})`}>
      <rect width={CELL - 10} height={CELL - 10} rx="4" fill="#4b5f78" />
      <text x={(CELL - 10) / 2} y={(CELL - 10) / 2 + 5} textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="800">
        D
      </text>
    </g>
  );
}

function Package({ x, y }: { x: number; y: number }) {
  return (
    <rect
      x={LEFT + x * CELL + CELL / 2 - 6}
      y={TOP + y * CELL + CELL / 2 - 6}
      width="12"
      height="12"
      rx="2"
      fill="#fbbf24"
      stroke="#b77904"
      strokeWidth="1"
    />
  );
}

function Agent({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g>
      <circle
        cx={LEFT + x * CELL + CELL / 2}
        cy={TOP + y * CELL + CELL / 2}
        r={active ? 8 : 6}
        fill={active ? "#0f766e" : "#14b8a6"}
        stroke="#ffffff"
        strokeWidth="2"
      />
      {active ? (
        <circle
          cx={LEFT + x * CELL + CELL / 2}
          cy={TOP + y * CELL + CELL / 2}
          r="13"
          fill="none"
          stroke="#0f766e"
          strokeWidth="1.5"
          opacity="0.35"
        />
      ) : null}
    </g>
  );
}

function center(x: number, y: number): string {
  return `${LEFT + x * CELL + CELL / 2},${TOP + y * CELL + CELL / 2}`;
}
