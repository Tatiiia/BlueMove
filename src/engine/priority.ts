// Score de priorité — MVP_SPEC §7.
// priorité = 100 × (wU × urgence + wD × demande + wS × rareté)
// La formule est une règle transparente ; seule l'urgence des préventifs peut provenir du modèle ML.
import { zoneDemand } from './demand';
import { predictDepletion } from './model';
import type {
  Candidate, DepletionModel, HypothesesConfig, PlanParams, Scenario, ValidationResult, Weights, Zone, ZoneStat,
} from './types';

export const fmt1 = (x: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmt0 = (x: number) => Math.round(x).toLocaleString('fr-FR');

export function normalizeWeights(w: Weights, fallback: Weights): Weights {
  const s = w.urgency + w.demand + w.scarcity;
  if (!(s > 0) || [w.urgency, w.demand, w.scarcity].some((x) => !(x >= 0))) return { ...fallback };
  return { urgency: w.urgency / s, demand: w.demand / s, scarcity: w.scarcity / s };
}

export function priorityScore(w: Weights, u: number, d: number, s: number): number {
  return 100 * (w.urgency * u + w.demand * d + w.scarcity * s);
}

export function buildCandidates(
  scenario: Scenario, validation: ValidationResult, params: PlanParams, cfg: HypothesesConfig, zones: Zone[],
  model: DepletionModel | null,
): { candidates: Candidate[]; zoneStats: ZoneStat[] } {
  const th = cfg.thresholds;
  const w = normalizeWeights(params.weights, cfg.priority.weights);
  const cap = cfg.priority.preventive_urgency_cap;
  const demand = zoneDemand(cfg, scenario.as_of_utc);
  const rainFactor = scenario.weather === 'pluie' ? cfg.weather.rain_demand_factor : 1;
  const closed = new Set(params.closed_zones);

  const rentable: Record<string, number> = {};
  for (const z of zones) rentable[z.id] = 0;
  for (const s of validation.scooters) if (s.is_rentable && s.zone_id) rentable[s.zone_id] += 1;
  const scarcity: Record<string, number> = {};
  for (const z of zones) {
    scarcity[z.id] = z.target_rentable > 0 ? Math.min(1, Math.max(0, (z.target_rentable - rentable[z.id]) / z.target_rentable)) : 0;
  }
  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));

  const candidates: Candidate[] = [];
  for (const s of validation.scooters) {
    if (s.outcome !== 'accepte' || !s.zone_id) continue;
    const r = s.reading;
    const c = r.charge_pct as number;
    const z = s.zone_id;
    const zone = zones.find((x) => x.id === z) as Zone;
    const category = c < th.critical_pct ? 'critique' : 'preventif';
    const D = demand[z].d;
    const S = scarcity[z];
    const uRule = category === 'critique' ? 1 : cap * (params.max_eligible_pct - c) / (params.max_eligible_pct - th.critical_pct);
    const usageKnown = r.usage_rate_6h !== null && Number.isFinite(r.usage_rate_6h);
    let risk: number | null = null;
    let uMl: number | null = null;
    if (model) {
      if (category === 'critique') uMl = 1;
      else {
        const usage = usageKnown ? (r.usage_rate_6h as number) : model.mean[1];
        const x = [c, usage, demand[z].e * cfg.demand.scale_factor * rainFactor, scenario.weather === 'pluie' ? 1 : 0];
        risk = predictDepletion(model, x);
        uMl = cap * risk;
      }
    }
    const pRule = priorityScore(w, uRule, D, S);
    const pMl = uMl === null ? null : priorityScore(w, uMl, D, S);
    const tail = ` ; zone ${zone.name} : demande ${fmt0(D * 100)} % du maximum, ${rentable[z]} louables pour une cible de ${zone.target_rentable}.`;
    const cat = category === 'critique' ? 'critique' : 'préventif';
    const noUsage = usageKnown ? '' : ' (usage récent inconnu : moyenne d\'entraînement)';
    candidates.push({
      scooter_id: s.scooter_id, battery_id: r.battery_id as string, zone_id: z, lat: r.lat as number, lng: r.lng as number,
      charge_pct: c, usage_rate_6h: usageKnown ? (r.usage_rate_6h as number) : NaN, category,
      demand: D, scarcity: S, rentable_in_zone: rentable[z], target_in_zone: zone.target_rentable,
      urgency_rule: uRule, urgency_ml: uMl, risk_3h: risk,
      priority_rule: pRule, priority_ml: pMl,
      explanation_rule: `Priorité ${fmt1(pRule)} — charge ${fmt1(c)} % (${cat})${tail}`,
      explanation_ml: pMl === null ? null
        : `Priorité ${fmt1(pMl)} — charge ${fmt1(c)} % (${cat}${risk !== null ? `, risque 3 h : ${fmt0(risk * 100)} %${noUsage}` : ''})${tail}`,
    });
  }
  candidates.sort((a, b) => (b.priority_ml ?? b.priority_rule) - (a.priority_ml ?? a.priority_rule) || (a.scooter_id < b.scooter_id ? -1 : 1));

  const zoneStats: ZoneStat[] = zones.map((zz) => ({
    zone_id: zz.id, name: zoneName[zz.id], demand: demand[zz.id].d, expected_searches: demand[zz.id].e * cfg.demand.scale_factor * rainFactor,
    rentable: rentable[zz.id], target: zz.target_rentable, scarcity: scarcity[zz.id], closed: closed.has(zz.id),
    critical: candidates.filter((c) => c.zone_id === zz.id && c.category === 'critique').length,
    preventive: candidates.filter((c) => c.zone_id === zz.id && c.category === 'preventif').length,
  }));
  return { candidates, zoneStats };
}
