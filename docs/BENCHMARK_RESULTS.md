# Résultats du banc d'essai (données simulées)

> Sortie de `npm run benchmark` (déterministe). 15 instants de jours ouvrés 16 à 20, non utilisés pour entraîner le modèle. Jours 16–17 : calibration des poids (D-25) ; jours 18–20 : évaluation. Valeurs simulées : elles comparent des méthodes, elles ne mesurent pas un gain réel.

### Évaluation (jours 18–20, 9 instants) — poids retenus 0,5/0,1/0,4 — vélo-cargo ×2 (défaut) (critiques éligibles cumulés : 212)
| Variante | Échanges | Critiques servis | Coût / recharge (€) | km / recharge | Déficit projeté pondéré | Scooters < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| REF | 162 | 162 | 6,11 | 1,51 | 2,7 | 118 | 1/9 |
| OPT_REGLE | 216 | 162 | 5,71 | 1,32 | 1,6 | 92 | 1/9 |
| OPT_ML | 216 | 162 | 5,48 | 1,21 | 1,6 | 91 | 7/9 |

### Évaluation (jours 18–20, 9 instants) — poids retenus 0,5/0,1/0,4 — utilitaire ×2 (critiques éligibles cumulés : 212)
| Variante | Échanges | Critiques servis | Coût / recharge (€) | km / recharge | Déficit projeté pondéré | Scooters < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| REF | 212 | 212 | 5,63 | 1,41 | 0,6 | 73 | 0/9 |
| OPT_REGLE | 513 | 208 | 4,30 | 0,69 | 0,6 | 68 | 4/9 |
| OPT_ML | 507 | 212 | 4,36 | 0,73 | 0,6 | 75 | 5/9 |

### Évaluation (jours 18–20, 9 instants) — poids initiaux 0,5/0,35/0,15 — vélo-cargo ×2 (défaut) (critiques éligibles cumulés : 212)
| Variante | Échanges | Critiques servis | Coût / recharge (€) | km / recharge | Déficit projeté pondéré | Scooters < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| REF | 162 | 162 | 6,11 | 1,51 | 2,7 | 118 | 1/9 |
| OPT_REGLE | 216 | 152 | 5,67 | 1,30 | 2,5 | 102 | 1/9 |
| OPT_ML | 216 | 162 | 5,22 | 1,08 | 2,5 | 98 | 7/9 |

### Évaluation (jours 18–20, 9 instants) — poids initiaux 0,5/0,35/0,15 — utilitaire ×2 (critiques éligibles cumulés : 212)
| Variante | Échanges | Critiques servis | Coût / recharge (€) | km / recharge | Déficit projeté pondéré | Scooters < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| REF | 212 | 212 | 5,63 | 1,41 | 0,6 | 73 | 1/9 |
| OPT_REGLE | 519 | 188 | 4,21 | 0,65 | 2,6 | 88 | 3/9 |
| OPT_ML | 511 | 210 | 4,24 | 0,66 | 0,6 | 68 | 5/9 |

### Calibration (jours 16–17, 6 instants) — poids retenus 0,5/0,1/0,4 — vélo-cargo ×2 (défaut) (critiques éligibles cumulés : 334)
| Variante | Échanges | Critiques servis | Coût / recharge (€) | km / recharge | Déficit projeté pondéré | Scooters < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| REF | 144 | 144 | 4,63 | 0,80 | 35,4 | 222 | 2/6 |
| OPT_REGLE | 144 | 144 | 4,77 | 0,87 | 33,0 | 222 | 2/6 |
| OPT_ML | 144 | 144 | 4,70 | 0,83 | 33,0 | 222 | 2/6 |

### Calibration (jours 16–17, 6 instants) — poids retenus 0,5/0,1/0,4 — utilitaire ×2 (critiques éligibles cumulés : 334)
| Variante | Échanges | Critiques servis | Coût / recharge (€) | km / recharge | Déficit projeté pondéré | Scooters < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| REF | 284 | 284 | 4,44 | 0,77 | 13,6 | 110 | 2/6 |
| OPT_REGLE | 355 | 264 | 4,14 | 0,61 | 10,7 | 152 | 1/6 |
| OPT_ML | 346 | 278 | 4,11 | 0,59 | 12,7 | 122 | 3/6 |

### Calibration (jours 16–17, 6 instants) — poids initiaux 0,5/0,35/0,15 — vélo-cargo ×2 (défaut) (critiques éligibles cumulés : 334)
| Variante | Échanges | Critiques servis | Coût / recharge (€) | km / recharge | Déficit projeté pondéré | Scooters < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| REF | 144 | 144 | 4,63 | 0,80 | 35,4 | 222 | 4/6 |
| OPT_REGLE | 144 | 139 | 4,75 | 0,85 | 40,5 | 226 | 1/6 |
| OPT_ML | 144 | 144 | 4,75 | 0,85 | 39,3 | 222 | 1/6 |

### Calibration (jours 16–17, 6 instants) — poids initiaux 0,5/0,35/0,15 — utilitaire ×2 (critiques éligibles cumulés : 334)
| Variante | Échanges | Critiques servis | Coût / recharge (€) | km / recharge | Déficit projeté pondéré | Scooters < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| REF | 284 | 284 | 4,44 | 0,77 | 13,6 | 110 | 6/6 |
| OPT_REGLE | 357 | 252 | 4,08 | 0,58 | 18,6 | 154 | 0/6 |
| OPT_ML | 354 | 264 | 4,07 | 0,57 | 16,3 | 143 | 0/6 |
