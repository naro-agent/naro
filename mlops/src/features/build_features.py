"""
KReIS 10차 데이터 기반 Feature Engineering
입력: data/raw/*.csv
출력: data/processed/naro_features.csv
         data/processed/feature_summary.csv
         data/processed/target_distribution.csv
"""

import yaml
import pandas as pd
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
RAW_DIR  = BASE_DIR / "data" / "raw"
OUT_DIR  = BASE_DIR / "data" / "processed"

# params.yaml 로드
_params = yaml.safe_load((BASE_DIR / "params.yaml").read_text(encoding="utf-8"))
P = _params["features"]


# ─── Step 1. 데이터 로드 및 필터링 ───────────────────────────

def load_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    print("데이터 로드 중...")

    p = pd.read_csv(RAW_DIR / "kreisp10.csv", encoding="utf-8", low_memory=False)
    hp = pd.read_csv(RAW_DIR / "kreishp10.csv", encoding="utf-8", low_memory=False)
    pen = pd.read_csv(RAW_DIR / "kreispen.csv", encoding="utf-8", low_memory=False)
    job = pd.read_csv(RAW_DIR / "kreisjob.csv", encoding="utf-8", low_memory=False)

    # 10차 응답자 필터 (w23age not null)
    p = p[p["w23age"].notna()].copy()
    hp = hp[hp["age"].notna()].copy()
    pen = pen[pen["penwave"] == 10].copy()
    job = job[job["jobwave"] == 10].copy()

    print(f"  kreisp10:  {len(p):,}명")
    print(f"  kreishp10: {len(hp):,}명")
    print(f"  kreispen:  {len(pen):,}행 (10차)")
    print(f"  kreisjob:  {len(job):,}행 (10차)")
    return p, hp, pen, job


# ─── Step 2. kreispen 집계 피처 ──────────────────────────────

def agg_pension(pen: pd.DataFrame) -> pd.DataFrame:
    public_types = {10, 20, 30, 40}
    private_types = {51, 52, 53, 54}
    active = pen[pen["penstat"].isin([1, 2])]

    agg = pen.groupby("pid").apply(
        lambda g: pd.Series({
            "has_public_pension": bool(
                ((g["pentype"].isin(public_types)) & (g["penstat"].isin([1, 2]))).any()
            ),
            "has_private_pension": bool(
                ((g["pentype"].isin(private_types)) & (g["penstat"].isin([1, 2]))).any()
            ),
            "is_receiving_pension": bool((g["penstat"] == 2).any()),
            "pension_count": int((g["penstat"].isin([1, 2])).sum()),
        }),
        include_groups=False,
    ).reset_index()

    return agg


# ─── Step 3. kreisjob 집계 피처 ──────────────────────────────

def agg_job(job: pd.DataFrame, p: pd.DataFrame) -> pd.DataFrame:
    # 현재 근무 중인 일자리: j003 == -9
    # 마지막 일자리: jobseq가 가장 큰 행
    def summarize(g):
        is_retired = not (g["j003"] == -9).any()
        # jobseq가 있는 경우 가장 큰 행 = 마지막 일자리
        if "jobseq" in g.columns:
            last = g.loc[g["jobseq"].idxmax()]
        else:
            last = g.iloc[-1]
        return pd.Series({
            "is_retired": is_retired,
            "last_job_income": float(last["j020"]) if pd.notna(last["j020"]) else np.nan,
            "total_work_months": float(g["j005"].clip(lower=0).sum()),
            "job_count": len(g),
        })

    agg = job.groupby("pid").apply(summarize, include_groups=False).reset_index()
    return agg


# ─── Step 4. 전체 병합 ────────────────────────────────────────

def merge_all(
    p: pd.DataFrame,
    hp: pd.DataFrame,
    pen_agg: pd.DataFrame,
    job_agg: pd.DataFrame,
) -> pd.DataFrame:
    print("데이터 병합 중...")

    hp_cols = ["pid", "hd001b", "hdin", "he001b", "he002b", "he003b"]
    hp_sub = hp[[c for c in hp_cols if c in hp.columns]].copy()

    df = (
        p
        .merge(hp_sub, on="pid", how="left")
        .merge(pen_agg, on="pid", how="left")
        .merge(job_agg, on="pid", how="left")
    )

    # bool 피처 결측 → False
    for col in ["has_public_pension", "has_private_pension", "is_receiving_pension", "is_retired"]:
        if col in df.columns:
            df[col] = df[col].fillna(False).infer_objects(copy=False).astype(bool)

    df["pension_count"] = df["pension_count"].fillna(0).astype(int)
    df["job_count"] = df["job_count"].fillna(0).astype(int)

    print(f"  병합 결과: {len(df):,}명 × {len(df.columns)}컬럼")
    return df


