import { REASON_LABELS } from '../engine/validate';
import type { Candidate, PlanParams, ValidatedScooter, ZoneStat } from '../engine/types';
import { age, n, pct } from './format';
import { statusLabel } from './points';

export function PriorityTable({ candidates, mlActive, params, selected, onSelect, zoneName }: {
  candidates: Candidate[]; mlActive: boolean; params: PlanParams; selected: string | null; onSelect: (id: string) => void;
  zoneName: Record<string, string>;
}) {
  const w = params.weights;
  const sum = w.urgency + w.demand + w.scarcity || 1;
  const rows = [...candidates].sort((a, b) => prio(b, mlActive) - prio(a, mlActive) || (a.scooter_id < b.scooter_id ? -1 : 1));
  if (rows.length === 0) return <div className="empty">Aucun scooter éligible avec les paramètres actuels.</div>;
  return (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>#</th><th>Scooter</th><th>Zone</th><th className="num">Charge</th><th>Classe</th>
            <th className="num">Risque 3 h {mlActive ? <span className="tag ml">ML</span> : null}</th>
            <th>Composantes <span className="xs muted">(urgence · demande · rareté)</span></th>
            <th className="num">Priorité</th><th>Justification</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const u = (mlActive && c.urgency_ml !== null ? c.urgency_ml : c.urgency_rule) * (w.urgency / sum);
            const d = c.demand * (w.demand / sum);
            const s = c.scarcity * (w.scarcity / sum);
            const p = prio(c, mlActive);
            return (
              <tr key={c.scooter_id} className={selected === c.scooter_id ? 'sel' : ''} onClick={() => onSelect(c.scooter_id)} style={{ cursor: 'pointer' }}>
                <td className="num muted">{i + 1}</td>
                <td className="strong nowrap">{c.scooter_id}</td>
                <td className="nowrap">{zoneName[c.zone_id]}</td>
                <td className="num">{n(c.charge_pct, 1)} %</td>
                <td>{c.category === 'critique' ? <span className="tag crit">critique</span> : <span className="tag prev">préventif</span>}</td>
                <td className="num">{c.category === 'critique' ? <span className="muted xs">déjà &lt; 20 %</span> : mlActive && c.risk_3h !== null ? pct(c.risk_3h) : <span className="muted xs">règle</span>}</td>
                <td>
                  <div className="comp" title={`urgence ${n(u * 100, 1)} · demande ${n(d * 100, 1)} · rareté ${n(s * 100, 1)}`}>
                    <span className="u" style={{ width: `${u * 100}%` }} /><span className="d" style={{ width: `${d * 100}%` }} /><span className="s" style={{ width: `${s * 100}%` }} />
                  </div>
                </td>
                <td className="num strong">{n(p, 1)}</td>
                <td className="xs muted" style={{ minWidth: 260 }}>{(mlActive ? c.explanation_ml : null) ?? c.explanation_rule}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const prio = (c: Candidate, ml: boolean) => (ml && c.priority_ml !== null ? c.priority_ml : c.priority_rule);

export function QualityTable({ scooters, duplicates, zoneName, onSelect }: {
  scooters: ValidatedScooter[]; duplicates: { message_id: string; scooter_id: string }[]; zoneName: Record<string, string>;
  onSelect: (id: string) => void;
}) {
  const rows = scooters.filter((s) => s.outcome === 'rejet_qualite' || (s.outcome === 'exclusion' && s.reason_code !== 'EXCL_CHARGE_SUFFISANTE'))
    .sort((a, b) => Number(b.outcome === 'rejet_qualite') - Number(a.outcome === 'rejet_qualite') || (a.reason_code ?? '').localeCompare(b.reason_code ?? '') || a.scooter_id.localeCompare(b.scooter_id));
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr><th>Scooter</th><th>Résultat</th><th>Motif</th><th>Zone</th><th className="num">Charge</th><th>Statut</th><th className="num">Âge GPS</th><th className="num">Âge BMS</th></tr></thead>
        <tbody>
          {duplicates.map((d) => (
            <tr key={`dup-${d.message_id}`}>
              <td className="strong">{d.scooter_id}</td><td><span className="tag bad">rejet qualité</span></td>
              <td>{REASON_LABELS.REJ_DOUBLON} <span className="code">{d.message_id}</span></td><td colSpan={5} className="muted xs">Message ignoré ; la première occurrence est conservée.</td>
            </tr>
          ))}
          {rows.map((s) => (
            <tr key={s.scooter_id} onClick={() => onSelect(s.scooter_id)} style={{ cursor: 'pointer' }}>
              <td className="strong">{s.scooter_id}</td>
              <td>{s.outcome === 'rejet_qualite' ? <span className="tag bad">rejet qualité</span> : <span className="tag">exclusion</span>}</td>
              <td>{REASON_LABELS[s.reason_code ?? ''] ?? s.reason_code} <span className="code xs">{s.reason_code}</span></td>
              <td>{s.zone_id ? zoneName[s.zone_id] : '—'}</td>
              <td className="num">{n(s.reading.charge_pct, 1)}{Number.isFinite(s.reading.charge_pct) ? ' %' : ''}</td>
              <td className="nowrap">{statusLabel(s)}</td>
              <td className="num">{age(s.gps_age_min)}</td>
              <td className="num">{age(s.bms_age_min)}</td>
            </tr>
          ))}
          {rows.length + duplicates.length === 0 && <tr><td colSpan={8} className="empty">Aucun rejet ni exclusion (hors charge suffisante).</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function MaintenanceTable({ scooters, zoneName }: { scooters: ValidatedScooter[]; zoneName: Record<string, string> }) {
  const rows = scooters.filter((s) => s.outcome === 'maintenance');
  return (
    <div className="stack" style={{ padding: 12 }}>
      <div className="notice info small">Ces scooters présentent une alerte batterie. Ils sont <b>exclus des tournées de recharge</b> et signalés à l'équipe de maintenance (activité distincte).</div>
      {rows.length === 0 ? <div className="empty">Aucune alerte dans ce scénario.</div> : (
        <table className="t">
          <thead><tr><th>Scooter</th><th>Motif</th><th>Code / température</th><th>Zone</th><th className="num">Charge</th></tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.scooter_id}>
              <td className="strong">{s.scooter_id}</td><td><span className="tag maint">{REASON_LABELS[s.reason_code ?? '']}</span></td>
              <td>{s.reading.bms_fault_code ?? `${n(s.reading.battery_temp_c, 1)} °C`}</td>
              <td>{s.zone_id ? zoneName[s.zone_id] : '—'}</td><td className="num">{n(s.reading.charge_pct, 1)} %</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

export function ZoneTable({ stats }: { stats: ZoneStat[] }) {
  const maxE = Math.max(1, ...stats.map((z) => z.expected_searches));
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr><th>Zone</th><th>Demande attendue (3 h)</th><th className="num">Louables</th><th className="num">Cible</th><th>Couverture</th><th className="num">Rareté</th><th className="num">Critiques</th><th className="num">Préventifs</th></tr></thead>
        <tbody>
          {stats.map((z) => {
            const cov = z.target > 0 ? z.rentable / z.target : 1;
            return (
              <tr key={z.zone_id}>
                <td className="strong">{z.name}{z.closed && <span className="tag bad" style={{ marginLeft: 6 }}>fermée</span>}</td>
                <td><div className="row"><div className="bar" style={{ width: 90 }}><span style={{ width: `${(z.expected_searches / maxE) * 100}%` }} /></div><span className="xs num">{n(z.expected_searches)} rech.</span></div></td>
                <td className="num">{z.rentable}</td><td className="num">{z.target}</td>
                <td><div className="row"><div className="bar" style={{ width: 80 }}><span style={{ width: `${Math.min(1, cov) * 100}%`, background: cov < 1 ? 'var(--prev)' : 'var(--teal)' }} /></div><span className="xs num">{pct(cov)}</span></div></td>
                <td className="num">{n(z.scarcity * 100)} %</td>
                <td className="num">{z.critical}</td><td className="num">{z.preventive}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="xs muted" style={{ padding: '8px 12px' }}>Demande : profil de la heatmap W5 (valeurs illustratives) sur les 3 prochaines heures, × facteur d'échelle de simulation (H23). Louable = définition du cadre commun (libre, hors maintenance, GPS &lt; 2 min, BMS &lt; 10 min, ≥ 20 %).</p>
    </div>
  );
}
