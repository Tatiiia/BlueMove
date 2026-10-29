// Contrôles qualité et éligibilité — MVP_SPEC §6 (règles déterministes, aucune IA).
import { zoneOf } from './geo';
import { ageMinutes, parseUtc } from './time';
import type {
  HypothesesConfig, PlanParams, Scenario, ScooterReading, ValidatedScooter, ValidationResult, Zone,
} from './types';

const RENTAL = new Set(['libre', 'reserve', 'en_location']);
const OPS = new Set(['actif', 'maintenance', 'hors_service']);

export const REASON_LABELS: Record<string, string> = {
  ACCEPTE: 'Accepté',
  REJ_DOUBLON: 'Message dupliqué',
  REJ_CHAMP_MANQUANT: 'Champ obligatoire manquant',
  REJ_BATTERIE_INVALIDE: 'Charge hors de [0 ; 100 %]',
  REJ_COORDONNEES: 'Coordonnées invalides',
  REJ_HORODATAGE: 'Horodatage dans le futur ou illisible',
  REJ_ASSOCIATION_BATTERIE: 'Batterie non conforme au registre',
  REJ_STATUT_INCONNU: 'Statut inconnu',
  MAINT_ALERTE_BMS: 'Code défaut BMS → maintenance',
  MAINT_TEMPERATURE: 'Température batterie anormale → maintenance',
  EXCL_MAINTENANCE: 'En maintenance / hors service',
  EXCL_EN_LOCATION: 'En location',
  EXCL_RESERVE: 'Réservé',
  EXCL_GPS_PERIME: 'Position périmée',
  EXCL_BMS_PERIME: 'Mesure batterie périmée',
  EXCL_HORS_ZONE: 'Hors zone autorisée',
  EXCL_ZONE_FERMEE: 'Zone fermée par l\'opérateur',
  EXCL_CHARGE_SUFFISANTE: 'Charge suffisante (≥ seuil d\'intervention)',
  REMPLACE: 'Mesure plus ancienne remplacée',
};

const missing = (v: unknown) => v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v)) || v === '';

/** Rejet qualité d'un message isolé, ou null s'il est exploitable. */
export function qualityReason(r: ScooterReading, asOfUtc: string): string | null {
  if (missing(r.scooter_id) || missing(r.charge_pct) || missing(r.bms_ts_utc) || missing(r.lat) || missing(r.lng)
    || missing(r.gps_ts_utc) || missing(r.rental_status) || missing(r.ops_status)) return 'REJ_CHAMP_MANQUANT';
  const c = r.charge_pct as number;
  if (c < 0 || c > 100) return 'REJ_BATTERIE_INVALIDE';
  const lat = r.lat as number;
  const lng = r.lng as number;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) return 'REJ_COORDONNEES';
  const asOf = parseUtc(asOfUtc) as number;
  const g = parseUtc(r.gps_ts_utc);
  const b = parseUtc(r.bms_ts_utc);
  if (g === null || b === null || g > asOf + 60000 || b > asOf + 60000) return 'REJ_HORODATAGE';
  if (missing(r.battery_id) || r.battery_id !== r.registry_battery_id) return 'REJ_ASSOCIATION_BATTERIE';
  if (!RENTAL.has(r.rental_status as string) || !OPS.has(r.ops_status as string)) return 'REJ_STATUT_INCONNU';
  return null;
}

