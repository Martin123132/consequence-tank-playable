import type { Point } from "./types";

export interface ExperimentEnvironment {
  changeAtStep: number;
  blockedCells?: Point[];
  depotAfterChange?: Point;
  openGateRows?: { before: number[]; after: number[] };
}

export interface MemoryFactors {
  danger: boolean;
  success: boolean;
  candidate: boolean;
}

export interface ControlledExperiment {
  randomness?: "paired-v1";
  memory: MemoryFactors;
  hazardsEnabled: boolean;
  environment?: ExperimentEnvironment;
  successEvidence?: "harm-veto";
  navigation?: "physical-astar";
}

export const SUCCESS_VETO_STEPS = 120;
export interface SuccessEvidenceMetrics {
  harmEvents: number;
  clearedCells: number;
  rejectedWrites: number;
  unreinforcedDamagedTrips: number;
}

export interface ExperimentMetrics {
  movementAttempts: number;
  repairTicks: number;
  neutralMovementEnergy: number;
  learnedDangerSurcharge: number;
}

export const CONTROLLED_COSTS = Object.freeze({
  movementEnergy: 0.92,
  damagePerHit: 2,
  repairSteps: 3,
  learnedDangerSurcharge: 0.18,
});
