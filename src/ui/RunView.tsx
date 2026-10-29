import { useEffect, useMemo, useState } from 'react';
import type { Depot, HypothesesConfig, Kpis, RunResult, Strategy, VariantResult, Zone } from '../engine/types';
import { FleetMap, MapLegend, type MapRoute } from './FleetMap';
import { clockAfter, eur, hours, localTime, minutes, n, pct, rel, signedPct } from './format';
import { AGENT_COLORS, buildPoints } from './points';
import { REJECT_REASONS, type DecisionRecord } from './store';

export interface RunMeta { run_id: string; computed_at_utc: string; scenario_label: string; result: RunResult }

export const VARIANT_INFO: Record<Strategy, { name: string; desc: string; tag: string; tagClass: string }> = {
  REF: { name: 'Référence', desc: 'Critiques < 20 % au plus proche voisin — planification manuelle simulée', tag: 'sans IA', tagClass: 'rule' },
  OPT_REGLE: { name: 'Optimisée', desc: 'Priorité par règles + heuristique de tournée (insertion, 2-opt, échanges)', tag: 'optimisation', tagClass: 'opt' },
  OPT_ML: { name: 'Optimisée + ML', desc: 'Idem, urgence des préventifs estimée par le modèle de risque à 3 h', tag: 'optimisation + ML', tagClass: 'ml' },
};

type Better = 'lower' | 'higher' | 'none';
const ROWS: { label: string; key: keyof Kpis; fmt: (x: number | null) => string; better: Better; hint?: string }[] = [
  { label: 'Interventions planifiées', key: 'swaps', fmt: (x) => n(x), better: 'higher' },
  { label: 'dont scooters critiques', key: 'critical_served', fmt: (x) => n(x), better: 'higher' },
  { label: 'Durée mobilisée (agents cumulés)', key: 'duration_h', fmt: (x) => hours(x), better: 'none' },
  { label: 'Distance estimée', key: 'km', fmt: (x) => `${n(x, 1)} km`, better: 'none' },
  { label: 'Coût estimé de la tournée', key: 'cost_eur', fmt: (x) => eur(x), better: 'none' },
  { label: 'KR1 · Coût par recharge', key: 'kr1_cost_per_swap', fmt: (x) => eur(x), better: 'lower' },
  { label: 'KR2 · Recharges par heure-agent', key: 'kr2_swaps_per_hour', fmt: (x) => n(x, 2), better: 'higher' },
  { label: 'KR3 · km par recharge', key: 'kr3_km_per_swap', fmt: (x) => n(x, 2), better: 'lower' },
  { label: 'KR4 · Couverture des critiques', key: 'kr4_critical_coverage', fmt: (x) => pct(x), better: 'higher' },
  { label: 'KR4b · Critiques en zones à forte demande', key: 'kr4b_critical_coverage_high_demand', fmt: (x) => pct(x), better: 'higher' },
  { label: 'Déficit projeté pondéré à 3 h', key: 'projected_weighted_deficit', fmt: (x) => n(x, 1), better: 'lower', hint: 'projection simulée' },
  { label: 'Scooters projetés < 20 % à 3 h', key: 'projected_below_20', fmt: (x) => n(x), better: 'lower', hint: 'projection simulée' },
];

function Delta({ a, b, better }: { a: number | null | undefined; b: number | null | undefined; better: Better }) {
  const d = rel(a, b);
  if (d === null) return <span className="delta neutral">{a === b && a !== null && a !== undefined ? '=' : '—'}</span>;
  const cls = better === 'none' || Math.abs(d) < 0.005 ? 'neutral' : (better === 'lower') === (d < 0) ? 'good' : 'bad';
  return <span className={`delta ${cls}`}>{signedPct(d)}</span>;
}

interface Props {
  cfg: HypothesesConfig;
  meta: RunMeta;
  zones: Zone[];
  depots: Depot[];
  decision: DecisionRecord | undefined;
  onDecide: (d: DecisionRecord) => void;
  onBack: () => void;
  stale: boolean;
}

