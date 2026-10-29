# MVP_SPEC — Planificateur de tournées de recharge BlueMove

> **Cahier des charges de développement**, destiné à Claude Sonnet (ou à tout développeur). Il fige les choix de conception : ne pas les réinventer. En cas d'ambiguïté, appliquer l'ordre de priorité : **ce document → `DECISIONS.md` → `BLUEMOVE_CONTEXT.md` → `ARCHITECTURE.md`**. Si un point reste indécidable, choisir l'option la plus simple, la noter dans `docs/DEV_NOTES.md` et continuer.
>
> **Règles non négociables**
> 1. Toutes les données sont **simulées** et affichées comme telles (bandeau permanent « DONNÉES SIMULÉES — démonstration pédagogique »).
> 2. **Aucune action automatique** : l'application recommande, le responsable des opérations approuve ou rejette.
> 3. **Aucune donnée client** (ni identité, ni trajet individuel). Aucune géolocalisation d'agent.
> 4. **Aucun LLM, RAG ou agent IA** dans l'application.
> 5. Le moteur ne renvoie **jamais** une tournée qui viole une contrainte.
> 6. Stockage en **UTC**, affichage en **Europe/Paris**.
> 7. Toute valeur numérique de paramétrage provient de `config/hypotheses.json` (source unique pour Python et TypeScript).

---

## 1. Objectif et utilisateurs

**Objectif** : aider le responsable des opérations à décider, à un instant donné, **quels scooters recharger, dans quel ordre et par quel agent**, sous contraintes de temps et de batteries transportées, et à **comparer** la proposition à une planification de référence avant de l'approuver.

**Hypothèse de fonctionnement (H01)** : la recharge se fait par **échange de batterie sur place** ; le scooter n'est pas déplacé. Un agent part du dépôt avec un stock de batteries chargées et y revient.

| Utilisateur | Rôle applicatif | Besoin |
|---|---|---|
| Responsable des opérations (exploitation) | `responsable_ops` | Paramétrer, calculer, comparer, approuver / rejeter |
| Agent de recharge | `agent` | Consulter et imprimer la feuille de route **approuvée** |
| Enseignant, analyste, jury | `lecteur` | Consulter sans modifier |

---

## 2. Périmètre

### 2.1 Fonctionnalités incluses (F)

| ID | Fonctionnalité |
|---|---|
| F01 | Sélection d'un scénario simulé (instant donné de la flotte) |
| F02 | Contrôles qualité et éligibilité, avec motifs (onglet « Contrôles qualité ») |
| F03 | Carte des scooters par classe de charge et statut ; zones affichées |
| F04 | Indicateurs de situation : flotte, louables, critiques, préventifs, exclus, rejets, déficit par zone |
| F05 | Panneau de paramètres opérationnels |
| F06 | Liste des candidats triés par priorité avec décomposition du score |
| F07 | Calcul de trois variantes : REF, OPT_REGLE, OPT_ML |
| F08 | Carte des tournées (une couleur par agent, étapes numérotées) et chronologie par agent |
| F09 | Tableau de comparaison des variantes avec écarts par rapport à REF et variante recommandée |
| F10 | Liste des scooters critiques non servis avec motif |
| F11 | Approbation ou rejet (motif obligatoire) ; expiration après 30 min |
| F12 | Feuille de route imprimable par agent |
| F13 | Historique des calculs et décisions, taux d'acceptation |
| F14 | Page « Méthode » : modèle, métriques, hypothèses, limites |
| F15 | Mode démonstration local sans Supabase (lecture seule des décisions) |

### 2.2 Hors périmètre (ne pas développer)
Voir §15.

---

## 3. Parcours utilisateur

1. **Ouvrir le tableau de bord** (`/`) : bandeau « données simulées », sélection du scénario (par défaut `SC02`).
2. **Visualiser la flotte** : carte + tuiles d'indicateurs + onglet « Contrôles qualité ».
3. **Régler les paramètres** : agents, véhicule, durée, seuils, poids, zones inaccessibles, ML activé ou non.
4. **Identifier les interventions prioritaires** : tableau des candidats trié par priorité, avec la raison de chaque score.
5. **Lancer le calcul** (bouton « Calculer les tournées ») → redirection vers `/runs/{id}`.
6. **Visualiser les tournées** de la variante recommandée (carte, étapes, chronologie) ; onglets pour les autres variantes.
7. **Comparer** les trois variantes (tableau F09).
8. **Approuver** une variante ou **rejeter** avec motif. Les agents consultent ensuite leur feuille de route.

---

## 4. Maquette fonctionnelle décrite

