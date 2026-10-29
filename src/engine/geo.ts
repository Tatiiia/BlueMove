import type { Depot, HypothesesConfig, Offset, Zone } from './types';

const KM_PER_DEG = 111.32;
const EARTH_R_KM = 6371.0088;

export function offsetToLatLng(cfg: HypothesesConfig, o: Offset): { lat: number; lng: number } {
  const { lat: lat0, lng: lng0 } = cfg.city_center;
  return {
    lat: lat0 + o.north / KM_PER_DEG,
    lng: lng0 + o.east / (KM_PER_DEG * Math.cos((lat0 * Math.PI) / 180)),
  };
}

/** Distance à vol d'oiseau (km). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = p2 - p1;
  const dl = toRad(lng2 - lng1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(a));
}

export function buildZones(cfg: HypothesesConfig): Zone[] {
  return cfg.zones.map((z) => ({
    id: z.id, name: z.name, radius_m: z.radius_m, target_rentable: z.target_rentable,
    ...offsetToLatLng(cfg, z.offset_km),
  }));
}

export function buildDepots(cfg: HypothesesConfig): Depot[] {
  return cfg.depots.map((d) => ({ id: d.id, name: d.name, hypothesis: d.hypothesis, ...offsetToLatLng(cfg, d.offset_km) }));
}

/** Zone dont le cercle contient le point ; si plusieurs, la plus proche du centre. */
export function zoneOf(zones: Zone[], lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const z of zones) {
    const d = haversineKm(lat, lng, z.lat, z.lng) * 1000;
    if (d <= z.radius_m && d < bestD) { best = z.id; bestD = d; }
  }
  return best;
}
