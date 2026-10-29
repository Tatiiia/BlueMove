// Construction des tournées — MVP_SPEC §8.
// Optimisation combinatoire classique (recherche opérationnelle) : AUCUN apprentissage ici.
//   REF        : seuil 20 % + plus proche voisin (planification manuelle simulée)
//   OPT_*      : insertion gloutonne (priorité / temps ajouté) + 2-opt + échanges, déterministe
import { haversineKm } from './geo';

export interface Node { id: string; lat: number; lng: number }

export interface Problem {
  depot: { lat: number; lng: number };
  nodes: Node[];          // candidats (indices 1..n dans les matrices ; 0 = dépôt)
  prize: number[];        // priorité par nœud (index 0..n-1)
  agents: number;
  capacity: number;
  shiftMin: number;
  serviceMin: number;
  speedKmh: number;
  detour: number;
}

export interface Solution {
  routes: number[][];     // indices de nœuds (0..n-1)
  stats: { insertions: number; twoOptMoves: number; swaps: number; passes: number };
}

export class Matrix {
  readonly size: number;
  readonly km: Float64Array;
  readonly min: Float64Array;
  constructor(p: Problem) {
    const pts = [p.depot, ...p.nodes];
    this.size = pts.length;
    this.km = new Float64Array(this.size * this.size);
    this.min = new Float64Array(this.size * this.size);
    for (let i = 0; i < this.size; i++) {
      for (let j = i + 1; j < this.size; j++) {
        const d = haversineKm(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng) * p.detour;
        const t = (d / p.speedKmh) * 60;
        this.km[i * this.size + j] = d; this.km[j * this.size + i] = d;
        this.min[i * this.size + j] = t; this.min[j * this.size + i] = t;
      }
    }
  }
  /** a, b : indices matrice (0 = dépôt, nœud k → k + 1). */
  t(a: number, b: number): number { return this.min[a * this.size + b]; }
  d(a: number, b: number): number { return this.km[a * this.size + b]; }
}

const EPS = 1e-9;

/** Durée d'une tournée (trajets aller-retour dépôt + interventions), en minutes. */
export function routeDuration(m: Matrix, route: number[], serviceMin: number): number {
  if (route.length === 0) return 0;
  let t = m.t(0, route[0] + 1);
  for (let i = 1; i < route.length; i++) t += m.t(route[i - 1] + 1, route[i] + 1);
  t += m.t(route[route.length - 1] + 1, 0);
  return t + serviceMin * route.length;
}

export function routeKm(m: Matrix, route: number[]): number {
  if (route.length === 0) return 0;
  let d = m.d(0, route[0] + 1);
  for (let i = 1; i < route.length; i++) d += m.d(route[i - 1] + 1, route[i] + 1);
  return d + m.d(route[route.length - 1] + 1, 0);
}

function insertionDelta(m: Matrix, route: number[], node: number, pos: number, serviceMin: number): number {
  const a = pos === 0 ? 0 : route[pos - 1] + 1;
  const b = pos === route.length ? 0 : route[pos] + 1;
  return m.t(a, node + 1) + m.t(node + 1, b) - m.t(a, b) + serviceMin;
}

function bestInsertion(m: Matrix, route: number[], node: number, serviceMin: number): { pos: number; delta: number } {
  let best = { pos: -1, delta: Infinity };
  for (let p = 0; p <= route.length; p++) {
    const dt = insertionDelta(m, route, node, p, serviceMin);
    if (dt < best.delta - EPS) best = { pos: p, delta: dt };
  }
  return best;
}

function twoOpt(m: Matrix, route: number[]): number {
  let moves = 0;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const a = i === 0 ? 0 : route[i - 1] + 1;
        const b = j === route.length - 1 ? 0 : route[j + 1] + 1;
        const ri = route[i] + 1;
        const rj = route[j] + 1;
        const delta = m.t(a, rj) + m.t(ri, b) - m.t(a, ri) - m.t(rj, b);
        if (delta < -EPS) {
          let x = i; let y = j;
          while (x < y) { [route[x], route[y]] = [route[y], route[x]]; x++; y--; }
          improved = true; moves++;
        }
      }
    }
  }
  return moves;
}

