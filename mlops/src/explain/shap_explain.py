"""
SHAP 기반 모델 설명
입력: models/{target}_best.pkl, data/processed/naro_features.csv
출력: reports/shap_{target}_summary.png  (전체 피처 중요도)
      reports/shap_{target}_bar.png       (상위 10개 바 차트)
      reports/shap_importance.csv         (피처 중요도 수치)
"""

import yaml
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import shap
from pathlib import Path

BASE_DIR      = Path(__file__).resolve().parents[2]
PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODELS_DIR    = BASE_DIR / "models"
REPORTS_DIR   = BASE_DIR / "reports"

_params = yaml.safe_load((BASE_DIR / "params.yaml").read_text(encoding="utf-8"))
P = _params["explain"]

TARGET_COLUMNS = ["finance_score", "health_score", "leisure_score", "relation_score"]

# 피처명 한글 레이블
FEATURE_LABELS = {
    "sex":                  "성별",
    "w23age":               "나이",
    "w23mar":               "혼인상태",
    "w23edu":               "교육수준",
    "w23inc":               "개인 연소득",
    "w23din":               "가처분소득",
    "w23exp":               "연간 지출",
    "hd001b":               "가구 총소득",
    "hdin":                 "가구 가처분소득",
    "he001b":               "총자산",
    "he002b":               "금융자산",
    "he003b":               "부동산자산",
    "p23d001":              "공적연금 가입여부",
    "p23d002":              "공적연금 수령액",
    "p23e001":              "개인연금 가입여부",
    "has_public_pension":   "공적연금 보유",
    "has_private_pension":  "개인연금 보유",
    "is_receiving_pension": "연금 수령중",
    "pension_count":        "연금 종류수",
    "is_retired":           "은퇴여부",
    "last_job_income":      "최근 근로소득",
    "total_work_months":    "총 근무월수",
    "job_count":            "일자리 이력수",
    "p23c003":              "개인 최소 노후생활비",
    "p23c004":              "개인 적정 노후생활비",
    "p23c023":              "여가활동 빈도",
    "p23c024":              "여가활동 유형수",
    "p23c025":              "여가활동 만족도",
    "p23c027":              "문화활동 일수",
    "p23c028":              "스포츠활동 일수",
    "p23c029":              "취미활동 일수",
    "p23c030":              "관광활동 일수",
    "p23c031":              "사교활동 일수",
    "p23c032":              "기타여가 일수",
}

TARGET_LABELS = {
    "finance_score":  "재무",
    "health_score":   "건강",
    "leisure_score":  "여가활동",
    "relation_score": "대인관계",
}


def _get_font():
    """시스템에서 한글 폰트 탐색."""
    candidates = [
        "Malgun Gothic", "NanumGothic", "AppleGothic",
        "NotoSansCJK-Regular", "Noto Sans KR",
    ]
    available = {f.name for f in fm.fontManager.ttflist}
    for name in candidates:
        if name in available:
            return name
    return None


def _rename_features(feature_names: list[str]) -> list[str]:
    return [FEATURE_LABELS.get(f, f) for f in feature_names]