### 4.1 `/` — Tableau de bord
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▓ DONNÉES SIMULÉES — démonstration pédagogique (BlueMove est fictive)       │
├──────────────────────────────────────────────────────────────────────────────┤
│ BlueMove · Tournées de recharge     Scénario [SC02 · Mar. 16:30 ▼]  Rôle: …  │
├───────────────┬──────────────────────────────────────────┬───────────────────┤
│ TUILES        │                                          │ PARAMÈTRES        │
│ Flotte 300    │              CARTE (Leaflet)             │ Agents [2]        │
│ Louables 231  │  ● rouge = critique (<20 %)              │ Véhicule [cargo]  │
│ Critiques 27  │  ● orange = préventif (20–40 %)          │ Durée [240] min   │
│ Préventifs 54 │  ● vert = ≥ 40 %   ○ gris = exclu        │ Seuil max [40] %  │
│ Exclus 18     │  ◯ cercles = zones, ■ = dépôt            │ Poids U/D/S       │
│ Rejets 4      │                                          │ Zones fermées [ ] │
│ Déficit zones │                                          │ ML [✓] v1.0.0     │
│ (barres)      │                                          │ ▸ Hypothèses av.  │
│               │                                          │ [Calculer]        │
├───────────────┴──────────────────────────────────────────┴───────────────────┤
│ Onglets : [Priorités] [Contrôles qualité] [Orientés maintenance]            │
│ Priorités : Rang | Scooter | Zone | Charge | Classe | Risque 3 h | U | D | S │
│             | Priorité | Raison                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```
Les nombres de la maquette sont fictifs ; l'application affiche les valeurs calculées.

### 4.2 `/runs/[id]` — Résultat d'un calcul
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▓ DONNÉES SIMULÉES                                                          │
│ Calcul du 03/11 16:31 · SC02 · moteur 1.0.0 · modèle 1.0.0 · empreinte a1b2… │
│ Statut : PROPOSÉ — expire à 17:01                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ Variantes : [REF] [OPT_REGLE] [OPT_ML ★ recommandée]                         │
├──────────────────────────────────────────┬───────────────────────────────────┤
│ CARTE : polylignes par agent, étapes 1…n │ CHRONOLOGIE                       │
│                                          │ Agent 1 : 16:31 dépôt → … → 20:12 │
│                                          │  1. SC-0042 Gare 14 % P90,4 16:41 │
│                                          │  …                                │
├──────────────────────────────────────────┴───────────────────────────────────┤
│ COMPARAISON                 REF     OPT_REGLE   OPT_ML    Écart OPT_ML/REF  │
│ Recharges (échanges)        …       …           …         …                 │
│ Durée mobilisée (h)         …                                                │
│ Distance (km)               …                                                │
│ KR1 Coût / recharge (€)     …                                                │
│ KR2 Recharges / heure       …                                                │
│ KR3 km / recharge           …                                                │
│ KR4 Critiques servis (%)    …                                                │
│ KR4b Critiques zones fortes …                                                │
│ Déficit projeté pondéré     …       (plus bas = mieux)                       │
│ Scooters < 20 % projetés    …                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ Critiques non servis : SC-0107 Loisirs 9 % — capacité batteries atteinte …   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Approuver OPT_ML]  [Rejeter…]  (motif : trop long / données douteuses /     │
│  contrainte terrain non prise en compte / priorités incohérentes / autre)   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Autres écrans
- `/runs/[id]/agent/[k]` : feuille de route imprimable (CSS `@media print`) de la variante approuvée : ordre, scooter, batterie à retirer, zone, coordonnées, heure estimée, consigne « vérifier l'état du scooter ; signaler tout défaut à la maintenance ».
- `/historique` : tableau des calculs (date, scénario, variante recommandée, statut, décision, motif, auteur) ; taux d'acceptation (KR6) et répartition des motifs de rejet.
- `/methode` : origine des données (simulation), registre des hypothèses (lu depuis `config/hypotheses.json`), formule de priorité, modèle (version, date, variables, coefficients, métriques comparées à la règle), **avertissement** : « Les performances affichées sont mesurées sur données simulées. Elles valident la chaîne de calcul, pas la capacité prédictive réelle. »

---

## 5. Données

### 5.1 Source unique des paramètres : `config/hypotheses.json`
```json
{
  "version": "1.0.0",
  "data_origin": "SIMULATION",
  "timezone": "Europe/Paris",
  "city_center": { "lat": 45.7578, "lng": 4.8320, "note": "Choix arbitraire de lisibilité (D-11) ; ville fictive" },
  "depot": { "id": "DEP-1", "name": "Dépôt principal", "offset_km": { "east": 0.3, "north": -1.2 } },
  "zones": [
    { "id": "Z-GARE",  "name": "Gare",                "offset_km": { "east": 1.2,  "north": 0.0 }, "radius_m": 700,  "target_rentable": 50 },
    { "id": "Z-AFF",   "name": "Quartier d'affaires", "offset_km": { "east": 1.5,  "north": 1.2 }, "radius_m": 600,  "target_rentable": 45 },
    { "id": "Z-CAMP",  "name": "Campus",              "offset_km": { "east": 0.5,  "north": 3.0 }, "radius_m": 800,  "target_rentable": 35 },
    { "id": "Z-CENT",  "name": "Centre-ville",        "offset_km": { "east": 0.0,  "north": 0.0 }, "radius_m": 900,  "target_rentable": 50 },
    { "id": "Z-RES",   "name": "Résidentiel",         "offset_km": { "east": -2.0, "north": -1.0 }, "radius_m": 1000, "target_rentable": 35 },
    { "id": "Z-LOIS",  "name": "Loisirs",             "offset_km": { "east": -0.8, "north": 1.8 }, "radius_m": 700,  "target_rentable": 25 }
  ],
  "fleet": { "size": 300, "allocation": { "Z-GARE": 63, "Z-AFF": 56, "Z-CAMP": 44, "Z-CENT": 63, "Z-RES": 44, "Z-LOIS": 30 } },
  "demand": {
    "source": "Heatmap W5 (valeurs illustratives), jours ouvrés, 28 jours",
    "workdays_in_window": 20,
    "scale_factor": 3,
    "slots": [[6,9],[9,12],[12,14],[14,17],[17,20],[20,23]],
    "searches_28d": {
      "Z-GARE": [400,240,200,220,420,180],
      "Z-AFF":  [300,200,180,240,360,100],
      "Z-CAMP": [200,180,240,160,220,80],
      "Z-CENT": [180,260,320,300,400,240],
      "Z-RES":  [240,160,120,160,280,120],
      "Z-LOIS": [80,100,160,180,260,300]
    },
    "no_offer_rate": {
      "Z-GARE": [0.45,0.20,0.15,0.20,0.35,0.15],
      "Z-AFF":  [0.15,0.10,0.20,0.15,0.40,0.10],
      "Z-CAMP": [0.30,0.15,0.25,0.10,0.20,0.05],
      "Z-CENT": [0.10,0.15,0.20,0.15,0.25,0.20],
      "Z-RES":  [0.35,0.15,0.10,0.10,0.20,0.10],
      "Z-LOIS": [0.05,0.05,0.10,0.15,0.30,0.45]
    }
  },
  "weather": { "rain_probability": 0.25, "rain_demand_factor": 0.7 },
  "consumption_per_trip_pct": { "mean": 8, "sd": 3, "min": 2, "max": 20 },
  "thresholds": {
    "critical_pct": 20,
    "max_eligible_pct": 40,
    "rentable_gps_max_age_min": 2,
    "rentable_bms_max_age_min": 10,
    "intervention_gps_max_age_min": 10,
    "intervention_bms_max_age_min": 30,
    "battery_temp_max_c": 55
  },
  "horizon_h": 3,
  "priority": { "weights": { "urgency": 0.50, "demand": 0.35, "scarcity": 0.15 }, "preventive_urgency_cap": 0.8, "high_demand_threshold": 0.5 },
  "vehicles": {
    "velo_cargo": { "label": "Vélo-cargo électrique", "capacity_batteries": 12, "speed_kmh": 15, "cost_per_km_eur": 0.05 },
    "utilitaire": { "label": "Utilitaire électrique", "capacity_batteries": 30, "speed_kmh": 18, "cost_per_km_eur": 0.20 }
  },
  "defaults": { "agents": 2, "vehicle": "velo_cargo", "shift_min": 240, "service_min": 6, "detour_factor": 1.3, "agent_cost_eur_h": 30 },
  "bounds": { "agents": [1,3], "shift_min": [30,480], "service_min": [3,15], "detour_factor": [1.0,2.0], "agent_cost_eur_h": [15,60], "max_eligible_pct": [25,60], "capacity_batteries": [1,40] },
  "plan_expiry_min": 30,
  "history": { "calendar_days": 28, "simulated_workdays": 20, "baseline_swap_times_local": ["07:00","14:00"], "baseline_swaps_per_round": 40, "seed": 20261029 }
}
```
Conversion des décalages : `lat = lat0 + north / 111.32` ; `lng = lng0 + east / (111.32 × cos(lat0 en radians))`.

### 5.2 Schéma de base de données (Supabase / PostgreSQL)

Fichier `supabase/migrations/001_schema.sql` :
```sql
create extension if not exists pgcrypto;

