// Types du moteur de planification BlueMove (consigne E).
// Le moteur est indépendant de l'interface : fonctions pures, déterministes, testées.

export type Strategy = 'REF' | 'OPT_REGLE' | 'OPT_ML';
export type Category = 'critique' | 'preventif';
export type Outcome = 'accepte' | 'rejet_qualite' | 'exclusion' | 'maintenance';

export interface Offset { east: number; north: number }

export interface HypothesesConfig {
  version: string;
  data_origin: string;
  timezone: string;
  city_center: { lat: number; lng: number; note: string };
  depots: { id: string; name: string; offset_km: Offset; hypothesis: string }[];
  zones: { id: string; name: string; offset_km: Offset; radius_m: number; target_rentable: number }[];
  fleet: { size: number; allocation: Record<string, number> };
  demand: {
    source: string;
    workdays_in_window: number;
    scale_factor: number;
    slots: [number, number][];
    searches_28d: Record<string, number[]>;
    no_offer_rate: Record<string, number[]>;
  };
  weather: { rain_probability: number; rain_demand_factor: number };
  consumption_per_trip_pct: { mean: number; sd: number; min: number; max: number };
  thresholds: {
    critical_pct: number;
    max_eligible_pct: number;
    rentable_gps_max_age_min: number;
    rentable_bms_max_age_min: number;
    intervention_gps_max_age_min: number;
    intervention_bms_max_age_min: number;
    battery_temp_max_c: number;
  };
  horizon_h: number;
  priority: {
    weights: Weights;
    weights_initial_design?: Weights;
    weights_note?: string;
    preventive_urgency_cap: number;
    high_demand_threshold: number;
  };
  vehicles: Record<VehicleId, { label: string; capacity_batteries: number; speed_kmh: number; cost_per_km_eur: number }>;
  defaults: {
    agents: number; vehicle: VehicleId; depot: string; shift_min: number; service_min: number;
    detour_factor: number; agent_cost_eur_h: number;
  };
  bounds: Record<string, [number, number]>;
  plan_expiry_min: number;
}

export type VehicleId = 'velo_cargo' | 'utilitaire';
export interface Weights { urgency: number; demand: number; scarcity: number }

export interface ScooterReading {
  message_id: string;
  scooter_id: string;
  battery_id: string | null;
  registry_battery_id: string | null;
  lat: number | null;
  lng: number | null;
  gps_ts_utc: string | null;
  charge_pct: number | null;
  bms_ts_utc: string | null;
  bms_fault_code: string | null;
  battery_temp_c: number | null;
  rental_status: string | null;
  ops_status: string | null;
  usage_rate_6h: number | null;
}

export interface Scenario {
  id: string;
  label: string;
  as_of_utc: string;
  weather: 'sec' | 'pluie';
  is_test_case: boolean;
  description?: string;
  expected_behavior?: string;
  data_origin?: string;
  readings: ScooterReading[];
}

export interface Zone {
  id: string; name: string; lat: number; lng: number; radius_m: number; target_rentable: number;
}
export interface Depot { id: string; name: string; lat: number; lng: number; hypothesis: string }

export interface ValidatedScooter {
  reading: ScooterReading;
  scooter_id: string;
  zone_id: string | null;
  outcome: Outcome;
  reason_code: string | null;
  gps_age_min: number | null;
  bms_age_min: number | null;
  is_rentable: boolean;
}

export interface ValidationResult {
  scooters: ValidatedScooter[];            // une entrée par scooter distinct (message retenu)
  duplicates: { message_id: string; scooter_id: string }[];
  superseded: { message_id: string; scooter_id: string }[];
  summary: Record<string, number>;         // compte par code (+ ACCEPTE)
}

export interface PlanParams {
  agents: number;
  vehicle: VehicleId;
  capacity_batteries: number;
  speed_kmh: number;
  cost_per_km_eur: number;
  depot_id: string;
  shift_min: number;
  service_min: number;
  detour_factor: number;
  agent_cost_eur_h: number;
  max_eligible_pct: number;
  weights: Weights;
  closed_zones: string[];
  ml_enabled: boolean;
}

export interface Candidate {
  scooter_id: string;
  battery_id: string;
  zone_id: string;
  lat: number;
  lng: number;
  charge_pct: number;
  usage_rate_6h: number;
  category: Category;
  demand: number;                  // D_z, 0–1
  scarcity: number;                // S_z, 0–1
  rentable_in_zone: number;        // R_z
  target_in_zone: number;          // C_z
  urgency_rule: number;            // U, mode règle
  urgency_ml: number | null;       // U, mode ML (null si ML indisponible)
  risk_3h: number | null;          // probabilité prédite (préventifs uniquement)
  priority_rule: number;           // 0–100
  priority_ml: number | null;      // 0–100
  explanation_rule: string;
  explanation_ml: string | null;
}

export interface Stop {
  agent_index: number;
  seq: number;
  scooter_id: string;
  battery_id: string;
  zone_id: string;
  lat: number;
  lng: number;
  arrival_min: number;
  cum_km: number;
  priority: number;
  category: Category;
  charge_pct: number;
  explanation: string;
}

export interface Route {
  agent_index: number;
  stops: Stop[];
  duration_min: number;
  travel_min: number;
  km: number;
}

export interface Unserved {
  scooter_id: string; zone_id: string; charge_pct: number; category: Category; priority: number; reason: string;
}

export interface Kpis {
  swaps: number;
  critical_served: number;
  duration_h: number;
  km: number;
  cost_eur: number;
  kr1_cost_per_swap: number | null;
  kr2_swaps_per_hour: number | null;
  kr3_km_per_swap: number | null;
  kr4_critical_coverage: number | null;
  kr4b_critical_coverage_high_demand: number | null;
  priority_served: number;
  projected_weighted_deficit: number;
  projected_below_20: number;
}

export interface VariantResult {
  strategy: Strategy;
  status: 'proposee' | 'non_calculee';
  routes: Route[];
  kpis: Kpis | null;
  unserved: Unserved[];
  message: string | null;
  is_recommended: boolean;
}

export interface RunResult {
  engine_version: string;
  model_version: string | null;
  config_version: string;
  scenario_id: string;
  as_of_utc: string;
  params: PlanParams;
  input_hash: string;
  validation: ValidationResult;
  candidates: Candidate[];
  zone_stats: ZoneStat[];
  variants: VariantResult[];
  recommended: Strategy | null;
  recommendation_reason: string;
  compute_ms: number;
}

export interface ZoneStat {
  zone_id: string; name: string; demand: number; expected_searches: number; rentable: number; target: number;
  scarcity: number; closed: boolean; critical: number; preventive: number;
}

export interface DepletionModel {
  model_id: string;
  version: string;
  trained_at_utc: string;
  data_origin: string;
  algorithm: string;
  target: string;
  horizon_h: number;
  applicable_charge_range: [number, number];
  features: string[];
  mean: number[];
  std: number[];
  coef: number[];
  intercept: number;
  metrics: Record<string, number | string>;
  status: string;
  warning?: string;
}
