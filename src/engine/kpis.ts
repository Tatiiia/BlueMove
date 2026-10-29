// Indicateurs KR1–KR5 (simulation) — MVP_SPEC §9. KR6 (acceptation) est calculé à partir des décisions.
// K6 (coût par transfert de scooter, W6) n'est ni réutilisé ni redéfini (D-04).
import type {
  Candidate, HypothesesConfig, Kpis, PlanParams, Route, ValidationResult, ZoneStat,
} from './types';

export function computeKpis(
  routes: Route[], candidates: Candidate[], validation: ValidationResult, zoneStats: ZoneStat[],
  params: PlanParams, cfg: HypothesesConfig,
): Kpis {
  const stops = routes.flatMap((r) => r.stops);
  const swaps = stops.length;
  const durationH = routes.reduce((s, r) => s + r.duration_min, 0) / 60;
  const km = routes.reduce((s, r) => s + r.km, 0);
  const cost = durationH * params.agent_cost_eur_h + km * params.cost_per_km_eur;
  const served = new Set(stops.map((s) => s.scooter_id));
  const crit = candidates.filter((c) => c.category === 'critique');
  const highD = new Set(zoneStats.filter((z) => z.demand >= cfg.priority.high_demand_threshold).map((z) => z.zone_id));
  const critHigh = crit.filter((c) => highD.has(c.zone_id));
  const ratio = (num: number, den: number) => (den > 0 ? num / den : null);

  // Projection simulée de l'offre à l'horizon H (hors déplacements des scooters) — §9.1
  const H = cfg.horizon_h;
  const arrival = new Map(stops.map((s) => [s.scooter_id, s.arrival_min]));
  const closed = new Set(params.closed_zones);
  const projRentable: Record<string, number> = {};
  let below = 0;
  for (const s of validation.scooters) {
    const r = s.reading;
    if (s.outcome === 'rejet_qualite' || s.outcome === 'maintenance' || r.ops_status !== 'actif'
      || r.rental_status === 'en_location' || !s.zone_id || closed.has(s.zone_id)) continue;
    const a = arrival.get(s.scooter_id);
    const usage = r.usage_rate_6h !== null && Number.isFinite(r.usage_rate_6h) ? r.usage_rate_6h : 0;
    const proj = a !== undefined && a <= H * 60
      ? 100
      : (r.charge_pct as number) - (usage / 6) * H * cfg.consumption_per_trip_pct.mean;
    if (proj >= cfg.thresholds.critical_pct) projRentable[s.zone_id] = (projRentable[s.zone_id] ?? 0) + 1;
    else below++;
  }
  let deficit = 0;
  for (const z of zoneStats) {
    if (z.closed) continue;
    deficit += z.demand * Math.max(0, z.target - (projRentable[z.zone_id] ?? 0));
  }

  return {
    swaps,
    critical_served: crit.filter((c) => served.has(c.scooter_id)).length,
    duration_h: durationH,
    km,
    cost_eur: cost,
    kr1_cost_per_swap: ratio(cost, swaps),
    kr2_swaps_per_hour: ratio(swaps, durationH),
    kr3_km_per_swap: ratio(km, swaps),
    kr4_critical_coverage: ratio(crit.filter((c) => served.has(c.scooter_id)).length, crit.length),
    kr4b_critical_coverage_high_demand: ratio(critHigh.filter((c) => served.has(c.scooter_id)).length, critHigh.length),
    priority_served: stops.reduce((s, x) => s + x.priority, 0),
    projected_weighted_deficit: deficit,
    projected_below_20: below,
  };
}
