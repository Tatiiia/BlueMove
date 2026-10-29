import { useState } from 'react';
import { eur, localTime, n, pct } from './format';
import { VARIANT_INFO } from './RunView';
import { REJECT_REASONS, type DecisionRecord } from './store';

export function History({ decisions, onClear }: { decisions: DecisionRecord[]; onClear: () => void }) {
  const [armed, setArmed] = useState(false);
  const decided = decisions.filter((d) => d.decision !== 'expiree');
  const approved = decided.filter((d) => d.decision === 'approuvee').length;
  const followed = decided.filter((d) => d.decision === 'approuvee' && d.strategy === d.recommended).length;
  const reasons: Record<string, number> = {};
  for (const d of decided) if (d.reason_code) reasons[d.reason_code] = (reasons[d.reason_code] ?? 0) + 1;
  const list = [...decisions].reverse();
  return (
    <>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div className="kpi navy"><div className="label">Décisions enregistrées</div><div className="value">{decided.length}</div><div className="sub">dans ce navigateur</div></div>
        <div className="kpi teal"><div className="label">KR6 · Taux d'acceptation</div><div className="value">{decided.length ? pct(approved / decided.length) : 'ND'}</div><div className="sub">objectif proposé ≥ 70 % (H17)</div></div>
        <div className="kpi accent"><div className="label">Recommandation suivie</div><div className="value">{decided.length ? pct(followed / decided.length) : 'ND'}</div><div className="sub">variante recommandée approuvée</div></div>
        <div className="kpi"><div className="label">Motifs de rejet</div><div className="value">{Object.values(reasons).reduce((a, b) => a + b, 0)}</div>
          <div className="sub">{Object.entries(reasons).map(([k, v]) => `${REJECT_REASONS[k]} ${v}`).join(' · ') || 'aucun'}</div></div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Journal des décisions</h2><span className="tag sim">simulateur</span><span className="spacer" />
          {decisions.length > 0 && !armed && <button className="btn ghost small" onClick={() => setArmed(true)}>Effacer le journal</button>}
          {armed && <span className="row small"><span className="muted">Effacer les {decisions.length} décisions ?</span>
            <button className="btn danger small" onClick={() => { onClear(); setArmed(false); }}>Effacer</button>
            <button className="btn ghost small" onClick={() => setArmed(false)}>Annuler</button></span>}
        </div>
        {list.length === 0 ? <div className="empty">Aucune décision pour l'instant. Calculez une tournée puis approuvez ou rejetez-la.</div> : (
          <div className="table-wrap" style={{ maxHeight: 620 }}>
            <table className="t">
              <thead><tr><th>Décision le</th><th>Scénario</th><th>Décision</th><th>Variante</th><th>Recommandée</th><th className="num">Interventions</th><th className="num">Coût / recharge</th><th>Motif / commentaire</th><th>Traçabilité</th></tr></thead>
              <tbody>
                {list.map((d) => (
                  <tr key={`${d.run_id}-${d.decided_at_utc}`}>
                    <td className="nowrap">{localTime(d.decided_at_utc)}</td>
                    <td>{d.scenario_label}</td>
                    <td>{d.decision === 'approuvee' ? <span className="tag good">approuvée</span> : <span className="tag bad">rejetée</span>}</td>
                    <td>{d.strategy ? VARIANT_INFO[d.strategy].name : '—'}</td>
                    <td>{d.recommended ? VARIANT_INFO[d.recommended].name : '—'}</td>
                    <td className="num">{d.kpis ? n(d.kpis.swaps) : '—'}</td>
                    <td className="num">{d.kpis ? eur(d.kpis.kr1_cost_per_swap) : '—'}</td>
                    <td className="small">{d.reason_code ? REJECT_REASONS[d.reason_code] : ''}{d.comment ? ` « ${d.comment} »` : ''}</td>
                    <td className="xs muted">calcul {localTime(d.computed_at_utc, false)} · <span className="code">{d.input_hash.slice(0, 10)}</span> · moteur {d.engine_version} · modèle {d.model_version ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="xs muted" style={{ padding: '8px 16px 12px' }}>Le journal est conservé dans le stockage local du navigateur (démonstration, sans serveur ni compte). En production, il serait stocké dans la base PostgreSQL décrite dans MVP_SPEC §5.2, avec l'identité de l'opérateur.</p>
      </div>
    </>
  );
}
