// Orchestration d'un calcul : contrôles → candidats → 3 variantes → indicateurs → recommandation.
// Aucune action n'est déclenchée : le résultat est une recommandation soumise à validation humaine.
import { buildDepots, buildZones } from './geo';
import { computeKpis } from './kpis';
import { isModelUsable } from './model';
import { Matrix, nearestNeighbourRoutes, optimizeRoutes, routeDuration, routeKm, type Problem } from './optimize';
import { buildCandidates, normalizeWeights } from './priority';
import { canonicalJson, sha256Hex } from './sha256';
import type {
  Candidate, DepletionModel, HypothesesConfig, PlanParams, Route, RunResult, Scenario, Strategy, Unserved,
  ValidationResult, VariantResult, ZoneStat,
} from './types';
import { validateScenario } from './validate';

export const ENGINE_VERSION = '1.0.0';

export function defaultParams(cfg: HypothesesConfig): PlanParams {
  const d = cfg.defaults;
  const v = cfg.vehicles[d.vehicle];
  return {
    agents: d.agents, vehicle: d.vehicle, capacity_batteries: v.capacity_batteries, speed_kmh: v.speed_kmh,
    cost_per_km_eur: v.cost_per_km_eur, depot_id: d.depot, shift_min: d.shift_min, service_min: d.service_min,
    detour_factor: d.detour_factor, agent_cost_eur_h: d.agent_cost_eur_h,
    max_eligible_pct: cfg.thresholds.max_eligible_pct, weights: { ...cfg.priority.weights }, closed_zones: [],
    ml_enabled: true,
  };
}

/** Valide et borne les paramètres saisis (MVP_SPEC §5.1 « bounds »). Retourne les corrections appliquées. */
export function sanitizeParams(input: PlanParams, cfg: HypothesesConfig): { params: PlanParams; corrections: string[] } {
  const corrections: string[] = [];
  const b = cfg.bounds;
  const clamp = (name: string, v: number, [lo, hi]: [number, number], integer = false) => {
    let x = Number.isFinite(v) ? v : lo;
    if (integer) x = Math.round(x);
    const y = Math.min(hi, Math.max(lo, x));
    if (y !== v) corrections.push(`${name} ramené à ${y}`);
    return y;
  };
  const vehicle = cfg.vehicles[input.vehicle] ? input.vehicle : cfg.defaults.vehicle;
  const depot = cfg.depots.some((d) => d.id === input.depot_id) ? input.depot_id : cfg.defaults.depot;
  const zones = new Set(cfg.zones.map((z) => z.id));
  const params: PlanParams = {
    ...input,
    vehicle,
    depot_id: depot,
    agents: clamp('Agents', input.agents, b.agents, true),
    capacity_batteries: clamp('Batteries par agent', input.capacity_batteries, b.capacity_batteries, true),
    shift_min: clamp('Durée de tournée', input.shift_min, b.shift_min),
    service_min: clamp('Temps d\'intervention', input.service_min, b.service_min),
    detour_factor: clamp('Facteur de détour', input.detour_factor, b.detour_factor),
    agent_cost_eur_h: clamp('Coût horaire', input.agent_cost_eur_h, b.agent_cost_eur_h),
    max_eligible_pct: clamp('Seuil d\'intervention', input.max_eligible_pct, b.max_eligible_pct),
    speed_kmh: Number.isFinite(input.speed_kmh) && input.speed_kmh > 0 ? input.speed_kmh : cfg.vehicles[vehicle].speed_kmh,
    cost_per_km_eur: Number.isFinite(input.cost_per_km_eur) && input.cost_per_km_eur >= 0 ? input.cost_per_km_eur : cfg.vehicles[vehicle].cost_per_km_eur,
    weights: normalizeWeights(input.weights, cfg.priority.weights),
    closed_zones: [...new Set(input.closed_zones.filter((z) => zones.has(z)))].sort(),
    ml_enabled: Boolean(input.ml_enabled),
  };
  return { params, corrections };
}

function buildRoutes(sol: number[][], cands: Candidate[], prize: number[], m: Matrix, p: PlanParams, ml: boolean): Route[] {
  return sol.map((r, k) => {
    let t = 0; let km = 0; let prev = 0;
    const stops = r.map((node, seq) => {
      t += m.t(prev, node + 1); km += m.d(prev, node + 1);
      const c = cands[node];
      const stop = {
        agent_index: k + 1, seq: seq + 1, scooter_id: c.scooter_id, battery_id: c.battery_id, zone_id: c.zone_id,
        lat: c.lat, lng: c.lng, arrival_min: t, cum_km: km, priority: prize[node], category: c.category,
        charge_pct: c.charge_pct, explanation: (ml ? c.explanation_ml : c.explanation_rule) ?? c.explanation_rule,
      };
      t += p.service_min; prev = node + 1;
      return stop;
    });
    const duration = routeDuration(m, r, p.service_min);
    return { agent_index: k + 1, stops, duration_min: duration, travel_min: duration - p.service_min * r.length, km: routeKm(m, r) };
  });
}

