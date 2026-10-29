# BlueMove · Recharge Planner

Outil d'aide à la planification des **tournées de recharge** des scooters électriques BlueMove — Workshop 9, consigne E (« Optimiser les trajets de rechargement pour l'équipe de maintenance »), cours *DATA+AI in Corporate Strategy*, ESSEC Global BBA, Groupe 3.

> **Démonstration pédagogique. BlueMove est une entreprise fictive et toutes les données sont simulées.** Aucun résultat affiché n'est une performance mesurée sur le terrain. L'application recommande ; l'opérateur décide ; aucune commande n'est envoyée à un scooter ou à un agent.

## Ce que fait l'application

Pour une situation de flotte donnée (300 scooters, 6 zones), le responsable des opérations peut :

1. voir **quels scooters nécessitent une intervention**, lesquels sont exclus et pourquoi (loués, réservés, données périmées, hors zone, alertes batterie, erreurs de données) ;
2. régler la tournée : point de départ, nombre d'agents, véhicule, batteries transportées, durée, seuil d'intervention, poids de priorité, zones fermées, activation du modèle ML ;
3. consulter les **priorités** et leur justification (urgence, demande de la zone, rareté locale) ;
4. lancer **« Optimiser la tournée »** : calcul de trois variantes sur les mêmes données — **Référence** (critiques au plus proche voisin, sans IA), **Optimisée** (heuristique de tournée, sans IA), **Optimisée + ML** (urgence des préventifs estimée par un modèle) ;
5. voir l'**ordre des arrêts** par agent, les heures estimées, la carte, les scooters non retenus avec leur motif ;
6. **comparer** les variantes (coût par recharge, km par recharge, couverture des critiques, projection de service) et isoler l'apport de l'optimisation et celui du ML ;
7. **approuver ou rejeter** (motif obligatoire) ; la recommandation expire après 30 min ; feuille de route imprimable ;
8. consulter le **journal des décisions** (KR6 taux d'acceptation), la **fiche du modèle**, les **hypothèses** et un **banc d'essai** sur 15 situations simulées.

## Ce qui relève de l'IA, et ce qui n'en relève pas

| Brique | Nature | Fichier |
|---|---|---|
| Contrôles qualité, éligibilité, alertes | Règles | `src/engine/validate.ts` |
| Score de priorité | Règle (formule pondérée) | `src/engine/priority.ts` |
| Risque qu'un scooter à 20–40 % passe sous 20 % en 3 h | **Apprentissage automatique** (régression logistique) | `ml/train_depletion.py`, `src/engine/model.ts` |
| Sélection et ordre des arrêts | Optimisation combinatoire (recherche opérationnelle, pas de l'IA) | `src/engine/optimize.ts` |
| Recommandation entre variantes | Règle | `src/engine/run.ts` |
| Approbation ou rejet | Décision humaine | `src/ui/RunView.tsx` |

## Pile technique

- **Interface** : React 19 + TypeScript, CSS natif, plan SVG (aucune clé d'API, aucun service externe).
- **Build** : esbuild → site statique dans `dist/` (compatible Vercel sans serveur).
- **Moteur** : TypeScript pur, déterministe, testé (`node:test` via `tsx`).
- **Données et modèle** : Python 3 (numpy, pandas, scikit-learn) — générateur à graine fixe, modèle exporté en JSON.
- **Persistance** : stockage local du navigateur pour le journal des décisions (aucune donnée personnelle).

Pourquoi pas Next.js / Supabase : voir `docs/DECISIONS.md` (D-17 à D-19).

## Installation locale

Prérequis : Node.js ≥ 20 ; Python ≥ 3.10 uniquement pour régénérer les données.

```bash
npm install
npm test            # 23 tests du moteur
npm run build       # produit dist/
npm run dev         # build + serveur local http://localhost:5173 (rechargement à la modification)
```

Ouvrir `dist/index.html` directement depuis le disque ne fonctionne pas (les scénarios sont chargés par `fetch`) : utiliser `npm run dev` ou un serveur statique (`npx serve dist`).

### Commandes

| Commande | Effet |
|---|---|
| `npm run build` | Compile l'application dans `dist/` (copie des scénarios et du banc d'essai) |
| `npm run dev` | Build en mode développement + serveur local |
| `npm test` | Tests du moteur (critères d'acceptation, cas T01–T12) |
| `npm run typecheck` | Vérification TypeScript complète (nécessite `npm install`) |
| `npm run benchmark` | Banc d'essai sur 15 situations simulées (tableaux Markdown) |
| `npm run data` | Régénère les données simulées et réentraîne le modèle (Python) |

Pour régénérer les données : `pip install -r sim/requirements.txt` puis `npm run data`. Le résultat est identique à chaque exécution (graine fixe), à l'exception de la date d'entraînement inscrite dans le modèle.

## Données

| Élément | Origine |
|---|---|
| `config/hypotheses.json` | Paramètres et hypothèses (H01–H27), source unique pour Python et TypeScript |
| `data/scenarios/` | 3 scénarios (SC01–SC03) et 6 cas de test (TC01, 02, 03, 08, 09, 10), générés par `sim/generate.py` |
| `data/benchmark/` | 15 situations des jours ouvrés 16–20, non utilisées pour l'entraînement |
| `data/model/depletion_model_v1.json` | Modèle de risque à 3 h (coefficients, métriques, avertissement) ; rapport : `ml/report.md` |
| Profil de demande | Heatmap du Workshop 5 (valeurs illustratives) × 3 |

Aucune donnée réelle de BlueMove, aucune donnée client, aucune géolocalisation d'agent.

## Hypothèses et limites principales

- Recharge par **échange de batterie sur place** (H01) — à confirmer ; la collecte au dépôt changerait le modèle d'optimisation.
- Distances **à vol d'oiseau × 1,3** ; pas d'itinéraire routier, pas de trafic.
- Projection de service simplifiée (consommation moyenne, scooters immobiles).
- Poids de priorité **recalibrés** sur simulation (D-25).
- Le modèle ML ne bat la règle simple que de très peu, même sur simulation (D-27) : il reste un composant conditionnel.
- K3 et K4 ne sont mesurables qu'au pilote ; K6 (coût par transfert) ne s'applique pas à un échange de batterie.

## Déploiement sur Vercel

Le projet est un site statique ; aucune variable d'environnement n'est requise.

1. Créer un dépôt GitHub et y pousser ce dossier (`node_modules/`, `dist/` et `data/generated/` sont ignorés par `.gitignore`).
2. Sur vercel.com : **Add New → Project → Import** le dépôt.
3. Laisser les réglages lus dans `vercel.json` : *Framework* « Other », *Install* `npm install`, *Build* `npm run build`, *Output* `dist`.
4. **Deploy**, puis ouvrir l'URL fournie et vérifier : tableau de bord chargé, « Optimiser la tournée », page « Méthode » → « Lancer » le banc d'essai.

Variante sans GitHub : `npm i -g vercel` puis `vercel` (connexion au compte demandée) et `vercel --prod`.

## Documentation

`docs/` contient la conception (WORKSHOP_9_CONCEPTION, GRILLE_IA_JUSTIFICATIONS, ARCHITECTURE, MVP_SPEC, BLUEMOVE_CONTEXT, DECISIONS) et la mise en œuvre : **IMPLEMENTATION.md**, **TESTS.md**, **DEMO.md**, **BENCHMARK_RESULTS.md**.
