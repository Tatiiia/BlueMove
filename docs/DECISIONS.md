# Journal des décisions — Workshop 9 BlueMove (consigne E)

> Journal des arbitrages métier et techniques : question, options, critères, décision, raison, limites. Les hypothèses (H-xx) sont **réversibles** et **à valider** ; elles ne décrivent pas la réalité de BlueMove. Toute valeur chiffrée utilisée dans les autres livrables renvoie à ce registre.

---

## 1. Registre des hypothèses

| ID | Hypothèse | Valeur par défaut | Fondement | À valider avec |
|---|---|---|---|---|
| **H01** | Mode de recharge : **échange de batterie sur place** ; le scooter n'est pas déplacé | — | Indice documentaire : identifiants distincts scooter / batterie, datation des changements de batterie, contrôle d'association scooter–batterie [R Cadre commun, W2]. Non confirmé. | Responsable exploitation |
| H02 | Les agents de recharge sont rattachés à l'exploitation | — | Rapport W1–8 (cadre commun) | Direction / exploitation |
| H03 | Tournée : départ et retour à un dépôt unique, sans réapprovisionnement en cours de tournée | 1 dépôt | Simplification MVP | Exploitation |
| H04 | Durée d'une tournée | 240 min | Demi-journée de travail, hypothèse | Exploitation |
| H05 | Nombre d'agents par tournée planifiée | 2 (paramètre 1–3) | Hypothèse de simulation | Exploitation |
| H06 | Véhicules (préréglages) | Vélo-cargo : 12 batteries, 15 km/h, 0,05 €/km · Utilitaire électrique : 30 batteries, 18 km/h, 0,20 €/km | Ordres de grandeur de simulation, non sourcés | Exploitation + finance |
| H07 | Temps d'intervention par échange (stationnement, repérage, échange, contrôle) | 6 min | Hypothèse | Mesure terrain au pilote |
| H08 | Distance de trajet = distance à vol d'oiseau × facteur de détour | × 1,3 | Approximation usuelle en milieu urbain, à calibrer | Technique (matrice routière en V2) |
| H09 | Coût horaire chargé d'un agent | 30 €/h | Hypothèse | Finance |
| H10 | Seuil critique / seuil maximal d'éligibilité | 20 % / 40 % | 20 % = seuil de louabilité [R Cadre commun] ; 40 % = hypothèse | Exploitation |
| H11 | Horizon de prévision et de projection | 3 h | Hypothèse : recouvre une tournée de 4 h | Exploitation |
| H12 | Fraîcheur requise pour planifier une intervention | GPS ≤ 10 min, BMS ≤ 30 min | Scooter à l'arrêt : GPS / 60 s, BMS / 5 min [R W3] ; tolérance = 10 et 6 messages manqués | Qualité des données |
| H13 | Poids de la priorité (urgence / demande / rareté) | 0,50 / 0,35 / 0,15 | Hypothèse, réglable dans l'interface | Exploitation |
| H14 | Flotte simulée | 300 scooters, 6 zones, 1 dépôt | Hypothèse de simulation ; aucun chiffre réel disponible | — |
| H15 | Profil de demande par zone et créneau | Heatmap W5 (recherches sur 28 jours ouvrés) | **Valeurs illustratives** du W5, pas des observations | Données réelles du pilote |
| H16 | Consommation simulée par trajet client | 8 % ± 3 % de charge | Hypothèse de simulation | Historique BMS réel |
| H17 | Objectifs terrain du pilote | KR1 ≤ 90 % de la référence ; KR6 ≥ 70 % ; K3 non dégradé | Aligné sur la logique de K6 [R W6] | Direction / exploitation |
| H18 | Validité d'un plan non décidé | 30 min | Les données vieillissent | Exploitation |
| H19 | Cible de scooters louables par zone | Gare 50 · Affaires 45 · Campus 35 · Centre 50 · Résidentiel 35 · Loisirs 25 (total 240 = 80 % de la flotte) | Hypothèse de simulation | Exploitation |
| H20 | Périmètre temporel de la démonstration | Jours ouvrés, 6 h–20 h (départ de tournée) | Seul le profil jours ouvrés 6–23 h est documenté [R W5] | — |
| H21 | Charge d'une batterie de remplacement | 100 % | Simplification | Exploitation |
| H22 | Seuils d'acceptation du modèle ML **sur données réelles** | AUC ≥ 0,75 et précision@k ≥ règle + 10 points | Hypothèse ; aucune référence BlueMove | Data / exploitation |
| H23 | Facteur d'échelle appliqué aux recherches W5 dans la simulation | × 3 | Calibre l'usage simulé à ~3 trajets / scooter / jour, soit l'objectif K5 [R W6] | — |
| H24 | Température batterie au-delà de laquelle on oriente vers la maintenance | 55 °C | Valeur provisoire ; le W3 renvoie au seuil du constructeur | Constructeur / maintenance |
| H25 | Dans la simulation, un scooter reste dans sa zone après un trajet | — | Simplification : les flux entre zones relèvent du repositionnement | — |
| H26 | Météo simulée | 25 % de jours de pluie ; demande × 0,7 | Hypothèse de simulation | — |
| H27 | Second point de départ possible « Point relais Nord » | décalage (−0,2 km E ; +2,2 km N) | Ajout MVP : la consigne demande un point de départ paramétrable (D-22) | Exploitation |

