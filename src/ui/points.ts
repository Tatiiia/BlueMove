import { REASON_LABELS } from '../engine/validate';
import type { Candidate, ValidatedScooter } from '../engine/types';
import type { MapPoint } from './FleetMap';
import { age, n } from './format';

export const AGENT_COLORS = ['#1d5bff', '#0e9f8e', '#d6336c'];

const RENTAL: Record<string, string> = { libre: 'libre', reserve: 'réservé', en_location: 'en location' };
const OPS: Record<string, string> = { actif: 'actif', maintenance: 'en maintenance', hors_service: 'hors service' };

export function statusLabel(s: ValidatedScooter): string {
  const r = s.reading;
  return `${RENTAL[r.rental_status ?? ''] ?? r.rental_status ?? '?'} · ${OPS[r.ops_status ?? ''] ?? r.ops_status ?? '?'}`;
}

export function buildPoints(scooters: ValidatedScooter[], candidates: Candidate[], mlActive: boolean): MapPoint[] {
  const byId = new Map(candidates.map((c) => [c.scooter_id, c]));
  const out: MapPoint[] = [];
  for (const s of scooters) {
    if (s.outcome === 'rejet_qualite') continue; // position non fiable : listé dans « Contrôles qualité »
    const r = s.reading;
    const c = byId.get(s.scooter_id);
    const kind = s.outcome === 'maintenance' ? 'maint'
      : s.outcome === 'exclusion' ? (s.reason_code === 'EXCL_CHARGE_SUFFISANTE' ? 'ok' : 'excl')
      : c?.category === 'critique' ? 'crit' : 'prev';
    const lines = [
      `Batterie ${n(r.charge_pct, 1)} % · ${statusLabel(s)}`,
      `Position ${n(r.lat, 4)}, ${n(r.lng, 4)}`,
      `Fraîcheur GPS ${age(s.gps_age_min)} · BMS ${age(s.bms_age_min)}`,
    ];
    if (c) {
      const p = mlActive && c.priority_ml !== null ? c.priority_ml : c.priority_rule;
      lines.push(`Priorité ${n(p, 1)}${c.risk_3h !== null && mlActive ? ` · risque 3 h ${n(c.risk_3h * 100, 0)} %` : ''}`);
    }
    if (s.reason_code) lines.push(REASON_LABELS[s.reason_code] ?? s.reason_code);
    out.push({ id: s.scooter_id, lat: r.lat as number, lng: r.lng as number, kind, title: s.scooter_id, lines });
  }
  return out;
}
