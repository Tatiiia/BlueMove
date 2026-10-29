// Tests du moteur (node:test) — critères d'acceptation MVP_SPEC §14 et cas T01–T12.
// Exécution : npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  defaultParams, expectedSearches, normalizeWeights, predictDepletion, priorityScore, runPlanning, sanitizeParams,
  sha256Hex, zoneDemand,
} from '../src/engine/index';
import { recommendForTest } from '../src/engine/run';
void normalizeWeights;
import type { DepletionModel, HypothesesConfig, PlanParams, RunResult, Scenario, VariantResult } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf-8')) as T;
const cfg = read<HypothesesConfig>('config/hypotheses.json');
const model = read<DepletionModel>('data/model/depletion_model_v1.json');
const scen = (id: string) => read<Scenario>(`data/scenarios/${id}.json`);
const P = (over: Partial<PlanParams> = {}): PlanParams => ({ ...defaultParams(cfg), ...over });
const run = (id: string, over: Partial<PlanParams> = {}, m: DepletionModel | null = model) => runPlanning(scen(id), P(over), cfg, m);
const allStops = (r: RunResult) => r.variants.flatMap((v) => v.routes.flatMap((x) => x.stops));
const codeCount = (r: RunResult, code: string) => r.validation.summary[code] ?? 0;

