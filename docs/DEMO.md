# Démonstration orale — 3 à 5 minutes

> Situation par défaut : **SC02 · Mardi 16 h 30, avant la pointe du soir**. Paramètres par défaut (2 agents, vélos-cargos, 12 batteries chacun, 4 h). Avant de commencer : ouvrir l'application, onglet **Décisions** → « Effacer le journal » si une répétition a laissé des traces.

## Déroulé

| Temps | Action à l'écran | Ce qu'il faut dire |
|---|---|---|
| 0:00 | Tableau de bord, badge « Données de démonstration » | « BlueMove est fictive ; tout est simulé. L'outil aide le responsable des opérations à décider quelles batteries échanger, dans quel ordre, par quel agent. Hypothèse : échange de batterie sur place (H01), à confirmer. » |
| 0:20 | Les 6 indicateurs | « 300 scooters suivis, 272 louables. 77 nécessitent une intervention, dont 12 critiques sous 20 % : ils ne sont déjà plus louables. 16 sont exclus : loués, réservés, données trop anciennes… Un scooter à recharger n'est pas forcément louable, et inversement. » |
| 0:45 | Survoler puis cliquer un point rouge sur le plan | « Pour chaque scooter : identifiant, position, batterie, statut, fraîcheur GPS et BMS, priorité. Le plan est schématique ; les distances sont estimées à vol d'oiseau. » |
| 1:05 | Onglet **Contrôles qualité** | « Règles déterministes issues des workshops 2 et 8 : rejets de données invalides, exclusions métier. Une alerte batterie part en maintenance, pas en recharge. » |
| 1:20 | Onglet **Priorités**, montrer la barre de composantes et la justification | « La priorité est une formule lisible : urgence, demande de la zone, rareté locale. Pour les préventifs, le modèle ML estime le risque de passer sous 20 % en 3 heures. C'est la seule brique d'apprentissage. » |
| 1:40 | Glisser le **seuil d'intervention** de 40 à 30 %, puis revenir | « Les paramètres filtrent réellement : 77 → 46 candidats. » |
| 1:55 | **Optimiser la tournée** | « Trois variantes sur les mêmes données : référence sans IA, optimisation sans IA, optimisation avec ML. » |
| 2:10 | Carte et **Ordre des arrêts** | « Chaque agent a sa tournée numérotée, ses heures estimées, la raison de chaque arrêt. Durée et nombre de batteries sont garantis par l'algorithme. » |
| 2:35 | Tableau **Comparaison à la référence** | « La référence traite les 12 critiques à 8,01 € par recharge. L'optimisation utilise toute la capacité, 24 échanges, à 5,82 € : c'est l'apport de l'optimisation, −27 %, sans IA. Le ML ajoute −4 %, à 5,57 €. On distingue ce qui vient de l'algorithme classique et ce qui vient de l'IA. » |
| 3:05 | Onglet variante **Référence**, puis revenir | « La carte montre les différences d'itinéraire. » |
| 3:15 | **Rejeter** sans motif (message), puis **Approuver** | « L'outil recommande, l'opérateur décide. Un rejet exige un motif ; la recommandation expire après 30 minutes. Rien n'est envoyé aux scooters. » |
| 3:35 | Onglet **Décisions** | « Chaque décision garde l'empreinte des données, les versions du moteur et du modèle : c'est la traçabilité du cadre commun. KR6, le taux d'acceptation, se calcule ici. » |
| 3:50 | Situation **SC03 · pluie** → Optimiser | « Ici, la référence est recommandée : la règle de choix ne favorise pas l'IA par principe. » |
| 4:10 | **Méthode** → Lancer le banc d'essai | « Sur 9 situations non vues : 5,48 € par recharge avec ML, 5,71 € sans, 6,11 € pour la référence. Le modèle lui-même ne bat la règle simple que de 0,8 point de précision : il n'atteindrait pas notre seuil d'activation. D'où notre décision : Go sous conditions, ML conditionnel. » |

## Résultats à expliquer

- **Apport de l'optimisation** (SC02) : coût par recharge −27 %, km par recharge −44 %, scooters projetés sous 20 % : 12 → 7.
- **Apport du ML** (SC02) : −4 % sur le coût par recharge ; faible et dépendant du scénario.
- **SC03** : la référence gagne, ce qui montre l'honnêteté de la comparaison.
- **Recalibrage** : avec les poids initiaux, l'optimisation privilégiait des zones demandées déjà bien servies ; nous avons recalibré sur des jours dédiés et évalué sur d'autres (D-25).

## Choix d'architecture à défendre

1. **Optimisation au cœur, ML en appui** : cohérent avec la grille (153/220, « potentiellement utile »).
2. **Comparaison systématique à une référence** sur les mêmes données et hypothèses.
3. **Pas de LLM ni d'agent** : données structurées, explications générées par gabarit, aucune action autonome.
4. **Validation humaine et traçabilité** : approbation, motif de rejet, expiration, empreinte SHA-256.
5. **Site statique** : moteur déterministe en TypeScript, aucun serveur ni clé d'API, déploiement Vercel immédiat.

## Limites à mentionner

- Données simulées ; gains réels à mesurer lors d'un pilote comparatif sur jours et zones comparables.
- Mode de recharge à confirmer (échange ou collecte).
- Distances à vol d'oiseau, pas de trafic.
- Modèle entraîné sur simulation : ses métriques ne prouvent rien sur le terrain.
- Pas d'authentification ni de base de données dans ce MVP (prévues pour le pilote).

## Questions probables

- *« Où est l'IA ? »* — Dans le risque d'épuisement à 3 h ; l'itinéraire relève de la recherche opérationnelle. Nous les séparons volontairement.
- *« Pourquoi garder le ML s'il apporte peu ? »* — Pour démontrer la chaîne et mesurer son apport ; il est désactivable et ne serait activé en production qu'au-delà du seuil H22.
- *« Les 27 % sont-ils réels ? »* — Non : écart calculé sur un scénario simulé, avec des hypothèses de coût et de vitesse. Seul le pilote mesurera un gain.
