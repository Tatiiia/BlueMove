// Journal des décisions du simulateur (stockage local du navigateur).
// Une décision ici n'envoie aucune instruction au terrain ni aux scooters.
import type { Kpis, PlanParams, Strategy } from '../engine/types';

export interface DecisionRecord {
  run_id: string;
  scenario_id: string;
  scenario_label: string;
  computed_at_utc: string;
  decided_at_utc: string;
  decision: 'approuvee' | 'rejetee' | 'expiree';
  strategy: Strategy | null;
  recommended: Strategy | null;
  reason_code: string | null;
  comment: string;
  input_hash: string;
  engine_version: string;
  model_version: string | null;
  params: PlanParams;
  kpis: Kpis | null;
}

const KEY = 'bluemove.recharge.decisions.v1';

export function loadDecisions(): DecisionRecord[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveDecisions(list: DecisionRecord[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
    return true;
  } catch {
    return false;
  }
}

export const REJECT_REASONS: Record<string, string> = {
  TROP_LONG: 'Tournée trop longue',
  DONNEES_DOUTEUSES: 'Données douteuses',
  CONTRAINTE_TERRAIN: 'Contrainte terrain non prise en compte',
  PRIORITES_INCOHERENTES: 'Priorités incohérentes',
  AUTRE: 'Autre',
};