---

## 2. Décisions

### D-01 — Mode de recharge (incertitude structurante)
- **Question** : comment BlueMove recharge-t-elle ses scooters ? Le rapport W1–8 ne le précise pas.
- **Options** :

| Scénario | Ce que fait l'agent | Contrainte de capacité | Lien avec le repositionnement | Cohérence avec le rapport |
|---|---|---|---|---|
| A. Échange de batterie sur place | Remplace la batterie, laisse le scooter | Nombre de batteries chargées transportées | Aucun (activités séparées) | **Forte** : batteries identifiées, changements datés, association contrôlée |
| B. Collecte vers un dépôt | Emporte le scooter, le recharge, le redéploie | Places dans le véhicule ; capacité des zones de dépose [R W4] | Fort : le redéploiement **est** un repositionnement → K6 s'applique | Possible, non documentée |
| C. Recharge sur place par câble ou batterie d'appoint | Branche et attend | Temps d'attente long | Aucun | Non documentée |
| D. Prestataires indépendants | Hors organisation BlueMove | Contractuelle | Variable | Non documentée |

- **Critères** : cohérence avec les décisions antérieures, séparation recharge / repositionnement, faisabilité d'un MVP.
- **Décision** : **Scénario A retenu comme hypothèse de travail (H01)**, présenté comme tel.
- **Pourquoi** : c'est le seul scénario appuyé par des indices du rapport ; il isole la recharge du repositionnement, ce qui évite de transformer le sujet en gestion générale de flotte.
- **Limites** : si BlueMove pratique la collecte (B), le modèle d'optimisation change (capacité en scooters, dépose, couplage avec le repositionnement et K6). L'architecture reste valable ; le module d'optimisation devra être reparamétré (capacité en places, temps de chargement au dépôt, contraintes de dépose).
- **Conséquence** : le MVP modélise des échanges ; le scénario B est noté comme évolution.

### D-02 — Utilisateurs et rattachement
- **Constat** : la consigne parle d'« équipe de maintenance » ; le rapport confie la recharge à l'exploitation et la réparation à la maintenance.
- **Décision** : utilisateur principal = **responsable des opérations (exploitation)** qui planifie et valide ; utilisateurs terrain = **agents de recharge**. La maintenance est une partie prenante secondaire : elle reçoit les signalements (alerte BMS, défaut constaté pendant un échange) mais n'est pas planifiée par l'outil.
- **Pourquoi** : préserve la séparation des activités actée au cadre commun tout en répondant à la consigne.

### D-03 — Périmètre fonctionnel
- **Inclus** : sélection des scooters à recharger, priorisation, construction de tournées sous contraintes, comparaison à une référence, validation humaine, traçabilité.
- **Exclus** : repositionnement, maintenance prédictive des pannes, personnalisation client, réoptimisation en temps réel pendant la tournée, suivi GPS des agents, application mobile terrain, intégration télématique réelle.
- **Pourquoi** : les exclus relèvent d'autres consignes du module (a, b, c) ou d'une phase de production.

