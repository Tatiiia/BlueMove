// Banc d'essai reproductible : 15 instants simulés (jours ouvrés 16 à 20, hors entraînement du modèle).
// Jours 16–17 : calibration des poids (D-25) ; jours 18–20 : évaluation. Usage : npm run benchmark
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultParams, runPlanning } from '../src/engine/index';
import type { DepletionModel, HypothesesConfig, PlanParams, Scenario } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf-8')) as T;
const cfg = read<HypothesesConfig>('config/hypotheses.json');
const model = read<DepletionModel>('data/model/depletion_model_v1.json');
const index = read<{ id: string; file: string }[]>('data/benchmark/index.json');
const all = index.map((e) => read<Scenario>(`data/benchmark/${e.file}`));

const sets: [string, Scenario[]][] = [
  ['Évaluation (jours 18–20, 9 instants)', all.filter((s) => !/^BM1[67]/.test(s.id))],
  ['Calibration (jours 16–17, 6 instants)', all.filter((s) => /^BM1[67]/.test(s.id))],
];
const vehicles: [string, Partial<PlanParams>][] = [
  ['vélo-cargo ×2 (défaut)', {}],
  ['utilitaire ×2', { vehicle: 'utilitaire', capacity_batteries: 30, speed_kmh: 18, cost_per_km_eur: 0.2 }],
];
const weightSets: [string, PlanParams['weights']][] = [
  ['poids retenus 0,5/0,1/0,4', cfg.priority.weights],
  ['poids initiaux 0,5/0,35/0,15', cfg.priority.weights_initial_design ?? cfg.priority.weights],
];

const f = (x: number, d = 2) => x.toFixed(d).replace('.', ',');
for (const [setName, set] of sets) {
  for (const [wName, w] of weightSets) {
    for (const [vName, v] of vehicles) {
      const agg: Record<string, { sw: number; crit: number; cost: number; km: number; def: number; b20: number; rec: number }> = {};
      let critTotal = 0;
      for (const s of set) {
        const r = runPlanning(s, { ...defaultParams(cfg), ...v, weights: w }, cfg, model);
        critTotal += r.candidates.filter((c) => c.category === 'critique').length;
        for (const x of r.variants) {
          if (!x.kpis) continue;
          const a = (agg[x.strategy] ??= { sw: 0, crit: 0, cost: 0, km: 0, def: 0, b20: 0, rec: 0 });
          a.sw += x.kpis.swaps; a.crit += x.kpis.critical_served; a.cost += x.kpis.cost_eur; a.km += x.kpis.km;
          a.def += x.kpis.projected_weighted_deficit; a.b20 += x.kpis.projected_below_20; a.rec += x.is_recommended ? 1 : 0;
        }
      }
      console.log(`\n### ${setName} — ${wName} — ${vName} (critiques éligibles cumulés : ${critTotal})`);
      console.log('| Variante | Échanges | Critiques servis | Coût / recharge (€) | km / recharge | Déficit projeté pondéré | Scooters < 20 % à 3 h | Recommandée |');
      console.log('|---|---|---|---|---|---|---|---|');
      for (const [k, a] of Object.entries(agg)) {
        console.log(`| ${k} | ${a.sw} | ${a.crit} | ${f(a.cost / a.sw)} | ${f(a.km / a.sw)} | ${f(a.def, 1)} | ${a.b20} | ${a.rec}/${set.length} |`);
      }
    }
  }
}
