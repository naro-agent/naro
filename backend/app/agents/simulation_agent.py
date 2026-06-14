import os
import math
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.schemas import (
    UserProfile, SimulationResult, CashFlowPoint, SimulationAssumptions,
)

# ── 최근 5년 평균 경제 지표 (2019~2024 한국 통계청 기반) ──────────────────
INFLATION_RATE = 0.032        # 소비자물가 연 3.2%
WAGE_GROWTH_RATE = 0.035      # 임금상승률 연 3.5%
MEDICAL_COST_GROWTH = 0.045   # 의료비 상승률 연 4.5%
UNCERTAINTY_RATE = 0.08       # 연간 불확실성 ±8% (1σ)
PROJECTION_YEARS = 35


def _run_cashflow(profile: UserProfile) -> tuple[list[CashFlowPoint], int | None, int]:
    """현금흐름 계산 (룰 기반). 데이터 포인트 + 적자 정보 반환."""
    data: list[CashFlowPoint] = []
    deficit_start_age = None
    deficit_months = 0

    monthly_pension = profile.national_pension_expected + profile.personal_pension

    for i in range(PROJECTION_YEARS):
        current_age = profile.age + i
        year_events: list[str] = []

        extra_monthly_cost = 0
        for event in profile.life_events:
            if event.years_later == i:
                year_events.append(event.type)
            duration = getattr(event, 'duration_years', 4)
            if event.years_later <= i < event.years_later + duration:
                extra_monthly_cost += int(
                    event.monthly_cost * (1 + INFLATION_RATE) ** i
                )

        if profile.health_issue and current_age >= 65:
            years_since_65 = current_age - 65
            extra_monthly_cost += int(
                300000 * (1 + MEDICAL_COST_GROWTH) ** years_since_65
            )

        if current_age < profile.retirement_target_age:
            income = int(profile.monthly_income * (1 + WAGE_GROWTH_RATE) ** i)
            base_expense = int(
                profile.monthly_expense * (1 + INFLATION_RATE) ** i
            ) + extra_monthly_cost
        else:
            years_retired = current_age - profile.retirement_target_age
            income = int(monthly_pension * (1 + INFLATION_RATE * 0.5) ** years_retired)
            base_expense = int(
                profile.monthly_target_living_cost * (1 + INFLATION_RATE) ** years_retired
            ) + extra_monthly_cost

        cf = income - base_expense
        sigma = abs(cf) * UNCERTAINTY_RATE * math.sqrt(i + 1)

        is_deficit = cf < 0
        if is_deficit:
            deficit_months += 1
            if deficit_start_age is None:
                deficit_start_age = current_age

        data.append(CashFlowPoint(
            year=i,
            age=current_age,
            monthly_cash_flow=cf,
            upper_cash_flow=int(cf + sigma),
            lower_cash_flow=int(cf - sigma),
            is_deficit=is_deficit,
            events=year_events,
        ))

    return data, deficit_start_age, deficit_months