-- Référentiels (niveau Service)
create table zones (
  id text primary key,
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m integer not null check (radius_m > 0),
  target_rentable integer not null check (target_rentable >= 0),
  data_origin text not null default 'SIMULATION'
);

create table depots (
  id text primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  data_origin text not null default 'SIMULATION'
);

create table demand_profile (
  zone_id text not null references zones(id),
  day_type text not null default 'ouvre' check (day_type = 'ouvre'),
  slot_start smallint not null check (slot_start between 0 and 23),
  slot_end smallint not null check (slot_end > slot_start and slot_end <= 24),
  searches_28d integer not null check (searches_28d >= 0),
  no_offer_rate numeric(4,3) check (no_offer_rate between 0 and 1),
  data_origin text not null default 'SIMULATION',
  primary key (zone_id, day_type, slot_start)
);

-- Scénarios et relevés bruts (niveau Raw)
create table scenarios (
  id text primary key,                       -- 'SC02', 'TC08'…
  label text not null,
  as_of_utc timestamptz not null,
  weather text not null check (weather in ('sec','pluie')),
  description text,
  is_test_case boolean not null default false,
  expected_behavior text,
  data_origin text not null default 'SIMULATION'
);

create table scooter_readings (
  id bigserial primary key,                  -- clé technique : les doublons de message_id sont conservés tels que reçus
  scenario_id text not null references scenarios(id) on delete cascade,
  message_id text not null,
  scooter_id text not null,
  battery_id text,                           -- identifiant remonté par le BMS
  registry_battery_id text,                  -- batterie attendue selon le registre de flotte
  lat double precision,
  lng double precision,
  gps_ts_utc timestamptz,
  charge_pct numeric,                        -- non contraint : la validation se fait dans le moteur
  bms_ts_utc timestamptz,
  bms_fault_code text,
  battery_temp_c numeric,
  rental_status text,                        -- 'libre' | 'reserve' | 'en_location'
  ops_status text,                           -- 'actif' | 'maintenance' | 'hors_service'
  usage_rate_6h numeric,                     -- trajets réalisés par ce scooter sur les 6 dernières heures
  data_origin text not null default 'SIMULATION'
);
create index on scooter_readings (scenario_id);

-- Calculs, variantes, étapes, décisions
create table plan_runs (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null references scenarios(id),
  created_at_utc timestamptz not null default now(),
  created_by uuid,
  params jsonb not null,
  input_hash text not null,
  engine_version text not null,
  model_version text,                        -- null si ML désactivé ou indisponible
  validation_summary jsonb not null,
  compute_ms integer not null,
  data_origin text not null default 'SIMULATION'
);

create table plan_variants (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references plan_runs(id) on delete cascade,
  strategy text not null check (strategy in ('REF','OPT_REGLE','OPT_ML')),
  status text not null check (status in ('proposee','approuvee','rejetee','non_retenue','expiree','non_calculee')),
  is_recommended boolean not null default false,
  kpis jsonb not null,
  unserved jsonb not null,
  message text,                              -- ex. 'Aucune tournée admissible : …'
  expires_at_utc timestamptz not null,
  unique (run_id, strategy)
);

create table plan_stops (
  variant_id uuid not null references plan_variants(id) on delete cascade,
  agent_index smallint not null,
  seq smallint not null,
  scooter_id text not null,
  battery_id text,
  zone_id text not null,
  lat double precision not null,
  lng double precision not null,
  arrival_min numeric not null,              -- minutes depuis le départ du dépôt
  cum_km numeric not null,
  priority numeric not null,
  category text not null check (category in ('critique','preventif')),
  explanation text not null,
  primary key (variant_id, agent_index, seq)
);

create table plan_decisions (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null unique references plan_variants(id),
  decision text not null check (decision in ('approuvee','rejetee')),
  reason_code text check (reason_code in ('TROP_LONG','DONNEES_DOUTEUSES','CONTRAINTE_TERRAIN','PRIORITES_INCOHERENTES','AUTRE')),
  comment text,
  decided_by uuid not null,
  decided_at_utc timestamptz not null default now(),
  check (decision = 'approuvee' or reason_code is not null)
);

create table validation_results (
  run_id uuid not null references plan_runs(id) on delete cascade,
  scooter_id text not null,
  message_id text not null,
  outcome text not null check (outcome in ('accepte','rejet_qualite','exclusion','maintenance')),
  reason_code text,
  primary key (run_id, message_id, scooter_id)
);

create table user_roles (
  user_id uuid primary key,
  role text not null check (role in ('responsable_ops','agent','lecteur'))
);
```
> Remarque : le doublon de `message_id` n'est conservé qu'une fois dans `validation_results` (le second est compté dans `validation_summary.REJ_DOUBLON`).

Fichier `supabase/migrations/002_rls.sql` : activer la sécurité par ligne sur toutes les tables ; lecture autorisée à tout utilisateur authentifié ayant un rôle ; écriture sur `plan_runs`, `plan_variants`, `plan_stops`, `validation_results`, `plan_decisions` réservée au rôle `responsable_ops` (fonction `auth_role()` lisant `user_roles`) ; le rôle `agent` ne lit `plan_variants` et `plan_stops` que si `status = 'approuvee'`. Les écritures passent par les route handlers avec le jeton de l'utilisateur ; la clé de service n'est utilisée que par le script de chargement.

**Aucune table ne contient d'identifiant client ou d'identité d'agent.**

### 5.3 Types TypeScript (`src/lib/engine/types.ts`)
```ts
export type RentalStatus = 'libre' | 'reserve' | 'en_location';
export type OpsStatus = 'actif' | 'maintenance' | 'hors_service';
export type Strategy = 'REF' | 'OPT_REGLE' | 'OPT_ML';

export interface ScooterReading {
  message_id: string; scooter_id: string;
  battery_id: string | null; registry_battery_id: string | null;
  lat: number | null; lng: number | null; gps_ts_utc: string | null;
  charge_pct: number | null; bms_ts_utc: string | null;
  bms_fault_code: string | null; battery_temp_c: number | null;
  rental_status: RentalStatus | string | null; ops_status: OpsStatus | string | null;
  usage_rate_6h: number | null;
}

export interface Scenario {
  id: string; label: string; as_of_utc: string; weather: 'sec' | 'pluie';
  description?: string; is_test_case: boolean; expected_behavior?: string;
  readings: ScooterReading[];
}

