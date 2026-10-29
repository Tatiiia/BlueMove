// Formats d'affichage (français). « ND » quand un calcul est impossible (règle W6).
export const ND = 'ND';

export function n(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return ND;
  return x.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function pct(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return ND;
  return `${(x * 100).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
}
export function eur(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return ND;
  return `${x.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`;
}
export function minutes(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return ND;
  const h = Math.floor(m / 60);
  const mm = Math.round(m - h * 60);
  return h > 0 ? `${h} h ${String(mm).padStart(2, '0')}` : `${mm} min`;
}
export function hours(h: number | null | undefined): string {
  return h === null || h === undefined ? ND : minutes(h * 60);
}
export function age(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return ND;
  if (m < 1) return `${Math.max(0, Math.round(m * 60))} s`;
  return `${n(m, m < 10 ? 1 : 0)} min`;
}
/** Écart relatif (b − a) / a, ou null. */
export function rel(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined || !Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return (b - a) / Math.abs(a);
}
export function signedPct(x: number | null): string {
  if (x === null) return ND;
  const v = Math.round(x * 1000) / 10;
  return `${v > 0 ? '+' : ''}${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}
export function localTime(iso: string, withDate = true): string {
  const opts: Intl.DateTimeFormatOptions = withDate
    ? { timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('fr-FR', opts).format(new Date(iso));
}
export function clockAfter(isoStart: string, addMin: number): string {
  return localTime(new Date(Date.parse(isoStart) + addMin * 60000).toISOString(), false);
}
