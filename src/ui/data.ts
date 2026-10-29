// Données de démonstration intégrées au build (aucun appel réseau : fonctionne aussi dans un artefact Claude).
import config from '../../config/hypotheses.json';
import modelJson from '../../data/model/depletion_model_v1.json';
import benchIndex from '../../data/benchmark/index.json';
import scenarioIndex from '../../data/scenarios/index.json';
import type { DepletionModel, HypothesesConfig, Scenario } from '../engine/types';
import { BENCHMARK, SCENARIOS } from './bundled';

export const cfg = config as unknown as HypothesesConfig;
export const model = modelJson as unknown as DepletionModel;

export interface ScenarioEntry {
  id: string; label: string; as_of_utc: string; weather: string; is_test_case: boolean;
  description?: string; expected_behavior?: string; file: string;
}

export async function loadIndex(): Promise<ScenarioEntry[]> {
  return scenarioIndex as ScenarioEntry[];
}

export async function loadBenchmarkIndex(): Promise<ScenarioEntry[]> {
  return benchIndex as unknown as ScenarioEntry[];
}

export async function loadScenario(folder: 'scenarios' | 'benchmark', file: string): Promise<Scenario> {
  const s = (folder === 'scenarios' ? SCENARIOS : BENCHMARK)[file.replace('.json', '')];
  return checkScenario(s as Scenario);
}

/** Contrôle de forme minimal : un fichier mal formé ne doit pas casser l'interface. */
function checkScenario(s: Scenario): Scenario {
  if (!s || typeof s.id !== 'string' || typeof s.as_of_utc !== 'string' || !Array.isArray(s.readings)) {
    throw new Error('Fichier de scénario invalide');
  }
  return s;
}