export type ValidationOutcome = 'accepte' | 'rejet_qualite' | 'exclusion' | 'maintenance';

export interface ValidatedScooter extends ScooterReading {
  zone_id: string | null;
  outcome: ValidationOutcome;
  reason_code: string | null;      // cf. §6
  is_rentable: boolean;            // définition stricte du cadre commun
}

export interface Candidate {
  scooter_id: string; battery_id: string; zone_id: string; lat: number; lng: number;
  charge_pct: number; category: 'critique' | 'preventif';
  urgency: number; demand: number; scarcity: number;
  risk_3h: number | null;          // probabilité ML, préventifs uniquement
  priority: number;                // 0–100, pleine précision
  explanation: string;
}

export interface PlanParams {
  agents: number; vehicle: 'velo_cargo' | 'utilitaire'; capacity_batteries: number;
  speed_kmh: number; cost_per_km_eur: number; shift_min: number; service_min: number;
  detour_factor: number; agent_cost_eur_h: number; max_eligible_pct: number;
  weights: { urgency: number; demand: number; scarcity: number };   // normalisés à 1
  closed_zones: string[]; ml_enabled: boolean;
}

export interface Stop {
  agent_index: number; seq: number; scooter_id: string; battery_id: string; zone_id: string;
  lat: number; lng: number; arrival_min: number; cum_km: number;
  priority: number; category: 'critique' | 'preventif'; explanation: string;
}

export interface Route { agent_index: number; stops: Stop[]; duration_min: number; km: number; }

export interface VariantResult {
  strategy: Strategy; status: 'proposee' | 'non_calculee';
  routes: Route[]; kpis: Kpis; unserved: { scooter_id: string; zone_id: string; charge_pct: number; reason: string }[];
  message: string | null;
}

export interface Kpis {
  swaps: number; duration_h: number; km: number; cost_eur: number;
  kr1_cost_per_swap: number | null; kr2_swaps_per_hour: number | null; kr3_km_per_swap: number | null;
  kr4_critical_coverage: number | null; kr4b_critical_coverage_high_demand: number | null;
  projected_weighted_deficit: number; projected_below_20: number;
}
```

### 5.4 Exemple de scénario (`data/scenarios/SC02.json`, extrait)
```json
{
  "id": "SC02",
  "label": "Mardi 16 h 30 — avant la pointe du soir",
  "as_of_utc": "2026-11-03T15:30:00Z",
  "weather": "sec",
  "is_test_case": false,
  "description": "Situation nominale ; scénario de démonstration par défaut.",
  "readings": [
    {
      "message_id": "SC02-m-000042",
      "scooter_id": "SCO-0042",
      "battery_id": "BAT-1042",
      "registry_battery_id": "BAT-1042",
      "lat": 45.7581, "lng": 4.8462,
      "gps_ts_utc": "2026-11-03T15:29:20Z",
      "charge_pct": 14,
      "bms_ts_utc": "2026-11-03T15:27:00Z",
      "bms_fault_code": null,
      "battery_temp_c": 21.5,
      "rental_status": "libre",
      "ops_status": "actif",
      "usage_rate_6h": 2
    }
  ]
}
```
Le 3 novembre 2026 est un mardi ; à Paris, l'heure d'hiver est UTC+1 (16 h 30 locale = 15 h 30 UTC).

### 5.5 Modèle exporté (`data/model/depletion_model_v1.json`)
```json
{
  "model_id": "depletion_risk",
  "version": "1.0.0",
  "trained_at_utc": "2026-11-01T10:00:00Z",
  "data_origin": "SIMULATION",
  "algorithm": "logistic_regression",
  "target": "charge passe sous 20 % dans les 3 h (sans échange entre-temps)",
  "horizon_h": 3,
  "applicable_charge_range": [20, 40],
  "features": ["charge_pct", "usage_rate_6h", "zone_demand_next_h", "is_rain"],
  "mean": [0, 0, 0, 0],
  "std": [1, 1, 1, 1],
  "coef": [0, 0, 0, 0],
  "intercept": 0,
  "metrics": {
    "test_period": "jours ouvrés 16 à 20",
    "n_test": 0,
    "roc_auc": 0, "brier": 0,
    "precision_at_10": 0, "baseline_precision_at_10": 0
  },
  "status": "validated_on_simulation"
}
```
(Les valeurs numériques sont produites par le script ; celles-ci sont des emplacements.) Si le fichier est absent, illisible ou `status = "disabled"`, le ML est **indisponible** : OPT_ML est enregistrée avec `status = 'non_calculee'` et l'interface l'indique.

---

## 6. Règles métier : validation et éligibilité

Fonction pure `validate(scenario, params, config) → ValidatedScooter[]`, appliquée **dans cet ordre** ; le premier motif rencontré est retenu. `age(x) = as_of_utc − x` en minutes.

### 6.1 Rejets qualité (`outcome = 'rejet_qualite'`)
| Ordre | Code | Condition |
|---|---|---|
| 1 | `REJ_DOUBLON` | `message_id` déjà vu dans le scénario (on garde la première occurrence) |
| 2 | `REJ_CHAMP_MANQUANT` | `scooter_id`, `charge_pct`, `bms_ts_utc`, `lat`, `lng`, `gps_ts_utc`, `rental_status` ou `ops_status` absent |
| 3 | `REJ_BATTERIE_INVALIDE` | `charge_pct < 0` ou `> 100` (ex. 145 %) |
| 4 | `REJ_COORDONNEES` | latitude hors [−90 ; 90], longitude hors [−180 ; 180], ou (0, 0) |
| 5 | `REJ_HORODATAGE` | horodatage postérieur à `as_of_utc` de plus de 1 min |
| 6 | `REJ_ASSOCIATION_BATTERIE` | `battery_id` absent ou différent de `registry_battery_id` |
| 7 | `REJ_STATUT_INCONNU` | statut hors valeurs autorisées |

### 6.2 Orientation maintenance (`outcome = 'maintenance'`)
| Code | Condition |
|---|---|
| `MAINT_ALERTE_BMS` | `bms_fault_code` non nul |
| `MAINT_TEMPERATURE` | `battery_temp_c > thresholds.battery_temp_max_c` |
Ces scooters apparaissent dans l'onglet « Orientés maintenance » ; ils ne sont jamais dans une tournée de recharge.

### 6.3 Exclusions métier (`outcome = 'exclusion'`)
| Ordre | Code | Condition |
|---|---|---|
| 1 | `EXCL_MAINTENANCE` | `ops_status ≠ 'actif'` |
| 2 | `EXCL_EN_LOCATION` | `rental_status = 'en_location'` |
| 3 | `EXCL_RESERVE` | `rental_status = 'reserve'` |
| 4 | `EXCL_GPS_PERIME` | `age(gps_ts_utc) > intervention_gps_max_age_min` (10) |
| 5 | `EXCL_BMS_PERIME` | `age(bms_ts_utc) > intervention_bms_max_age_min` (30) |
| 6 | `EXCL_HORS_ZONE` | aucune zone ne contient la position |
| 7 | `EXCL_ZONE_FERMEE` | zone dans `params.closed_zones` |
| 8 | `EXCL_CHARGE_SUFFISANTE` | `charge_pct ≥ params.max_eligible_pct` (40) |

**Affectation de zone** : zone dont le cercle contient le point (distance haversine ≤ rayon) ; si plusieurs, la plus proche du centre.

Les scooters `accepte` restants sont les **candidats** : `critique` si `charge_pct < critical_pct` (20), sinon `preventif`.

### 6.4 Louabilité (pour l'affichage et la rareté)
`is_rentable = true` si : données non rejetées, `ops_status = 'actif'`, `rental_status = 'libre'`, dans une zone autorisée **et non fermée**, `age(gps) < 2 min`, `age(bms) < 10 min`, `charge_pct ≥ 20`. C'est la définition du cadre commun ; elle est **distincte** de l'éligibilité.

---

## 7. Priorité

Pour chaque candidat *i* situé en zone *z* :

### 7.1 Demande D (0–1), sans ML
Recherches attendues dans la zone sur `[as_of ; as_of + H]` (heure locale, jours ouvrés) :
`E_z = Σ_créneaux s  heures_de_recouvrement(s) × searches_28d[z][s] / (workdays_in_window × durée(s))`
(Aucune demande en dehors de 6 h–23 h. Le facteur d'échelle et la météo multiplient tous les E_z de la même façon et n'ont donc pas d'effet sur D.)
`D_z = E_z / max_z' E_z'` (0 si le maximum est nul).

### 7.2 Rareté S (0–1)
`R_z` = nombre de scooters **louables** (§6.4) dans la zone ; `C_z` = `target_rentable`.
`S_z = clamp((C_z − R_z) / C_z, 0, 1)`.

### 7.3 Urgence U (0–1)
- Critique (`charge < 20`) : `U = 1`.
- Préventif, **règle** (OPT_REGLE) : `U = cap × (max_eligible_pct − charge) / (max_eligible_pct − 20)`, avec `cap = 0,8`.
- Préventif, **ML** (OPT_ML) : `U = cap × p_i`, où `p_i` est la probabilité prédite (§7.5).

### 7.4 Score
`priority = 100 × (w_U × U + w_D × D_z + w_S × S_z)`, poids normalisés à 1 (défaut 0,50 / 0,35 / 0,15). Stocker en pleine précision, afficher à 1 décimale.

**Exemples de référence (tests unitaires)**, scénario mardi 16 h 30, H = 3 h, poids par défaut :
- E_Gare = 0,5 × 220/60 + 2,5 × 420/60 = 19,333 (maximum) → D_Gare = 1 ; E_Campus = 0,5 × 160/60 + 2,5 × 220/60 = 10,5 → D_Campus = 0,5431.
- Scooter critique 14 %, Gare, R = 32, C = 50 → S = 0,36 → **priority = 90,40**.
- Scooter préventif 30 %, Campus, règle, R = 30, C = 35 → U = 0,4 ; S = 0,1429 → **priority = 41,15** (tolérance 0,01).

### 7.5 Inférence ML
Applicable aux préventifs uniquement (`20 ≤ charge < 40`).
`x = [charge_pct, usage_rate_6h, zone_demand_next_h, is_rain]`, où `zone_demand_next_h = E_z × scale_factor × (rain ? rain_demand_factor : 1)` et `is_rain ∈ {0,1}`.
`p = 1 / (1 + exp(−(intercept + Σ coef_j × (x_j − mean_j) / std_j)))`.
`usage_rate_6h` manquant → remplacé par la moyenne d'entraînement et signalé dans l'explication.

### 7.6 Explication (gabarit déterministe)
`"Priorité {P} — charge {c} % ({critique|préventif}{, risque 3 h : {p} %}) ; zone {nom} : demande {D×100} % du maximum, {R} louables pour une cible de {C}."`

---

## 8. Optimisation

### 8.1 Modèle de temps et de coût
- `dist_km(a,b)` = haversine × `detour_factor`.
- `travel_min(a,b)` = `dist_km / speed_kmh × 60`.
- Durée d'une tournée = trajets (dépôt → … → dépôt) + `service_min × nombre d'échanges`.
- Contraintes dures : durée ≤ `shift_min` ; échanges ≤ `capacity_batteries` ; une seule visite par scooter ; départ et retour au dépôt.
- `arrival_min` d'une étape = instant d'arrivée avant intervention, depuis le départ.

