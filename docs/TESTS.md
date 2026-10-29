# Tests — BlueMove Recharge Planner

> Toutes les valeurs sont calculées sur **données simulées** (graine fixe). Elles vérifient le comportement du logiciel et comparent des méthodes ; elles ne mesurent pas une performance réelle.

## 1. Tests automatisés du moteur (`npm test`)

Résultat de la dernière exécution : **23 tests, 23 réussis, 0 échec** (≈ 2,5 s).

| # | Test | Critère | Résultat |
|---|---|---|---|
| 1 | SHA-256 : vecteur de référence « abc » | AC-12, AC-21 | ✅ |
| 2 | Demande : TypeScript identique au générateur Python (24 cas) | cohérence §7.1 | ✅ |
| 3 | Inférence du modèle identique à scikit-learn (12 cas, écart < 10⁻⁹) | §7.5 | ✅ |
| 4 | Exemples de la formule de priorité : 90,40 et 41,15 | AC-15 | ✅ |
| 5 | Chaque scooter dans une seule catégorie (SC02, TC08) | AC-02 | ✅ |
| 6 | TC08 : charge 145 % et −5 %, doublon, (0,0), batterie non conforme, statut inconnu → codes attendus, jamais en tournée | AC-03, T08 | ✅ |
| 7 | TC02 : 15 mesures batterie et 5 positions périmées exclues | AC-04, T02 | ✅ |
| 8 | TC03 : aucun scooter loué ou réservé dans une tournée | AC-05, T03 | ✅ |
| 9 | TC09 : alertes BMS et température orientées maintenance | AC-06, T09 | ✅ |
| 10 | Zone Gare fermée : aucune étape dans la zone | AC-07, T06 | ✅ |
| 11 | TC10 : 4 scooters hors zone exclus | AC-08, T10 | ✅ |
| 12 | 9 scénarios × 3 jeux de paramètres × 3 variantes : capacité, durée, unicité, éligibilité, REF limitée aux critiques | AC-09, AC-10, T12 | ✅ |
| 13 | TC01 : capacité contraignante, critiques non servis motivés | T01 | ✅ |
| 14 | Capacité réduite à 3 batteries par agent | T04 | ✅ |
| 15 | Durée de 30 min : tournées ≤ 30 min, motif « Temps insuffisant » | T05 | ✅ |
| 16 | Aucune tournée admissible (départ Nord, 30 min, seule zone ouverte : Résidentiel) ; toutes zones fermées | AC-11, T07 | ✅ |
| 17 | Déterminisme : mêmes entrées → mêmes tournées et même empreinte | AC-12 | ✅ |
| 18 | Performance : 300 scooters, 3 utilitaires, 480 min → < 2 s | AC-13 | ✅ |
| 19 | Modèle absent, désactivé ou invalide → « + ML » non calculée | AC-17, T11 | ✅ |
| 20 | La référence peut être recommandée | AC-16 | ✅ |
| 21 | Indicateurs « ND » sans échange | AC-24 | ✅ |
| 22 | Paramètres hors bornes corrigés (agents, durée, capacité, dépôt, zones) | validation des entrées | ✅ |
| 23 | Le seuil d'intervention modifie réellement les candidats | interactivité | ✅ |

Vérification de types : `tsc --noEmit` strict sur `src/engine` et `tests` → **0 erreur**.

## 2. Parcours de bout en bout dans le navigateur

Script Playwright exécuté contre le build de production servi localement (Chromium headless).

