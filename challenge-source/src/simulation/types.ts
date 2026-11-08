import type { Rng } from "./rng";
import type { ScenarioConfig } from "./scenarios";
import type { ControlledExperiment, ExperimentMetrics, SuccessEvidenceMetrics } from "./controlledExperiment";

export const MODES = [
  "baseline",
  "adaptive_blunt",
  "adaptive_candidate_lock",
  "adaptive_candidate_efficient",
  "oracle",
] as const;

export type ModeName = (typeof MODES)[number];

export interface Point {
  x: number;
  y: number;
}

export interface PackageMarker extends Point {
  id: string;
}

export interface AgentState extends Point {
  taskAssignments?: number;
  recoverySteps?: number;
  tripHadHarm?: boolean;
  detour?: { key: string; points: Point[] };
  id: number;
  battery: number;
  carrying: string | null;
  target: Point;
  routeType: "direct" | "success" | "candidate" | "danger" | "oracle";
  risk: number;
  path: Point[];
  recent: Point[];
  lastDamageStep: number;
  candidateSeen: boolean;
}

export interface Metrics {
  delivered: number;
  postDelivered: number;
  damage: number;
  postDamage: number;
  faultHits: number;
  postFaultHits: number;
  energySpent: number;
  candidateCrossings: number;
  candidatePromotions: number;
  firstPostShiftDeliveryStep: number | null;
}

export interface HistoryPoint {
  step: number;
  damage: number;
  energyPerDelivery: number;
  delivered: number;
  faultHits: number;
}

export interface SimState {
  localRecovery?: "visit-penalty-v1";
  recoveryMetrics?: { episodes: number; activeSteps: number };
  oracleNavigation?: "hazard-astar-v1";
  successVetoUntil?: number[][];
  successEvidenceMetrics?: SuccessEvidenceMetrics;
  experiment?: ControlledExperiment;
  experimentMetrics?: ExperimentMetrics;
  mode: ModeName;
  seed: number;
  scenario: ScenarioConfig;
  step: number;
  rng: Rng;
  rows: number;
  cols: number;
  agents: AgentState[];
  packages: PackageMarker[];
  depot: Point;
  danger: number[][];
  success: number[][];
  candidate: number[][];
  faultMap: boolean[][];
  metrics: Metrics;
  history: HistoryPoint[];
}