### 8.2 Variante REF — planification de référence
Simule une planification manuelle expérimentée (pas d'IA, pas d'optimisation globale) :
1. Candidats = **critiques uniquement**, sans priorité.
2. Répéter : prendre l'agent dont la durée courante est la plus faible (égalité → plus petit indice) ; lui ajouter en fin de tournée le candidat non visité **le plus proche** de sa dernière position tel que la tournée reste admissible (retour au dépôt compris) ; si aucun, cet agent est clos.
3. S'arrêter quand tous les agents sont clos.

### 8.3 Variantes OPT_REGLE et OPT_ML — heuristique de sélection et de tournées
Même algorithme, seule la priorité change (règle ou ML). Objectif : **maximiser la somme des priorités servies** sous contraintes, à durée minimale.

```
entrée : candidats (priorité > 0), K agents, dépôt, paramètres
routes ← K tournées vides
répéter jusqu'à 3 fois :
  # 1. Insertion gloutonne par rapport priorité / temps ajouté
  tant que vrai :
    meilleur ← aucun
    pour chaque candidat non affecté i :
      pour chaque tournée k, chaque position p :
        Δt ← temps ajouté (détour + service_min)
        si admissible(k avec i en p) :
          ratio ← priorité_i / Δt
          garder le meilleur (ratio max ; égalité : priorité max, puis scooter_id min, puis k min, puis p min)
    si meilleur = aucun : sortir
    insérer meilleur
  # 2. Amélioration 2-opt de chaque tournée (réduire la durée, ensemble inchangé), jusqu'à stabilité
  # 3. Échange : pour chaque non-affecté i par priorité décroissante, chercher un affecté j de priorité
  #    strictement inférieure tel que remplacer j par i (meilleure position) reste admissible ; appliquer le
  #    remplacement au plus grand gain de priorité ; au plus 200 échanges
  si aucune modification lors de ce tour : sortir
retourner routes
```
- **Déterminisme** : aucune source aléatoire ; tous les départages sont explicites.
- **Performance** : < 2 s en local et < 5 s sur Vercel pour 300 scooters, 3 agents, utilitaire, 480 min.
- **Aucune tournée admissible** (aucun candidat atteignable puis retour dans `shift_min`, ou capacité nulle) : renvoyer `routes` vides et `message = "Aucune tournée admissible : {motif}"` — motif parmi « aucun candidat éligible », « durée de tournée insuffisante pour atteindre un candidat et revenir », « zones des candidats toutes fermées ».

