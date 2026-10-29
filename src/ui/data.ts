// Chargement des données de démonstration (fichiers statiques publiés avec l'application).
import config from '../../config/hypotheses.json';
import modelJson from '../../data/model/depletion_model_v1.json';
import type { DepletionModel, HypothesesConfig, Scenario } from '../engine/types';

export const cfg = config as unknown as HypothesesConfig;
export const model = modelJson as unknown as DepletionModel;

export interface ScenarioEntry {
  id: string; label: string; as_of_utc: string; weather: string; is_test_case: boolean;
  description?: string; expected_behavior?: string; file: string;
}

const cache = new Map<string, Promise<Scenario>>();

export async function loadIndex(): Promise<ScenarioEntry[]> {
  const r = await fetch('data/scenarios/index.json');
  if (!r.ok) throw new Error(`Index des scénarios introuvable (${r.status})`);
  return r.json();
}

export function loadScenario(folder: 'scenarios' | 'benchmark', file: string): Promise<Scenario> {
  const key = `${folder}/${file}`;
  if (!cache.has(key)) {
    cache.set(key, fetch(`data/${folder}/${file}`).then((r) => {
      if (!r.ok) throw new Error(`Scénario ${file} introuvable (${r.status})`);
      return r.json() as Promise<Scenario>;
    }).then(checkScenario));
  }
  return cache.get(key)!;
}

export async function loadBenchmarkIndex(): Promise<ScenarioEntry[]> {
  const r = await fetch('data/benchmark/index.json');
  if (!r.ok) throw new Error('Index du banc d\'essai introuvable');
  return r.json();
}

/** Contrôle de forme minimal : un fichier mal formé ne doit pas casser l'interface. */
function checkScenario(s: Scenario): Scenario {
  if (!s || typeof s.id !== 'string' || typeof s.as_of_utc !== 'string' || !Array.isArray(s.readings)) {
    throw new Error('Fichier de scénario invalide');
  }
  return s;
}