function unservedReasons(
  cands: Candidate[], prize: number[], sol: number[][], m: Matrix, p: PlanParams, refOnly: boolean,
): Unserved[] {
  const served = new Set(sol.flat());
  const allFull = sol.every((r) => r.length >= p.capacity_batteries);
  const out: Unserved[] = [];
  cands.forEach((c, i) => {
    if (served.has(i)) return;
    let reason: string;
    if (refOnly && c.category !== 'critique') reason = 'Hors règle de référence (non critique)';
    else if (allFull) reason = 'Capacité batteries atteinte';
    else {
      const fits = sol.some((r) => {
        if (r.length >= p.capacity_batteries) return false;
        let best = Infinity;
        for (let pos = 0; pos <= r.length; pos++) {
          const tmp = [...r]; tmp.splice(pos, 0, i);
          best = Math.min(best, routeDuration(m, tmp, p.service_min));
        }
        return best <= p.shift_min + 1e-9;
      });
      reason = fits ? (refOnly ? 'Non retenu par la règle du plus proche voisin' : 'Arbitrage priorité / détour') : 'Temps insuffisant';
    }
    out.push({ scooter_id: c.scooter_id, zone_id: c.zone_id, charge_pct: c.charge_pct, category: c.category, priority: prize[i], reason });
  });
  return out.sort((a, b) => (a.category === b.category ? b.priority - a.priority : a.category === 'critique' ? -1 : 1));
}

function emptyMessage(cands: Candidate[], validation: ValidationResult, refOnly: boolean, m: Matrix, p: PlanParams): string {
  if (cands.length === 0) {
    if ((validation.summary.EXCL_ZONE_FERMEE ?? 0) > 0 && (validation.summary.ACCEPTE ?? 0) === 0) return 'Aucune tournée admissible : zones des candidats toutes fermées.';
    return refOnly ? 'Aucune tournée admissible : aucun scooter critique éligible.' : 'Aucune tournée admissible : aucun candidat éligible.';
  }
  const reachable = cands.some((_, i) => m.t(0, i + 1) * 2 + p.service_min <= p.shift_min);
  if (!reachable) return 'Aucune tournée admissible : durée de tournée insuffisante pour atteindre un candidat et revenir.';
  return 'Aucune tournée admissible avec les contraintes saisies.';
}

function variant(
  strategy: Strategy, cands: Candidate[], prize: number[], params: PlanParams, depot: { lat: number; lng: number },
  validation: ValidationResult, zoneStats: ZoneStat[], cfg: HypothesesConfig,
): VariantResult {
  const refOnly = strategy === 'REF';
  const pool = refOnly ? cands.filter((c) => c.category === 'critique') : cands;
  const poolPrize = refOnly ? pool.map((c) => c.priority_rule) : prize;
  const problem: Problem = {
    depot, nodes: pool.map((c) => ({ id: c.scooter_id, lat: c.lat, lng: c.lng })), prize: poolPrize,
    agents: params.agents, capacity: params.capacity_batteries, shiftMin: params.shift_min,
    serviceMin: params.service_min, speedKmh: params.speed_kmh, detour: params.detour_factor,
  };
  const m = new Matrix(problem);
  const sol = refOnly ? nearestNeighbourRoutes(problem, m) : optimizeRoutes(problem, m);
  const routes = buildRoutes(sol.routes, pool, poolPrize, m, params, strategy === 'OPT_ML');
  // Couverture et motifs calculés sur l'ensemble des candidats (préventifs hors règle pour REF)
  const fullSol = refOnly
    ? sol.routes.map((r) => r.map((i) => cands.indexOf(pool[i])))
    : sol.routes;
  const fullMatrix = refOnly ? new Matrix({ ...problem, nodes: cands.map((c) => ({ id: c.scooter_id, lat: c.lat, lng: c.lng })) }) : m;
  const unserved = unservedReasons(cands, refOnly ? cands.map((c) => c.priority_rule) : prize, fullSol, fullMatrix, params, refOnly);
  const kpis = computeKpis(routes, cands, validation, zoneStats, params, cfg);
  const total = routes.reduce((s, r) => s + r.stops.length, 0);
  return {
    strategy, status: 'proposee', routes, kpis, unserved, is_recommended: false,
    message: total === 0 ? emptyMessage(pool, validation, refOnly, m, params) : null,
  };
}

