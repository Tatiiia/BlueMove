import { useState } from 'react';
import { runPlanning } from '../engine/run';
import type { DepletionModel, HypothesesConfig, PlanParams, Strategy } from '../engine/types';
import { loadBenchmarkIndex, loadScenario } from './data';
import { eur, n, pct } from './format';
import { VARIANT_INFO } from './RunView';

interface Agg { sw: number; crit: number; cost: number; km: number; def: number; b20: number; rec: number }

export function Method({ cfg, model, modelUsable, params }: { cfg: HypothesesConfig; model: DepletionModel; modelUsable: boolean; params: PlanParams }) {
  const m = model.metrics as Record<string, number | string>;
  const [bench, setBench] = useState<{ evalOnly: Record<string, Agg>; calib: Record<string, Agg>; nEval: number; nCalib: number; critEval: number; ms: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const runBench = async () => {
    setBusy(true); setErr(null);
    try {
      const t0 = performance.now();
      const idx = await loadBenchmarkIndex();
      const scs = await Promise.all(idx.map((e) => loadScenario('benchmark', e.file)));
      const evalOnly: Record<string, Agg> = {}; const calib: Record<string, Agg> = {};
      let critEval = 0;
      for (const s of scs) {
        const isCalib = /^BM1[67]/.test(s.id);
        const r = runPlanning(s, params, cfg, model);
        if (!isCalib) critEval += r.candidates.filter((c) => c.category === 'critique').length;
        for (const v of r.variants) {
          if (!v.kpis) continue;
          const t = isCalib ? calib : evalOnly;
          const a = (t[v.strategy] ??= { sw: 0, crit: 0, cost: 0, km: 0, def: 0, b20: 0, rec: 0 });
          a.sw += v.kpis.swaps; a.crit += v.kpis.critical_served; a.cost += v.kpis.cost_eur; a.km += v.kpis.km;
          a.def += v.kpis.projected_weighted_deficit; a.b20 += v.kpis.projected_below_20; a.rec += v.is_recommended ? 1 : 0;
        }
      }
      setBench({ evalOnly, calib, nEval: scs.filter((s) => !/^BM1[67]/.test(s.id)).length, nCalib: scs.filter((s) => /^BM1[67]/.test(s.id)).length, critEval, ms: Math.round(performance.now() - t0) });
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const hyp: [string, string, string][] = [
    ['H01', 'Mode de recharge', 'Échange de batterie sur place ; le scooter n\'est pas déplacé (à confirmer)'],
    ['H03 / H27', 'Points de départ', cfg.depots.map((d) => d.name).join(' ; ') + ' — retour au point de départ'],
    ['H06', 'Véhicules', Object.values(cfg.vehicles).map((v) => `${v.label} : ${v.capacity_batteries} batteries, ${v.speed_kmh} km/h, ${n(v.cost_per_km_eur, 2)} €/km`).join(' · ')],
    ['H07', 'Temps d\'intervention', `${cfg.defaults.service_min} min par échange`],
    ['H08', 'Distances', `vol d'oiseau × ${n(cfg.defaults.detour_factor, 1)} — pas d'itinéraire routier`],
    ['H09', 'Coût agent', `${cfg.defaults.agent_cost_eur_h} €/h chargé`],
    ['H10', 'Seuils', `critique < ${cfg.thresholds.critical_pct} % (louabilité) · éligible < ${cfg.thresholds.max_eligible_pct} %`],
    ['H11', 'Horizon', `${cfg.horizon_h} h`],
    ['H12', 'Fraîcheur pour intervenir', `GPS ≤ ${cfg.thresholds.intervention_gps_max_age_min} min · BMS ≤ ${cfg.thresholds.intervention_bms_max_age_min} min (louable : 2 et 10 min)`],
    ['H13 / D-25', 'Poids de priorité', `urgence ${n(cfg.priority.weights.urgency, 2)} · demande ${n(cfg.priority.weights.demand, 2)} · rareté ${n(cfg.priority.weights.scarcity, 2)} (recalibrés ; conception initiale 0,50 / 0,35 / 0,15)`],
    ['H14', 'Flotte simulée', `${cfg.fleet.size} scooters, ${cfg.zones.length} zones`],
    ['H15 / H23', 'Demande', 'Heatmap W5 (valeurs illustratives) × 3'],
    ['H18', 'Validité d\'une recommandation', `${cfg.plan_expiry_min} min`],
    ['H24', 'Alerte température', `> ${cfg.thresholds.battery_temp_max_c} °C (provisoire)`],
  ];

  const strategies: Strategy[] = ['REF', 'OPT_REGLE', 'OPT_ML'];
  const BenchTable = ({ t, nInst }: { t: Record<string, Agg>; nInst: number }) => (
    <table className="t">
      <thead><tr><th>Variante</th><th className="num">Interventions</th><th className="num">Critiques servis</th><th className="num">Coût / recharge</th><th className="num">km / recharge</th><th className="num">Déficit projeté</th><th className="num">&lt; 20 % à 3 h</th><th className="num">Recommandée</th></tr></thead>
      <tbody>{strategies.filter((s) => t[s]).map((s) => {
        const a = t[s];
        return (
          <tr key={s}><td className="strong">{VARIANT_INFO[s].name}</td><td className="num">{a.sw}</td><td className="num">{a.crit}</td>
            <td className="num">{eur(a.sw ? a.cost / a.sw : null)}</td><td className="num">{n(a.sw ? a.km / a.sw : null, 2)}</td>
            <td className="num">{n(a.def, 1)}</td><td className="num">{a.b20}</td><td className="num">{a.rec} / {nInst}</td></tr>
        );
      })}</tbody>
    </table>
  );

  return (
    <>
      <div className="layers">
        <div className="layer"><span className="tag rule">Règles métier</span><h3>Contrôles et éligibilité</h3>
          <ul><li>Rejets qualité : doublon, charge hors 0–100 %, coordonnées, horodatage, batterie non conforme, statut inconnu</li>
            <li>Exclusions : loué, réservé, maintenance, données périmées, hors zone, zone fermée, charge suffisante</li>
            <li>Alerte BMS → maintenance (activité distincte)</li>
            <li>Score de priorité : formule pondérée lisible</li></ul></div>
        <div className="layer"><span className="tag opt">Optimisation classique</span><h3>Construction des tournées</h3>
          <ul><li>Référence : critiques au plus proche voisin</li><li>Optimisée : insertion gloutonne (priorité / minute ajoutée), 2-opt, échanges</li>
            <li>Contraintes garanties : durée, batteries, retour au départ</li><li><b>Pas de l'IA</b> : aucun apprentissage</li></ul></div>
        <div className="layer"><span className="tag ml">Apprentissage automatique</span><h3>Risque d'épuisement à 3 h</h3>
          <ul><li>Régression logistique, 4 variables</li><li>Seulement pour les préventifs (20–40 %)</li>
            <li>Entraînée hors ligne sur données <b>simulées</b></li><li>Désactivable ; comparée à la règle « batteries les plus faibles d'abord »</li></ul></div>
        <div className="layer"><span className="tag human">Décision humaine</span><h3>Validation</h3>
          <ul><li>Le responsable approuve ou rejette (motif obligatoire)</li><li>Expiration après {cfg.plan_expiry_min} min</li>
            <li>Empreinte des entrées et versions tracées</li><li>Aucune action automatique</li></ul></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h2>Fiche du modèle</h2><span className="tag ml">ML</span><span className="tag sim">données simulées</span><span className="spacer" />
            <span className={`tag ${modelUsable ? 'good' : 'bad'}`}>{modelUsable ? `v${model.version} chargé` : 'indisponible'}</span></div>
          <div className="card-b stack">
            <div className="notice warn small">{model.warning ?? 'Métriques mesurées sur données simulées.'} Seuils d'activation sur données réelles : AUC ≥ 0,75 et précision@10 ≥ référence + 10 points (H22).</div>
            <dl className="kv small">
              <dt>Cible</dt><dd>{model.target}</dd>
              <dt>Algorithme</dt><dd>régression logistique (scikit-learn), coefficients exportés en JSON</dd>
              <dt>Apprentissage / test</dt><dd>{String(m.train_period)} ({n(Number(m.n_train))} lignes) / {String(m.test_period)} ({n(Number(m.n_test))} lignes)</dd>
              <dt>Taux de positifs (test)</dt><dd>{pct(Number(m.positive_rate_test), 1)}</dd>
            </dl>
            <table className="t">
              <thead><tr><th>Métrique (période de test)</th><th className="num">Modèle</th><th className="num">Référence sans ML</th></tr></thead>
              <tbody>
                <tr><td>ROC AUC</td><td className="num">{n(Number(m.roc_auc), 3)}</td><td className="num">{n(Number(m.baseline_roc_auc), 3)}</td></tr>
                <tr><td>Précision@10 par heure</td><td className="num">{n(Number(m.precision_at_10), 3)}</td><td className="num">{n(Number(m.baseline_precision_at_10), 3)}</td></tr>
                <tr><td>Score de Brier (plus bas = mieux)</td><td className="num">{n(Number(m.brier), 4)}</td><td className="num">{n(Number(m.brier_prior_only), 4)} <span className="xs muted">(taux constant)</span></td></tr>
              </tbody>
            </table>
            <p className="small"><b>Lecture.</b> Même sur la simulation, le gain du modèle sur la règle « batteries les plus faibles d'abord » est faible (précision@10 : +{n((Number(m.precision_at_10) - Number(m.baseline_precision_at_10)) * 100, 1)} point). Il resterait sous le seuil d'activation H22. C'est cohérent avec la grille (153/220) : l'optimisation porte l'essentiel du gain, le ML reste conditionnel.</p>
            <table className="t">
              <thead><tr><th>Variable (standardisée)</th><th className="num">Moyenne</th><th className="num">Écart-type</th><th className="num">Coefficient</th></tr></thead>
              <tbody>{model.features.map((f, i) => (
                <tr key={f}><td className="code">{f}</td><td className="num">{n(model.mean[i], 2)}</td><td className="num">{n(model.std[i], 2)}</td><td className="num">{model.coef[i] > 0 ? '+' : ''}{n(model.coef[i], 3)}</td></tr>
              ))}<tr><td className="muted">constante</td><td /><td /><td className="num">{n(model.intercept, 3)}</td></tr></tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h2>Hypothèses en vigueur</h2><span className="tag sim">à valider</span></div>
          <div className="card-b flush">
            <table className="t"><tbody>{hyp.map(([id, l, v]) => (
              <tr key={id}><td className="code nowrap">{id}</td><td className="strong">{l}</td><td className="small">{v}</td></tr>
            ))}</tbody></table>
          </div>
          <div className="card-b">
            <p className="small strong">Limites à garder en tête</p>
            <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Toutes les données sont simulées ; aucun résultat n'est un gain mesuré chez BlueMove.</li>
              <li>Distances estimées à vol d'oiseau ; pas de trafic ni d'itinéraire routier.</li>
              <li>Projection de service simplifiée : consommation moyenne, scooters immobiles.</li>
              <li>Le mode de recharge réel (échange ou collecte) reste à confirmer.</li>
              <li>K3 et K4 ne sont mesurables qu'au pilote ; K6 ne s'applique pas à un échange de batterie.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Banc d'essai — 15 instants simulés</h2>
          <span className="tag sim">jours ouvrés 16 à 20, non vus à l'entraînement</span>
          <span className="spacer" />
          <button className="btn primary" onClick={runBench} disabled={busy}>{busy ? 'Calcul…' : 'Lancer avec les paramètres actuels'}</button>
        </div>
        <div className="card-b stack">
          <p className="small muted">Robustesse de la comparaison au-delà d'un seul scénario : les trois variantes sont recalculées sur 15 instants (06 h 30, 11 h 30 et 16 h 30). Les jours 16–17 ont servi à recalibrer les poids (D-25) ; le résultat de référence est celui des jours 18–20.</p>
          {err && <div className="notice err small">{err}</div>}
          {bench ? (
            <>
              <div className="small strong">Évaluation — jours 18 à 20 ({bench.nEval} instants, {bench.critEval} scooters critiques éligibles cumulés)</div>
              <div style={{ overflowX: 'auto' }}><BenchTable t={bench.evalOnly} nInst={bench.nEval} /></div>
              <details className="adv"><summary>Jours de calibration 16–17 ({bench.nCalib} instants) ▾</summary>
                <div style={{ overflowX: 'auto', marginTop: 8 }}><BenchTable t={bench.calib} nInst={bench.nCalib} /></div></details>
              <p className="xs muted">Calculé en {bench.ms} ms dans le navigateur. Valeurs simulées : elles servent à comparer les méthodes, pas à estimer un gain réel.</p>
            </>
          ) : <div className="empty small">Cliquez sur « Lancer » pour calculer le banc d'essai avec les paramètres du tableau de bord.</div>}
        </div>
      </div>
    </>
  );
}