test('SHA-256 : vecteur de référence', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('Demande : identique au générateur Python (fixtures)', () => {
  const fx = read<{ zone_id: string; as_of_utc: string; horizon_h: number; expected: number }[]>('tests/fixtures/demand_fixtures.json');
  for (const f of fx) assert.ok(Math.abs(expectedSearches(cfg, f.zone_id, f.as_of_utc, f.horizon_h) - f.expected) < 1e-9, `${f.zone_id} ${f.as_of_utc}`);
});

test('Modèle : inférence TypeScript identique à scikit-learn (fixtures)', () => {
  const fx = read<{ x: number[]; p: number }[]>('tests/fixtures/model_fixtures.json');
  for (const f of fx) assert.ok(Math.abs(predictDepletion(model, f.x) - f.p) < 1e-9);
});

test('AC-15 : exemples de référence de la formule de priorité (90,40 et 41,15)', () => {
  const w = { urgency: 0.5, demand: 0.35, scarcity: 0.15 }; // poids de l'exemple de MVP_SPEC §7.4
  const d = zoneDemand(cfg, '2026-11-03T15:30:00Z');
  assert.ok(Math.abs(d['Z-GARE'].e - 19.3333333) < 1e-6);
  assert.equal(d['Z-GARE'].d, 1);
  assert.ok(Math.abs(d['Z-CAMP'].d - 10.5 / 19.333333333) < 1e-6);
  assert.ok(Math.abs(priorityScore(w, 1, d['Z-GARE'].d, (50 - 32) / 50) - 90.4) < 0.01);
  const u = 0.8 * (40 - 30) / 20;
  assert.ok(Math.abs(priorityScore(w, u, d['Z-CAMP'].d, (35 - 30) / 35) - 41.15) < 0.01);
});

test('AC-02 : chaque scooter dans une seule catégorie', () => {
  for (const id of ['SC02', 'TC08']) {
    const r = run(id);
    const s = scen(id);
    const distinct = new Set(s.readings.map((x) => x.scooter_id)).size;
    assert.equal(r.validation.scooters.length, distinct);
    const sum = Object.entries(r.validation.summary).filter(([k]) => k !== 'REJ_DOUBLON' && k !== 'REMPLACE').reduce((a, [, v]) => a + v, 0);
    assert.equal(sum, distinct);
  }
});

test('AC-03 / T08 : erreurs de données rejetées avec le bon motif', () => {
  const r = run('TC08');
  const base = run('SC02');
  assert.equal(codeCount(r, 'REJ_BATTERIE_INVALIDE'), 2);
  assert.equal(codeCount(r, 'REJ_DOUBLON'), 1);
  assert.equal(codeCount(r, 'REJ_COORDONNEES'), 1);
  assert.equal(codeCount(r, 'REJ_ASSOCIATION_BATTERIE'), 1);
  assert.equal(codeCount(r, 'REJ_STATUT_INCONNU'), 1);
  assert.equal(codeCount(base, 'REJ_BATTERIE_INVALIDE'), 0);
  const rejected = new Set(r.validation.scooters.filter((s) => s.outcome === 'rejet_qualite').map((s) => s.scooter_id));
  for (const st of allStops(r)) assert.ok(!rejected.has(st.scooter_id));
});

test('AC-04 / T02 : données périmées exclues', () => {
  const r = run('TC02');
  assert.equal(codeCount(r, 'EXCL_BMS_PERIME'), 15);
  assert.equal(codeCount(r, 'EXCL_GPS_PERIME'), 5);
  const stale = new Set(r.validation.scooters.filter((s) => s.reason_code?.endsWith('PERIME')).map((s) => s.scooter_id));
  for (const st of allStops(r)) assert.ok(!stale.has(st.scooter_id));
});

test('AC-05 / T03 : jamais de scooter loué ou réservé dans une tournée', () => {
  const r = run('TC03');
  const base = run('SC02');
  assert.equal(codeCount(r, 'EXCL_EN_LOCATION'), codeCount(base, 'EXCL_EN_LOCATION') + 6);
  assert.equal(codeCount(r, 'EXCL_RESERVE'), codeCount(base, 'EXCL_RESERVE') + 4);
  const busy = new Set(scen('TC03').readings.filter((x) => x.rental_status !== 'libre').map((x) => x.scooter_id));
  for (const st of allStops(r)) assert.ok(!busy.has(st.scooter_id));
});

test('AC-06 / T09 : alertes batterie orientées maintenance', () => {
  const r = run('TC09');
  assert.equal(codeCount(r, 'MAINT_ALERTE_BMS'), 2);
  assert.equal(codeCount(r, 'MAINT_TEMPERATURE'), 1);
  const maint = new Set(r.validation.scooters.filter((s) => s.outcome === 'maintenance').map((s) => s.scooter_id));
  for (const st of allStops(r)) assert.ok(!maint.has(st.scooter_id));
});

test('AC-07 / T06 : aucune étape dans une zone fermée', () => {
  const r = run('SC02', { closed_zones: ['Z-GARE'] });
  assert.ok(codeCount(r, 'EXCL_ZONE_FERMEE') > 0);
  for (const st of allStops(r)) assert.notEqual(st.zone_id, 'Z-GARE');
});

test('AC-08 / T10 : scooters hors zone exclus', () => {
  assert.equal(codeCount(run('TC10'), 'EXCL_HORS_ZONE'), 4);
});

test('AC-09 / AC-10 / T12 : contraintes respectées dans tous les scénarios et variantes', () => {
  const ids = ['SC01', 'SC02', 'SC03', 'TC01', 'TC02', 'TC03', 'TC08', 'TC09', 'TC10'];
  const settings: Partial<PlanParams>[] = [
    {},
    { agents: 3, vehicle: 'utilitaire', capacity_batteries: 30, speed_kmh: 18, cost_per_km_eur: 0.2, shift_min: 480 },
    { agents: 1, capacity_batteries: 5, shift_min: 90, depot_id: 'DEP-2' },
  ];
  for (const id of ids) {
    for (const s of settings) {
      const r = run(id, s);
      const eligible = new Set(r.candidates.map((c) => c.scooter_id));
      const critical = new Set(r.candidates.filter((c) => c.category === 'critique').map((c) => c.scooter_id));
      for (const v of r.variants) {
        const seen = new Set<string>();
        for (const route of v.routes) {
          assert.ok(route.stops.length <= r.params.capacity_batteries, `${id} ${v.strategy} capacité`);
          assert.ok(route.duration_min <= r.params.shift_min + 1e-6, `${id} ${v.strategy} durée ${route.duration_min}`);
          for (const st of route.stops) {
            assert.ok(eligible.has(st.scooter_id), 'étape non éligible');
            assert.ok(!seen.has(st.scooter_id), 'scooter visité deux fois');
            seen.add(st.scooter_id);
            if (v.strategy === 'REF') assert.ok(critical.has(st.scooter_id), 'REF hors critiques');
          }
        }
      }
    }
  }
});

test('T01 : capacité contraignante — critiques non servis motivés', () => {
  const r = run('TC01');
  const opt = r.variants.find((v) => v.strategy === 'OPT_REGLE')!;
  assert.ok(opt.kpis!.swaps <= 24);
  assert.ok(opt.unserved.some((u) => u.category === 'critique' && u.reason === 'Capacité batteries atteinte'));
});

test('T04 : capacité réduite à 3 batteries par agent', () => {
  const r = run('SC02', { capacity_batteries: 3 });
  for (const v of r.variants) for (const route of v.routes) assert.ok(route.stops.length <= 3);
});

test('T05 : temps insuffisant — tournées courtes et motif explicite', () => {
  const r = run('SC02', { shift_min: 30 });
  const opt = r.variants.find((v) => v.strategy === 'OPT_REGLE')!;
  for (const route of opt.routes) assert.ok(route.duration_min <= 30 + 1e-6);
  assert.ok(opt.unserved.some((u) => u.reason === 'Temps insuffisant'));
});

test('AC-11 / T07 : aucune tournée admissible → message explicite, pas d\'erreur', () => {
  const others = cfg.zones.map((z) => z.id).filter((z) => z !== 'Z-RES');
  const r = run('SC02', { shift_min: 30, depot_id: 'DEP-2', closed_zones: others });
  for (const v of r.variants.filter((x) => x.status === 'proposee')) {
    assert.equal(v.routes.reduce((s, x) => s + x.stops.length, 0), 0);
    assert.match(v.message ?? '', /^Aucune tournée admissible/);
  }
  const all = run('SC02', { closed_zones: cfg.zones.map((z) => z.id) });
  assert.match(all.variants[1].message ?? '', /zones des candidats toutes fermées/);
});

test('AC-12 : déterminisme (mêmes entrées → mêmes tournées, même empreinte)', () => {
  const a = run('SC01');
  const b = run('SC01');
  assert.equal(a.input_hash, b.input_hash);
  assert.deepEqual(a.variants.map((v) => v.routes), b.variants.map((v) => v.routes));
  assert.notEqual(run('SC01', { agents: 3 }).input_hash, a.input_hash);
});

test('AC-13 : performance (300 scooters, 3 agents, utilitaire, 480 min)', () => {
  const r = run('TC01', { agents: 3, vehicle: 'utilitaire', capacity_batteries: 30, speed_kmh: 18, cost_per_km_eur: 0.2, shift_min: 480 });
  assert.ok(r.compute_ms < 2000, `${r.compute_ms} ms`);
});

test('AC-17 / T11 : modèle absent ou ML désactivé → OPT_ML non calculée', () => {
  for (const r of [run('SC02', {}, null), run('SC02', { ml_enabled: false })]) {
    const ml = r.variants.find((v) => v.strategy === 'OPT_ML')!;
    assert.equal(ml.status, 'non_calculee');
    assert.ok(r.recommended === 'REF' || r.recommended === 'OPT_REGLE');
    assert.equal(r.model_version, null);
  }
  const broken = { ...model, coef: [1, 2] };
  assert.equal(run('SC02', {}, broken as DepletionModel).variants[2].status, 'non_calculee');
});

test('AC-16 : la référence peut être recommandée', () => {
  const k = (deficit: number, cov: number | null, cost: number | null) => ({
    swaps: 1, critical_served: 0, duration_h: 1, km: 1, cost_eur: 1, kr1_cost_per_swap: cost, kr2_swaps_per_hour: 1,
    kr3_km_per_swap: 1, kr4_critical_coverage: cov, kr4b_critical_coverage_high_demand: cov, priority_served: 0,
    projected_weighted_deficit: deficit, projected_below_20: 0,
  });
  const v = (s: 'REF' | 'OPT_REGLE' | 'OPT_ML', kp: ReturnType<typeof k>): VariantResult =>
    ({ strategy: s, status: 'proposee', routes: [], kpis: kp, unserved: [], message: null, is_recommended: false });
  assert.equal(recommendForTest([v('REF', k(10, 0.5, 20)), v('OPT_REGLE', k(12, 0.9, 10))]).strategy, 'REF');
  assert.equal(recommendForTest([v('REF', k(10, 0.5, 20)), v('OPT_REGLE', k(10.05, 0.9, 10))]).strategy, 'OPT_REGLE');
});

test('AC-24 : indicateurs « ND » sans échange', () => {
  const r = run('SC02', { closed_zones: cfg.zones.map((z) => z.id) });
  const k = r.variants[0].kpis!;
  assert.equal(k.swaps, 0);
  assert.equal(k.kr1_cost_per_swap, null);
  assert.equal(k.kr2_swaps_per_hour, null);
  assert.equal(k.kr3_km_per_swap, null);
});

test('Validation des paramètres : valeurs hors bornes corrigées', () => {
  const { params, corrections } = sanitizeParams(P({ agents: 9, shift_min: 5, capacity_batteries: 0, depot_id: 'X', closed_zones: ['Z-GARE', 'ZZZ'] }), cfg);
  assert.equal(params.agents, 3);
  assert.equal(params.shift_min, 30);
  assert.equal(params.capacity_batteries, 1);
  assert.equal(params.depot_id, 'DEP-1');
  assert.deepEqual(params.closed_zones, ['Z-GARE']);
  assert.ok(corrections.length >= 3);
});

test('Seuil d\'intervention : modifie réellement le nombre de candidats', () => {
  const low = run('SC02', { max_eligible_pct: 25 }).candidates.length;
  const high = run('SC02', { max_eligible_pct: 60 }).candidates.length;
  assert.ok(high > low);
});
