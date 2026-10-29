# Grille d'évaluation IA 2026 — Justifications

**Projet** : BlueMove — consigne E, « Optimiser les trajets de rechargement pour l'équipe de maintenance »
**Groupe 3 — Workshop 9, étape 2**
**Classeur complété** : `GRILLE_IA_2026_BlueMove_Groupe3.xlsx` (notes saisies dans la colonne G de l'onglet officiel « Grille IA » ; structure, pondérations et formules inchangées ; un onglet « Justifications Groupe 3 » a été ajouté à côté).

---

## 1. Ce que nous évaluons

La grille évalue la pertinence d'une **solution d'aide à la planification des tournées de recharge**, composée de :
- règles d'éligibilité et de qualité des données (non-IA) ;
- un **modèle de ML** estimant le risque qu'un scooter encore louable passe sous 20 % de charge dans les 3 heures ;
- un **moteur d'optimisation combinatoire** construisant les tournées (recherche opérationnelle, non-IA au sens apprentissage) ;
- une validation humaine.

**Question préalable du guide de notation** : *une solution sans IA répondrait-elle au besoin plus simplement, avec une qualité et un coût comparables ?* Réponse : **en grande partie, oui**. Une optimisation classique fondée sur des règles capte probablement l'essentiel du gain. C'est pourquoi les notes de nécessité (05 à 09) restent moyennes. Nous n'avons pas cherché à gonfler le score.

Convention de lecture : **une note élevée signifie toujours une situation favorable**, y compris pour les coûts et les risques (guide de notation 2026).

---

## 2. Notes, pondérations et justifications

| ID | Critère principal | Sous-critère | Note | Pond. | Score pondéré | Justification BlueMove | Hypothèses / incertitudes |
|---|---|---|---|---|---|---|---|
| 01 | Accessibilité et Qualité des Données | Disponibilité légale, éthique et confidentialité | **4** | 2 | 8 | Les données utiles sont opérationnelles (position et charge des scooters stationnés, état de location, demande agrégée par zone et créneau). Aucune donnée client individuelle n'est nécessaire. Pas de LLM, donc pas de confidentialité des prompts. Hébergement UE déjà retenu (W2). | La position d'un scooter juste après une location peut révéler la destination d'un client : on n'utilise que l'état courant des scooters libres, sans historique de trajets. La géolocalisation future des agents est encadrée (salariés). |
| 02 | Accessibilité et Qualité des Données | Accès aux données et systèmes | **3** | 2 | 6 | GPS, BMS et état de location sont prévus (W1, W3) et Supabase est envisagé (W2), mais BlueMove est fictive : ces flux ne sont pas encore opérationnels. Le temps de trajet réel exige une matrice routière externe ; le MVP utilise une approximation. | Disponibilité réelle de l'API télématique et de l'historique BMS à confirmer. L'outil n'a qu'un accès en lecture ; il n'agit sur aucun système. |
| 03 | Accessibilité et Qualité des Données | Coût d'accès aux données et connaissances | **4** | 2 | 8 | Les données sont déjà collectées pour le service de location : leur coût marginal est faible. Le profil de demande est un sous-produit des analyses W4-W5. Aucune licence de données, ni indexation, ni embeddings. | Coût d'une matrice de temps de parcours en production (service tiers ou moteur auto-hébergé) à chiffrer. |
| 04 | Accessibilité et Qualité des Données | Qualité et exploitabilité des informations | **3** | 3 | 9 | Règles de qualité et de fraîcheur déjà définies (W2, W8) : rejets avec motif, seuils 2 min / 10 min, batterie entre 0 et 100 %. En revanche, aucun historique réel n'existe, la position GPS est imprécise et la demande observée est censurée (recherches sans offre). | 28 jours d'historique est un minimum pour un modèle de risque ; la qualité de l'association scooter-batterie conditionne tout le calcul. Risque W7 : mesure batterie falsifiée. |
| 05 | Complexité du Problème | Analyse de situations complexes | **3** | 2 | 6 | Choisir et ordonner des dizaines d'interventions sous contraintes de temps et de batteries dépasse ce qu'une règle simple ou une planification manuelle traite bien. Mais cette difficulté est combinatoire : elle relève de l'optimisation (recherche opérationnelle), pas de la reconnaissance de motifs par l'IA. | La note reflète une complexité réelle mais majoritairement non-IA. Une règle « batteries faibles au plus proche » capte une partie du bénéfice. |
| 06 | Complexité du Problème | Prédiction, personnalisation ou génération | **3** | 2 | 6 | Une prédiction à court terme est utile pour un seul point : repérer les scooters encore louables qui passeront sous 20 % dans les 3 h, selon leur usage et la demande de leur zone. Pas de personnalisation ni de génération de contenu. | La valeur ajoutée par rapport à un tri par niveau de charge reste à démontrer sur données réelles (seuils H22). |
| 07 | Variabilité et Hétérogénéité des Données | Diversité des formats | **2** | 2 | 4 | Données structurées et séries de capteurs déjà résumées (charge, position, statut). Aucun besoin d'analyse d'images, de texte, de son ou de vidéo. | Les comptes rendus des agents (texte libre) ne sont pas exploités dans ce périmètre. |
| 08 | Automatisation Avancée | Automatisation de tâches complexes | **3** | 3 | 9 | La préparation des tournées est quotidienne et répétitive ; l'outil peut automatiser la sélection, la priorisation et l'ordonnancement. Le jugement final reste humain par choix de gouvernance : il s'agit d'une assistance, pas d'une exécution automatique. | Volume modéré (quelques tournées par jour à l'échelle du pilote). Réoptimisation en temps réel hors MVP. |
| 09 | Bénéfices Potentiels | Qualité des résultats | **3** | 3 | 9 | L'outil peut améliorer la qualité du plan : moins de kilomètres par recharge, meilleure couverture des scooters critiques dans les zones demandées. L'essentiel de ce gain vient toutefois de l'optimisation ; l'apport propre du ML est incertain. | Mesuré par ablation : REF -> OPT_REGLE (apport de l'optimisation) puis OPT_REGLE -> OPT_ML (apport du ML). |
| 10 | Bénéfices Potentiels | Gains opérationnels mesurables | **4** | 3 | 12 | Les gains sont directement mesurables : kilomètres et temps par recharge, recharges par heure-agent, coût par recharge (KR1), indisponibilité liée à la batterie. Le W6 prévoit déjà une logique de coût de référence. | Ampleur inconnue avant le pilote. Les gains nets doivent intégrer le temps de validation par l'opérateur. |
| 11 | Possibilité de Prototypage | Facilité de prototypage | **4** | 2 | 8 | Prototype réalisable rapidement : heuristique d'optimisation en TypeScript, régression logistique entraînée hors ligne, données simulées, déploiement Vercel + Supabase. Aucun modèle sur mesure lourd. | Le prototype démontre la chaîne de décision, pas la performance réelle. |
| 12 | Coût et Complexité de Mise en Œuvre | Faisabilité et intégration technique | **4** | 3 | 12 | Architecture simple et compétences accessibles (web, SQL, Python de base). Latence faible : un calcul de tournée prend quelques secondes. L'intégration aux systèmes réels (télématique, gestion des interventions) reste à réaliser. | En production, solveur dédié et matrice routière ajoutent une brique technique. |
| 13 | Coût et Complexité de Mise en Œuvre | Coûts d'exploitation et infrastructure | **4** | 3 | 12 | Aucun appel LLM ni recherche vectorielle. Coûts limités à l'hébergement web, à la base de données et, plus tard, à la matrice routière. La valeur visée (temps agent, kilomètres) est récurrente. | Coûts de maintenance du modèle et de la télématique non chiffrés. |
| 14 | Existence de Cas Similaires | Références et solutions existantes | **4** | 2 | 8 | Problème classique de tournées de véhicules avec solveurs open source éprouvés (OR-Tools, VROOM). Le cours cite UPS, qui combine algorithmes et ML pour ajuster les itinéraires. Les opérateurs de micromobilité à batteries amovibles pratiquent des tournées d'échange. | Peu de retours publics détaillés sur l'apport chiffré du ML dans la priorisation des recharges. |
| 15 | Adaptation à Long Terme | Évolutivité des connaissances et modèles | **3** | 1 | 3 | Les paramètres métier sont réglables (seuils, poids, capacités). Le modèle doit être réentraîné : saisonnalité, nouvelles zones, vieillissement des batteries modifient la consommation. | Si le mode de recharge réel est la collecte (scénario B), le module d'optimisation devra être reparamétré. |
| 16 | Fiabilité et maîtrise des risques | Fiabilité et contrôle des résultats | **4** | 3 | 12 | Les résultats sont vérifiables : chaque tournée est contrôlée par des règles (temps, capacité, éligibilité), comparée à une référence, et accompagnée de l'explication de chaque priorité. Le ML ne fait qu'ordonner des scooters déjà éligibles ; son erreur reste bornée par les règles. | Une erreur de mesure BMS peut fausser une priorité : contrôles de cohérence et vérification sur place par l'agent. |
| 17 | Sécurité et autonomie des agents | Sécurité et contrôle des actions | **4** | 3 | 12 | L'outil recommande sans agir : aucune commande vers les scooters, approbation humaine obligatoire, rôles et droits par ligne (Supabase), journalisation de chaque plan et de chaque décision. Pas d'agent IA, donc pas de risque d'instructions malveillantes. | Risque critique W7 : un boîtier falsifié pourrait orienter les tournées. Mesures : identité des boîtiers, détection d'incohérences. |
| 18 | Suivi des résultats | Maintenance, suivi et viabilité | **3** | 3 | 9 | Le moteur d'optimisation est stable et peu coûteux à maintenir. Le composant ML exige un suivi : dérive, réentraînement, comparaison périodique à la règle. Charge supportable mais réelle pour une petite équipe data. | Le ML est désactivable : en cas de dérive, repli automatique sur la priorité par règles. |
**Total : 153 / 220** (somme des pondérations : 44). Vérifié par recalcul du classeur.

---

## 3. Lecture par bloc

| Bloc | Critères | Score obtenu | Maximum | Taux |
|---|---|---|---|---|
| Accessibilité et qualité des données | 01–04 | 31 | 45 | 69 % |
| Complexité du problème | 05–06 | 12 | 20 | 60 % |
| Variabilité des données | 07 | 4 | 10 | 40 % |
| Automatisation | 08 | 9 | 15 | 60 % |
| Bénéfices potentiels | 09–10 | 21 | 30 | 70 % |
| Prototypage | 11 | 8 | 10 | 80 % |
| Coût et complexité de mise en œuvre | 12–13 | 24 | 30 | 80 % |
| Cas similaires | 14 | 8 | 10 | 80 % |
| Adaptation à long terme | 15 | 3 | 5 | 60 % |
| Fiabilité | 16 | 12 | 15 | 80 % |
| Sécurité et contrôle | 17 | 12 | 15 | 80 % |
| Suivi | 18 | 9 | 15 | 60 % |
| **Total** | | **153** | **220** | **70 %** |

**Deux regroupements éclairent la décision :**
- **Nécessité de l'IA** (05, 06, 07, 08, 09) : 34 / 60, soit **57 %**.
- **Faisabilité et maîtrise des risques** (11, 12, 13, 16, 17) : 56 / 70, soit **80 %**.

Le projet est **facile et peu risqué à réaliser**, mais l'IA au sens strict n'y est **pas indispensable**. Le score global élevé ne doit pas être lu comme une preuve que l'IA est nécessaire.

---

## 4. Sensibilité du score

| Scénario | Ajustement | Score | Zone |
|---|---|---|---|
| Prudent | −1 sur 04 (données), 06 (prédiction), 09 (qualité), 10 (gains) | **142** | Potentiellement utile |
| Retenu | — | **153** | Potentiellement utile |
| Favorable | +1 sur 05 (complexité), 06, 09, 14 (références) | **162** | Fortement recommandée (de justesse) |

Le classement « IA potentiellement utile, à confirmer » est **robuste** : il faut cumuler quatre hypothèses favorables pour franchir 160, et ce franchissement reste marginal. Conformément au cours, la grille sera **réévaluée** après le pilote (étapes 3 à 6), notamment les critères 04, 06 et 09 lorsque des données BMS réelles seront disponibles.

---

## 5. Comparaison des approches

| Critère | 1. Planification manuelle | 2. Optimisation classique sans IA | 3. ML seul | 4. Hybride prédiction + optimisation | 5. LLM / agent IA |
|---|---|---|---|---|---|
| Principe | Le responsable choisit les scooters < 20 % sur une carte ; l'agent enchaîne au plus proche | Règles d'éligibilité + score de priorité par règles + solveur de tournées | Le modèle classe les scooters à recharger ; l'ordre de visite reste manuel | Règles + risque prédit par ML + solveur de tournées + validation | Un LLM propose ou orchestre les tournées en langage naturel |
| Qualité de la sélection | Faible : seuil fixe, ignore l'usage à venir | Bonne pour les cas critiques | Bonne pour anticiper, si données réelles | **La meilleure possible**, si le ML apporte un gain | Non fiable pour un calcul sous contraintes |
| Qualité de l'itinéraire | Moyenne (plus proche voisin) | **Élevée** | Faible (non optimisée) | **Élevée** | Faible sans solveur ; avec solveur, le LLM est superflu |
| Respect garanti des contraintes | Non vérifié | Oui | Non | Oui | Non garanti |
| Données requises | Carte en temps réel | État courant + profil de demande | Historique BMS ≥ 28 jours | Les deux | Les deux + prompts |
| Explicabilité | Bonne | **Très bonne** | Moyenne | Bonne (score décomposé) | Faible (risque d'hallucination) |
| Coût / complexité | Temps du responsable | Faible | Moyen | Moyen | Élevé (tokens, garde-fous) |
| Verdict | Référence de comparaison (REF) | **Socle indispensable** | Insuffisant seul | **Retenu, ML conditionnel** | **Écarté** |

**Optimisation combinatoire ≠ apprentissage automatique.** Un algorithme qui cherche le meilleur ordre de visite (plus proche voisin, insertion, 2-opt, solveur VRP) applique une procédure de recherche sur des contraintes connues : il n'apprend rien des données. Ce n'est pas de l'IA au sens ML, même si le cours range l'optimisation parmi les usages « automatisation et optimisation » [M9 p.7]. Dans notre solution, **seul le modèle de risque d'épuisement apprend à partir de données**.

---

## 6. Décision : GO SOUS CONDITIONS

**Justification** : le besoin est réel et mesurable, la solution est simple, peu coûteuse et contrôlable. Le gain principal attendu provient de l'optimisation ; le ML est un complément dont la valeur doit être démontrée.

**Conditions de passage du prototype au pilote :**

| # | Condition | Nature |
|---|---|---|
| C1 | Confirmer le mode de recharge réel (échange de batterie ou collecte) | Bloquante pour la production |
| C2 | Disposer d'un flux BMS et GPS conforme aux règles de fraîcheur, avec association scooter–batterie fiable (part d'états rejetés < 5 %, hypothèse) | Bloquante |
| C3 | Activer le ML **seulement** s'il bat la règle « batterie la plus faible d'abord » sur une période de test réelle (seuils H22) ; sinon conserver la priorité par règles | Bloquante pour le ML, pas pour l'outil |
| C4 | Validation humaine systématique ; aucune action automatique | Non négociable |
| C5 | Encadrer la géolocalisation des agents (information, finalité, conservation) avant tout suivi en tournée | Bloquante pour cette fonction |
| C6 | Traiter le risque critique W7 « mesure batterie falsifiée » (identité des boîtiers, détection d'incohérences) | Bloquante pour l'usage opérationnel |

**Critère d'arrêt** : si, après 4 semaines de pilote, la variante optimisée ne réduit pas le coût par recharge (KR1) par rapport à la référence sans dégrader K3, le projet est arrêté ou ramené à un simple tableau de priorités.