def explain_target(target: str, X: pd.DataFrame):
    model_path = MODELS_DIR / f"{target}_best.pkl"
    if not model_path.exists():
        print(f"  모델 없음: {model_path.name} — 건너뜀")
        return None

    bundle = joblib.load(model_path)
    model  = bundle["model"]
    model_name = bundle["name"]
    features = bundle["features"]

    # 모델에서 사용한 피처만
    X_t = X[[f for f in features if f in X.columns]].fillna(X.mean())

    # 샘플 수 제한 (SHAP 계산 속도)
    sample_n = min(P["sample_n"], len(X_t))
    X_sample = X_t.sample(n=sample_n, random_state=42)

    print(f"  {target} ({model_name}): SHAP 계산 중... (샘플 {sample_n:,}명)")

    # XGBoost → TreeExplainer, RF Pipeline → 내부 모델 추출
    if model_name == "XGBoost":
        explainer = shap.TreeExplainer(model)
        shap_vals = explainer.shap_values(X_sample)
    else:
        # RandomForest는 Pipeline 내부 모델 추출
        rf_model = model.named_steps["model"]
        X_scaled = model.named_steps["scaler"].transform(X_sample)
        X_scaled_df = pd.DataFrame(X_scaled, columns=X_sample.columns)
        explainer = shap.TreeExplainer(rf_model)
        shap_vals = explainer.shap_values(X_scaled_df)
        X_sample = X_scaled_df  # 시각화에 스케일된 값 사용

    # 피처 중요도 (mean |SHAP|)
    importance = pd.DataFrame({
        "feature": X_sample.columns,
        "feature_kr": _rename_features(list(X_sample.columns)),
        "mean_abs_shap": np.abs(shap_vals).mean(axis=0),
    }).sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)
    importance["target"] = target
    importance["rank"] = importance.index + 1

    # ── 시각화 ──────────────────────────────────────────────────
    font_name = _get_font()
    if font_name:
        plt.rcParams["font.family"] = font_name
    plt.rcParams["axes.unicode_minus"] = False

    target_kr = TARGET_LABELS.get(target, target)

    # 1) Beeswarm summary plot (상위 top_n개)
    top_n = P["top_n"]
    top15_idx = importance.head(top_n).index.tolist()
    top15_features = importance.head(top_n)["feature"].tolist()
    top15_labels   = importance.head(top_n)["feature_kr"].tolist()

    fig, ax = plt.subplots(figsize=(10, 6))
    shap.summary_plot(
        shap_vals[:, top15_idx],
        X_sample.iloc[:, top15_idx],
        feature_names=top15_labels,
        show=False,
        plot_size=None,
    )
    plt.title(f"[{target_kr}] SHAP 피처 영향도 (상위 {top_n}개)", fontsize=13, pad=12)
    plt.tight_layout()
    out = REPORTS_DIR / f"shap_{target}_summary.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"    저장: {out.name}")

    # 2) 바 차트 (상위 10개)
    top10 = importance.head(10)
    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.barh(top10["feature_kr"][::-1], top10["mean_abs_shap"][::-1],
                   color="#1264D3", alpha=0.85)
    ax.set_xlabel("평균 |SHAP 값|", fontsize=11)
    ax.set_title(f"[{target_kr}] 노후 준비 점수에 영향을 주는 요인 Top 10",
                 fontsize=12, pad=10)
    ax.bar_label(bars, fmt="%.2f", padding=3, fontsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    out_bar = REPORTS_DIR / f"shap_{target}_bar.png"
    plt.savefig(out_bar, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"    저장: {out_bar.name}")

    return importance


def main():
    print("=" * 55)
    print("  NaRo SHAP 설명 생성 시작")
    print("=" * 55)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(PROCESSED_DIR / "naro_features.csv")
    X  = df.drop(columns=["pid"] + TARGET_COLUMNS, errors="ignore")

    all_importance = []
    for target in TARGET_COLUMNS:
        print(f"\n[{TARGET_LABELS.get(target, target)}]")
        imp = explain_target(target, X)
        if imp is not None:
            all_importance.append(imp)

    # 전체 피처 중요도 통합 저장
    if all_importance:
        combined = pd.concat(all_importance, ignore_index=True)
        out_csv = REPORTS_DIR / "shap_importance.csv"
        combined.to_csv(out_csv, index=False, encoding="utf-8")
        print(f"\n피처 중요도 저장: {out_csv.name}")

        # 영역별 Top 5 요약 출력
        print("\n" + "=" * 55)
        print("  영역별 Top 5 영향 요인")
        print("=" * 55)
        for target in TARGET_COLUMNS:
            sub = combined[combined["target"] == target].head(5)
            target_kr = TARGET_LABELS.get(target, target)
            print(f"\n  [{target_kr}]")
            for _, row in sub.iterrows():
                print(f"    {int(row['rank']):2d}. {row['feature_kr']:16s}  SHAP={row['mean_abs_shap']:.3f}")

    print("\nSHAP 설명 완료!")


if __name__ == "__main__":
    main()