function recommend(variants: VariantResult[]): { strategy: Strategy | null; reason: string } {
  const ok = variants.filter((v) => v.status === 'proposee' && v.kpis);
  if (ok.length === 0) return { strategy: null, reason: 'Aucune variante calculée.' };
  const sorted = [...ok].sort((a, b) => {
    const ka = a.kpis!; const kb = b.kpis!;
    const ref = Math.max(Math.abs(ka.projected_weighted_deficit), Math.abs(kb.projected_weighted_deficit), 1e-9);
    if (Math.abs(ka.projected_weighted_deficit - kb.projected_weighted_deficit) / ref >= 0.01) {
      return ka.projected_weighted_deficit - kb.projected_weighted_deficit;
    }
    const ca = ka.kr4_critical_coverage ?? -1; const cb = kb.kr4_critical_coverage ?? -1;
    if (Math.abs(ca - cb) > 1e-9) return cb - ca;
    return (ka.kr1_cost_per_swap ?? Infinity) - (kb.kr1_cost_per_swap ?? Infinity);
  });
  const best = sorted[0];
  return {
    strategy: best.strategy,
    reason: 'Règle §8.5 : plus faible déficit projeté pondéré ; à moins de 1 % d\'écart, meilleure couverture des critiques, puis coût par recharge le plus bas. La référence peut être recommandée.',
  };
}

export function runPlanning(
  scenario: Scenario, rawParams: PlanParams, cfg: HypothesesConfig, model: DepletionModel | null,
): RunResult & { corrections: string[] } {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { params, corrections } = sanitizeParams(rawParams, cfg);
  const zones = buildZones(cfg);
  const depot = buildDepots(cfg).find((d) => d.id === params.depot_id)!;
  const usable = isModelUsable(model);
  const activeModel = usable && params.ml_enabled ? model : null;
  const validation = validateScenario(scenario, params, cfg, zones);
  const { candidates, zoneStats } = buildCandidates(scenario, validation, params, cfg, zones, activeModel);

  const variants: VariantResult[] = [
    variant('REF', candidates, candidates.map((c) => c.priority_rule), params, depot, validation, zoneStats, cfg),
    variant('OPT_REGLE', candidates, candidates.map((c) => c.priority_rule), params, depot, validation, zoneStats, cfg),
  ];
  if (activeModel) {
    variants.push(variant('OPT_ML', candidates, candidates.map((c) => c.priority_ml as number), params, depot, validation, zoneStats, cfg));
  } else {
    variants.push({
      strategy: 'OPT_ML', status: 'non_calculee', routes: [], kpis: null, unserved: [], is_recommended: false,
      message: usable ? 'ML désactivé par l\'opérateur : variante non calculée.' : 'Modèle indisponible ou invalide : variante non calculée.',
    });
  }
  const rec = recommend(variants);
  for (const v of variants) v.is_recommended = v.strategy === rec.strategy;

  const input_hash = sha256Hex(canonicalJson({
    scenario_id: scenario.id, as_of_utc: scenario.as_of_utc, weather: scenario.weather, readings: scenario.readings,
    params, config_version: cfg.version, engine_version: ENGINE_VERSION, model_version: activeModel?.version ?? null,
  }));
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    engine_version: ENGINE_VERSION, model_version: activeModel?.version ?? null, config_version: cfg.version,
    scenario_id: scenario.id, as_of_utc: scenario.as_of_utc, params, input_hash, validation, candidates, zone_stats: zoneStats,
    variants, recommended: rec.strategy, recommendation_reason: rec.reason, compute_ms: Math.round(t1 - t0), corrections,
  };
}

/** Exposé pour les tests unitaires de la règle de recommandation (AC-16). */
export const recommendForTest = recommend;

/** Analyse sans calcul de tournée : contrôles, candidats, statistiques de zone (filtrage en direct dans l'interface). */
export function analyzeScenario(scenario: Scenario, rawParams: PlanParams, cfg: HypothesesConfig, model: DepletionModel | null) {
  const { params, corrections } = sanitizeParams(rawParams, cfg);
  const zones = buildZones(cfg);
  const activeModel = isModelUsable(model) && params.ml_enabled ? model : null;
  const validation = validateScenario(scenario, params, cfg, zones);
  const { candidates, zoneStats } = buildCandidates(scenario, validation, params, cfg, zones, activeModel);
  return { params, corrections, validation, candidates, zoneStats, modelActive: activeModel !== null };
}
