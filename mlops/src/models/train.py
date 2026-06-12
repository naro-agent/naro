"""
NaRo 노후 준비 점수 예측 모델 학습
입력: data/processed/naro_features.csv
출력: models/{target}_best.pkl  (4개 영역별 최적 모델)
      reports/model_performance.csv
      mlruns/                    (MLflow 실험 기록)
"""

import yaml
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

import mlflow
import mlflow.sklearn
import mlflow.xgboost

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, r2_score
from xgboost import XGBRegressor

BASE_DIR      = Path(__file__).resolve().parents[2]
PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODELS_DIR    = BASE_DIR / "models"
REPORTS_DIR   = BASE_DIR / "reports"

_params = yaml.safe_load((BASE_DIR / "params.yaml").read_text(encoding="utf-8"))
P = _params["train"]

FEATURE_COLUMNS = [
    "sex", "w23age", "w23mar", "w23edu",
    "w23inc", "w23din", "w23exp",
    "hd001b", "hdin",
    "he001b", "he002b", "he003b",
    "p23d001", "p23d002", "p23e001",
    "has_public_pension", "has_private_pension",
    "is_receiving_pension", "pension_count",
    "is_retired", "last_job_income",
    "total_work_months", "job_count",
    "p23c003", "p23c004",
]

TARGET_COLUMNS = ["finance_score", "health_score", "leisure_score", "relation_score"]

TARGET_LABELS = {
    "finance_score":  "재무",
    "health_score":   "건강",
    "leisure_score":  "여가활동",
    "relation_score": "대인관계",
}


def load_dataset() -> tuple[pd.DataFrame, pd.DataFrame]:
    df = pd.read_csv(PROCESSED_DIR / "naro_features.csv")
    features = [c for c in FEATURE_COLUMNS if c in df.columns]
    X = df[features].fillna(df[features].median())
    return X, df[[t for t in TARGET_COLUMNS if t in df.columns]]


def make_models() -> dict:
    return {
        "XGBoost": XGBRegressor(
            n_estimators=P["xgb_n_estimators"],
            max_depth=P["xgb_max_depth"],
            learning_rate=P["xgb_learning_rate"],
            subsample=P["xgb_subsample"],
            colsample_bytree=P["xgb_colsample_bytree"],
            random_state=P["random_state"],
            n_jobs=-1,
            verbosity=0,
        ),
        "RandomForest": Pipeline([
            ("scaler", StandardScaler()),
            ("model", RandomForestRegressor(
                n_estimators=P["rf_n_estimators"],
                max_depth=P["rf_max_depth"],
                min_samples_leaf=P["rf_min_samples_leaf"],
                random_state=P["random_state"],
                n_jobs=-1,
            )),
        ]),
    }


def evaluate(model, X: pd.DataFrame, y: pd.Series, cv: KFold) -> dict:
    mae_scores = -cross_val_score(model, X, y, cv=cv, scoring="neg_mean_absolute_error", n_jobs=-1)
    r2_scores  =  cross_val_score(model, X, y, cv=cv, scoring="r2",                     n_jobs=-1)
    return {
        "mae_mean": round(float(mae_scores.mean()), 3),
        "mae_std":  round(float(mae_scores.std()),  3),
        "r2_mean":  round(float(r2_scores.mean()),  3),
        "r2_std":   round(float(r2_scores.std()),   3),
    }


