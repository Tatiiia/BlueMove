import { useMemo, useState } from 'react';
import { REASON_LABELS } from '../engine/validate';
import type { analyzeScenario } from '../engine/run';
import type { Depot, HypothesesConfig, PlanParams, Scenario, Zone } from '../engine/types';
import { FleetMap, MapLegend } from './FleetMap';
import { age, hours, n } from './format';
import { ParamsPanel } from './ParamsPanel';
import { buildPoints, statusLabel } from './points';
import { MaintenanceTable, PriorityTable, QualityTable, ZoneTable } from './Tables';

type Analysis = ReturnType<typeof analyzeScenario>;

interface Props {
  cfg: HypothesesConfig;
  scenario: Scenario;
  analysis: Analysis;
  zones: Zone[];
  depots: Depot[];
  params: PlanParams;
  setParams: (p: PlanParams) => void;
  modelUsable: boolean;
  modelVersion: string | null;
  onRun: () => void;
  running: boolean;
  stale: boolean;
}

export function Operations(p: Props) {
  const { analysis: a, cfg } = p;
  const [tab, setTab] = useState<'prio' | 'qual' | 'maint' | 'zones'>('prio');
  const [selected, setSelected] = useState<string | null>(null);
  const zoneName = useMemo(() => Object.fromEntries(p.zones.map((z) => [z.id, z.name])), [p.zones]);
  const points = useMemo(() => buildPoints(a.validation.scooters, a.candidates, a.modelActive), [a]);
  const s = a.validation.scooters;
  const rentable = s.filter((x) => x.is_rentable).length;
  const crit = a.candidates.filter((c) => c.category === 'critique').length;
  const rejected = s.filter((x) => x.outcome === 'rejet_qualite').length + a.validation.duplicates.length;
  const excluded = s.filter((x) => x.outcome === 'exclusion' && x.reason_code !== 'EXCL_CHARGE_SUFFISANTE').length;
  const maint = s.filter((x) => x.outcome === 'maintenance').length;
  const capacity = p.params.agents * p.params.capacity_batteries;
  const sel = selected ? s.find((x) => x.scooter_id === selected) : null;
  const selCand = selected ? a.candidates.find((c) => c.scooter_id === selected) : null;

  return (
    <>
      <div className="kpis">
        <div className="kpi navy">
          <div className="label">Scooters suivis</div>
          <div className="value">{s.length}</div>
          <div className="sub">{rentable} louables maintenant (cadre commun)</div>
        </div>
        <div className="kpi accent">
          <div className="label">Nécessitent une intervention</div>
          <div className="value">{a.candidates.length}</div>
          <div className="sub">charge &lt; {p.params.max_eligible_pct} %, données fraîches, libres</div>
        </div>
        <div className="kpi crit">
          <div className="label">Interventions prioritaires</div>
          <div className="value">{crit}</div>
          <div className="sub">critiques &lt; 20 % : non louables</div>
        </div>
        <div className="kpi">
          <div className="label">Exclus ou rejetés</div>
          <div className="value">{excluded + rejected}</div>
          <div className="sub">{excluded} exclus · {rejected} rejets qualité · {maint} alertes</div>
        </div>
        <div className="kpi teal">
          <div className="label">Ressources du scénario</div>
          <div className="value">{capacity}<span className="unit">batteries</span></div>
          <div className="sub">{p.params.agents} agent{p.params.agents > 1 ? 's' : ''} × {p.params.capacity_batteries} · {hours(p.params.shift_min / 60)} chacun</div>
        </div>
        <div className="kpi">
          <div className="label">Interventions possibles</div>
          <div className="value">≤ {Math.min(capacity, a.candidates.length)}</div>
          <div className="sub">borne haute ; la durée peut limiter davantage</div>
        </div>
      </div>

      {a.corrections.length > 0 && <div className="notice warn small">Paramètres corrigés : {a.corrections.join(' · ')}</div>}

      <div className="grid-main">
        <div className="card">
          <div className="card-h">
            <h2>Flotte et zones</h2>
            <span className="tag sim">plan schématique · ville fictive</span>
            <span className="spacer" />
            <span className="xs muted">Survoler ou cliquer un scooter</span>
          </div>
          <div className="card-b" style={{ paddingBottom: 8 }}><MapLegend /></div>
          <div style={{ position: 'relative' }}>
            <FleetMap zones={p.zones} depots={p.depots} activeDepot={p.params.depot_id} closedZones={p.params.closed_zones}
              points={points} selectedId={selected} onSelect={setSelected} center={cfg.city_center} />
            {sel && (
              <div className="detail-card">
                <div className="row"><span className="strong">{sel.scooter_id}</span><span className="spacer" /><button className="btn ghost xs" onClick={() => setSelected(null)}>Fermer</button></div>
                <dl className="kv" style={{ marginTop: 8 }}>
                  <dt>Batterie</dt><dd>{n(sel.reading.charge_pct, 1)} % · {sel.reading.battery_id}</dd>
                  <dt>Statut</dt><dd>{statusLabel(sel)}</dd>
                  <dt>Zone</dt><dd>{sel.zone_id ? zoneName[sel.zone_id] : 'hors zone'}</dd>
                  <dt>Position</dt><dd>{n(sel.reading.lat, 5)}, {n(sel.reading.lng, 5)}</dd>
                  <dt>Fraîcheur</dt><dd>GPS {age(sel.gps_age_min)} · BMS {age(sel.bms_age_min)}</dd>
                  <dt>Louable</dt><dd>{sel.is_rentable ? 'oui' : 'non'}</dd>
                  <dt>Décision</dt><dd>{selCand ? (selCand.category === 'critique' ? 'Éligible — critique' : 'Éligible — préventif') : (REASON_LABELS[sel.reason_code ?? ''] ?? '—')}</dd>
                  {selCand && <><dt>Priorité</dt><dd>{n(a.modelActive && selCand.priority_ml !== null ? selCand.priority_ml : selCand.priority_rule, 1)}{selCand.risk_3h !== null && a.modelActive ? ` · risque 3 h ${n(selCand.risk_3h * 100)} %` : ''}</dd></>}
                </dl>
              </div>
            )}
          </div>
        </div>
        <ParamsPanel cfg={cfg} params={p.params} onChange={p.setParams} modelUsable={p.modelUsable} modelVersion={p.modelVersion}
          onRun={p.onRun} running={p.running} stale={p.stale} candidates={a.candidates.length} />
      </div>

      <div className="card">
        <div className="tabs" role="tablist">
          <button className={tab === 'prio' ? 'on' : ''} onClick={() => setTab('prio')}>Priorités ({a.candidates.length})</button>
          <button className={tab === 'qual' ? 'on' : ''} onClick={() => setTab('qual')}>Contrôles qualité ({excluded + rejected})</button>
          <button className={tab === 'maint' ? 'on' : ''} onClick={() => setTab('maint')}>Orientés maintenance ({maint})</button>
          <button className={tab === 'zones' ? 'on' : ''} onClick={() => setTab('zones')}>Zones</button>
          <span className="spacer" />
        </div>
        {tab === 'prio' && (
          <>
            <div className="row wrap small" style={{ padding: '10px 12px', gap: 12 }}>
              <span className="tag rule">Règle</span><span className="muted">priorité = 100 × (urgence × {n(p.params.weights.urgency * 100)} % + demande × {n(p.params.weights.demand * 100)} % + rareté × {n(p.params.weights.scarcity * 100)} %) — poids normalisés</span>
              {a.modelActive
                ? <span><span className="tag ml">ML</span> <span className="muted">urgence des préventifs = 0,8 × risque prédit de passer sous 20 % en 3 h</span></span>
                : <span><span className="tag rule">sans ML</span> <span className="muted">urgence des préventifs proportionnelle à la charge</span></span>}
            </div>
            <PriorityTable candidates={a.candidates} mlActive={a.modelActive} params={p.params} selected={selected} onSelect={setSelected} zoneName={zoneName} />
          </>
        )}
        {tab === 'qual' && <QualityTable scooters={s} duplicates={a.validation.duplicates} zoneName={zoneName} onSelect={setSelected} />}
        {tab === 'maint' && <MaintenanceTable scooters={s} zoneName={zoneName} />}
        {tab === 'zones' && <ZoneTable stats={a.zoneStats} />}
      </div>
    </>
  );
}
