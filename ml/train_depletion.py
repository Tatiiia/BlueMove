"""Entraînement du modèle de risque d'épuisement (Workshop 9, consigne E).

Cible : la charge d'un scooter actuellement entre 20 et 40 % passe sous 20 % dans les 3 h
(lignes écartées si un échange de batterie intervient dans l'intervalle : cible censurée).
Variables : charge_pct, usage_rate_6h, zone_demand_next_h, is_rain.
Découpage temporel : jours ouvrés 1–15 (apprentissage), 16–20 (test).
Référence sans ML : classement par charge croissante (« batteries les plus faibles d'abord »).

DONNÉES SIMULÉES : les métriques valident la chaîne de calcul, pas une performance réelle.
Usage : python ml/train_depletion.py   (après sim/generate.py)
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "config" / "hypotheses.json").read_text(encoding="utf-8"))
FEATURES = ["charge_pct", "usage_rate_6h", "zone_demand_next_h", "is_rain"]
K = 10
CRIT = CFG["thresholds"]["critical_pct"]
MAXE = CFG["thresholds"]["max_eligible_pct"]


def precision_at_k(df: pd.DataFrame, score_col: str, k: int = K) -> float:
    vals = []
    for _, g in df.groupby("ts_utc"):
        if len(g) < k:
            continue
        top = g.sort_values([score_col, "scooter_id"], ascending=[False, True]).head(k)
        vals.append(top["label"].mean())
    return float(np.mean(vals))


def main() -> None:
    hist = pd.read_csv(ROOT / "data" / "generated" / "history_hourly.csv")
    pop = hist[(hist["ops_status"] == "actif") & (hist["charge_pct"] >= CRIT) & (hist["charge_pct"] < MAXE)]
    n_before = len(pop)
    pop = pop[~pop["swap_within_h"]].copy()
    pop["label"] = (pop["charge_after_h"] < CRIT).astype(int)
    train = pop[pop["workday"] <= 15]
    test = pop[pop["workday"] >= 16].copy()

    scaler = StandardScaler().fit(train[FEATURES])
    clf = LogisticRegression(max_iter=1000).fit(scaler.transform(train[FEATURES]), train["label"])
    test["p"] = clf.predict_proba(scaler.transform(test[FEATURES]))[:, 1]
    test["baseline_score"] = -test["charge_pct"]

    auc = roc_auc_score(test["label"], test["p"])
    auc_base = roc_auc_score(test["label"], test["baseline_score"])
    brier = brier_score_loss(test["label"], test["p"])
    brier_prior = brier_score_loss(test["label"], np.full(len(test), train["label"].mean()))
    p10 = precision_at_k(test, "p")
    p10_base = precision_at_k(test, "baseline_score")

    deciles = test.assign(dec=pd.qcut(test["p"], 10, labels=False, duplicates="drop")).groupby("dec").agg(
        p_moyen=("p", "mean"), taux_observe=("label", "mean"), n=("label", "size"))

    model = {
        "model_id": "depletion_risk",
        "version": "1.0.0",
        "trained_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "data_origin": "SIMULATION",
        "algorithm": "logistic_regression",
        "target": "charge passe sous 20 % dans les 3 h (sans échange entre-temps)",
        "horizon_h": CFG["horizon_h"],
        "applicable_charge_range": [CRIT, MAXE],
        "features": FEATURES,
        "mean": [float(x) for x in scaler.mean_],
        "std": [float(x) for x in scaler.scale_],
        "coef": [float(x) for x in clf.coef_[0]],
        "intercept": float(clf.intercept_[0]),
        "metrics": {
            "train_period": "jours ouvrés 1 à 15",
            "test_period": "jours ouvrés 16 à 20",
            "n_train": int(len(train)), "n_test": int(len(test)),
            "positive_rate_test": float(test["label"].mean()),
            "censored_rows_removed": int(n_before - len(pop)),
            "roc_auc": float(auc), "baseline_roc_auc": float(auc_base),
            "brier": float(brier), "brier_prior_only": float(brier_prior),
            "precision_at_10": float(p10), "baseline_precision_at_10": float(p10_base),
        },
        "activation_thresholds_real_data": {"roc_auc_min": 0.75, "precision_at_10_gain_min_points": 10,
                                            "source": "H22 (DECISIONS.md)"},
        "status": "validated_on_simulation",
        "warning": "Métriques mesurées sur données simulées : elles valident la chaîne de calcul, pas une performance réelle chez BlueMove.",
    }
    out = ROOT / "data" / "model" / "depletion_model_v1.json"
    out.write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding="utf-8")

    # fixtures : contrôle croisé de l'inférence Python ↔ TypeScript
    sample = test.sample(12, random_state=7)
    fx = [{"x": [float(r[f]) for f in FEATURES], "p": float(r["p"])} for _, r in sample.iterrows()]
    (ROOT / "tests" / "fixtures" / "model_fixtures.json").write_text(json.dumps(fx, indent=1), encoding="utf-8")

    m = model["metrics"]
    report = f"""# Rapport d'entraînement — modèle de risque d'épuisement v{model['version']}