def train_and_select(X: pd.DataFrame, Y: pd.DataFrame) -> list[dict]:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    mlflow.set_tracking_uri(f"sqlite:///{BASE_DIR / 'mlflow.db'}")
    mlflow.set_experiment("naro-retirement-score")

    cv = KFold(n_splits=P["cv_folds"], shuffle=True, random_state=P["random_state"])
    records = []

    for target in Y.columns:
        y = Y[target].dropna()
        X_t = X.loc[y.index]
        target_kr = TARGET_LABELS.get(target, target)

        print(f"\n{'─'*40}")
        print(f"  타겟: {target} ({target_kr})  (유효 샘플: {len(y):,}명)")
        print(f"{'─'*40}")

        best_model, best_name, best_mae = None, None, float("inf")
        best_metrics = {}

        for name, model in make_models().items():
            with mlflow.start_run(run_name=f"{target_kr}_{name}"):
                # params 기록
                mlflow.log_params({
                    "target": target,
                    "model": name,
                    "cv_folds": P["cv_folds"],
                    "random_state": P["random_state"],
                    "n_samples": len(y),
                    "n_features": X_t.shape[1],
                })
                if name == "XGBoost":
                    mlflow.log_params({
                        "xgb_n_estimators":   P["xgb_n_estimators"],
                        "xgb_max_depth":      P["xgb_max_depth"],
                        "xgb_learning_rate":  P["xgb_learning_rate"],
                        "xgb_subsample":      P["xgb_subsample"],
                        "xgb_colsample_bytree": P["xgb_colsample_bytree"],
                    })
                else:
                    mlflow.log_params({
                        "rf_n_estimators":    P["rf_n_estimators"],
                        "rf_max_depth":       P["rf_max_depth"],
                        "rf_min_samples_leaf": P["rf_min_samples_leaf"],
                    })

                # CV 평가
                metrics = evaluate(model, X_t, y, cv)
                print(f"  {name:15s}  MAE={metrics['mae_mean']:.2f}±{metrics['mae_std']:.2f}"
                      f"  R²={metrics['r2_mean']:.3f}±{metrics['r2_std']:.3f}")

                # metrics 기록
                mlflow.log_metrics({
                    "cv_mae_mean": metrics["mae_mean"],
                    "cv_mae_std":  metrics["mae_std"],
                    "cv_r2_mean":  metrics["r2_mean"],
                    "cv_r2_std":   metrics["r2_std"],
                })

                # 전체 데이터로 재학습 후 train 성능 기록
                model.fit(X_t, y)
                train_pred = model.predict(X_t)
                train_mae  = mean_absolute_error(y, train_pred)
                train_r2   = r2_score(y, train_pred)
                mlflow.log_metrics({
                    "train_mae": round(train_mae, 3),
                    "train_r2":  round(train_r2, 3),
                })

                # 모델 아티팩트 기록
                if name == "XGBoost":
                    mlflow.xgboost.log_model(model, artifact_path="model")
                else:
                    mlflow.sklearn.log_model(model, artifact_path="model")

                mlflow.set_tag("is_best", "false")

            records.append({"target": target, "model": name, **metrics})

            if metrics["mae_mean"] < best_mae:
                best_mae     = metrics["mae_mean"]
                best_name    = name
                best_model   = model
                best_metrics = metrics

        # 최적 모델 pkl 저장 + best 태그 갱신
        out_path = MODELS_DIR / f"{target}_best.pkl"
        joblib.dump({"model": best_model, "name": best_name, "features": list(X_t.columns)}, out_path)

        # best run에 태그 업데이트
        runs = mlflow.search_runs(
            experiment_names=["naro-retirement-score"],
            filter_string=f"params.target = '{target}' and params.model = '{best_name}'",
            order_by=["start_time DESC"],
            max_results=1,
        )
        if not runs.empty:
            mlflow.tracking.MlflowClient().set_tag(runs.iloc[0]["run_id"], "is_best", "true")

        train_pred = best_model.predict(X_t)
        train_mae  = mean_absolute_error(y, train_pred)
        train_r2   = r2_score(y, train_pred)
        print(f"  → 최적: {best_name}  (CV MAE={best_mae:.2f})")
        print(f"     Train MAE={train_mae:.2f}  R²={train_r2:.3f}  저장: {out_path.name}")

    return records


def save_report(records: list[dict]):
    df = pd.DataFrame(records)
    path = REPORTS_DIR / "model_performance.csv"
    df.to_csv(path, index=False, encoding="utf-8")
    print(f"\n성능 리포트 저장: {path}")

    print("\n" + "=" * 60)
    print("  모델 성능 요약 (5-Fold CV)")
    print("=" * 60)
    for target in TARGET_COLUMNS:
        sub = df[df["target"] == target]
        if sub.empty:
            continue
        best = sub.loc[sub["mae_mean"].idxmin()]
        print(f"  {target:20s}  최적={best['model']:15s}"
              f"  MAE={best['mae_mean']:.2f}  R²={best['r2_mean']:.3f}")


def main():
    print("=" * 60)
    print("  NaRo 모델 학습 시작")
    print("=" * 60)

    X, Y = load_dataset()
    print(f"피처: {X.shape[1]}개  샘플: {X.shape[0]:,}명")

    records = train_and_select(X, Y)
    save_report(records)

    print("\n모델 학습 완료!")
    print(f"MLflow UI: mlflow ui --backend-store-uri sqlite:///{BASE_DIR / 'mlflow.db'}")


if __name__ == "__main__":
    main()
