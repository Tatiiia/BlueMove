# BlueMove — Contexte de référence pour le Workshop 9

> **Usage de ce fichier.** Contexte condensé des workshops 1 à 8 (rapport du Groupe 3, 29/10/2026) et des consignes du module 9. Il sert de référence pendant la conception et le développement du MVP. Toute règle ci-dessous provient d'une source citée entre crochets ; les éléments propres au Workshop 9 sont signalés **[W9]** et renvoient au registre d'hypothèses de `DECISIONS.md`.
>
> Sources : **[R§]** = rapport Groupe 3, section indiquée ; **[M9 p.x]** = support du module 9 ; **[Grille]** = classeur « AI Evaluation Grid 2026 ».

---

## 1. L'entreprise et ses activités

BlueMove est une entreprise **fictive** de location de scooters électriques en libre-service via une application mobile. Son enjeu : proposer un scooter disponible au bon endroit, avec assez de batterie, et limiter les pannes. [R intro]

**Parcours client** : rechercher → réserver → utiliser → restituer. [R Cadre commun]

**Répartition des rôles déjà actée** [R Cadre commun] :

| Équipe | Responsabilité documentée |
|---|---|
| Exploitation | Organise la recharge et déplace les véhicules si nécessaire |
| Maintenance | Répare les pannes et valide le retour en service |

> ⚠️ **Écart à signaler [W9]** : la consigne E parle de « l'équipe de maintenance » pour la recharge, alors que notre rapport confie la recharge à l'exploitation. Nous désignons les utilisateurs terrain comme **« agents de recharge »**, rattachés à l'exploitation, sans contredire la consigne (voir D-02 dans `DECISIONS.md`).

### Cinq activités à ne jamais confondre [W9]

| Activité | Définition | Dans le périmètre du MVP ? |
|---|---|---|
| **Rechargement** | Rendre de l'énergie à un scooter (ici : échange de batterie sur place, hypothèse H01) | **Oui — cœur du sujet** |
| Réparation / maintenance | Traiter une panne ou une alerte technique et valider le retour en service | Non. Une alerte BMS détectée devient un signalement à la maintenance |
| Repositionnement | Déplacer un scooter vers une zone plus demandée [R W4] | Non |
| Déplacements des agents | Trajets effectués par les agents pour intervenir | Oui (calculés pour la tournée), **jamais comptés comme trajets clients** [R Cadre commun] |
| Trajets des clients | Locations réalisées par les clients | Non utilisés individuellement ; seule la demande agrégée par zone et horaire sert |

---

## 2. Définitions communes à respecter

### Scooter louable [R Cadre commun]
Un scooter est louable s'il est simultanément :
- libre, non réservé, hors maintenance ;
- dans une zone autorisée ;
- avec une position reçue depuis **moins de 2 min** ;
- avec une mesure batterie reçue depuis **moins de 10 min** ;
- avec **au moins 20 %** de charge au départ.

Le serveur confirme la réservation et empêche deux locations simultanées.

### Éligibilité à une intervention de recharge [W9 — définition nouvelle]
**Un scooter à recharger n'est pas nécessairement louable, et inversement.** L'éligibilité est définie séparément (voir `MVP_SPEC.md` §6) : statut actif hors maintenance, ni loué ni réservé, zone autorisée et accessible, association scooter–batterie valide, données fraîches (GPS ≤ 10 min, BMS ≤ 30 min — H12), charge < 40 % (H10), absence d'alerte BMS.

### Autres définitions [R Cadre commun]
- **Disponibilité technique** : en état de fonctionner, même pendant un trajet. Un scooter peut être apte au service et déjà loué.
- **Recherche d'un client** : comptée une seule fois, avec l'offre présentée à cet instant ; rayon testé 300 m.
- **Recherche « sans offre »** : aucun scooter louable dans le rayon défini. [R W5]
- **Identifiants** : un identifiant par scooter, batterie, location, intervention et zone. **Dater les changements de batterie et de zone.**
- **Horodatage** : stockage en UTC, affichage en heure locale.
- **Doubles comptes** : un trajet compté une seule fois même s'il génère plusieurs positions ; déplacements des agents distincts des trajets clients.

