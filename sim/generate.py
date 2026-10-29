"""Générateur de données SIMULÉES pour le MVP BlueMove (Workshop 9, consigne E).

Toutes les valeurs produites sont fictives et reproductibles (graine fixe dans
config/hypotheses.json). Elles ne décrivent pas l'activité réelle de BlueMove.

Sorties :
  data/generated/history_hourly.csv   historique horaire (entraînement du modèle) — non versionné
  data/scenarios/*.json + index.json  instantanés de flotte utilisés par l'application
  tests/fixtures/demand_fixtures.json valeurs de demande attendues (contrôle croisé Python ↔ TypeScript)

Usage : python sim/generate.py
"""
from __future__ import annotations

import copy
import json
import math
from datetime import datetime, timedelta, date
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "config" / "hypotheses.json").read_text(encoding="utf-8"))
TZ = ZoneInfo(CFG["timezone"])
UTC = ZoneInfo("UTC")
KM_PER_DEG = 111.32


# ---------------------------------------------------------------- géographie
def offset_to_latlng(east_km: float, north_km: float) -> tuple[float, float]:
    lat0, lng0 = CFG["city_center"]["lat"], CFG["city_center"]["lng"]
    lat = lat0 + north_km / KM_PER_DEG
    lng = lng0 + east_km / (KM_PER_DEG * math.cos(math.radians(lat0)))
    return lat, lng


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


ZONES = []
for z in CFG["zones"]:
    lat, lng = offset_to_latlng(z["offset_km"]["east"], z["offset_km"]["north"])
    ZONES.append({**z, "lat": lat, "lng": lng})
ZONE_IDS = [z["id"] for z in ZONES]


def zone_of(lat: float, lng: float) -> str | None:
    best, best_d = None, None
    for z in ZONES:
        d = haversine_km(lat, lng, z["lat"], z["lng"]) * 1000
        if d <= z["radius_m"] and (best_d is None or d < best_d):
            best, best_d = z["id"], d
    return best


def random_point_in_zone(rng: np.random.Generator, z: dict) -> tuple[float, float]:
    r_km = z["radius_m"] / 1000 * 0.95 * math.sqrt(rng.random())
    theta = rng.random() * 2 * math.pi
    east = z["offset_km"]["east"] + r_km * math.cos(theta)
    north = z["offset_km"]["north"] + r_km * math.sin(theta)
    return offset_to_latlng(east, north)


# ---------------------------------------------------------------- demande
SLOTS = CFG["demand"]["slots"]
WORKDAYS = CFG["demand"]["workdays_in_window"]


def expected_searches(zone_id: str, local_dt: datetime, horizon_h: float) -> float:
    """Recherches attendues (non mises à l'échelle) dans la zone sur [t ; t + H].
    Doit rester strictement identique à src/engine/demand.ts (testé par fixtures)."""
    h0 = local_dt.hour + local_dt.minute / 60 + local_dt.second / 3600
    h1 = h0 + horizon_h
    n = CFG["demand"]["searches_28d"][zone_id]
    total = 0.0
    for k, (a, b) in enumerate(SLOTS):
        overlap = max(0.0, min(b, h1) - max(a, h0))
        if overlap > 0:
            total += overlap * n[k] / (WORKDAYS * (b - a))
    return total


def slot_index(hour: int) -> int | None:
    for k, (a, b) in enumerate(SLOTS):
        if a <= hour < b:
            return k
    return None