async def _generate_ai_insight(
    profile: UserProfile,
    data: list[CashFlowPoint],
    deficit_start_age: int | None,
    deficit_months: int,
) -> str:
    """Claude가 시뮬레이션 결과를 분석해 개인화된 인사이트 생성."""
    try:
        api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")
        if not api_key:
            return ""
        base_url = os.getenv("ANTHROPIC_BASE_URL")
        llm_kwargs = dict(model="claude-sonnet-4-6", api_key=api_key, max_tokens=600)
        if base_url:
            llm_kwargs["base_url"] = base_url
        llm = ChatAnthropic(**llm_kwargs)

        retirement_cf = next(
            (p.monthly_cash_flow for p in data if p.age == profile.retirement_target_age), None
        )
        final_cf = data[-1].monthly_cash_flow if data else 0

        context = f"""고객 정보:
- 나이: {profile.age}세 / 직업: {profile.job_type}
- 은퇴 목표: {profile.retirement_target_age}세
- 월 소득: {profile.monthly_income:,}원 / 월 지출: {profile.monthly_expense:,}원
- 국민연금: {profile.national_pension_expected:,}원 / 개인연금: {profile.personal_pension:,}원
- 금융자산: {profile.financial_assets:,}원 / 부동산: {profile.real_estate_assets:,}원
- 건강 이슈: {'있음' if profile.health_issue else '없음'}
- 리스크 성향: {profile.risk_type}
- 생애이벤트: {[e.type for e in profile.life_events] or '없음'}

시뮬레이션 결과 (경제지표 반영):
- 은퇴 시점({profile.retirement_target_age}세) 월 현금흐름: {retirement_cf:,}원
- 적자 전환: {'없음' if not deficit_start_age else f'{deficit_start_age}세부터 ({deficit_months}개월간)'}
- {PROJECTION_YEARS}년 후 월 현금흐름: {final_cf:,}원"""

        messages = [
            SystemMessage(content=(
                "당신은 JB금융그룹의 노후 설계 전문가입니다. "
                "고객의 생애 현금흐름 시뮬레이션 결과를 바탕으로 "
                "핵심 리스크 1가지와 가장 시급한 행동 1가지를 "
                "따뜻하고 명확한 3~4문장으로 전달하세요. "
                "마크다운 기호(##, **, --, --- 등)를 절대 사용하지 말고 "
                "일반 텍스트로만 작성하세요. 숫자보다는 의미와 방향을 강조하세요."
            )),
            HumanMessage(content=context),
        ]

        import re

        def _clean_markdown(text: str) -> str:
            """마크다운 기호 제거."""
            text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
            text = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', text)
            text = re.sub(r'^---+$', '', text, flags=re.MULTILINE)
            text = re.sub(r'^--+', '', text, flags=re.MULTILINE)
            text = re.sub(r'^[\-\*]\s+', '', text, flags=re.MULTILINE)
            return re.sub(r'\n{3,}', '\n\n', text).strip()

        def _has_markdown(text: str) -> bool:
            return bool(re.search(r'(^#{1,6}\s|\*{2,}|^---+$|^--)', text, re.MULTILINE))

        def _is_valid_insight(text: str) -> bool:
            return len(text) >= 50 and any('가' <= c <= '힣' for c in text)

        # 1차 응답
        response = await llm.ainvoke(messages)
        insight = response.content.strip()

        # 마크다운 제거
        if _has_markdown(insight):
            print("[simulation_agent] 마크다운 감지 → 정제 시도")
            insight = _clean_markdown(insight)

        # 품질 검증 통과 시 반환
        if _is_valid_insight(insight):
            return insight

        # 2차 재시도
        print("[simulation_agent] 인사이트 품질 미달 → 재시도")
        retry_messages = [
            SystemMessage(content=(
                "당신은 JB금융그룹의 노후 설계 전문가입니다. "
                "고객의 시뮬레이션 결과에 대해 따뜻하고 명확한 3~4문장으로만 작성하세요. "
                "마크다운, 특수기호, 별표, 샵(#) 등은 절대 사용하지 마세요. "
                "순수 텍스트 문장만 작성하세요."
            )),
            HumanMessage(content=context),
        ]
        retry_response = await llm.ainvoke(retry_messages)
        retry_insight = _clean_markdown(retry_response.content.strip())
        if _is_valid_insight(retry_insight):
            print("[simulation_agent] 재시도 성공")
            return retry_insight

        print("[simulation_agent] 재시도도 미달 → 빈 문자열 반환")
        return ""

    except Exception:
        return ""


async def run_simulation(profile: UserProfile) -> SimulationResult:
    data, deficit_start_age, deficit_months = _run_cashflow(profile)

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

    ai_insight = await _generate_ai_insight(profile, data, deficit_start_age, deficit_months)

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
        ai_insight=ai_insight,
    )
