import math
from app.schemas import (
    UserProfile, SimulationResult, CashFlowPoint, SimulationAssumptions,
)

# ── 최근 5년 평균 경제 지표 (2019~2024 한국 통계청 기반) ──────────────────
INFLATION_RATE = 0.032        # 소비자물가 연 3.2%
WAGE_GROWTH_RATE = 0.035      # 임금상승률 연 3.5%
MEDICAL_COST_GROWTH = 0.045   # 의료비 상승률 연 4.5%
UNCERTAINTY_RATE = 0.08       # 연간 불확실성 ±8% (1σ)
PROJECTION_YEARS = 35


async def run_simulation(profile: UserProfile) -> SimulationResult:
    data: list[CashFlowPoint] = []
    deficit_start_age = None
    deficit_months = 0

    monthly_pension = profile.national_pension_expected + profile.personal_pension

    for i in range(PROJECTION_YEARS):
        current_age = profile.age + i
        year_events: list[str] = []

        # ── 이벤트 비용: 물가상승률 반영 ────────────────────────────────
        extra_monthly_cost = 0
        for event in profile.life_events:
            if event.years_later == i:
                year_events.append(event.type)
            duration = getattr(event, 'duration_years', 4)
            if event.years_later <= i < event.years_later + duration:
                # 이벤트 비용도 물가상승률만큼 증가
                extra_monthly_cost += int(
                    event.monthly_cost * (1 + INFLATION_RATE) ** i
                )

        # ── 건강 이슈: 65세 이후 의료비 상승률 반영 ─────────────────────
        if profile.health_issue and current_age >= 65:
            years_since_65 = current_age - 65
            extra_monthly_cost += int(
                300000 * (1 + MEDICAL_COST_GROWTH) ** years_since_65
            )

        # ── 수입·지출 계산 ────────────────────────────────────────────
        if current_age < profile.retirement_target_age:
            # 은퇴 전: 소득은 임금상승률, 지출은 물가상승률로 증가
            income = int(profile.monthly_income * (1 + WAGE_GROWTH_RATE) ** i)
            base_expense = int(
                profile.monthly_expense * (1 + INFLATION_RATE) ** i
            ) + extra_monthly_cost
        else:
            # 은퇴 후: 연금은 물가연동(CPI 50% 반영), 생활비는 물가상승률
            years_retired = current_age - profile.retirement_target_age
            income = int(monthly_pension * (1 + INFLATION_RATE * 0.5) ** years_retired)
            base_expense = int(
                profile.monthly_target_living_cost * (1 + INFLATION_RATE) ** years_retired
            ) + extra_monthly_cost

        cf = income - base_expense

        # ── 신뢰구간: 연수가 길수록 불확실성 누적 ────────────────────────
        # σ = UNCERTAINTY_RATE * sqrt(i+1) → 누적 불확실성
        sigma = abs(cf) * UNCERTAINTY_RATE * math.sqrt(i + 1)
        upper = int(cf + sigma)
        lower = int(cf - sigma)

        is_deficit = cf < 0
        if is_deficit:
            deficit_months += 1
            if deficit_start_age is None:
                deficit_start_age = current_age

        data.append(CashFlowPoint(
            year=i,
            age=current_age,
            monthly_cash_flow=cf,
            upper_cash_flow=upper,
            lower_cash_flow=lower,
            is_deficit=is_deficit,
            events=year_events,
        ))

    # ── 핵심 메시지 ──────────────────────────────────────────────────
    if deficit_start_age:
        key_msg = (
            f"물가상승률(연 {INFLATION_RATE*100:.1f}%)·의료비 상승 반영 시 "
            f"{deficit_start_age}세부터 월 현금흐름이 적자로 전환됩니다. "
            f"총 {deficit_months}개월({deficit_months//12}년) 동안 부족이 예상됩니다."
        )
    else:
        key_msg = (
            f"물가상승률(연 {INFLATION_RATE*100:.1f}%)을 반영해도 "
            f"전체 기간 현금흐름이 흑자를 유지합니다. "
            f"다만 불확실성 구간 하단을 대비한 완충 자산 확보를 권장합니다."
        )

    assumptions = SimulationAssumptions(
        inflation_rate=INFLATION_RATE * 100,
        wage_growth_rate=WAGE_GROWTH_RATE * 100,
        medical_cost_growth_rate=MEDICAL_COST_GROWTH * 100,
        uncertainty_rate=UNCERTAINTY_RATE * 100,
    )

    return SimulationResult(
        data=data,
        deficit_start_age=deficit_start_age,
        total_deficit_months=deficit_months,
        key_risk_message=key_msg,
        assumptions=assumptions,
    )