export function validateScenario(
  scenario: Scenario, params: PlanParams, cfg: HypothesesConfig, zones: Zone[],
): ValidationResult {
  const th = cfg.thresholds;
  const seen = new Set<string>();
  const duplicates: { message_id: string; scooter_id: string }[] = [];
  const byScooter = new Map<string, { r: ScooterReading; q: string | null; order: number }[]>();

  scenario.readings.forEach((r, order) => {
    if (seen.has(r.message_id)) { duplicates.push({ message_id: r.message_id, scooter_id: r.scooter_id }); return; }
    seen.add(r.message_id);
    const key = missing(r.scooter_id) ? `?${r.message_id}` : r.scooter_id;
    const list = byScooter.get(key) ?? [];
    list.push({ r, q: qualityReason(r, scenario.as_of_utc), order });
    byScooter.set(key, list);
  });

  const superseded: { message_id: string; scooter_id: string }[] = [];
  const scooters: ValidatedScooter[] = [];
  const closed = new Set(params.closed_zones);
  const recency = (r: ScooterReading) => (parseUtc(r.bms_ts_utc) ?? -Infinity);

  for (const [key, list] of [...byScooter.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    // Une donnée rejetée ne remplace pas le dernier état validé (W8) : on retient le message valide le plus récent.
    const valid = list.filter((m) => m.q === null).sort((a, b) => recency(b.r) - recency(a.r) || b.order - a.order);
    const chosen = valid[0] ?? [...list].sort((a, b) => recency(b.r) - recency(a.r) || b.order - a.order)[0];
    for (const m of list) if (m !== chosen) superseded.push({ message_id: m.r.message_id, scooter_id: key });
    const r = chosen.r;
    const gpsAge = ageMinutes(scenario.as_of_utc, r.gps_ts_utc);
    const bmsAge = ageMinutes(scenario.as_of_utc, r.bms_ts_utc);
    const base = { reading: r, scooter_id: key, gps_age_min: gpsAge, bms_age_min: bmsAge };
    if (chosen.q !== null) {
      scooters.push({ ...base, zone_id: null, outcome: 'rejet_qualite', reason_code: chosen.q, is_rentable: false });
      continue;
    }
    const zone = zoneOf(zones, r.lat as number, r.lng as number);
    const charge = r.charge_pct as number;
    let outcome: ValidatedScooter['outcome'] = 'accepte';
    let reason: string | null = null;
    if (!missing(r.bms_fault_code)) { outcome = 'maintenance'; reason = 'MAINT_ALERTE_BMS'; }
    else if (r.battery_temp_c !== null && r.battery_temp_c > th.battery_temp_max_c) { outcome = 'maintenance'; reason = 'MAINT_TEMPERATURE'; }
    else {
      const excl =
        r.ops_status !== 'actif' ? 'EXCL_MAINTENANCE'
        : r.rental_status === 'en_location' ? 'EXCL_EN_LOCATION'
        : r.rental_status === 'reserve' ? 'EXCL_RESERVE'
        : (gpsAge as number) > th.intervention_gps_max_age_min ? 'EXCL_GPS_PERIME'
        : (bmsAge as number) > th.intervention_bms_max_age_min ? 'EXCL_BMS_PERIME'
        : zone === null ? 'EXCL_HORS_ZONE'
        : closed.has(zone) ? 'EXCL_ZONE_FERMEE'
        : charge >= params.max_eligible_pct ? 'EXCL_CHARGE_SUFFISANTE'
        : null;
      if (excl) { outcome = 'exclusion'; reason = excl; }
    }
    const isRentable = outcome !== 'maintenance' && r.ops_status === 'actif' && r.rental_status === 'libre'
      && zone !== null && !closed.has(zone)
      && (gpsAge as number) < th.rentable_gps_max_age_min && (bmsAge as number) < th.rentable_bms_max_age_min
      && charge >= th.critical_pct;
    scooters.push({ ...base, zone_id: zone, outcome, reason_code: reason, is_rentable: isRentable });
  }

  const summary: Record<string, number> = { ACCEPTE: 0 };
  for (const s of scooters) {
    const k = s.reason_code ?? 'ACCEPTE';
    summary[k] = (summary[k] ?? 0) + 1;
  }
  if (duplicates.length) summary.REJ_DOUBLON = duplicates.length;
  if (superseded.length) summary.REMPLACE = superseded.length;
  return { scooters, duplicates, superseded, summary };
}
