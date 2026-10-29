export type ScenarioId = "normal_shift" | "heavy_fault_band" | "sparse_packages" | "high_traffic";

export interface ScenarioConfig {
  id: ScenarioId;
  label: string;
  description: string;
  agentCount: number;
  packageCount: number;
  faultBandStart: number;
  faultBandEnd: number;
  damageMultiplier: number;
  energyMultiplier: number;
}

export const SCENARIO_PRESETS: readonly ScenarioConfig[] = [
  {
    id: "normal_shift",
    label: "Normal shift",
    description: "Default gate-shift warehouse pattern",
    agentCount: 7,
    packageCount: 5,
    faultBandStart: 9,
    faultBandEnd: 12,
    damageMultiplier: 1,
    energyMultiplier: 1,
  },
  {
    id: "heavy_fault_band",
    label: "Heavy fault band",
    description: "Wider disruption zone with higher damage cost",
    agentCount: 7,
    packageCount: 5,
    faultBandStart: 8,
    faultBandEnd: 13,
    damageMultiplier: 1.35,
    energyMultiplier: 1.04,
  },
  {
    id: "sparse_packages",
    label: "Sparse packages",
    description: "Lower pickup density with longer repositioning loops",
    agentCount: 6,
    packageCount: 3,
    faultBandStart: 9,
    faultBandEnd: 12,
    damageMultiplier: 1,
    energyMultiplier: 1.08,
  },
  {
    id: "high_traffic",
    label: "High traffic",
    description: "More active agents sharing the same disruption pattern",
    agentCount: 10,
    packageCount: 5,
    faultBandStart: 9,
    faultBandEnd: 12,
    damageMultiplier: 1.08,
    energyMultiplier: 1.12,
  },
] as const;

export const DEFAULT_SCENARIO = SCENARIO_PRESETS[0];

export function getScenarioById(id: ScenarioId): ScenarioConfig {
  return SCENARIO_PRESETS.find((scenario) => scenario.id === id) ?? DEFAULT_SCENARIO;
}