### 8.4 Motif des candidats non servis (critiques en priorité dans l'affichage)
- `Capacité batteries atteinte` si toutes les tournées ont `capacity_batteries` échanges ;
- sinon `Temps insuffisant` si l'insertion du candidat dans chaque tournée, à sa meilleure position, dépasse `shift_min` ;
- sinon `Arbitrage priorité / détour` ;
- pour REF : `Hors règle de référence (non critique)` pour les préventifs.

### 8.5 Variante recommandée
Parmi les variantes calculées : plus petit **déficit projeté pondéré** ; à égalité (écart < 1 %), plus grande KR4 ; puis plus petit KR1. **REF peut être recommandée** : la recommandation n'est pas acquise à la variante utilisant le ML.

---

## 9. Indicateurs

Tous calculés par `computeKpis(variant, candidates, validated, params, config)`. Toute division par zéro → `null`, affiché « ND » (règle W6).

| ID | Nom | Calcul (simulation) | Mesure terrain au pilote | Objectif proposé |
|---|---|---|---|---|
| — | Échanges planifiés | nombre d'étapes | échanges **confirmés** (scan batterie) | — |
| — | Durée mobilisée (h) | Σ durées de tournée / 60 | temps réel des tournées | — |
| — | Distance (km) | Σ distances, détour compris | relevé du véhicule | — |
| **KR1** | Coût par recharge | (durée h × `agent_cost_eur_h` + km × `cost_per_km_eur`) / échanges | coûts validés finance / échanges confirmés | ≤ 90 % de REF (H17) |
| **KR2** | Recharges par heure-agent | échanges / durée h | idem, réel | > REF |
| **KR3** | km par recharge | km / échanges | idem, réel | < REF |
| **KR4** | Couverture des critiques | critiques servis / critiques éligibles | idem | > REF |
| KR4b | Couverture des critiques en zones à forte demande | même calcul limité aux zones `D_z ≥ 0,5` | idem | > REF |
| **KR5** | Indisponibilité liée à la batterie | *proxy* : déficit projeté pondéré et scooters projetés < 20 % (§9.1) | minutes-scooter (actifs, libres, hors maintenance) avec charge < 20 % ÷ minutes-scooter de présence dans la flotte active | en baisse vs période de référence |
| **KR6** | Taux d'acceptation | variantes approuvées / calculs décidés (hors expirés) | idem | ≥ 70 % (H17) |
| K3 | Accès au service (W6) | non calculé en simulation | défini au W6 | ≥ 90 %, **non dégradé** |
| K4 | Disponibilité technique (W6) | non calculé | défini au W6 | ≥ 95 % (garde) |

KR1–KR6 sont **nouveaux** : K6 (coût par transfert de scooter) n'est ni réutilisé ni redéfini (D-04).