### D-04 — Indicateurs : ne pas redéfinir K6
- **Constat** : K6 = coûts ÷ **transferts de scooters confirmés** [R W6]. En scénario A, aucun transfert.
- **Décision** : créer des indicateurs dédiés **KR1 à KR6** (définis dans `MVP_SPEC.md` §9). KR1 (coût par recharge confirmée) reprend la logique de coût de K6 et son objectif relatif (≤ 90 % de la référence, H17), sans l'usurper. Les coûts partagés sont répartis selon le temps consacré à chaque activité, comme le prévoit déjà le W6.
- **K3** reste l'indicateur de résultat pour le client ; **K4** est suivi comme indicateur de garde (interprétation à valider : un scooter < 20 % est-il « apte au service » ?).

### D-05 — Éligibilité à l'intervention distincte de la louabilité
- **Décision** : règles d'éligibilité propres (voir `MVP_SPEC.md` §6), avec seuils de fraîcheur plus tolérants que pour la louabilité (H12) car l'agent vérifie sur place.
- **Distinction** : un **rejet qualité** (donnée invalide : charge à 145 %, doublon, coordonnées impossibles) est séparé d'une **exclusion métier** (donnée valide mais scooter non éligible : loué, réservé, en maintenance, zone inaccessible…).
- **Alerte BMS** (code défaut, température anormale) : le scooter est exclu de la recharge et **orienté vers la maintenance**.

