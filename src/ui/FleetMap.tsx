// Plan schématique de la ville fictive (SVG). Projection locale en kilomètres, sans fond de carte externe.
// Les tracés de tournée sont des segments à vol d'oiseau : les distances affichées sont des estimations.
import { useMemo, useRef, useState } from 'react';
import type { Depot, Zone } from '../engine/types';

export type PointKind = 'crit' | 'prev' | 'ok' | 'excl' | 'maint';
export interface MapPoint {
  id: string; lat: number; lng: number; kind: PointKind; title: string; lines: string[];
}
export interface MapRoute { agent: number; color: string; stops: { lat: number; lng: number; seq: number; id: string }[] }

interface Props {
  zones: Zone[];
  depots: Depot[];
  activeDepot: string;
  closedZones: string[];
  points: MapPoint[];
  routes?: MapRoute[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  center: { lat: number; lng: number };
  fadeUnrouted?: boolean;
}

const S = 100; // pixels par km
const KM = 111.32;
const ORDER: PointKind[] = ['ok', 'excl', 'prev', 'crit', 'maint'];

export function FleetMap(p: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ pt: MapPoint; x: number; y: number } | null>(null);
  const cos0 = Math.cos((p.center.lat * Math.PI) / 180);
  const proj = (lat: number, lng: number) => ({ x: (lng - p.center.lng) * cos0 * KM * S, y: -(lat - p.center.lat) * KM * S });