# ─── Step 5. 타겟 변수 생성 (4대 영역 점수 0~100) ─────────────

def _safe_normalize(series: pd.Series, min_val: float, max_val: float) -> pd.Series:
    """min-max 정규화 → 0~100 스케일."""
    return ((series - min_val) / (max_val - min_val) * 100).clip(0, 100)


def build_targets(df: pd.DataFrame) -> pd.DataFrame:
    print("타겟 변수 생성 중...")

    # ── 재무 점수 ──────────────────────────────────────────────
    # p23c007: 노후 준비 인식 (1~6), p23c008: 충분도 (1~4)
    # 생활비 충족률: w23inc / (p23c004 * 12) — 개인 적정 노후생활비 기준
    p23c004 = pd.to_numeric(df.get("p23c004", pd.Series(dtype=float)), errors="coerce")
    w23inc = pd.to_numeric(df.get("w23inc", pd.Series(dtype=float)), errors="coerce")
    p23c007 = pd.to_numeric(df.get("p23c007", pd.Series(dtype=float)), errors="coerce")
    p23c008 = pd.to_numeric(df.get("p23c008", pd.Series(dtype=float)), errors="coerce")

    living_ratio = (w23inc / (p23c004 * 12)).clip(0, 2)  # 0~2 범위 클리핑
    living_score = (living_ratio / 2 * 100).clip(0, 100)

    awareness_score = _safe_normalize(p23c007.fillna(p23c007.median()), 1, 6)
    sufficiency_score = _safe_normalize(p23c008.fillna(p23c008.median()), 1, 4)

    components_finance = pd.DataFrame({
        "living": living_score,
        "awareness": awareness_score,
        "sufficiency": sufficiency_score,
    })
    # 결측이 많은 컬럼(c007: 74%, c008: 81%) → 해당 행에서 사용 가능한 컬럼만으로 평균
    df["finance_score"] = components_finance.mean(axis=1, skipna=True).round(1)

    # ── 건강 점수 ──────────────────────────────────────────────
    # p23k001~p23k009: 0~4 척도 (높을수록 좋음)
    health_cols = [f"p23k{str(i).zfill(3)}" for i in range(1, 10)]
    health_cols = [c for c in health_cols if c in df.columns]
    health_raw = df[health_cols].apply(pd.to_numeric, errors="coerce")
    df["health_score"] = (health_raw.mean(axis=1, skipna=True) / 4 * 100).round(1)

    # ── 여가 점수 ──────────────────────────────────────────────
    # p23c020: 여가활동 유무 (1=있음→100, 2=없음→0)
    # p23c023: 빈도 (1~6), p23c024: 유형 다양성 (1~4), p23c025: 만족도 (1~5)
    # p23c027~p23c032: 월 여가활동 일수/시간 (연속형, 결측 1%)
    def _neg9_to_nan(s): return pd.to_numeric(s, errors="coerce").replace(-9, np.nan)

    c020 = _neg9_to_nan(df.get("p23c020", pd.Series(dtype=float)))
    c023 = _neg9_to_nan(df.get("p23c023", pd.Series(dtype=float)))
    c024 = _neg9_to_nan(df.get("p23c024", pd.Series(dtype=float)))
    c025 = _neg9_to_nan(df.get("p23c025", pd.Series(dtype=float)))
    # 월 여가 참여 일수 (p23c027: 문화, p23c028: 스포츠, p23c029: 취미, p23c030: 관광, p23c031: 사교, p23c032: 기타)
    leisure_day_cols = [f"p23c{str(i).zfill(3)}" for i in range(27, 33)]
    leisure_days = df[[c for c in leisure_day_cols if c in df.columns]].apply(_neg9_to_nan)
    total_days = leisure_days.sum(axis=1, min_count=1)  # 월 총 여가활동 일수

    leisure_has  = c020.map({1: 100.0, 2: 0.0})
    leisure_freq = _safe_normalize(c023.fillna(c023.median()), 1, 6)
    leisure_type = _safe_normalize(c024.fillna(c024.median()), 1, 4)
    leisure_sat  = _safe_normalize(c025.fillna(c025.median()), 1, 5)
    # 총 여가일수: 분위수 기반 정규화 (0일→0, 상위10%→100)
    d90 = total_days.quantile(P["leisure_days_quantile"])
    leisure_days_score = (total_days / d90 * 100).clip(0, 100) if d90 > 0 else pd.Series(0.0, index=df.index)

    components_leisure = pd.DataFrame({
        "has":   leisure_has,
        "freq":  leisure_freq,
        "type":  leisure_type,
        "sat":   leisure_sat,
        "days":  leisure_days_score,
    })
    df["leisure_score"] = components_leisure.mean(axis=1, skipna=True).round(1)

    # ── 대인관계 점수 ──────────────────────────────────────────
    # p23z025: 가족관계 만족도 (1~9, -9=무응답)
    # p23z008: 자녀/지인 왕래 여부 (1=왕래, 2=비왕래, -9=무응답)
    # p23z026: 사회활동 참여 횟수 (연속형)
    # p23z027: 사회활동 참여 여부 (1=있음, 2=없음)
    # p23z028: 사회활동 만족도 (1=만족, 2=불만족)
    # p23z029: 사회활동 빈도 (1~4)
    z025 = _neg9_to_nan(df.get("p23z025", pd.Series(dtype=float)))
    z008 = _neg9_to_nan(df.get("p23z008", pd.Series(dtype=float)))
    z026 = _neg9_to_nan(df.get("p23z026", pd.Series(dtype=float)))
    z027 = _neg9_to_nan(df.get("p23z027", pd.Series(dtype=float)))
    z028 = _neg9_to_nan(df.get("p23z028", pd.Series(dtype=float)))
    z029 = _neg9_to_nan(df.get("p23z029", pd.Series(dtype=float)))

    # p23z025: 실제 범위 1~9 (높을수록 좋음)
    relation_family  = _safe_normalize(z025.fillna(z025.median()), 1, 9)
    relation_contact = z008.map({1: 100.0, 2: 0.0}).fillna(50.0)

    # 사회활동 참여 여부 (1=있음→100, 2=없음→0)
    relation_social_has = z027.map({1: 100.0, 2: 0.0}).fillna(50.0)
    # 사회활동 만족도 (1=만족→100, 2=불만족→0)
    relation_social_sat = z028.map({1: 100.0, 2: 0.0}).fillna(50.0)
    # 사회활동 빈도 (1~4, 높을수록 자주)
    relation_social_freq = _safe_normalize(z029.fillna(z029.median()), 1, 4)
    # 사회활동 횟수 (연속형, 분위수 기반)
    q90_z026 = z026.quantile(P["social_count_quantile"])
    relation_social_count = (z026 / q90_z026 * 100).clip(0, 100) if q90_z026 > 0 else pd.Series(50.0, index=df.index)
    relation_social_count = relation_social_count.fillna(50.0)

    components_relation = pd.DataFrame({
        "family":       relation_family,
        "contact":      relation_contact,
        "social_has":   relation_social_has,
        "social_sat":   relation_social_sat,
        "social_freq":  relation_social_freq,
        "social_count": relation_social_count,
    })
    df["relation_score"] = components_relation.mean(axis=1, skipna=True).round(1)

    for col in ["finance_score", "health_score", "leisure_score", "relation_score"]:
        valid = df[col].notna().sum()
        print(f"  {col}: 유효 {valid:,}명 / 평균 {df[col].mean():.1f}점")

    return df