### Pilote [R Cadre commun]
- Test à petite échelle avant déploiement. Fréquences, durées de conservation et objectifs chiffrés sont **des propositions à valider**.
- Fenêtre d'analyse : **28 jours**. Heatmap W5 : jours ouvrés, 6 h–23 h.
- « Une cible indique le résultat souhaité ; elle ne décrit pas un résultat déjà obtenu. »
- **Traçabilité** : chaque recommandation conserve ses données, la version du calcul, la décision et le résultat.

---

## 3. Données (W1, W3)

### Données utiles [R W1]
| Famille | Données | Source | Usage déjà identifié |
|---|---|---|---|
| Scooters | Position, charge, état | GPS, BMS, serveur (état de location) | Afficher les louables et **organiser la recharge** |
| Scooters | Distance, chocs, pannes | Compteur, capteurs, diagnostic, compte rendu technicien | Entretien, incidents |
| Clients | Fréquence, horaires, zones | Historique des locations, recherches, réservations | Heures de pointe, recherches sans scooter |
| Contexte | Météo, trafic, travaux | Services externes / API | **Adapter les tournées** |
| Contexte | Chaussée, événements, stationnement | Signalements, calendriers, cartes des zones et capacités | Difficultés d'accès, contraintes de stationnement |

**Priorité de collecte** : position, batterie, état de location, incidents, puis recherches sans offre et contexte. [R W1]

### Fréquences proposées pour le test [R W3]
| Équipement | En trajet | À l'arrêt | Décision aidée |
|---|---|---|---|
| GPS | toutes les 10 s | toutes les 60 s | Localiser, vérifier la zone |
| BMS (charge, tension, courant, température) | toutes les 30 s | toutes les 5 min ; immédiat sur alerte | **Choisir les scooters à recharger**, suivre chaque batterie |
| Température moteur/contrôleur | résumé / 30 s | — | Surchauffe |
| Compteur et diagnostic | sur événement | — | Entretien, panne |

### Décision déjà esquissée au W3 (fondement direct du W9)
> « **Prioriser la recharge** : combiner la charge, la position et l'activité attendue pour proposer une tournée. **Comparer d'abord le résultat à une règle simple**, par exemple traiter les batteries faibles. » [R W3]

> « Un simple seuil d'alerte reste une règle, pas une prédiction apprise. » [R W3]

---

## 4. Architecture et gestion des données (W2)

- Plateforme **principalement cloud**. [R W2]
- **Base opérationnelle** (service immédiat) / **lac de données** (historiques, formats variés) / **entrepôt** (données vérifiées pour analyses et indicateurs).
- Quatre étapes : Collecter → Transmettre (chiffré, identité par boîtier, tampon local si coupure, heure de mesure + heure de réception) → Vérifier (doublons, unités, liens scooter–batterie–location, rejets avec motif) → Mettre à disposition (**Raw / Trusted / Service**).
- « **Seules les données acceptées modifient l'état courant du scooter.** » « Une donnée rejetée ne remplace pas le dernier état validé. » [R W2, W8]
- Une mesure en retard complète l'historique sans remplacer un état plus récent. [R W2]
- Outil possible : **Supabase** (PostgreSQL, connexion des utilisateurs, stockage privé), **région UE**, sauvegardes séparées. [R W2]

### Contrôles qualité explicites [R W2, W8]
- Champs obligatoires, **charge entre 0 et 100 %** (exemple W8 : une batterie annoncée à 145 % est rejetée), dates, position, association scooter–batterie.
- Ne pas supprimer une valeur seulement parce qu'elle est inhabituelle.
- Correction à la source, relance sans doublon, vérification.

### Conservation proposée [R W2]
| Donnée | Durée |
|---|---|
| Positions détaillées | 30 jours |
| Résumés de mobilité | 13 mois |
| Mesures techniques résumées et interventions | 24 mois |

