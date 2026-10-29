# Rapport d'entraînement — modèle de risque d'épuisement v1.0.0

> **Données simulées.** Ces métriques valident la chaîne de calcul (préparation, découpage temporel,
> entraînement, export, inférence). Elles **ne démontrent pas** une performance réelle chez BlueMove.
> Seuils d'activation sur données réelles (H22) : AUC ≥ 0,75 et précision@10 ≥ référence + 10 points.

## Données
- Population : instantanés horaires, jours ouvrés 6 h–22 h, scooters actifs, charge entre 20 et 40 %.
- Cible : charge < 20 % trois heures plus tard ; 728 lignes écartées (échange dans l'intervalle).
- Apprentissage : 14353 lignes (jours 1–15) · Test : 4860 lignes (jours 16–20) · Taux de positifs en test : 15.0%.

## Résultats sur la période de test
| Métrique | Modèle | Référence sans ML |
|---|---|---|
| ROC AUC | 0.767 | 0.743 (charge croissante) |
| Score de Brier (plus bas = mieux) | 0.1121 | 0.1286 (taux moyen constant) |
| Précision@10 par heure | 0.313 | 0.305 |

## Coefficients (variables standardisées)
| Variable | Moyenne | Écart-type | Coefficient |
|---|---|---|---|
| charge_pct | 30.212 | 5.751 | -0.910 |
| usage_rate_6h | 0.978 | 1.080 | +0.141 |
| zone_demand_next_h | 30.405 | 13.631 | +0.314 |
| is_rain | 0.377 | 0.485 | -0.083 |
| (constante) | | | -1.763 |

## Calibration par décile de probabilité prédite
| Décile | Probabilité moyenne prédite | Taux observé | n |
|---|---|---|---|
| 1 | 0.030 | 0.019 | 486 |
| 2 | 0.046 | 0.019 | 486 |
| 3 | 0.064 | 0.058 | 486 |
| 4 | 0.086 | 0.076 | 486 |
| 5 | 0.112 | 0.076 | 486 |
| 6 | 0.143 | 0.130 | 486 |
| 7 | 0.181 | 0.169 | 486 |
| 8 | 0.237 | 0.255 | 486 |
| 9 | 0.299 | 0.294 | 486 |
| 10 | 0.414 | 0.401 | 486 |

## Limites
- Le simulateur génère la consommation à partir de l'usage et de la demande de zone ; le modèle retrouve
  cette logique. Sur le terrain, relief, température, vieillissement des batteries et comportements
  d'usage modifieront les relations.
- Le modèle ne s'applique qu'aux scooters entre 20 et 40 % ; les scooters déjà sous 20 % sont prioritaires par règle.
