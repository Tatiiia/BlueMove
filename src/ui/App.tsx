import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildDepots, buildZones } from '../engine/geo';
import { isModelUsable } from '../engine/model';
import { analyzeScenario, defaultParams, runPlanning } from '../engine/run';
import type { PlanParams, Scenario } from '../engine/types';
import { cfg, loadIndex, loadScenario, model, type ScenarioEntry } from './data';
import { localTime } from './format';
import { History } from './History';
import { Method } from './Method';
import { Operations } from './Operations';
import { RunView, type RunMeta } from './RunView';
import { loadDecisions, saveDecisions, type DecisionRecord } from './store';

type View = 'operations' | 'tournee' | 'historique' | 'methode';
const VIEWS: View[] = ['operations', 'tournee', 'historique', 'methode'];
const viewFromHash = (): View => { const h = window.location.hash.replace('#', '') as View; return VIEWS.includes(h) ? h : 'operations'; };

export function App() {
  const zones = useMemo(() => buildZones(cfg), []);
  const depots = useMemo(() => buildDepots(cfg), []);
  const modelUsable = isModelUsable(model);
  const [index, setIndex] = useState<ScenarioEntry[]>([]);
  const [scenarioId, setScenarioId] = useState('SC02');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [params, setParams] = useState<PlanParams>(() => ({ ...defaultParams(cfg), ml_enabled: modelUsable }));
  const [run, setRun] = useState<(RunMeta & { key: string }) | null>(null);
  const [running, setRunning] = useState(false);
  const [view, setViewState] = useState<View>(viewFromHash);
  const [decisions, setDecisions] = useState<DecisionRecord[]>(() => loadDecisions());
  const [storageWarning, setStorageWarning] = useState(false);

  const setView = useCallback((v: View) => { setViewState(v); if (window.location.hash !== `#${v}`) window.location.hash = v; window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { const f = () => setViewState(viewFromHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => { loadIndex().then(setIndex).catch((e) => setLoadError(e.message)); }, []);
  useEffect(() => {
    const entry = index.find((e) => e.id === scenarioId);
    if (!entry) return;
    setScenario(null);
    loadScenario('scenarios', entry.file).then(setScenario).catch((e) => setLoadError(e.message));
  }, [index, scenarioId]);

  const analysis = useMemo(() => (scenario ? analyzeScenario(scenario, params, cfg, model) : null), [scenario, params]);
  const currentKey = scenario ? `${scenario.id}|${JSON.stringify(params)}` : '';
  const stale = run !== null && run.key !== currentKey;
  const entry = index.find((e) => e.id === scenarioId);

  const onRun = () => {
    if (!scenario) return;
    setRunning(true);
    window.setTimeout(() => {
      const result = runPlanning(scenario, params, cfg, model);
      setRun({ run_id: `${scenario.id}-${Date.now().toString(36)}`, computed_at_utc: new Date().toISOString(), scenario_label: scenario.label, result, key: currentKey });
      setRunning(false);
      setView('tournee');
    }, 20);
  };

  const onDecide = (d: DecisionRecord) => {
    const next = [...decisions.filter((x) => x.run_id !== d.run_id), d];
    setDecisions(next);
    setStorageWarning(!saveDecisions(next));
  };

  const decision = run ? decisions.find((d) => d.run_id === run.run_id) : undefined;
  const nominal = index.filter((e) => !e.is_test_case);
  const tests = index.filter((e) => e.is_test_case);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#operations" title="Logotype provisoire (pas le logo officiel)">
            <span className="brand-mark" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" className="brand-bolt" /></svg>
            </span>
            <span className="brand-word"><span className="b">blue</span><span className="m">move</span></span>
            <span className="brand-sub">Recharge<br />Planner</span>
          </a>
          <nav className="nav" aria-label="Navigation principale">
            <button className={view === 'operations' ? 'active' : ''} onClick={() => setView('operations')}>Opérations</button>
            <button className={view === 'tournee' ? 'active' : ''} onClick={() => setView('tournee')}>Tournée{run && !decision && !stale ? <span className="count">1</span> : null}</button>
            <button className={view === 'historique' ? 'active' : ''} onClick={() => setView('historique')}>Décisions{decisions.length ? <span className="count">{decisions.length}</span> : null}</button>
            <button className={view === 'methode' ? 'active' : ''} onClick={() => setView('methode')}>Méthode</button>
          </nav>
          <span className="spacer" />
          <div className="scenario-select">
            <label htmlFor="sc" className="xs topbar-muted">Situation</label>
            <select id="sc" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              <optgroup label="Scénarios">{nominal.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</optgroup>
              <optgroup label="Cas de test">{tests.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</optgroup>
            </select>
          </div>
          <span className="demo-badge" title="Toutes les données affichées sont simulées">● Données de démonstration</span>
        </div>
      </header>

      <main className="page">
        <div className="page-head">
          <div>
            <h1>{{ operations: 'Tableau de bord des recharges', tournee: 'Recommandation de tournée', historique: 'Décisions de l\'opérateur', methode: 'Méthode, modèle et hypothèses' }[view]}</h1>
            {entry && <div className="meta">{entry.label} · situation du {localTime(entry.as_of_utc)} (heure de Paris) · météo : {entry.weather}{entry.is_test_case ? ` · ${entry.expected_behavior}` : ''}</div>}
          </div>
        </div>
        {loadError && <div className="notice err">Impossible de charger les données de démonstration : {loadError}</div>}
        {storageWarning && <div className="notice warn small">Le navigateur refuse le stockage local : la décision est visible dans cette session mais ne sera pas conservée.</div>}

        {view === 'operations' && (scenario && analysis ? (
          <Operations cfg={cfg} scenario={scenario} analysis={analysis} zones={zones} depots={depots} params={params} setParams={setParams}
            modelUsable={modelUsable} modelVersion={modelUsable ? model.version : null} onRun={onRun} running={running} stale={stale} />
        ) : !loadError && <div className="card"><div className="empty">Chargement du scénario…</div></div>)}

        {view === 'tournee' && (run ? (
          <RunView key={run.run_id} cfg={cfg} meta={run} zones={zones} depots={depots} decision={decision} onDecide={onDecide}
            onBack={() => setView('operations')} stale={stale} />
        ) : (
          <div className="card"><div className="empty">Aucune tournée calculée.<br /><br />
            <button className="btn primary" onClick={() => setView('operations')}>Aller au tableau de bord</button></div></div>
        ))}

        {view === 'historique' && <History decisions={decisions} onClear={() => { setDecisions([]); saveDecisions([]); }} />}
        {view === 'methode' && <Method cfg={cfg} model={model} modelUsable={modelUsable} params={params} />}
      </main>
      <footer className="footer">
        BlueMove est une entreprise fictive. Démonstration pédagogique — Groupe 3, ESSEC Global BBA, DATA+AI in Corporate Strategy, Workshop 9 (consigne E). Toutes les données sont simulées ; aucun résultat ne constitue une performance mesurée. Logotype provisoire.
      </footer>
    </>
  );
}