/** Heuristique OPT : maximiser la somme des priorités servies sous contraintes (temps, batteries). */
export function optimizeRoutes(p: Problem, m: Matrix): Solution {
  const n = p.nodes.length;
  const routes: number[][] = Array.from({ length: p.agents }, () => []);
  const assigned = new Array<boolean>(n).fill(false);
  const order = [...Array(n).keys()].sort((a, b) => (p.nodes[a].id < p.nodes[b].id ? -1 : 1));
  const stats = { insertions: 0, twoOptMoves: 0, swaps: 0, passes: 0 };
  if (p.capacity < 1 || p.agents < 1) return { routes, stats };
  const dur = () => routes.map((r) => routeDuration(m, r, p.serviceMin));

  for (let pass = 0; pass < 3; pass++) {
    stats.passes++;
    let changed = false;
    // 1. Insertion gloutonne
    let times = dur();
    for (;;) {
      let best: { i: number; k: number; pos: number; ratio: number; dt: number } | null = null;
      for (const i of order) {
        if (assigned[i] || !(p.prize[i] > 0)) continue;
        for (let k = 0; k < p.agents; k++) {
          if (routes[k].length >= p.capacity) continue;
          for (let pos = 0; pos <= routes[k].length; pos++) {
            const dt = insertionDelta(m, routes[k], i, pos, p.serviceMin);
            if (times[k] + dt > p.shiftMin + EPS) continue;
            const ratio = p.prize[i] / dt;
            if (!best || ratio > best.ratio + 1e-12
              || (Math.abs(ratio - best.ratio) <= 1e-12 && p.prize[i] > p.prize[best.i] + EPS)) {
              best = { i, k, pos, ratio, dt };
            }
          }
        }
      }
      if (!best) break;
      routes[best.k].splice(best.pos, 0, best.i);
      assigned[best.i] = true;
      times[best.k] += best.dt;
      stats.insertions++;
      changed = true;
    }
    // 2. 2-opt
    for (const r of routes) {
      const mv = twoOpt(m, r);
      if (mv > 0) { stats.twoOptMoves += mv; changed = true; }
    }
    // 3. Échanges : remplacer un nœud servi par un non servi de priorité supérieure, si admissible
    times = dur();
    const unassigned = order.filter((i) => !assigned[i] && p.prize[i] > 0)
      .sort((a, b) => p.prize[b] - p.prize[a] || (p.nodes[a].id < p.nodes[b].id ? -1 : 1));
    for (const i of unassigned) {
      if (stats.swaps >= 200) break;
      let best: { k: number; j: number; route: number[]; time: number; gain: number } | null = null;
      for (let k = 0; k < p.agents; k++) {
        for (let jj = 0; jj < routes[k].length; jj++) {
          const j = routes[k][jj];
          const gain = p.prize[i] - p.prize[j];
          if (!(gain > EPS)) continue;
          const without = routes[k].filter((_, idx) => idx !== jj);
          const ins = bestInsertion(m, without, i, p.serviceMin);
          const time = routeDuration(m, without, p.serviceMin) + ins.delta;
          if (time > p.shiftMin + EPS) continue;
          if (!best || gain > best.gain + EPS || (Math.abs(gain - best.gain) <= EPS && time < best.time - EPS)) {
            const nr = [...without]; nr.splice(ins.pos, 0, i);
            best = { k, j, route: nr, time, gain };
          }
        }
      }
      if (best) {
        routes[best.k] = best.route;
        assigned[i] = true; assigned[best.j] = false;
        times[best.k] = best.time;
        stats.swaps++;
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const r of routes) stats.twoOptMoves += twoOpt(m, r);
  return { routes, stats };
}

/** Variante REF : visite au plus proche voisin, agent le moins chargé d'abord (planification manuelle simulée). */
export function nearestNeighbourRoutes(p: Problem, m: Matrix): Solution {
  const n = p.nodes.length;
  const routes: number[][] = Array.from({ length: p.agents }, () => []);
  const stats = { insertions: 0, twoOptMoves: 0, swaps: 0, passes: 1 };
  if (p.capacity < 1 || p.agents < 1) return { routes, stats };
  const visited = new Array<boolean>(n).fill(false);
  const cur = new Array<number>(p.agents).fill(0); // temps écoulé hors retour
  const open = new Array<boolean>(p.agents).fill(true);
  for (;;) {
    let k = -1;
    for (let a = 0; a < p.agents; a++) if (open[a] && (k < 0 || cur[a] < cur[k] - EPS)) k = a;
    if (k < 0) break;
    const last = routes[k].length ? routes[k][routes[k].length - 1] + 1 : 0;
    let best = -1;
    let bestD = Infinity;
    if (routes[k].length < p.capacity) {
      for (let i = 0; i < n; i++) {
        if (visited[i]) continue;
        const total = cur[k] + m.t(last, i + 1) + p.serviceMin + m.t(i + 1, 0);
        if (total > p.shiftMin + EPS) continue;
        const d = m.d(last, i + 1);
        if (d < bestD - EPS || (Math.abs(d - bestD) <= EPS && best >= 0 && p.nodes[i].id < p.nodes[best].id)) { best = i; bestD = d; }
      }
    }
    if (best < 0) { open[k] = false; continue; }
    cur[k] += m.t(last, best + 1) + p.serviceMin;
    routes[k].push(best);
    visited[best] = true;
    stats.insertions++;
  }
  return { routes, stats };
}