### 9.1 Projection de service (simulation uniquement)
Pour chaque scooter non rejeté et non orienté maintenance, `ops_status = 'actif'`, non loué, situé dans une zone non fermée (y compris les scooters exclus pour charge suffisante ou donnée périmée, qui comptent dans l'offre future) :
- servi par la variante avec `arrival_min ≤ H × 60` → charge projetée 100 % (H21) ;
- sinon → `charge − usage_rate_6h / 6 × H × consumption_per_trip_pct.mean`.
`R'_z` = scooters projetés ≥ 20 % dans la zone ; **déficit projeté pondéré** = `Σ_z D_z × max(0, C_z − R'_z)` ; **scooters projetés < 20 %** = compte. Afficher l'étiquette « projection simulée, hors déplacements des scooters ».

### 9.2 Tableau de comparaison
Pour chaque indicateur : valeur par variante et écart relatif de chaque variante OPT par rapport à REF : `(OPT − REF) / REF` en %, avec indication du sens favorable (flèche verte si favorable). Afficher séparément : **« Apport de l'optimisation »** = OPT_REGLE vs REF ; **« Apport du ML »** = OPT_ML vs OPT_REGLE.

---

## 10. Générateur de simulation (`sim/generate.py`)

Python 3.11+, `numpy`, `pandas` ; graine `history.seed` ; lit `config/hypotheses.json`.

1. **Géographie** : dépôt et centres de zone par décalage ; positions des scooters tirées uniformément dans le cercle de leur zone (répartition `fleet.allocation`) ; `SCO-0001`…`SCO-0300`, batteries `BAT-1001`… ; un pool de batteries de rechange pour les échanges.
2. **Attractivité** : chaque scooter reçoit un multiplicateur lognormal (σ = 0,3) — rend `usage_rate_6h` informatif.
3. **Historique** (20 jours ouvrés, pas horaire, 6 h–23 h) : pour chaque heure, demande de zone = `searches_28d / (20 × durée du créneau) × scale_factor × météo` ; trajets de zone ~ Poisson(demande × (1 − no_offer_rate)) répartis entre scooters louables proportionnellement à l'attractivité ; chaque trajet consomme N(8, 3) % borné [2 ; 20] ; le scooter reste dans sa zone (H25). Météo par jour : pluie avec probabilité 0,25.
4. **Politique d'échange historique** (règle simple, pour que les charges varient) : à 07 h 00 et 14 h 00, échanger jusqu'à 40 batteries parmi les scooters < 20 % (les plus faibles d'abord) ; charge 100 %.
5. **Fichiers** : `data/generated/history_hourly.csv` (scooter_id, horodatage UTC, zone, charge, usage_rate_6h, zone_demand_next_h, is_rain, swapped_flag) ; `data/generated/README.md` rappelant l'origine simulée.
6. **Scénarios** : poursuite de la simulation sur des jours ouvrés **non vus** à l'entraînement (après la fenêtre), instantanés :

| ID | Instant (local) | Contenu | Comportement attendu |
|---|---|---|---|
| SC01 | Mar. 03/11 07:30 | Nominal, pointe du matin | Tournées admissibles |
| SC02 | Mar. 03/11 16:30 | **Nominal, démonstration par défaut** | Tournées admissibles |
| SC03 | Jeu. 05/11 12:00 | Pluie | Tournées admissibles, demande réduite |
| TC01 | = SC02 | 40 scooters ramenés < 20 % | Capacité contraignante ; critiques non servis listés |
| TC02 | = SC02 | 15 scooters BMS âgé de 45 min ; 5 scooters GPS âgé de 20 min | `EXCL_BMS_PERIME` ×15, `EXCL_GPS_PERIME` ×5 |
| TC03 | = SC02 | 6 scooters < 20 % en location, 4 réservés | `EXCL_EN_LOCATION` ×6, `EXCL_RESERVE` ×4 |
| TC06 | = SC02 | (paramètre : Gare fermée) | Aucune étape en Gare ; `EXCL_ZONE_FERMEE` |
| TC08 | = SC02 | charge 145 % ; charge −5 % ; un doublon ; un point (0,0) ; une batterie non conforme au registre ; un `ops_status = 'inconnu'` | Codes `REJ_*` correspondants |
| TC09 | = SC02 | 2 codes défaut BMS ; 1 température 65 °C | `MAINT_*` ×3 |
| TC10 | = SC02 | 4 scooters hors de toute zone | `EXCL_HORS_ZONE` ×4 |

Les tests TC04 (capacité), TC05 (temps insuffisant) et TC07 (aucune tournée admissible) utilisent SC02 avec des paramètres (§14.2). Chaque scénario porte `expected_behavior`.

7. **Chargement** : `scripts/load-supabase.ts` insère zones, dépôt, profil, scénarios et relevés (clé de service, exécution locale uniquement).

---

## 11. Entraînement du modèle (`ml/train_depletion.py`)

- **Population** : instantanés horaires de l'historique où le scooter est libre, actif et `20 ≤ charge < 40`.
- **Cible** : 1 si la charge passe sous 20 % dans les 3 h suivantes ; lignes **écartées** si un échange intervient dans l'intervalle (cible censurée).
- **Variables** : `charge_pct`, `usage_rate_6h`, `zone_demand_next_h`, `is_rain`.
- **Découpage temporel** : jours ouvrés 1–15 en apprentissage, 16–20 en test (jamais de mélange aléatoire).
- **Modèle** : `StandardScaler` + `LogisticRegression` (scikit-learn, `class_weight=None`, `max_iter=1000`).
- **Référence** : classement par charge croissante (« batteries les plus faibles d'abord », règle W3).
- **Métriques** (période de test) : ROC AUC ; score de Brier ; **précision@10** = pour chaque heure, part des 10 scooters les mieux classés qui passent réellement sous 20 %, moyennée sur les heures — pour le modèle **et** pour la référence.
- **Sortie** : `data/model/depletion_model_v1.json` (§5.5) + `ml/report.md` (métriques, courbe de calibration en tableau par déciles).
- **Contrôle de cohérence** : si le modèle ne bat pas la référence en précision@10 **sur la simulation**, le script s'arrête en erreur (signe d'un défaut de la chaîne, pas d'une conclusion métier).
- **Message obligatoire dans le rapport** : « Métriques mesurées sur données simulées ; elles ne démontrent pas une performance réelle. Seuils d'activation sur données réelles : AUC ≥ 0,75 et précision@10 ≥ référence + 10 points (H22). »

---

## 12. Interfaces et composants

### 12.1 Arborescence
```
bluemove-recharge/
├─ README.md                      # installation, scripts, avertissement données simulées
├─ docs/                          # les six documents de conception
├─ config/hypotheses.json
├─ sim/generate.py · sim/requirements.txt
├─ ml/train_depletion.py · ml/report.md
├─ data/generated/ · data/scenarios/*.json · data/model/depletion_model_v1.json
├─ supabase/migrations/001_schema.sql · 002_rls.sql
├─ scripts/load-supabase.ts
├─ src/app/
│  ├─ layout.tsx                  # bandeau DONNÉES SIMULÉES, navigation
│  ├─ page.tsx                    # tableau de bord
│  ├─ runs/[id]/page.tsx          # résultat
│  ├─ runs/[id]/agent/[k]/page.tsx
│  ├─ historique/page.tsx
│  ├─ methode/page.tsx
│  └─ api/… (cf. ARCHITECTURE §2.3)
├─ src/lib/engine/
│  ├─ types.ts · config.ts · geo.ts (haversine, zones) · time.ts (UTC ↔ Europe/Paris)
│  ├─ validate.ts · demand.ts · priority.ts · model.ts
│  ├─ baseline.ts (REF) · optimize.ts (insertion, 2-opt, échange)
│  ├─ kpis.ts · projection.ts · explain.ts · hash.ts (SHA-256 des entrées)
│  └─ run.ts                      # orchestration : validate → candidats → 3 variantes → recommandation
├─ src/lib/repo/ index.ts · supabase.ts · local.ts
├─ src/components/
│  ├─ SimulatedDataBanner.tsx · ScenarioSelector.tsx · KpiTiles.tsx · ZoneDeficitBars.tsx
│  ├─ FleetMap.tsx · RouteMap.tsx (react-leaflet, chargement dynamique sans SSR)
│  ├─ ParamsPanel.tsx · PriorityTable.tsx · QualityTable.tsx · MaintenanceList.tsx
│  ├─ VariantTabs.tsx · RouteTimeline.tsx · ComparisonTable.tsx · UnservedList.tsx
│  └─ DecisionPanel.tsx · RunHistoryTable.tsx · ModelCard.tsx
└─ tests/engine/*.test.ts         # Vitest
```

### 12.2 Pile
Next.js (App Router, TypeScript strict), React, Tailwind CSS, Leaflet + react-leaflet (tuiles OpenStreetMap, attribution affichée), `@supabase/supabase-js` et `@supabase/ssr`, Vitest. Aucune autre dépendance lourde. Couleurs de carte accompagnées d'une légende et d'un libellé (pas d'information portée par la couleur seule).

### 12.3 Variables d'environnement
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (script de chargement uniquement), `DEMO_MODE=local|supabase`. Si les variables Supabase sont absentes → `local` : lecture de `data/scenarios/*.json`, calculs en mémoire, décisions non persistées, bandeau « Mode démonstration : décisions non enregistrées », sélecteur de rôle de démonstration.

---

## 13. Architecture technique (rappel)
Next.js sur Vercel (fonctions en région UE, runtime Node), Supabase PostgreSQL et Auth en région UE, moteur TypeScript exécuté côté serveur dans `POST /api/plan-runs`, modèle lu depuis le JSON embarqué. Détails, sécurité et évolutions : `ARCHITECTURE.md`.

---

## 14. Critères d'acceptation

### 14.1 Critères fonctionnels (AC)
| ID | Critère vérifiable |
|---|---|
| AC-01 | Le bandeau « DONNÉES SIMULÉES » est visible sur toutes les pages, y compris la feuille de route imprimée. |
| AC-02 | Pour un scénario, chaque scooter (après dédoublonnage) est classé dans exactement une catégorie : accepté (candidat ou non), rejet qualité, exclusion, maintenance ; la somme égale le nombre de scooters distincts. |
| AC-03 | TC08 : chaque anomalie reçoit le code attendu (`REJ_BATTERIE_INVALIDE` ×2, `REJ_DOUBLON` ×1, `REJ_COORDONNEES` ×1, `REJ_ASSOCIATION_BATTERIE` ×1, `REJ_STATUT_INCONNU` ×1) ; aucun de ces messages ne figure dans une tournée. |
| AC-04 | TC02 : 15 `EXCL_BMS_PERIME` et 5 `EXCL_GPS_PERIME`. |
| AC-05 | TC03 : aucun scooter loué ou réservé dans une tournée ; codes `EXCL_EN_LOCATION` et `EXCL_RESERVE`. |
| AC-06 | TC09 : les 3 scooters apparaissent dans « Orientés maintenance » et dans aucune tournée. |
| AC-07 | TC06 : aucune étape dans une zone fermée. |
| AC-08 | TC10 : 4 `EXCL_HORS_ZONE`. |
| AC-09 | Pour tous les scénarios et toutes les variantes : nombre d'étapes par tournée ≤ `capacity_batteries`. |
| AC-10 | Pour tous les scénarios et toutes les variantes : durée de chaque tournée ≤ `shift_min` (retour au dépôt compris). |
| AC-11 | TC05 et TC07 : réponse 200 avec tournées vides et message « Aucune tournée admissible : … » ; jamais d'erreur 500. |
| AC-12 | Deux calculs aux entrées identiques produisent les mêmes tournées et la même `input_hash`. |
| AC-13 | SC02 avec 3 agents, utilitaire, 480 min : calcul < 5 s sur Vercel. |
| AC-14 | Chaque étape et chaque ligne du tableau des priorités affichent U, D, S, la priorité et l'explication (§7.6). |
| AC-15 | Tests unitaires de §7.4 : 90,40 et 41,15 (± 0,01). |
| AC-16 | Trois variantes affichées avec écarts vs REF ; recommandation selon §8.5 ; un test construit un cas où REF est recommandée. |
| AC-17 | Modèle absent ou ML désactivé : OPT_ML « non calculée », recommandation parmi REF et OPT_REGLE, mention visible. |
| AC-18 | Approbation réservée à `responsable_ops` (403 sinon) ; la variante passe à `approuvee`, les autres du même calcul à `non_retenue` ; décision horodatée en UTC avec auteur. |
| AC-19 | Rejet sans `reason_code` → 400. |
| AC-20 | Décision après expiration (30 min) → 409 et statut affiché `expiree`. |
| AC-21 | Chaque calcul enregistre `params`, `input_hash`, `engine_version`, `model_version`, `validation_summary`, `compute_ms`. |
| AC-22 | Un utilisateur `agent` ne voit que les variantes approuvées et ne peut rien écrire (vérifié par politique de sécurité par ligne et par test d'API). |
| AC-23 | Toutes les heures affichées sont en Europe/Paris ; toutes les heures stockées sont en UTC. |
| AC-24 | Variante sans échange : KR1, KR2, KR3 affichés « ND ». |
| AC-25 | La page Méthode affiche version, origine `SIMULATION`, métriques du modèle **et** de la référence, et l'avertissement sur la portée des métriques. |
| AC-26 | Le schéma ne contient aucune colonne d'identité client ou agent. |
| AC-27 | Sans variables Supabase, l'application fonctionne en mode local avec le bandeau dédié. |
| AC-28 | `npm test` passe ; `npm run build` passe sans erreur TypeScript. |

### 14.2 Cas de test représentatifs
| ID | Situation | Données / paramètres | Résultat attendu |
|---|---|---|---|
| T01 | Batteries faibles nombreuses | TC01, défauts | Critiques servis ≤ 24 (2 × 12) ; non servis listés « Capacité batteries atteinte » |
| T02 | Données périmées | TC02 | AC-04 |
| T03 | Scooter loué / réservé | TC03 | AC-05 |
| T04 | Contrainte de capacité | SC02, `capacity_batteries = 3` | ≤ 3 étapes par agent |
| T05 | Temps insuffisant | SC02, `shift_min = 30` | Tournées courtes ou vides, motif « Temps insuffisant » |
| T06 | Zone inaccessible | SC02, `closed_zones = ['Z-GARE']` | AC-07 |
| T07 | Aucune tournée admissible | SC02, `shift_min = 30`, `closed_zones` = toutes sauf Résidentiel (zone la plus éloignée du dépôt) | Message explicite, pas d'erreur |
| T08 | Erreur de données | TC08 | AC-03 |
| T09 | Alerte technique | TC09 | AC-06 |
| T10 | Hors zone | TC10 | AC-08 |
| T11 | ML indisponible | SC02, modèle retiré | AC-17 |
| T12 | Cohérence d'ensemble | SC01, SC02, SC03 × 3 variantes | AC-09, AC-10, AC-12 |

> T07 : si le cas n'aboutit pas à zéro tournée avec la géographie générée, réduire `shift_min` jusqu'à obtenir zéro tournée et consigner la valeur dans le test.

---

## 15. Hors périmètre (ne pas développer)
- Repositionnement de scooters, équilibrage de la flotte, scénario « collecte au dépôt ».
- Maintenance prédictive des pannes ; planification des réparations.
- Personnalisation client, données clients, trajets individuels.
- Géolocalisation ou suivi en temps réel des agents ; évaluation individuelle des agents.
- Application mobile, scan de batterie, confirmation terrain.
- Réoptimisation en cours de tournée ; fenêtres horaires par scooter ; plusieurs dépôts ; réapprovisionnement en cours de tournée.
- Matrice routière réelle, trafic, API d'itinéraire.
- Ingestion télématique, file de messages, lac et entrepôt de données, Power BI.
- Solveur externe (OR-Tools, VROOM) ; serveur de modèle ; réentraînement automatique.
- LLM, RAG, agent IA, chatbot, génération de texte.
- Commande des scooters ou de tout système externe.
- Week-ends et nuits (profil de demande non documenté).

---

## 16. Ordre de développement conseillé
1. `config/hypotheses.json`, `sim/generate.py` → scénarios et historique.
2. `ml/train_depletion.py` → modèle JSON + rapport.
3. Moteur `src/lib/engine` + tests Vitest (§7.4, §14.2) **avant** toute interface.
4. Interface en mode local (`DEMO_MODE=local`).
5. Supabase : migrations, sécurité par ligne, chargement, décisions, authentification.
6. Déploiement Vercel (région UE), vérification AC-13 et AC-22.
7. Page Méthode, feuille de route imprimable, historique.