### D-06 — Approche retenue : hybride règles + ML borné + optimisation
- **Options comparées** (détail dans `WORKSHOP_9_CONCEPTION.md` §2.3 et §4) : planification manuelle ; optimisation classique sans IA ; ML seul ; hybride prédiction + optimisation ; LLM / agent.
- **Décision** :
  1. **Règles déterministes** : contrôles qualité, éligibilité, contraintes dures.
  2. **Score de priorité transparent** : urgence + demande de zone + rareté locale.
  3. **Composant ML borné** : estimation de la probabilité qu'un scooter aujourd'hui louable passe sous 20 % dans les 3 h (H11). C'est la **seule partie relevant de l'apprentissage automatique**.
  4. **Optimisation combinatoire** (recherche opérationnelle, **pas de l'IA au sens ML**) : sélection et ordonnancement des interventions sous contraintes de temps et de batteries.
  5. **Validation humaine** obligatoire.
- **Pourquoi** : le gain principal attendu vient de l'optimisation ; le ML n'apporte une valeur que pour les scooters **pas encore critiques**, dont l'épuisement dépend de l'usage. Le W3 recommandait déjà de comparer à une règle simple.
- **Condition** : le composant ML est **désactivable** et n'est conservé que s'il bat la règle « batterie la plus faible d'abord » sur données réelles (H22).

### D-07 — Choix du modèle prédictif
- **Options** : (a) régression logistique ; (b) gradient boosting ; (c) séries temporelles de demande par zone ; (d) réseau de neurones.
- **Décision MVP** : **(a) régression logistique**, entraînée hors ligne en Python, coefficients exportés en JSON.
- **Pourquoi** : explicable (coefficients lisibles), suffisante pour démontrer la chaîne, sans serveur de modèle. (b) est l'évolution naturelle si elle apporte un gain mesuré. (c) est écarté pour le MVP : le profil de demande W5 (moyenne par zone et créneau) suffit à pondérer la valeur d'une recharge ; une prévision fine de demande relève davantage de la consigne a. (d) disproportionné.
- **Limite majeure** : entraîné sur données simulées, le modèle « retrouve » la logique du simulateur. Ses métriques valident le **pipeline**, pas la **capacité prédictive réelle**.

### D-08 — Algorithme d'optimisation
- **Problème formel** : sélection et tournées de véhicules sous contraintes de temps et de capacité, avec gain par visite (famille *Team Orienteering Problem* / VRP à collecte de gains).
- **Options** : (a) heuristique d'insertion gloutonne + amélioration 2-opt, en TypeScript ; (b) solveur open source (Google OR-Tools, VROOM) ; (c) programmation linéaire en nombres entiers exacte.
- **Décision** : **(a) pour le MVP**, **(b) en production**.
- **Pourquoi** : (a) s'exécute dans une fonction Vercel sans dépendance lourde, est déterministe et testable, et donne des solutions admissibles en moins de quelques secondes pour ~300 scooters. (c) est trop lent et inutile à cette échelle. (b) apporte une meilleure qualité de solution et des contraintes riches (fenêtres horaires, multi-dépôts) quand le besoin sera confirmé.
- **Garantie** : le moteur ne renvoie **jamais** de tournée violant une contrainte ; en l'absence de solution, il le dit.

### D-09 — Référence de comparaison et isolement de l'apport du ML
- **Décision** : chaque calcul produit **trois variantes** avec le même modèle de temps et de coût :
  - **REF** — planification de référence : scooters < 20 % uniquement, visités au plus proche voisin (simule une planification manuelle expérimentée) ;
  - **OPT_REGLE** — optimisation + priorité sans ML ;
  - **OPT_ML** — optimisation + priorité avec ML.
- **Pourquoi** : REF → OPT_REGLE mesure l'apport de l'**optimisation** (non-IA) ; OPT_REGLE → OPT_ML mesure l'apport **propre au ML**. On évite d'attribuer à l'IA un gain venant de l'algorithmique classique.

### D-10 — LLM, RAG et agent IA écartés
- **Usages examinés** : expliquer une tournée en langage naturel, interpréter des comptes rendus, piloter l'optimisation par un agent.
- **Décision** : **écartés pour le MVP**.
- **Pourquoi** : les données sont structurées ; les explications se génèrent par gabarit déterministe (« priorité 82 : charge 14 %, zone Gare, 17–20 h, 3 scooters louables pour une cible de 50 ») ; un agent autonome ajouterait un risque d'action non maîtrisée sans gain démontré. Une piste future serait la synthèse des comptes rendus de maintenance, hors périmètre.

### D-11 — Distances et carte
- **Décision MVP** : distance haversine × 1,3 (H08) ; segments droits sur la carte, signalés comme « estimation ». Fond de carte OpenStreetMap via Leaflet, centré sur une ville fictive positionnée par configuration (par défaut Lyon, **choix arbitraire de lisibilité** ; les zones sont des cercles et ne reproduisent aucune géographie réelle).
- **Production** : matrice de temps de parcours issue d'un moteur d'itinéraire (OSRM ou OpenRouteService), éventuellement avec trafic.

### D-12 — Pile technique MVP
- **Décision** : Next.js (TypeScript) déployé sur **Vercel** (fonctions en région UE) ; **Supabase** PostgreSQL en **région UE** [R W2] pour scénarios, plans, décisions et journal ; moteur d'optimisation et calcul du score en TypeScript côté serveur ; modèle ML entraîné hors ligne en Python, exporté en JSON versionné.
- **Écarté** : serveur de modèle Python, file de messages IoT, entrepôt de données dédié, Power BI — inutiles pour le MVP, prévus en production (W2, W6).
- **Repli** : un mode démonstration lit les scénarios depuis des fichiers JSON si Supabase n'est pas configuré (décisions non persistées, signalé à l'écran).

### D-13 — Validation humaine et cycle de vie d'un plan
- **Décision** : un plan est **proposé** ; seul le responsable des opérations peut l'**approuver** ou le **rejeter** (motif obligatoire). Un plan non décidé **expire** après 30 min (H18). L'application n'envoie aucune commande aux scooters et ne déclenche aucune intervention.
- **Pourquoi** : règle de gouvernance W3/W8 ; responsabilité de la décision.

### D-14 — Données simulées
- **Décision** : générateur Python à graine fixe ; chaque table et chaque écran porte la mention **« DONNÉES SIMULÉES »** ; colonne `data_origin = 'SIMULATION'`. Aucune donnée réelle n'est mélangée.
- **Contenu** : historique de 28 jours (cohérent avec la fenêtre du pilote) pour entraîner le modèle ; scénarios instantanés (« mardi 16 h 30 ») pour l'application, dont des scénarios de test avec anomalies.

### D-15 — Données des agents
- **Décision MVP** : aucune géolocalisation des agents ; une tournée est attribuée à un « agent 1, 2, 3 » sans identité.
- **Production** : la géolocalisation des salariés est encadrée (information préalable, finalité limitée à l'organisation des tournées, pas d'évaluation individuelle de performance par la trace GPS, durée de conservation limitée). À valider par le référent données personnelles avant tout déploiement.