| Étape | Constat |
|---|---|
| Chargement de SC02 | 300 scooters suivis, 272 louables, 77 à traiter, 12 critiques, 16 exclus |
| Seuil d'intervention 40 → 30 % | Candidats 77 → 46 (filtrage réel) |
| Zone Gare fermée | Candidats 77 → 55 ; zone hachurée sur le plan |
| Clic sur un scooter critique | Fiche : batterie, statut, zone, position, fraîcheur GPS/BMS, louabilité, décision |
| « Optimiser la tournée » | 3 variantes ; Référence 12 interventions (8,01 €/recharge), Optimisée 24 (5,82 €), Optimisée + ML 24 (5,57 €, recommandée) ; 24 arrêts listés |
| Rejet sans motif | Bloqué : « Un motif est obligatoire » |
| Approbation | Notice « Décision enregistrée dans le simulateur… » ; bouton d'impression de la feuille de route |
| Décisions | 1 décision, KR6 = 100 % |
| Méthode → banc d'essai | Tableau des jours 18–20 calculé en ≈ 0,4 s |
| Cas TC08 → Contrôles qualité | Rejets listés en tête avec leur code (doublon, charge 145 %…) |
| Toutes zones fermées → calcul | « Aucune tournée admissible : zones des candidats toutes fermées. » |
| Mobile 390 px | Mise en page empilée, aucun débordement horizontal |
| Console | **Aucune erreur JavaScript** |

## 3. Résultats des scénarios de démonstration (paramètres par défaut : 2 vélos-cargos, 12 batteries, 4 h)

| Scénario | Variante | Interventions | dont critiques | Distance | Coût / recharge | Scooters < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| SC01 · 06 h 30 (47 critiques) | Référence | 24 | 24 | 21,0 km | 4,80 € | 23 | |
| | Optimisée | 24 | 24 | 15,6 km | 4,34 € | 23 | ★ |
| | Optimisée + ML | 24 | 24 | 15,6 km | 4,34 € | 23 | |
| SC02 · 16 h 30 (12 critiques) | Référence | 12 | 12 | 29,4 km | 8,01 € | 12 | |
| | Optimisée | 24 | 12 | 33,0 km | 5,82 € | 7 | |
| | Optimisée + ML | 24 | 12 | 30,1 km | 5,57 € | 7 | ★ |
| SC03 · 12 h 00, pluie (34 critiques) | Référence | 24 | 24 | 20,0 km | 4,71 € | 21 | ★ |
| | Optimisée | 24 | 24 | 23,9 km | 5,04 € | 21 | |
| | Optimisée + ML | 24 | 24 | 22,8 km | 4,95 € | 21 | |

Lecture : quand les critiques dépassent la capacité (SC01, SC03), toutes les variantes traitent 24 critiques ; l'optimisation peut raccourcir le parcours (SC01) mais pas toujours (SC03, où la référence est recommandée). Quand la capacité dépasse les critiques (SC02), l'optimisation ajoute des préventifs utiles et réduit le coût par recharge.

## 4. Banc d'essai (9 situations d'évaluation, jours 18–20)

Paramètres par défaut, vélo-cargo ×2 (détail complet : `BENCHMARK_RESULTS.md`) :

| Variante | Interventions | Critiques servis (sur 212) | Coût / recharge | km / recharge | Déficit projeté | < 20 % à 3 h | Recommandée |
|---|---|---|---|---|---|---|---|
| Référence | 162 | 162 | 6,11 € | 1,51 | 2,7 | 118 | 1 / 9 |
| Optimisée | 216 | 162 | 5,71 € | 1,32 | 1,6 | 92 | 1 / 9 |
| Optimisée + ML | 216 | 162 | 5,48 € | 1,21 | 1,6 | 91 | 7 / 9 |

Avec les poids de conception initiaux (0,50 / 0,35 / 0,15), l'optimisation servait moins de critiques (152) et la référence était recommandée plus souvent sur les jours de calibration : c'est l'origine du recalibrage D-25.

## 5. Limitations restantes

- La vérification TypeScript des composants React n'a pas pu tourner dans l'environnement de développement (types React non installables hors ligne). Le build esbuild et le parcours navigateur n'ont révélé aucune erreur ; lancer `npm install && npm run typecheck` une fois sur une machine connectée.
- Pas de test automatisé des composants d'interface (le parcours Playwright a servi de recette ; il n'est pas inclus dans `npm test`).
- Le déploiement Vercel n'a pas été réalisé ni vérifié depuis l'environnement de développement (pas d'accès réseau).
- Rôles et authentification non implémentés (D-18).
- Les métriques du modèle et du banc d'essai sont issues de la simulation.