  const box = useMemo(() => {
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    const add = (x: number, y: number, r = 0) => { minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r); minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r); };
    for (const z of p.zones) { const q = proj(z.lat, z.lng); add(q.x, q.y, (z.radius_m / 1000) * S); }
    for (const d of p.depots) { const q = proj(d.lat, d.lng); add(q.x, q.y, 20); }
    for (const pt of p.points) { const q = proj(pt.lat, pt.lng); add(q.x, q.y, 10); }
    const m = 0.45 * S;
    return { x: minX - m, y: minY - m - 20, w: maxX - minX + 2 * m, h: maxY - minY + 2 * m + 20 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.zones, p.depots, p.points]);

  const routed = useMemo(() => new Set((p.routes ?? []).flatMap((r) => r.stops.map((s) => s.id))), [p.routes]);
  const closed = new Set(p.closedZones);
  const sorted = useMemo(() => [...p.points].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)), [p.points]);
  const gridLines: number[] = [];
  for (let k = Math.ceil(box.x / S); k * S < box.x + box.w; k++) gridLines.push(k);
  const gridRows: number[] = [];
  for (let k = Math.ceil(box.y / S); k * S < box.y + box.h; k++) gridRows.push(k);

  const showTip = (pt: MapPoint, e: React.MouseEvent) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ pt, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div className="map-wrap" ref={wrap} onMouseLeave={() => setHover(null)}>
      <svg className="map-svg" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img"
        aria-label="Plan schématique des zones, du dépôt et des scooters" onClick={() => p.onSelect(null)}>
        <defs>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" className="m-hatch" strokeWidth="2" />
          </pattern>
          {(p.routes ?? []).map((r) => (
            <marker key={r.agent} id={`arrow-${r.agent}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: r.color }} />
            </marker>
          ))}
        </defs>
        {gridLines.map((k) => <line key={`gx${k}`} className="m-grid" x1={k * S} x2={k * S} y1={box.y} y2={box.y + box.h} strokeWidth="1" />)}
        {gridRows.map((k) => <line key={`gy${k}`} className="m-grid" y1={k * S} y2={k * S} x1={box.x} x2={box.x + box.w} strokeWidth="1" />)}

        {p.zones.map((z) => {
          const q = proj(z.lat, z.lng);
          const r = (z.radius_m / 1000) * S;
          const isClosed = closed.has(z.id);
          return (
            <g key={z.id}>
              <circle className={`m-zone${isClosed ? ' closed' : ''}`} cx={q.x} cy={q.y} r={r} strokeWidth="1.5" strokeDasharray={isClosed ? '6 4' : undefined} />
              <text className={`m-zlabel${isClosed ? ' closed' : ''}`} x={q.x} y={q.y - r - 7} textAnchor="middle" fontSize="13" fontWeight="700">
                {z.name}{isClosed ? ' · fermée' : ''}
              </text>
            </g>
          );
        })}

        {(p.routes ?? []).map((r) => {
          const d = p.depots.find((x) => x.id === p.activeDepot)!;
          const pts = [d, ...r.stops, d].map((s) => proj(s.lat, s.lng));
          return (
            <g key={`r${r.agent}`}>
              {pts.slice(1).map((b, i) => {
                const a = pts[i];
                const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
                return (
                  <g key={i}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: r.color }} strokeWidth="3" strokeOpacity="0.85" strokeLinecap="round"
                      strokeDasharray={i === pts.length - 2 ? '6 5' : undefined} />
                    <line x1={a.x} y1={a.y} x2={mx} y2={my} style={{ stroke: r.color }} strokeWidth="3" strokeOpacity="0" markerEnd={`url(#arrow-${r.agent})`} />
                  </g>
                );
              })}
            </g>
          );
        })}

        {sorted.map((pt) => {
          const q = proj(pt.lat, pt.lng);
          const faded = p.fadeUnrouted && routed.size > 0 && !routed.has(pt.id);
          const sel = p.selectedId === pt.id;
          const common = {
            className: `m-pt ${pt.kind}${sel ? ' sel' : ''}`,
            onMouseMove: (e: React.MouseEvent) => showTip(pt, e),
            onClick: (e: React.MouseEvent) => { e.stopPropagation(); p.onSelect(pt.id); },
            opacity: faded ? 0.25 : 1,
          };
          if (pt.kind === 'maint') {
            return <rect key={pt.id} {...common} x={q.x - 5} y={q.y - 5} width="10" height="10" transform={`rotate(45 ${q.x} ${q.y})`} />;
          }
          const radius = { crit: 5.5, prev: 5, ok: 3.2, excl: 4 }[pt.kind];
          return <circle key={pt.id} {...common} cx={q.x} cy={q.y} r={sel ? radius + 2.5 : radius} />;
        })}

        {(p.routes ?? []).map((r) => r.stops.map((s) => {
          const q = proj(s.lat, s.lng);
          return (
            <g key={`b${r.agent}-${s.seq}`} onClick={(e) => { e.stopPropagation(); p.onSelect(s.id); }} style={{ cursor: 'pointer' }}>
              <circle className="m-badge" cx={q.x} cy={q.y} r={p.selectedId === s.id ? 12 : 9.5} style={{ fill: r.color }} strokeWidth="2" />
              <text className="m-badge-t" x={q.x} y={q.y + 3.8} textAnchor="middle" fontSize="10.5" fontWeight="700">{s.seq}</text>
            </g>
          );
        }))}

        {p.depots.map((d) => {
          const q = proj(d.lat, d.lng);
          const active = d.id === p.activeDepot;
          return (
            <g key={d.id} opacity={active ? 1 : 0.45}>
              <rect className={`m-depot${active ? '' : ' off'}`} x={q.x - 9} y={q.y - 9} width="18" height="18" rx="4" strokeWidth="2" />
              <text className="m-depot-d" x={q.x} y={q.y + 4} textAnchor="middle" fontSize="10" fontWeight="800">D</text>
              <text className="m-ink" x={q.x + 14} y={q.y + 4} fontSize="11.5" fontWeight="600">{d.name}{active ? '' : ' (inactif)'}</text>
            </g>
          );
        })}

        <g className="m-scale" transform={`translate(${box.x + 16} ${box.y + box.h - 16})`}>
          <line x1="0" y1="0" x2={S} y2="0" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" strokeWidth="2" />
          <line x1={S} y1="-4" x2={S} y2="4" strokeWidth="2" />
          <text className="m-ink" x={S / 2} y="-7" textAnchor="middle" fontSize="11">1 km</text>
        </g>
      </svg>
      {hover && (
        <div className="map-tooltip" style={{ left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 600) - 200), top: hover.y + 12 }}>
          <div className="t">{hover.pt.title}</div>
          {hover.pt.lines.map((l, i) => <div key={i} className={i === 0 ? '' : 'l'}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

export function MapLegend({ withRoutes = false }: { withRoutes?: boolean }) {
  return (
    <div className="legend">
      <span className="it"><span className="dot crit" />Critique (&lt; 20 %, non louable)</span>
      <span className="it"><span className="dot prev" />Préventif (20 % → seuil)</span>
      <span className="it"><span className="dot ok" />Charge suffisante</span>
      <span className="it"><span className="dot excl" />Exclu (loué, réservé, périmé, hors zone…)</span>
      <span className="it"><span className="dot maint" />Orienté maintenance</span>
      <span className="it"><span className="dot depot" />Point de départ</span>
      {withRoutes && <span className="it muted">Traits : trajets d'agents à vol d'oiseau (estimation) · pointillé : retour</span>}
    </div>
  );
}