> **Données simulées.** Ces métriques valident la chaîne de calcul (préparation, découpage temporel,
> entraînement, export, inférence). Elles **ne démontrent pas** une performance réelle chez BlueMove.
> Seuils d'activation sur données réelles (H22) : AUC ≥ 0,75 et précision@10 ≥ référence + 10 points.

## Données
- Population : instantanés horaires, jours ouvrés 6 h–22 h, scooters actifs, charge entre {CRIT} et {MAXE} %.
- Cible : charge < {CRIT} % trois heures plus tard ; {m['censored_rows_removed']} lignes écartées (échange dans l'intervalle).
- Apprentissage : {m['n_train']} lignes (jours 1–15) · Test : {m['n_test']} lignes (jours 16–20) · Taux de positifs en test : {m['positive_rate_test']:.1%}.

## Résultats sur la période de test
| Métrique | Modèle | Référence sans ML |
|---|---|---|
| ROC AUC | {auc:.3f} | {auc_base:.3f} (charge croissante) |
| Score de Brier (plus bas = mieux) | {brier:.4f} | {brier_prior:.4f} (taux moyen constant) |
| Précision@10 par heure | {p10:.3f} | {p10_base:.3f} |

## Coefficients (variables standardisées)
| Variable | Moyenne | Écart-type | Coefficient |
|---|---|---|---|
""" + "\n".join(f"| {f} | {mu:.3f} | {sd:.3f} | {c:+.3f} |" for f, mu, sd, c in
                 zip(FEATURES, model["mean"], model["std"], model["coef"])) + f"""
| (constante) | | | {model['intercept']:+.3f} |

## Calibration par décile de probabilité prédite
| Décile | Probabilité moyenne prédite | Taux observé | n |
|---|---|---|---|
""" + "\n".join(f"| {int(d) + 1} | {r.p_moyen:.3f} | {r.taux_observe:.3f} | {int(r.n)} |" for d, r in deciles.iterrows()) + """

## Limites
- Le simulateur génère la consommation à partir de l'usage et de la demande de zone ; le modèle retrouve
  cette logique. Sur le terrain, relief, température, vieillissement des batteries et comportements
  d'usage modifieront les relations.
- Le modèle ne s'applique qu'aux scooters entre 20 et 40 % ; les scooters déjà sous 20 % sont prioritaires par règle.
"""
    (ROOT / "ml" / "report.md").write_text(report, encoding="utf-8")
    print(json.dumps(m, indent=1))
    if p10 <= p10_base:
        print("ERREUR : le modèle ne bat pas la référence sur la simulation — défaut probable de la chaîne.")
        sys.exit(1)


if __name__ == "__main__":
    main()
