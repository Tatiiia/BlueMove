import type { HypothesesConfig, PlanParams, VehicleId, Weights } from '../engine/types';
import { n } from './format';

interface Props {
  cfg: HypothesesConfig;
  params: PlanParams;
  onChange: (p: PlanParams) => void;
  modelUsable: boolean;
  modelVersion: string | null;
  onRun: () => void;
  running: boolean;
  stale: boolean;
  candidates: number;
}

export function ParamsPanel({ cfg, params, onChange, modelUsable, modelVersion, onRun, running, stale, candidates }: Props) {
  const set = <K extends keyof PlanParams>(k: K, v: PlanParams[K]) => onChange({ ...params, [k]: v });
  const setVehicle = (v: VehicleId) => {
    const veh = cfg.vehicles[v];
    onChange({ ...params, vehicle: v, capacity_batteries: veh.capacity_batteries, speed_kmh: veh.speed_kmh, cost_per_km_eur: veh.cost_per_km_eur });
  };
  const w = params.weights;
  const sum = w.urgency + w.demand + w.scarcity || 1;
  const setW = (k: keyof Weights, v: number) => set('weights', { ...w, [k]: v });
  const toggleZone = (id: string) => set('closed_zones', params.closed_zones.includes(id) ? params.closed_zones.filter((z) => z !== id) : [...params.closed_zones, id]);
  const b = cfg.bounds;
  const initial = cfg.priority.weights_initial_design;

  return (
    <div className="card">
      <div className="card-h"><h2>Paramètres de la tournée</h2><span className="spacer" /><span className="tag rule">entrées opérateur</span></div>
      <div className="card-b stack">
        <div className="field">
          <label htmlFor="depot">Point de départ et de retour</label>
          <select id="depot" value={params.depot_id} onChange={(e) => set('depot_id', e.target.value)}>
            {cfg.depots.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.hypothesis})</option>)}
          </select>
        </div>
        <div className="field">
          <span className="lbl">Agents mobilisés</span>
          <div className="seg" role="group" aria-label="Agents">
            {[1, 2, 3].map((k) => <button key={k} className={params.agents === k ? 'on' : ''} onClick={() => set('agents', k)}>{k} agent{k > 1 ? 's' : ''}</button>)}
          </div>
        </div>
        <div className="field">
          <span className="lbl">Véhicule</span>
          <div className="seg" role="group" aria-label="Véhicule">
            {(Object.keys(cfg.vehicles) as VehicleId[]).map((v) => (
              <button key={v} className={params.vehicle === v ? 'on' : ''} onClick={() => setVehicle(v)}>{cfg.vehicles[v].label.replace(' électrique', '')}</button>
            ))}
          </div>
          <span className="hint">{n(params.speed_kmh)} km/h · {n(params.cost_per_km_eur, 2)} €/km (H06)</span>
        </div>
        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label htmlFor="cap">Batteries par agent</label>
            <input id="cap" type="number" min={b.capacity_batteries[0]} max={b.capacity_batteries[1]} value={params.capacity_batteries}
              onChange={(e) => set('capacity_batteries', Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="shift">Durée (min)</label>
            <input id="shift" type="number" min={b.shift_min[0]} max={b.shift_min[1]} step={15} value={params.shift_min}
              onChange={(e) => set('shift_min', Number(e.target.value))} />
          </div>
        </div>
        <input aria-label="Durée de tournée" type="range" min={b.shift_min[0]} max={b.shift_min[1]} step={15} value={params.shift_min}
          onChange={(e) => set('shift_min', Number(e.target.value))} style={{ accentColor: 'var(--blue)', marginTop: -6 }} />
        <div className="field">
          <label htmlFor="thr">Seuil d'intervention : charge &lt; {params.max_eligible_pct} %</label>
          <input id="thr" type="range" min={b.max_eligible_pct[0]} max={b.max_eligible_pct[1]} value={params.max_eligible_pct}
            onChange={(e) => set('max_eligible_pct', Number(e.target.value))} />
          <span className="hint">Critique si &lt; {cfg.thresholds.critical_pct} % (seuil de louabilité, cadre commun) · {candidates} scooters éligibles</span>
        </div>
        <div className="field">
          <span className="lbl">Poids de la priorité <span className="tag rule">règle</span></span>
          {([['urgency', 'Urgence (batterie)'], ['demand', 'Demande de la zone'], ['scarcity', 'Rareté locale']] as [keyof Weights, string][]).map(([k, label]) => (
            <div key={k} className="row" style={{ gap: 10 }}>
              <span className="small" style={{ width: 128 }}>{label}</span>
              <input aria-label={label} type="range" min={0} max={100} value={Math.round(w[k] * 100)} onChange={(e) => setW(k, Number(e.target.value) / 100)} style={{ flex: 1 }} />
              <span className="small num strong" style={{ width: 38, textAlign: 'right' }}>{n((w[k] / sum) * 100)} %</span>
            </div>
          ))}
          <div className="row wrap">
            <button className="btn ghost small" onClick={() => set('weights', { ...cfg.priority.weights })}>Poids recalibrés (défaut)</button>
            {initial && <button className="btn ghost small" onClick={() => set('weights', { ...initial })}>Poids de la conception initiale</button>}
          </div>
        </div>
        <div className="field">
          <span className="lbl">Zones fermées (travaux, événement)</span>
          <div className="chips">
            {cfg.zones.map((z) => (
              <button key={z.id} className={`chip ${params.closed_zones.includes(z.id) ? 'on' : ''}`} onClick={() => toggleZone(z.id)}
                aria-pressed={params.closed_zones.includes(z.id)}>{z.name}</button>
            ))}
          </div>
        </div>
        <label className="switch">
          <input type="checkbox" checked={params.ml_enabled && modelUsable} disabled={!modelUsable} onChange={(e) => set('ml_enabled', e.target.checked)} />
          <span className="small"><span className="strong">Modèle ML de risque à 3 h</span> <span className="tag ml">IA</span><br />
            <span className="muted xs">{modelUsable ? `v${modelVersion} · entraîné sur données simulées` : 'Modèle indisponible'}</span></span>
        </label>
        <details className="adv">
          <summary>Hypothèses avancées ▾</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <div className="grid-2" style={{ gap: 10 }}>
              <div className="field">
                <label htmlFor="svc">Intervention (min)</label>
                <input id="svc" type="number" min={b.service_min[0]} max={b.service_min[1]} value={params.service_min} onChange={(e) => set('service_min', Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="cost">Coût agent (€/h)</label>
                <input id="cost" type="number" min={b.agent_cost_eur_h[0]} max={b.agent_cost_eur_h[1]} value={params.agent_cost_eur_h} onChange={(e) => set('agent_cost_eur_h', Number(e.target.value))} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="det">Facteur de détour : × {n(params.detour_factor, 2)}</label>
              <input id="det" type="range" min={b.detour_factor[0]} max={b.detour_factor[1]} step={0.05} value={params.detour_factor} onChange={(e) => set('detour_factor', Number(e.target.value))} />
              <span className="hint">Distance = vol d'oiseau × facteur (H08). Pas de calcul d'itinéraire routier.</span>
            </div>
          </div>
        </details>
        {stale && <div className="notice warn small">Paramètres ou scénario modifiés depuis le dernier calcul.</div>}
        <button className="btn primary big" onClick={onRun} disabled={running}>{running ? 'Calcul en cours…' : 'Optimiser la tournée'}</button>
        <p className="xs muted">Calcule trois variantes sur les mêmes données : référence, optimisation sans IA, optimisation avec ML. Aucune intervention n'est déclenchée.</p>
      </div>
    </div>
  );
}