---

## 5. Analyse et visualisation (W4, W5)

- Comparer trajets, recherches et véhicules réellement louables ; **les trajets ne montrent qu'une partie de la demande**. [R W4]
- Tableau zone × date × tranche horaire : départs, arrivées, recherches, scooters louables. [R W4]
- DBSCAN (200 m, 20 points) : outil de diagnostic, ne remplace pas les zones autorisées et ne prédit pas la demande. [R W4]
- Avant/après ne suffit pas à prouver la causalité : comparer des jours et secteurs similaires. [R W4]
- Arbitrage W4 : « Des scooters présents mais peu utilisés → vérifier batterie, panne… **Recharger ou réparer si nécessaire avant de déplacer.** »

### Heatmap W5 — % de recherches sans offre (n = recherches), jours ouvrés, fenêtre 28 jours
> **Valeurs illustratives** construites pour le W5, pas des observations. Réutilisées dans la simulation W9 comme profil de demande (H15).

| Zone | 6–9 h | 9–12 h | 12–14 h | 14–17 h | 17–20 h | 20–23 h |
|---|---|---|---|---|---|---|
| Gare | 45 % (400) | 20 % (240) | 15 % (200) | 20 % (220) | 35 % (420) | 15 % (180) |
| Quartier d'affaires | 15 % (300) | 10 % (200) | 20 % (180) | 15 % (240) | 40 % (360) | 10 % (100) |
| Campus | 30 % (200) | 15 % (180) | 25 % (240) | 10 % (160) | 20 % (220) | 5 % (80) |
| Centre-ville | 10 % (180) | 15 % (260) | 20 % (320) | 15 % (300) | 25 % (400) | 20 % (240) |
| Résidentiel | 35 % (240) | 15 % (160) | 10 % (120) | 10 % (160) | 20 % (280) | 10 % (120) |
| Loisirs | 5 % (80) | 5 % (100) | 10 % (160) | 15 % (180) | 30 % (260) | 45 % (300) |

Règles d'affichage : « ND » en gris si calcul impossible ou moins de 30 recherches ; couleurs constantes. [R W5]

---

## 6. Indicateurs (W6)

