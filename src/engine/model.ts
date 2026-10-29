// Inférence du modèle de risque d'épuisement (seule brique d'apprentissage automatique).
// Régression logistique entraînée hors ligne (ml/train_depletion.py), coefficients exportés en JSON.
import type { DepletionModel } from './types';

export const MODEL_FEATURES = ['charge_pct', 'usage_rate_6h', 'zone_demand_next_h', 'is_rain'];

/** Vérifie que le fichier du modèle est exploitable ; sinon le ML est déclaré indisponible. */
export function isModelUsable(m: DepletionModel | null | undefined): m is DepletionModel {
  if (!m || m.status === 'disabled') return false;
  const n = MODEL_FEATURES.length;
  return Array.isArray(m.features) && m.features.join(',') === MODEL_FEATURES.join(',')
    && m.mean?.length === n && m.std?.length === n && m.coef?.length === n
    && m.std.every((s) => Number.isFinite(s) && s > 0) && Number.isFinite(m.intercept);
}

export function predictDepletion(m: DepletionModel, x: number[]): number {
  let z = m.intercept;
  for (let j = 0; j < x.length; j++) z += m.coef[j] * ((x[j] - m.mean[j]) / m.std[j]);
  return 1 / (1 + Math.exp(-z));
}