# ─── Step 6. 입력 피처 선택 및 전처리 ────────────────────────

FEATURE_COLUMNS = [
    # 기본정보
    "sex", "w23age", "w23mar", "w23edu",
    # 재무
    "w23inc", "w23din", "w23exp",
    "hd001b", "hdin",
    "he001b", "he002b", "he003b",
    # 연금
    "p23d001", "p23d002", "p23e001",
    "has_public_pension", "has_private_pension",
    "is_receiving_pension", "pension_count",
    # 일자리
    "is_retired", "last_job_income",
    "total_work_months", "job_count",
    # 노후 인식
    "p23c003", "p23c004",
    # 여가 (추가)
    "p23c023", "p23c024", "p23c025",
    "p23c027", "p23c028", "p23c029", "p23c030", "p23c031", "p23c032",
]

TARGET_COLUMNS = ["finance_score", "health_score", "leisure_score", "relation_score"]


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    print("전처리 중...")

    # 결측치 처리: p23d002, p23d003 → 0 (미수령)
    for col in ["p23d002", "p23d003"]:
        if col in df.columns:
            df[col] = df[col].fillna(0)

    # 수치형 피처 결측 → 중앙값 대체
    num_cols = [
        c for c in FEATURE_COLUMNS
        if c in df.columns and df[c].dtype != bool
        and c not in ["has_public_pension", "has_private_pension", "is_receiving_pension", "is_retired"]
    ]
    for col in num_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        median = df[col].median()
        df[col] = df[col].fillna(median)

    # 이상치 처리: 수치형 연속변수 IQR 기준 상하위 1% 클리핑
    clip_cols = ["w23inc", "w23din", "w23exp", "hd001b", "hdin",
                 "he001b", "he002b", "he003b", "last_job_income", "total_work_months",
                 "p23c027", "p23c028", "p23c029", "p23c030", "p23c031", "p23c032"]
    for col in clip_cols:
        if col in df.columns:
            lo = df[col].quantile(P["clip_lower"])
            hi = df[col].quantile(P["clip_upper"])
            df[col] = df[col].clip(lo, hi)

    # bool → int (0/1)
    for col in ["has_public_pension", "has_private_pension", "is_receiving_pension", "is_retired"]:
        if col in df.columns:
            df[col] = df[col].astype(int)

    return df