# ---------------------------------------------------------------- simulation
def iso_utc(local_dt: datetime) -> str:
    return local_dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> None:
    hc = CFG["history"]
    rng = np.random.default_rng(hc["seed"])
    step_min = hc["step_min"]
    steps_per_h = 60 // step_min

    # Flotte
    scooters = []
    k = 0
    for zid, n in CFG["fleet"]["allocation"].items():
        z = next(z for z in ZONES if z["id"] == zid)
        for _ in range(n):
            k += 1
            lat, lng = random_point_in_zone(rng, z)
            scooters.append({"id": f"SCO-{k:04d}", "zone": zid, "lat": lat, "lng": lng,
                             "battery": f"BAT-{1000 + k}"})
    N = len(scooters)
    attract = rng.lognormal(0.0, 0.3, N)
    charge = rng.uniform(30, 100, N)
    next_battery = [2001]
    zone_idx = np.array([ZONE_IDS.index(s["zone"]) for s in scooters])

    # Calendrier : fenêtre de 28 jours + 3 jours de scénarios (03, 04 et 05/11/2026)
    start = datetime.fromisoformat(hc["window_start_local"]).replace(tzinfo=TZ)
    window_days = hc["calendar_days"]
    scenario_days = [date(2026, 11, 3), date(2026, 11, 4), date(2026, 11, 5)]
    total_days = window_days + len(scenario_days)
    days = [start.date() + timedelta(days=d) for d in range(total_days)]
    assert days[window_days] == scenario_days[0], "les scénarios doivent suivre la fenêtre"

    weather = {}
    for d in days:
        weather[d] = bool(rng.random() < CFG["weather"]["rain_probability"])
    weather[date(2026, 11, 3)] = False   # SC01, SC02 : temps sec
    weather[date(2026, 11, 5)] = True    # SC03 : pluie (choix de scénario)

    workday_number = {}
    w = 0
    for d in days[:window_days]:
        if d.weekday() < 5:
            w += 1
            workday_number[d] = w
    assert w == hc["simulated_workdays"], w

    n_steps = total_days * 24 * steps_per_h
    charge_start = np.zeros((n_steps, N))
    swap_at = np.zeros((n_steps, N), dtype=bool)
    trips_at = np.zeros((n_steps, N), dtype=np.int16)
    ops_status = np.array(["actif"] * N, dtype=object)
    ops_hist = np.empty((n_steps, N), dtype=object)
    swap_times = {tuple(map(int, t.split(":"))) for t in hc["baseline_swap_times_local"]}
    cons = CFG["consumption_per_trip_pct"]

    snapshots_wanted = {
        "SC01": datetime(2026, 11, 3, 6, 30, tzinfo=TZ),
        "SC02": datetime(2026, 11, 3, 16, 30, tzinfo=TZ),
        "SC03": datetime(2026, 11, 5, 12, 0, tzinfo=TZ),
    }
    bench_days = [d for d, n in workday_number.items() if n >= 16]
    for d in bench_days:
        for hh, mm in [(6, 30), (11, 30), (16, 30)]:
            snapshots_wanted[f"BM{workday_number[d]:02d}{hh:02d}"] = datetime(d.year, d.month, d.day, hh, mm, tzinfo=TZ)
    snapshots: dict[str, dict] = {}
    step_time = []

    for s in range(n_steps):
        t = start + timedelta(minutes=step_min * s)
        # heure locale « murale » (le pas reste de 30 min même au changement d'heure du 25/10)
        t = datetime(t.year, t.month, t.day, t.hour, t.minute, tzinfo=TZ)
        step_time.append(t)
        d = t.date()
        is_workday = d.weekday() < 5
        if t.hour == 0 and t.minute == 0:
            ops_status[:] = "actif"
            u = rng.random(N)
            ops_status[u < hc["daily_maintenance_rate"]] = "maintenance"
            ops_status[(u >= hc["daily_maintenance_rate"]) &
                       (u < hc["daily_maintenance_rate"] + hc["daily_out_of_service_rate"])] = "hors_service"
        # tournée d'échange de la politique historique (règle simple)
        if is_workday and (t.hour, t.minute) in swap_times:
            cand = [i for i in np.argsort(charge, kind="stable")
                    if charge[i] < CFG["thresholds"]["critical_pct"] and ops_status[i] == "actif"]
            for i in cand[: hc["baseline_swaps_per_round"]]:
                charge[i] = 100.0
                scooters[i]["battery"] = f"BAT-{next_battery[0]}"
                next_battery[0] += 1
                swap_at[s, i] = True
        charge_start[s] = charge
        ops_hist[s] = ops_status
        for name, when in snapshots_wanted.items():
            if when == t:
                snapshots[name] = {"step": s, "charge": charge.copy(), "ops": ops_status.copy(),
                                   "pos": [(sc["lat"], sc["lng"]) for sc in scooters],
                                   "battery": [sc["battery"] for sc in scooters]}
        # trajets clients
        slot = slot_index(t.hour)
        if not is_workday or slot is None:
            continue
        wf = CFG["weather"]["rain_demand_factor"] if weather[d] else 1.0
        busy = np.zeros(N, dtype=bool)
        for zi, zid in enumerate(ZONE_IDS):
            n28 = CFG["demand"]["searches_28d"][zid][slot]
            a, b = SLOTS[slot]
            lam = n28 / (WORKDAYS * (b - a)) * CFG["demand"]["scale_factor"] * wf * (step_min / 60)
            lam *= 1 - CFG["demand"]["no_offer_rate"][zid][slot]
            for _ in range(rng.poisson(lam)):
                ok = np.where((zone_idx == zi) & (charge >= CFG["thresholds"]["critical_pct"]) &
                              (ops_status == "actif") & (~busy))[0]
                if len(ok) == 0:
                    continue  # recherche sans offre
                p = attract[ok] / attract[ok].sum()
                i = int(rng.choice(ok, p=p))
                c = float(np.clip(rng.normal(cons["mean"], cons["sd"]), cons["min"], cons["max"]))
                charge[i] = max(1.0, charge[i] - c)
                busy[i] = True
                trips_at[s, i] += 1
                z = ZONES[zi]
                scooters[i]["lat"], scooters[i]["lng"] = random_point_in_zone(rng, z)

    # ------------------------------------------------ historique horaire (entraînement)
    rows = []
    look = 3 * steps_per_h
    for s, t in enumerate(step_time):
        d = t.date()
        if d not in workday_number or t.minute != 0 or not (6 <= t.hour <= 22):
            continue
        wf = CFG["weather"]["rain_demand_factor"] if weather[d] else 1.0
        usage = trips_at[max(0, s - 6 * steps_per_h): s].sum(axis=0)
        for i in range(N):
            rows.append({
                "scooter_id": scooters[i]["id"],
                "ts_utc": iso_utc(t),
                "workday": workday_number[d],
                "zone_id": scooters[i]["zone"],
                "ops_status": ops_hist[s, i],
                "charge_pct": round(float(charge_start[s, i]), 2),
                "usage_rate_6h": int(usage[i]),
                "zone_demand_next_h": round(expected_searches(scooters[i]["zone"], t, CFG["horizon_h"])
                                            * CFG["demand"]["scale_factor"] * wf, 6),
                "is_rain": int(weather[d]),
                "swap_within_h": bool(swap_at[s + 1: s + look + 1, i].any()),
                "charge_after_h": round(float(charge_start[s + look, i]), 2),
            })
    hist = pd.DataFrame(rows)
    out_gen = ROOT / "data" / "generated"
    out_gen.mkdir(parents=True, exist_ok=True)
    hist.to_csv(out_gen / "history_hourly.csv", index=False)
    (out_gen / "README.md").write_text(
        "# Données générées — SIMULATION\n\nFichiers produits par `sim/generate.py` (graine fixe). "
        "Ils ne contiennent aucune donnée réelle de BlueMove et ne doivent pas être présentés comme des observations.\n",
        encoding="utf-8")

    # ------------------------------------------------ scénarios
    out_sc = ROOT / "data" / "scenarios"
    out_sc.mkdir(parents=True, exist_ok=True)
    meta = {
        "SC01": ("Mardi 06 h 30 — prise de poste du matin", "sec",
                 "Situation nominale avant la pointe du matin (dernière tournée d'échange la veille à 14 h).",
                 "Tournées admissibles."),
        "SC02": ("Mardi 16 h 30 — avant la pointe du soir", "sec",
                 "Situation nominale ; scénario de démonstration par défaut.",
                 "Tournées admissibles ; la capacité en batteries est contraignante."),
        "SC03": ("Jeudi 12 h 00 — journée de pluie", "pluie",
                 "Demande réduite par la pluie (hypothèse H26).",
                 "Tournées admissibles."),
    }
    scen = {}
    bench = {}
    for name, snap in snapshots.items():
        when = snapshots_wanted[name]
        s = snap["step"]
        srng = np.random.default_rng(hc["seed"] + int(name[2:]))
        usage = trips_at[max(0, s - 6 * steps_per_h): s].sum(axis=0)
        last_step_trip = trips_at[s - 1] if s > 0 else np.zeros(N)
        readings = []
        for i in range(N):
            ops = snap["ops"][i]
            rental = "libre"
            if ops == "actif" and last_step_trip[i] > 0 and srng.random() < 0.5:
                rental = "en_location"
            elif ops == "actif" and snap["charge"][i] >= 20 and srng.random() < 0.015:
                rental = "reserve"
            gps_age = srng.uniform(1, 9) if rental == "en_location" else srng.uniform(5, 55)
            bms_age = srng.uniform(5, 30) if rental == "en_location" else srng.uniform(10, 290)
            lat, lng = snap["pos"][i]
            readings.append({
                "message_id": f"{name}-m-{i + 1:06d}",
                "scooter_id": scooters[i]["id"],
                "battery_id": snap["battery"][i],
                "registry_battery_id": snap["battery"][i],
                "lat": round(lat, 6), "lng": round(lng, 6),
                "gps_ts_utc": iso_utc(when - timedelta(seconds=float(gps_age))),
                "charge_pct": round(float(snap["charge"][i]), 1),
                "bms_ts_utc": iso_utc(when - timedelta(seconds=float(bms_age))),
                "bms_fault_code": None,
                "battery_temp_c": round(float(srng.normal(17, 3)), 1),
                "rental_status": rental,
                "ops_status": ops,
                "usage_rate_6h": int(usage[i]),
            })
        if name.startswith("BM"):
            bench[name] = {"id": name, "label": f"Banc d'essai {when.strftime('%d/%m %H:%M')}", "as_of_utc": iso_utc(when),
                           "weather": "pluie" if weather[when.date()] else "sec", "is_test_case": False,
                           "description": "Instant de jour ouvré 16 à 20 (hors entraînement), pour l'évaluation comparative.",
                           "expected_behavior": "—", "data_origin": "SIMULATION", "readings": readings}
            continue
        label, wx, desc, expected = meta[name]
        scen[name] = {"id": name, "label": label, "as_of_utc": iso_utc(when), "weather": wx,
                      "is_test_case": False, "description": desc, "expected_behavior": expected,
                      "data_origin": "SIMULATION", "readings": readings}

    base = scen["SC02"]
    as_of = datetime.fromisoformat(base["as_of_utc"].replace("Z", "+00:00"))

    def pick(sc, n, pred, seed):
        r = np.random.default_rng(hc["seed"] + seed)
        idx = [i for i, x in enumerate(sc["readings"]) if pred(x)]
        return [idx[j] for j in sorted(r.choice(len(idx), size=n, replace=False))]

    def free_active(x):
        return x["rental_status"] == "libre" and x["ops_status"] == "actif"

    def derive(tc, label, desc, expected):
        sc = copy.deepcopy(base)
        sc.update({"id": tc, "label": label, "description": desc, "expected_behavior": expected,
                   "is_test_case": True})
        for j, x in enumerate(sc["readings"]):
            x["message_id"] = f"{tc}-m-{j + 1:06d}"
        return sc

    tests = {}
    # TC01 — batteries faibles nombreuses
    sc = derive("TC01", "Test · batteries faibles nombreuses",
                "SC02 avec 40 scooters supplémentaires ramenés sous 20 %.",
                "Capacité contraignante : critiques non servis listés « Capacité batteries atteinte ».")
    r = np.random.default_rng(hc["seed"] + 101)
    for i in pick(sc, 40, lambda x: free_active(x) and x["charge_pct"] >= 20, 101):
        sc["readings"][i]["charge_pct"] = round(float(r.uniform(4, 19.5)), 1)
    tests["TC01"] = sc
    # TC02 — données périmées
    sc = derive("TC02", "Test · données périmées",
                "SC02 : 15 mesures batterie âgées de 45 min, 5 positions âgées de 20 min.",
                "EXCL_BMS_PERIME ×15 et EXCL_GPS_PERIME ×5.")
    chosen = pick(sc, 20, lambda x: free_active(x) and x["charge_pct"] < 40, 102)
    for i in chosen[:15]:
        sc["readings"][i]["bms_ts_utc"] = iso_utc(as_of - timedelta(minutes=45))
    for i in chosen[15:]:
        sc["readings"][i]["gps_ts_utc"] = iso_utc(as_of - timedelta(minutes=20))
    tests["TC02"] = sc
    # TC03 — scooters loués / réservés
    sc = derive("TC03", "Test · scooters loués ou réservés",
                "SC02 : 6 scooters < 20 % passés en location, 4 réservés.",
                "Aucun scooter loué ou réservé dans une tournée (EXCL_EN_LOCATION ×6, EXCL_RESERVE ×4 de plus que SC02).")
    chosen = pick(sc, 10, lambda x: free_active(x) and x["charge_pct"] < 20, 103)
    for i in chosen[:6]:
        sc["readings"][i]["rental_status"] = "en_location"
    for i in chosen[6:]:
        sc["readings"][i]["rental_status"] = "reserve"
    tests["TC03"] = sc
    # TC08 — erreurs de données
    sc = derive("TC08", "Test · erreurs de données",
                "SC02 : charge 145 %, charge −5 %, message dupliqué, position (0,0), batterie non conforme au registre, statut inconnu.",
                "REJ_BATTERIE_INVALIDE ×2, REJ_DOUBLON ×1, REJ_COORDONNEES ×1, REJ_ASSOCIATION_BATTERIE ×1, REJ_STATUT_INCONNU ×1.")
    chosen = pick(sc, 6, free_active, 108)
    rd = sc["readings"]
    rd[chosen[0]]["charge_pct"] = 145
    rd[chosen[1]]["charge_pct"] = -5
    rd[chosen[2]]["lat"], rd[chosen[2]]["lng"] = 0.0, 0.0
    rd[chosen[3]]["battery_id"] = "BAT-9999"
    rd[chosen[4]]["ops_status"] = "inconnu"
    rd.insert(chosen[5] + 1, copy.deepcopy(rd[chosen[5]]))  # doublon exact du même message
    tests["TC08"] = sc
    # TC09 — alertes techniques
    sc = derive("TC09", "Test · alertes batterie",
                "SC02 : 2 codes défaut BMS et 1 température batterie de 65 °C.",
                "MAINT_ALERTE_BMS ×2 et MAINT_TEMPERATURE ×1 ; jamais dans une tournée.")
    chosen = pick(sc, 3, lambda x: free_active(x) and x["charge_pct"] < 30, 109)
    sc["readings"][chosen[0]]["bms_fault_code"] = "BMS_E12"
    sc["readings"][chosen[1]]["bms_fault_code"] = "BMS_E07"
    sc["readings"][chosen[2]]["battery_temp_c"] = 65.0
    tests["TC09"] = sc
    # TC10 — hors zone
    sc = derive("TC10", "Test · scooters hors zone",
                "SC02 : 4 scooters déplacés hors de toute zone autorisée.",
                "EXCL_HORS_ZONE ×4.")
    outside = [(3.6, -2.6), (-4.2, 2.0), (2.9, 4.4), (-3.6, -3.1)]
    for i, (e, n) in zip(pick(sc, 4, lambda x: free_active(x) and x["charge_pct"] < 40, 110), outside):
        lat, lng = offset_to_latlng(e, n)
        assert zone_of(lat, lng) is None
        sc["readings"][i]["lat"], sc["readings"][i]["lng"] = round(lat, 6), round(lng, 6)
    tests["TC10"] = sc

    index = []
    for name, sc in list(scen.items()) + list(tests.items()):
        (out_sc / f"{name}.json").write_text(json.dumps(sc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index.append({k: sc[k] for k in ("id", "label", "as_of_utc", "weather", "is_test_case",
                                          "description", "expected_behavior")} | {"file": f"{name}.json"})
    (out_sc / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    out_bm = ROOT / "data" / "benchmark"
    out_bm.mkdir(parents=True, exist_ok=True)
    for name, sc in sorted(bench.items()):
        (out_bm / f"{name}.json").write_text(json.dumps(sc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (out_bm / "index.json").write_text(json.dumps([{"id": k, "label": v["label"], "as_of_utc": v["as_of_utc"],
        "weather": v["weather"], "file": f"{k}.json"} for k, v in sorted(bench.items())], ensure_ascii=False, indent=2), encoding="utf-8")

    # ------------------------------------------------ fixtures de contrôle croisé
    fx = []
    for zid in ZONE_IDS:
        for iso in ["2026-11-03T15:30:00Z", "2026-11-03T05:30:00Z", "2026-11-05T11:00:00Z", "2026-11-03T21:15:00Z"]:
            loc = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(TZ)
            fx.append({"zone_id": zid, "as_of_utc": iso, "horizon_h": CFG["horizon_h"],
                       "expected": expected_searches(zid, loc, CFG["horizon_h"])})
    fxdir = ROOT / "tests" / "fixtures"
    fxdir.mkdir(parents=True, exist_ok=True)
    (fxdir / "demand_fixtures.json").write_text(json.dumps(fx, indent=1), encoding="utf-8")

    # ------------------------------------------------ résumé
    for name, sc in list(scen.items()):
        ch = np.array([x["charge_pct"] for x in sc["readings"]])
        rented = sum(x["rental_status"] == "en_location" for x in sc["readings"])
        print(f"{name}: <20%={int((ch < 20).sum())}  20-40%={int(((ch >= 20) & (ch < 40)).sum())}  "
              f"en_location={rented}  maintenance={sum(x['ops_status'] != 'actif' for x in sc['readings'])}")
    print(f"historique : {len(hist)} lignes, {hist['workday'].nunique()} jours ouvrés ; "
          f"trajets/scooter/jour ouvré ≈ {trips_at.sum() / N / (w + 3):.2f}")


if __name__ == "__main__":
    main()