| ID | Indicateur | Calcul | Objectif proposé |
|---|---|---|---|
| **K3** | Accès au service | 100 × recherches trouvant ≥ 1 scooter louable ÷ recherches analysables | **≥ 90 %** |
| **K4** | Disponibilité technique | 100 × minutes aptes au service ÷ minutes de présence dans la flotte active | **≥ 95 %** |
| K5 | Utilisation | trajets clients terminés ÷ scooters-jours actifs (exclut mouvements d'agents) | ≥ 3 / scooter / jour |
| **K6** | Coût d'un déplacement de scooter | (coûts agents + véhicule + énergie) ÷ **transferts de scooters confirmés** | **≤ 90 % du coût de référence**, sans dégrader l'accès au service |
| K7 | Délai de remise en service | délai couvrant 90 % des incidents standards | ≤ 24 h |
| K8 | Recherches utilisables | 100 × recherches valides ÷ recherches reçues (sans doublons) | ≥ 98 % |
| K11 | Risques critiques sans plan complet | nombre | 0 |

Règles de calcul [R W6] :
- K6 : « **Séparer recharge, maintenance et repositionnement.** Répartir les coûts partagés selon le temps consacré à chaque activité. »
- Taux globaux : additionner numérateurs et dénominateurs, **ne pas moyenner des pourcentages**. Dénominateur nul → « ND ».
- Les objectifs sont **des cibles proposées pour le pilote, pas des performances observées**.

> **Conséquence [W9]** : en scénario d'échange de batterie sur place, il n'y a **aucun transfert de scooter**. K6 n'est donc pas applicable aux tournées de recharge et **n'est pas redéfini**. Nous créons des indicateurs dédiés KR1–KR6 (voir `MVP_SPEC.md` §9).
>
> **Point d'interprétation à valider** : K4 mesure l'aptitude technique ; un scooter à 12 % de charge est-il « apte au service » ? Le rapport ne tranche pas. L'effet direct de la recharge porte sur la **louabilité** (seuil 20 %), donc sur **K3**. Nous suivons K4 comme indicateur de garde, sans lui attribuer le gain.

---

## 7. Sécurité, RGPD et gouvernance (W2, W7, W8)

- **Minimisation** : ne collecter que l'utile ; séparer identité et analyses ; la pseudonymisation ne vaut pas anonymat. [R W2, W7]
- **Positions et trajets** : risque critique (2×3=6) — restreindre les historiques individuels, utiliser des résumés par zone. [R W7]
- **Capteurs et commandes** : risque critique — « un faux boîtier envoie une batterie erronée » ; identité par boîtier, échanges chiffrés. [R W7] → impact direct sur les priorités de recharge.
- **Droits par métier** : exploitation = flotte ; maintenance = équipements ; analystes = données résumées. Double authentification des comptes d'équipe. [R W2, W7]
- Supabase : connexion et **droits par ligne** ; journal des accès. [R W8]
- Score de risque = probabilité × gravité (1–2 modéré, 3–4 élevé, 6–9 critique). [R W7]
- **Validation d'un nouvel usage** : le métier décrit le bénéfice ; qualité, sécurité et vie privée vérifient ; le pilote arbitre ; la direction autorise. Fiche de décision. [R W8]
- W3 : « Les techniciens vérifient les alertes pendant le pilote **avant toute automatisation**. » Un score de risque déclenche un contrôle, jamais une action automatique.
- **Règle W9** : aucune intervention n'est exécutée sans validation de l'opérateur.

### Rôles de gouvernance [R W8]
Direction / pilote des données · Responsable métier (exploitation pour l'offre) · Responsable qualité des données · Équipe technique et analyste · Référent sécurité · Protection des personnes (référent, DPO éventuel).

**Transmis au W9** : « des données autorisées et vérifiées, un responsable métier et des conditions de lancement pour chaque futur usage d'intelligence artificielle. » [R W8]

---

## 8. Exigences du module 9

**Six étapes obligatoires** [M9 p.16, p.20] :
1. Définir le problème métier : utilisateurs, objectifs, résultats attendus (+ alternatives sans IA, indicateurs de succès, contraintes).
2. Évaluer la pertinence de l'IA avec la grille 2026 et envisager une solution sans IA.
3. Analyser les données : sources, disponibilité, qualité, contraintes (droits, confidentialité, fraîcheur).
4. Choisir l'approche (sans IA, ML/DL, LLM, RAG, agent ou combinaison), justifiée ; privilégier les modèles existants.
5. Concevoir l'architecture : composants, flux, actions métier ; contrôles d'accès, supervision, coûts.
6. Définir le prototype et son évaluation : tests, indicateurs de réussite, risques.

**Livrables** : proposition synthétique avec grille complétée, schéma d'architecture simplifié, plan de prototype avec critères de succès. Défi facultatif : démonstration (Claude Code, GitHub, Supabase, Vercel). [M9 p.20]

**Grille** [Grille ; M9 p.18-19] : 18 critères, pondérations totales 44, maximum 220. < 100 : IA peu nécessaire ; 100–159 : potentiellement utile, à confirmer ; 160–220 : fortement recommandée. **Aide à la décision, pas validation automatique.** Un score élevé = situation favorable, y compris pour coûts et risques. Un risque juridique ou critique ne se compense pas par le total. La grille est **réajustable** si les étapes 3 à 6 apportent des informations nouvelles. [M9 p.16]

**Exemple du cours directement pertinent** : « UPS pour optimisation logistique : algorithmes combinés à du machine learning pour ajuster les itinéraires. » [M9 p.16] Le cours distingue optimisation (recherche opérationnelle) et ML pour anticiper les besoins. [M9 p.7]