### D-16 — Décision Go
- **Résultat de la grille** : **153 / 220** → « IA potentiellement utile, à confirmer » (détail dans `GRILLE_IA_JUSTIFICATIONS.md`).
- **Décision** : **Go sous conditions**. Le projet se justifie surtout comme outil d'aide à la décision fondé sur l'optimisation ; le ML est un complément conditionnel.

---

## 3. Contradictions et écarts relevés entre sources

| # | Écart | Sources | Traitement |
|---|---|---|---|
| E1 | Recharge attribuée à « l'équipe de maintenance » (consigne) vs à l'exploitation (rapport) | M9 p.20 ; R Cadre commun | D-02 |
| E2 | K6 défini par transfert de scooter, inapplicable à un échange de batterie | R W6 | D-04, KR1–KR6 |
| E3 | K4 : un scooter à batterie faible est-il « apte au service » ? Non tranché | R Cadre commun, W6 | Suivi de garde ; point à valider |
| E4 | Libellés de la grille différents entre la diapositive du cours (p.18, ancienne version) et le classeur 2026 | M9 p.18 ; Grille | Le classeur fait foi (hiérarchie des sources) |
| E5 | Le W1 prévoit trafic et travaux pour adapter les tournées ; aucune source de données n'est définie | R W1 | Zones « inaccessibles » paramétrables dans le MVP ; trafic en production |
| E6 | La heatmap W5 couvre les jours ouvrés 6–23 h uniquement | R W5 | Démonstration limitée aux jours ouvrés (H20) |

---

## 4. Points restant à valider (ordre de criticité)

1. **Mode de recharge réel** (H01) — conditionne le modèle d'optimisation. *Bloquant pour la production, pas pour le MVP.*
2. **Historique BMS exploitable** : au moins 28 jours de mesures horodatées, associées scooter–batterie, pour entraîner et tester le modèle sur données réelles. *Bloquant pour activer le ML.*
3. **Paramètres terrain** : capacité des véhicules, temps d'intervention, vitesse, coût horaire (H06, H07, H09).
4. **Encadrement de la géolocalisation des agents** (D-15).
5. **Interprétation de K4** pour un scooter à faible charge (E3).
6. **Objectif KR1** et seuil d'acceptation des recommandations (H17).
7. **Protection contre les mesures BMS falsifiées** (risque critique W7) avant tout usage opérationnel.


---

## 5. Décisions de mise en œuvre du MVP (ajoutées pendant le développement)

> Écarts au cahier des charges `MVP_SPEC.md`, chacun justifié. Les arbitrages de conception (D-01 à D-16) sont conservés.

### D-17 — Application statique React + esbuild au lieu de Next.js
- **Constat** : l'environnement de développement n'avait aucun accès au registre npm. Next.js, Tailwind et Leaflet ne pouvaient être ni installés ni compilés, donc ni testés.
- **Décision** : application monopage React 19 + TypeScript, compilée par esbuild en fichiers statiques (`dist/`), déployable sur Vercel sans adaptation (`vercel.json`). Styles en CSS natif (variables de thème BlueMove).
- **Pourquoi** : livrer un outil **effectivement compilé et testé** (build, tests, parcours navigateur) plutôt qu'un code Next.js non vérifiable. Le moteur (`src/engine`) est indépendant du cadre : une migration vers Next.js consiste à déplacer les composants dans `app/` et, si souhaité, le calcul dans une route API.
- **Limite** : pas de rendu serveur ni de route API.

### D-18 — Pas de Supabase ni d'authentification dans le MVP
- **Décision** : le journal des décisions est conservé dans le stockage local du navigateur ; aucun compte, aucun rôle.
- **Pourquoi** : données entièrement simulées, aucune donnée personnelle ; la consigne de développement déconseille une authentification sans valeur pour ce MVP. Le schéma PostgreSQL et les règles de sécurité par ligne restent spécifiés (`MVP_SPEC.md` §5.2) pour le pilote.
- **Conséquence** : AC-18 (rôle) et AC-22 (agent en lecture seule) ne sont pas implémentés ; AC-19 (motif obligatoire) et AC-20 (expiration) le sont côté interface.

