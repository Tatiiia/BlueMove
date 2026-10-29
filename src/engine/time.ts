// Heures stockées en UTC, affichées et interprétées en heure locale (Europe/Paris) — cadre commun.

export function parseUtc(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Âge en minutes d'un horodatage par rapport à l'instant du scénario. */
export function ageMinutes(asOfUtc: string, ts: string | null): number | null {
  const a = parseUtc(asOfUtc);
  const t = parseUtc(ts);
  if (a === null || t === null) return null;
  return (a - t) / 60000;
}

/** Heure locale décimale (ex. 16,5 pour 16 h 30) dans le fuseau donné. */
export function localDecimalHour(isoUtc: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(isoUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') + get('minute') / 60 + get('second') / 3600;
}

export function formatLocal(isoUtc: string, timeZone: string, withDate = true): string {
  const opts: Intl.DateTimeFormatOptions = withDate
    ? { timeZone, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { timeZone, hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('fr-FR', opts).format(new Date(isoUtc));
}

export function addMinutesIso(isoUtc: string, minutes: number): string {
  return new Date(Date.parse(isoUtc) + minutes * 60000).toISOString();
}