# ─── Step 7. 출력 파일 저장 ──────────────────────────────────

def save_outputs(df: pd.DataFrame):
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    available_features = [c for c in FEATURE_COLUMNS if c in df.columns]
    available_targets = [c for c in TARGET_COLUMNS if c in df.columns]
    keep_cols = ["pid"] + available_features + available_targets

    out = df[[c for c in keep_cols if c in df.columns]].copy()
    out.to_csv(OUT_DIR / "naro_features.csv", index=False, encoding="utf-8")
    print(f"\n저장: naro_features.csv  ({len(out):,}행 × {len(out.columns)}컬럼)")

    # feature_summary.csv
    feat_df = out[available_features]
    summary = pd.DataFrame({
        "feature": available_features,
        "missing_pct": (feat_df.isna().mean() * 100).round(2).values,
        "mean": feat_df.mean().round(3).values,
        "std": feat_df.std().round(3).values,
        "min": feat_df.min().values,
        "max": feat_df.max().values,
    })
    summary.to_csv(OUT_DIR / "feature_summary.csv", index=False, encoding="utf-8")
    print(f"저장: feature_summary.csv")

    # target_distribution.csv
    tgt_df = out[available_targets]
    dist = tgt_df.describe(percentiles=[0.25, 0.5, 0.75]).T.reset_index()
    dist.columns = ["target", "count", "mean", "std", "min", "q25", "median", "q75", "max"]
    dist.to_csv(OUT_DIR / "target_distribution.csv", index=False, encoding="utf-8")
    print(f"저장: target_distribution.csv")


# ─── 메인 ────────────────────────────────────────────────────

def main():
    print("=" * 50)
    print("NaRo Feature Engineering 시작")
    print("=" * 50)

    p, hp, pen, job = load_data()

    print("\n연금 집계 중...")
    pen_agg = agg_pension(pen)
    print(f"  연금 집계: {len(pen_agg):,}명")

    print("\n일자리 집계 중...")
    job_agg = agg_job(job, p)
    print(f"  일자리 집계: {len(job_agg):,}명")

    df = merge_all(p, hp, pen_agg, job_agg)

    print("\n타겟 변수 생성 중...")
    df = build_targets(df)

    df = preprocess(df)
    save_outputs(df)

    print("\n" + "=" * 50)
    print("Feature Engineering 완료!")
    print("=" * 50)


if __name__ == "__main__":
    main()