### D-19 — Calcul exécuté dans le navigateur
- **Décision** : le moteur s'exécute côté client (40 à 120 ms par calcul sur les scénarios de démonstration).
- **Pourquoi** : aucun serveur à maintenir, résultat identique (moteur déterministe), démonstration possible hors connexion une fois la page chargée. L'empreinte SHA-256 des entrées assure la traçabilité.

### D-20 — Plan schématique SVG au lieu d'un fond OpenStreetMap
- **Décision** : carte vectorielle en coordonnées locales (km), zones, dépôts, scooters et tournées, échelle 1 km.
- **Pourquoi** : aucune dépendance à un service de tuiles ; BlueMove et sa ville sont fictives, un fond réel suggérerait une géographie inexistante (cf. D-11). Les tracés sont des segments à vol d'oiseau, signalés comme estimations.

### D-21 — SC01 placé à 06 h 30
- **Constat** : la politique d'échange simulée de l'historique passe à 07 h 00 et 14 h 00 ; à 07 h 30, la tournée du matin vient d'avoir lieu.
- **Décision** : SC01 = 06 h 30, « prise de poste du matin », pour représenter la décision que l'outil doit éclairer.

### D-22 — Point de départ paramétrable (H27)
- La consigne de développement demande un point de départ modifiable. Un second point (« Point relais Nord ») est ajouté comme hypothèse ; le retour se fait au point de départ choisi.

### D-23 — Plusieurs mesures pour un même scooter
- **Décision** : après suppression des doublons de message, le moteur retient la mesure **valide** la plus récente ; une mesure invalide ne remplace jamais un état validé (règle W8). Les mesures écartées sont comptées (« REMPLACE »).

### D-24 — Scooter orienté maintenance non louable
- Par prudence, un scooter présentant une alerte BMS n'est pas compté comme louable dans la rareté de zone, même s'il est libre.

### D-25 — Recalibrage des poids de priorité (modification de H13)
- **Constat (tests du moteur)** : avec les poids de conception 0,50 / 0,35 / 0,15, la variante optimisée privilégiait des zones très demandées **mais déjà au niveau de leur cible**, au détriment de critiques situés dans des zones en déficit. Sur la projection de service, la référence faisait mieux dans 2 scénarios de démonstration sur 3.
- **Protocole** : grille de 15 combinaisons de poids (urgence 0,4–0,7 ; demande 0,05–0,35 ; rareté = complément), **calibration** sur 6 instants des jours ouvrés 16–17, **évaluation** sur 9 instants des jours 18–20 (jamais utilisés pour choisir). Critère : déficit projeté pondéré, puis coût par recharge. La formule elle-même est inchangée.
- **Décision** : poids par défaut **0,50 / 0,10 / 0,40**. Les poids initiaux restent accessibles dans l'interface (« Poids de la conception initiale ») pour la comparaison.
- **Résultat sur l'évaluation (vélo-cargo ×2, 9 instants)** : coût par recharge 5,71 € (optimisée) et 5,48 € (+ ML) contre 6,11 € (référence) ; tous les critiques servis ; déficit projeté 1,6 contre 2,7 (détail : `BENCHMARK_RESULTS.md`).
- **Limite** : calibrage sur simulation ; à refaire sur données réelles du pilote.

### D-26 — Banc d'essai de 15 instants
- **Décision** : le générateur exporte 15 instants (06 h 30, 11 h 30, 16 h 30 des jours ouvrés 16 à 20) ; l'application les recalcule à la demande (page « Méthode ») et `npm run benchmark` produit le tableau de référence.
- **Pourquoi** : éviter de juger la méthode sur un seul scénario choisi pour la démonstration.

### D-27 — Constat sur le composant ML
- Sur la période de test simulée, le modèle dépasse à peine la règle « batteries les plus faibles d'abord » (précision@10 : 0,313 contre 0,305 ; AUC 0,767 contre 0,743). Il **n'atteindrait pas** le seuil d'activation H22 (+10 points). Le composant reste dans le MVP pour démontrer la chaîne complète et la comparaison ; la conclusion « ML conditionnel » de la grille (153/220) en sort renforcée.