export function RunView({ cfg, meta, zones, depots, decision, onDecide, onBack, stale }: Props) {
  const r = meta.result;
  const [active, setActive] = useState<Strategy>(r.recommended ?? 'OPT_REGLE');
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [approveChoice, setApproveChoice] = useState<Strategy>(r.recommended ?? 'OPT_REGLE');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(t); }, []);

  const v = r.variants.find((x) => x.strategy === active)!;
  const byStrat = Object.fromEntries(r.variants.map((x) => [x.strategy, x])) as Record<Strategy, VariantResult>;
  const zoneName = useMemo(() => Object.fromEntries(zones.map((z) => [z.id, z.name])), [zones]);
  const points = useMemo(() => buildPoints(r.validation.scooters, r.candidates, r.model_version !== null), [r]);
  const routes: MapRoute[] = v.routes.filter((x) => x.stops.length).map((x) => ({
    agent: x.agent_index, color: AGENT_COLORS[(x.agent_index - 1) % 3],
    stops: x.stops.map((s) => ({ lat: s.lat, lng: s.lng, seq: s.seq, id: s.scooter_id })),
  }));
  const expiresAt = Date.parse(meta.computed_at_utc) + cfg.plan_expiry_min * 60000;
  const expired = now > expiresAt;
  const minsLeft = Math.max(0, Math.ceil((expiresAt - now) / 60000));
  const startIso = r.as_of_utc;
  const depot = depots.find((d) => d.id === r.params.depot_id)!;

  const decide = (decisionType: 'approuvee' | 'rejetee') => {
    setError(null);
    if (expired) { setError('Recommandation expirée : relancez le calcul avec des données à jour.'); return; }
    if (decisionType === 'rejetee' && !reason) { setError('Un motif est obligatoire pour rejeter une recommandation.'); return; }
    const chosen = decisionType === 'approuvee' ? approveChoice : null;
    onDecide({
      run_id: meta.run_id, scenario_id: r.scenario_id, scenario_label: meta.scenario_label, computed_at_utc: meta.computed_at_utc,
      decided_at_utc: new Date().toISOString(), decision: decisionType, strategy: chosen, recommended: r.recommended,
      reason_code: decisionType === 'rejetee' ? reason : null, comment: comment.trim(), input_hash: r.input_hash,
      engine_version: r.engine_version, model_version: r.model_version, params: r.params,
      kpis: chosen ? byStrat[chosen].kpis : null,
    });
  };

  const approvedVariant = decision?.decision === 'approuvee' && decision.strategy ? byStrat[decision.strategy] : null;
  const k = v.kpis;

  return (
    <>
      <div className="card">
        <div className="card-b row wrap" style={{ gap: 14 }}>
          <div className="stack-sm" style={{ minWidth: 240 }}>
            <span className="xs muted">Recommandation calculée le {localTime(meta.computed_at_utc)} pour la situation du {localTime(r.as_of_utc)}</span>
            <span className="strong">{meta.scenario_label}</span>
          </div>
          <dl className="kv xs" style={{ flex: 1, minWidth: 280 }}>
            <dt>Empreinte des entrées</dt><dd className="code">{r.input_hash.slice(0, 16)}…</dd>
            <dt>Versions</dt><dd>moteur {r.engine_version} · modèle {r.model_version ?? 'désactivé'} · hypothèses {r.config_version}</dd>
            <dt>Calcul</dt><dd>{r.compute_ms} ms · {r.candidates.length} candidats · départ {depot.name}</dd>
          </dl>
          {decision ? (
            <span className={`tag ${decision.decision === 'approuvee' ? 'good' : 'bad'}`}>
              {decision.decision === 'approuvee' ? `Approuvée : ${VARIANT_INFO[decision.strategy!].name}` : 'Rejetée'}
            </span>
          ) : expired ? <span className="tag bad">Expirée</span> : <span className="tag human">Proposée · expire dans {minsLeft} min</span>}
          <button className="btn" onClick={onBack}>← Modifier les paramètres</button>
        </div>
        {stale && <div className="notice warn small" style={{ margin: '0 16px 14px' }}>Les paramètres ou le scénario ont changé depuis ce calcul : relancez « Optimiser la tournée » pour une recommandation à jour.</div>}
      </div>

      <div className="variant-tabs">
        {r.variants.map((x) => {
          const info = VARIANT_INFO[x.strategy];
          return (
            <button key={x.strategy} className={`vt ${active === x.strategy ? 'on' : ''}`} disabled={x.status !== 'proposee'} onClick={() => setActive(x.strategy)}>
              <div className="n">{info.name} {x.is_recommended && <span className="star" title="Variante recommandée">★ recommandée</span>}
                <span className="spacer" /><span className={`tag ${info.tagClass}`}>{info.tag}</span></div>
              <div className="d">{info.desc}</div>
              <div className="d num" style={{ color: 'var(--ink-2)', marginTop: 6 }}>
                {x.kpis ? <>{x.kpis.swaps} interventions · {n(x.kpis.km, 1)} km · {eur(x.kpis.kr1_cost_per_swap)} / recharge</> : x.message}
              </div>
            </button>
          );
        })}
      </div>
      {r.recommended && <p className="xs muted">{r.recommendation_reason}</p>}

      <div className="kpis">
        <div className="kpi accent"><div className="label">Interventions</div><div className="value">{k?.swaps ?? 0}</div><div className="sub">dont {k?.critical_served ?? 0} critiques · sur {r.candidates.length} éligibles</div></div>
        <div className="kpi"><div className="label">Durée mobilisée</div><div className="value">{hours(k?.duration_h ?? 0)}</div><div className="sub">agents cumulés · max {minutes(r.params.shift_min)} / agent</div></div>
        <div className="kpi"><div className="label">Distance estimée</div><div className="value">{n(k?.km ?? 0, 1)}<span className="unit">km</span></div><div className="sub">vol d'oiseau × {n(r.params.detour_factor, 2)}</div></div>
        <div className="kpi teal"><div className="label">Coût estimé</div><div className="value">{eur(k?.cost_eur ?? 0, 0)}</div><div className="sub">{eur(k?.kr1_cost_per_swap ?? null)} par recharge (KR1)</div></div>
        <div className="kpi crit"><div className="label">Critiques couverts</div><div className="value">{pct(k?.kr4_critical_coverage ?? null)}</div><div className="sub">KR4 · zones fortes : {pct(k?.kr4b_critical_coverage_high_demand ?? null)}</div></div>
        <div className="kpi"><div className="label">Non retenus</div><div className="value">{v.unserved.length}</div><div className="sub">dont {v.unserved.filter((u) => u.category === 'critique').length} critiques</div></div>
      </div>

      {v.message && <div className="notice err"><b>{v.message}</b> Ajustez la durée, la capacité, le point de départ ou les zones fermées.</div>}

      <div className="grid-run">
        <div className="card">
          <div className="card-h"><h2>Itinéraire — {VARIANT_INFO[active].name}</h2><span className="tag sim">estimation</span></div>
          <div className="card-b" style={{ paddingBottom: 8 }}><MapLegend withRoutes /></div>
          <FleetMap zones={zones} depots={depots} activeDepot={r.params.depot_id} closedZones={r.params.closed_zones} points={points}
            routes={routes} selectedId={selected} onSelect={setSelected} center={cfg.city_center} fadeUnrouted />
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-h"><h2>Validation humaine</h2><span className="tag human">décision opérateur</span></div>
            <div className="card-b stack">
              {decision ? (
                <div className={`notice ${decision.decision === 'approuvee' ? 'ok' : 'warn'}`}>
                  <div>
                    <b>{decision.decision === 'approuvee' ? `Variante « ${VARIANT_INFO[decision.strategy!].name} » approuvée` : `Recommandation rejetée — ${REJECT_REASONS[decision.reason_code ?? ''] ?? ''}`}</b>
                    <div className="small">le {localTime(decision.decided_at_utc)}{decision.comment ? ` · « ${decision.comment} »` : ''}</div>
                    <div className="xs" style={{ marginTop: 4 }}>Décision enregistrée dans le simulateur. Aucune intervention réelle n'est déclenchée.</div>
                  </div>
                </div>
              ) : expired ? (
                <div className="notice warn">Cette recommandation a expiré ({cfg.plan_expiry_min} min) : les données ont vieilli. Relancez le calcul.</div>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="appr">Variante à approuver</label>
                    <select id="appr" value={approveChoice} onChange={(e) => setApproveChoice(e.target.value as Strategy)}>
                      {r.variants.filter((x) => x.status === 'proposee').map((x) => (
                        <option key={x.strategy} value={x.strategy}>{VARIANT_INFO[x.strategy].name}{x.is_recommended ? ' (recommandée)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button className="btn good" onClick={() => decide('approuvee')} disabled={(byStrat[approveChoice]?.kpis?.swaps ?? 0) === 0}>Approuver la tournée</button>
                  <div className="row" style={{ gap: 8 }}>
                    <select aria-label="Motif de rejet" value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px' }}>
                      <option value="">Motif de rejet…</option>
                      {Object.entries(REJECT_REASONS).map(([code, l]) => <option key={code} value={code}>{l}</option>)}
                    </select>
                    <button className="btn danger" onClick={() => decide('rejetee')}>Rejeter</button>
                  </div>
                  <textarea aria-label="Commentaire" placeholder="Commentaire (facultatif)" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                  {error && <div className="notice err small">{error}</div>}
                  <p className="xs muted">L'application recommande ; vous décidez. Aucune commande n'est envoyée aux scooters ni aux agents.</p>
                </>
              )}
              {approvedVariant && <button className="btn" onClick={() => window.print()}>Imprimer la feuille de route</button>}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h2>Ordre des arrêts</h2><span className="spacer" /><span className="xs muted">heures estimées (départ {localTime(startIso, false)})</span></div>
            <div className="card-b stack" style={{ maxHeight: 520, overflow: 'auto' }}>
              {v.routes.map((route) => (
                <div key={route.agent_index} className="agent-block">
                  <div className="agent-head">
                    <span className="agent-swatch" style={{ background: AGENT_COLORS[(route.agent_index - 1) % 3] }} />
                    <b>Agent {route.agent_index}</b>
                    <span className="muted">{route.stops.length} arrêts · {minutes(route.duration_min)} · {n(route.km, 1)} km</span>
                  </div>
                  {route.stops.length === 0 && <div className="empty xs">Aucun arrêt admissible.</div>}
                  {route.stops.map((s) => (
                    <div key={s.scooter_id} className={`stop ${selected === s.scooter_id ? 'sel' : ''}`} onClick={() => setSelected(s.scooter_id)}>
                      <span className="badge" style={{ background: AGENT_COLORS[(route.agent_index - 1) % 3] }}>{s.seq}</span>
                      <div>
                        <div><b>{s.scooter_id}</b> · {zoneName[s.zone_id]} · {n(s.charge_pct, 1)} % {s.category === 'critique' ? <span className="tag crit">critique</span> : <span className="tag prev">préventif</span>}</div>
                        <div className="why">{s.explanation}</div>
                      </div>
                      <div className="right small num">{clockAfter(startIso, s.arrival_min)}<div className="xs muted">{n(s.cum_km, 1)} km</div></div>
                    </div>
                  ))}
                  {route.stops.length > 0 && <div className="stop" style={{ cursor: 'default' }}><span /><span className="muted small">Retour : {depot.name}</span><span className="right small num">{clockAfter(startIso, route.duration_min)}</span></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Comparaison à la référence</h2>
          <span className="tag sim">valeurs simulées — même scénario, mêmes hypothèses</span>
        </div>
        <div className="card-b flush" style={{ overflowX: 'auto' }}>
          <table className="t">
            <thead>
              <tr>
                <th>Indicateur</th>
                {r.variants.map((x) => <th key={x.strategy} className="num">{VARIANT_INFO[x.strategy].name}{x.is_recommended ? ' ★' : ''}</th>)}
                <th className="num">Apport de l'optimisation<div className="xs muted">Optimisée vs Référence</div></th>
                <th className="num">Apport du ML<div className="xs muted">Optimisée + ML vs Optimisée</div></th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}{row.hint && <span className="xs muted"> · {row.hint}</span>}</td>
                  {r.variants.map((x) => <td key={x.strategy} className="num">{x.kpis ? row.fmt(x.kpis[row.key] as number | null) : '—'}</td>)}
                  <td className="num"><Delta a={byStrat.REF.kpis?.[row.key] as number | null} b={byStrat.OPT_REGLE.kpis?.[row.key] as number | null} better={row.better} /></td>
                  <td className="num"><Delta a={byStrat.OPT_REGLE.kpis?.[row.key] as number | null} b={byStrat.OPT_ML.kpis?.[row.key] as number | null} better={row.better} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-b grid-2" style={{ borderTop: '1px solid var(--line-2)' }}>
          {(['kr1_cost_per_swap', 'kr3_km_per_swap', 'swaps', 'projected_weighted_deficit'] as (keyof Kpis)[]).map((key) => {
            const row = ROWS.find((x) => x.key === key)!;
            const vals = r.variants.map((x) => (x.kpis?.[key] as number | null) ?? null);
            const max = Math.max(1e-9, ...vals.map((x) => x ?? 0));
            return (
              <div key={key} className="stack-sm">
                <span className="small strong">{row.label} <span className="xs muted">({row.better === 'lower' ? 'plus bas = mieux' : 'plus haut = mieux'})</span></span>
                <div className="cmp-bars">
                  {r.variants.map((x, i) => (
                    <div key={x.strategy} className="cmp-bar">
                      <span className="xs">{VARIANT_INFO[x.strategy].name}</span>
                      <div className="track"><div className="fill" style={{ width: `${((vals[i] ?? 0) / max) * 100}%`, background: x.strategy === 'REF' ? '#a7b1c2' : x.strategy === 'OPT_REGLE' ? 'var(--blue)' : 'var(--teal)' }} /></div>
                      <span className="xs num right">{x.kpis ? row.fmt(vals[i]) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="card-b" style={{ borderTop: '1px solid var(--line-2)' }}>
          <p className="xs muted">Coûts = durée mobilisée × {eur(r.params.agent_cost_eur_h, 0)}/h + km × {eur(r.params.cost_per_km_eur)} (hypothèses H06, H09). Distances à vol d'oiseau × facteur de détour : aucun itinéraire routier n'est calculé. Projections : consommation attendue selon l'usage récent, sans déplacement des scooters. Ces chiffres comparent des variantes ; ils ne constituent pas des gains mesurés sur le terrain. K6 (coût par transfert de scooter) ne s'applique pas à un échange de batterie.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Scooters non retenus — {VARIANT_INFO[active].name}</h2><span className="spacer" /><span className="xs muted">éligibles mais hors tournée, avec motif</span></div>
        <div className="table-wrap" style={{ maxHeight: 320 }}>
          <table className="t">
            <thead><tr><th>Scooter</th><th>Zone</th><th className="num">Charge</th><th>Classe</th><th className="num">Priorité</th><th>Motif</th></tr></thead>
            <tbody>
              {v.unserved.map((u) => (
                <tr key={u.scooter_id} onClick={() => setSelected(u.scooter_id)} style={{ cursor: 'pointer' }} className={selected === u.scooter_id ? 'sel' : ''}>
                  <td className="strong">{u.scooter_id}</td><td>{zoneName[u.zone_id]}</td><td className="num">{n(u.charge_pct, 1)} %</td>
                  <td>{u.category === 'critique' ? <span className="tag crit">critique</span> : <span className="tag prev">préventif</span>}</td>
                  <td className="num">{n(u.priority, 1)}</td><td>{u.reason}</td>
                </tr>
              ))}
              {v.unserved.length === 0 && <tr><td colSpan={6} className="empty">Tous les scooters éligibles sont dans la tournée.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="xs muted" style={{ padding: '8px 16px 12px' }}>Les scooters exclus en amont (loués, réservés, données périmées, hors zone, alertes) figurent dans l'onglet « Contrôles qualité » du tableau de bord.</p>
      </div>

      <div className="card">
        <div className="card-h"><h2>Paramètres et logique de la recommandation</h2></div>
        <div className="card-b grid-2">
          <dl className="kv small">
            <dt>Agents</dt><dd>{r.params.agents} · {cfg.vehicles[r.params.vehicle].label} · {r.params.capacity_batteries} batteries chacun</dd>
            <dt>Durée max</dt><dd>{minutes(r.params.shift_min)} par agent · intervention {r.params.service_min} min</dd>
            <dt>Vitesse / détour</dt><dd>{r.params.speed_kmh} km/h · × {n(r.params.detour_factor, 2)}</dd>
            <dt>Seuils</dt><dd>critique &lt; {cfg.thresholds.critical_pct} % · éligible &lt; {r.params.max_eligible_pct} % · GPS ≤ {cfg.thresholds.intervention_gps_max_age_min} min · BMS ≤ {cfg.thresholds.intervention_bms_max_age_min} min</dd>
            <dt>Poids</dt><dd>urgence {n(r.params.weights.urgency * 100)} % · demande {n(r.params.weights.demand * 100)} % · rareté {n(r.params.weights.scarcity * 100)} %</dd>
            <dt>Zones fermées</dt><dd>{r.params.closed_zones.length ? r.params.closed_zones.map((z) => zoneName[z]).join(', ') : 'aucune'}</dd>
            <dt>ML</dt><dd>{r.model_version ? `actif (v${r.model_version})` : 'non utilisé'}</dd>
          </dl>
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li><span className="tag rule">Règles</span> contrôles qualité et éligibilité ({r.validation.scooters.length} scooters, {r.candidates.length} candidats).</li>
            <li><span className="tag rule">Règle</span> score de priorité transparent (urgence, demande de zone, rareté).</li>
            <li><span className="tag ml">ML</span> pour les préventifs, urgence = 0,8 × risque prédit de passer sous 20 % en 3 h (variante « + ML » uniquement).</li>
            <li><span className="tag opt">Optimisation</span> sélection et ordre des arrêts : insertion gloutonne priorité / minute, 2-opt, échanges ; contraintes de durée et de batteries garanties.</li>
            <li><span className="tag rule">Règle</span> recommandation : plus faible déficit projeté, puis couverture des critiques, puis coût par recharge.</li>
            <li><span className="tag human">Humain</span> approbation ou rejet motivé, tracé avec l'empreinte des entrées.</li>
          </ol>
        </div>
      </div>

      {approvedVariant && (
        <div className="print-sheet">
          {approvedVariant.routes.filter((x) => x.stops.length).map((route) => (
            <div key={route.agent_index} className="agent-page">
              <h1>BlueMove — Feuille de route · Agent {route.agent_index}</h1>
              <p>DONNÉES SIMULÉES — démonstration pédagogique. Variante : {VARIANT_INFO[approvedVariant.strategy].name}. Situation du {localTime(r.as_of_utc)}. Départ et retour : {depot.name}. Empreinte {r.input_hash.slice(0, 12)}.</p>
              <table>
                <thead><tr><th>#</th><th>Heure</th><th>Scooter</th><th>Batterie à retirer</th><th>Zone</th><th>Charge</th><th>Coordonnées</th></tr></thead>
                <tbody>{route.stops.map((s) => (
                  <tr key={s.scooter_id}><td>{s.seq}</td><td>{clockAfter(startIso, s.arrival_min)}</td><td>{s.scooter_id}</td><td>{s.battery_id}</td><td>{zoneName[s.zone_id]}</td><td>{n(s.charge_pct, 1)} %</td><td>{n(s.lat, 5)}, {n(s.lng, 5)}</td></tr>
                ))}</tbody>
              </table>
              <p>Consigne : vérifier l'état du scooter avant l'échange ; signaler tout défaut à la maintenance. Retour prévu : {clockAfter(startIso, route.duration_min)}.</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
