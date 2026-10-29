// Demande attendue par zone (profil W5, valeurs illustratives) — MVP_SPEC §7.1.
// Doit rester identique à expected_searches() de sim/generate.py (contrôlé par fixtures).
import { localDecimalHour } from './time';
import type { HypothesesConfig } from './types';

export function expectedSearches(cfg: HypothesesConfig, zoneId: string, asOfUtc: string, horizonH: number): number {
  const h0 = localDecimalHour(asOfUtc, cfg.timezone);
  const h1 = h0 + horizonH;
  const n = cfg.demand.searches_28d[zoneId];
  if (!n) return 0;
  let total = 0;
  cfg.demand.slots.forEach(([a, b], k) => {
    const overlap = Math.max(0, Math.min(b, h1) - Math.max(a, h0));
    if (overlap > 0) total += (overlap * n[k]) / (cfg.demand.workdays_in_window * (b - a));
  });
  return total;
}

/** D_z normalisé (0–1) pour chaque zone, et E_z brut. */
export function zoneDemand(cfg: HypothesesConfig, asOfUtc: string): Record<string, { e: number; d: number }> {
  const e: Record<string, number> = {};
  for (const z of cfg.zones) e[z.id] = expectedSearches(cfg, z.id, asOfUtc, cfg.horizon_h);
  const max = Math.max(0, ...Object.values(e));
  const out: Record<string, { e: number; d: number }> = {};
  for (const [k, v] of Object.entries(e)) out[k] = { e: v, d: max > 0 ? v / max : 0 };
  return out;
}
