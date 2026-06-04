import os
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from app.schemas import UserProfile, DiagnosisResult, SpendingInsight
from app.data.mock_personas import PEER_AVERAGE_SCORES, PEER_SPENDING_AVERAGE


def _calc_spending_insights(profile: UserProfile) -> tuple[list[SpendingInsight], int, int]:
    insights = []
    avg_savings = 0
    total_premium = 0

    age_key = str(min(58, (profile.age // 5) * 5)) if profile.age >= 55 else "55"
    peer_spending = PEER_SPENDING_AVERAGE.get(age_key, PEER_SPENDING_AVERAGE["55"])

    if profile.spending_categories:
        for cat, amount in profile.spending_categories.items():
            if cat in peer_spending:
                peer_avg = peer_spending[cat]
                diff_pct = round((amount - peer_avg) / peer_avg * 100, 1)
                insights.append(SpendingInsight(
                    category=cat, amount=amount,
                    peer_avg=peer_avg, diff_pct=diff_pct,
                ))

    if profile.monthly_savings_trend:
        avg_savings = int(sum(profile.monthly_savings_trend) / len(profile.monthly_savings_trend))

    if profile.insurance:
        total_premium = sum(i.monthly_premium for i in profile.insurance)

    return insights, avg_savings, total_premium


def _calculate_scores(profile: UserProfile) -> dict:
    monthly_pension = profile.national_pension_expected + profile.personal_pension
    retirement_fund = profile.retirement_pension
    net_assets = profile.financial_assets + profile.real_estate_assets - profile.liabilities
    target_years = max(25, 85 - profile.retirement_target_age)
    needed_total = profile.monthly_target_living_cost * 12 * target_years
    expected_pension_total = monthly_pension * 12 * target_years
    expected_total = net_assets + retirement_fund + expected_pension_total
    asset_gap = max(0, needed_total - expected_total)
    monthly_shortfall = max(0, profile.monthly_target_living_cost - monthly_pension)

    # 재무 점수
    finance_raw = 0
    if net_assets > 0:
        finance_raw += min(40, net_assets / needed_total * 40)
    if retirement_fund > 0:
        finance_raw += min(20, retirement_fund / (profile.monthly_target_living_cost * 12 * 5) * 20)
    if monthly_pension > profile.monthly_target_living_cost * 0.5:
        finance_raw += 20
    elif monthly_pension > 0:
        finance_raw += 10
    savings_rate = max(0, profile.monthly_income - profile.monthly_expense) / max(1, profile.monthly_income)
    finance_raw += min(20, savings_rate * 40)
    finance_score = max(10, min(100, int(finance_raw)))

    # 생애이벤트 점수
    total_event_cost = sum(e.monthly_cost for e in profile.life_events)
    event_burden_ratio = total_event_cost / max(1, profile.monthly_income)
    event_score = max(20, min(100, int(100 - event_burden_ratio * 120)))

    # 소비패턴 점수 — 저축 추이 반영
    expense_ratio = profile.monthly_expense / max(1, profile.monthly_income)
    if expense_ratio < 0.6:
        consumption_score = 85
    elif expense_ratio < 0.75:
        consumption_score = 70
    elif expense_ratio < 0.9:
        consumption_score = 55
    else:
        consumption_score = 35

    # 월별 저축 추이가 있으면 변동성 반영
    if profile.monthly_savings_trend and len(profile.monthly_savings_trend) >= 6:
        trend = profile.monthly_savings_trend
        avg = sum(trend) / len(trend)
        # 평균 저축이 목표 생활비의 10% 이상이면 가점
        if avg >= profile.monthly_target_living_cost * 0.1:
            consumption_score = min(100, consumption_score + 5)
        # 저축이 불규칙하면 감점 (표준편차 높을 때)
        variance = sum((x - avg) ** 2 for x in trend) / len(trend)
        if variance ** 0.5 > avg * 0.5:
            consumption_score = max(10, consumption_score - 5)

    if profile.risk_type == "보수형":
        consumption_score = min(100, consumption_score + 5)

    # 건강 점수 — 보험 가입 현황 반영
    health_score = 45 if profile.health_issue else 75
    if profile.insurance:
        has_medical = any("실손" in i.name or "의료" in i.name for i in profile.insurance)
        has_critical = any("암" in i.name or "중대" in i.name or "뇌" in i.name for i in profile.insurance)
        if has_medical:
            health_score = min(100, health_score + 8)
        if has_critical:
            health_score = min(100, health_score + 7)

    total_score = int(
        finance_score * 0.40
        + event_score * 0.25
        + consumption_score * 0.20
        + health_score * 0.15
    )

    age_key = str(min(60, (profile.age // 5) * 5))
    peer = PEER_AVERAGE_SCORES.get(age_key, PEER_AVERAGE_SCORES["55"])
    if total_score >= peer["total"] + 5:
        peer_comparison = "평균보다 높음"
    elif total_score <= peer["total"] - 5:
        peer_comparison = "평균보다 낮음"
    else:
        peer_comparison = "평균"

    risk_areas = []
    if finance_score < 50:
        risk_areas.append("재무")
    if event_score < 50:
        risk_areas.append("생애이벤트")
    if consumption_score < 50:
        risk_areas.append("소비패턴")
    if health_score < 50:
        risk_areas.append("건강")

    return {
        "total_score": total_score,
        "finance_score": finance_score,
        "event_score": event_score,
        "consumption_score": consumption_score,
        "health_score": health_score,
        "asset_gap": int(asset_gap),
        "monthly_shortfall": int(monthly_shortfall),
        "peer_comparison": peer_comparison,
        "risk_areas": risk_areas,
    }


async def run_diagnosis(profile: UserProfile) -> DiagnosisResult:
    scores = _calculate_scores(profile)
    spending_insights, avg_savings, total_premium = _calc_spending_insights(profile)

    api_key = os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        summary = _fallback_summary(profile, scores)
        return DiagnosisResult(
            **scores, summary=summary,
            spending_insights=spending_insights or None,
            avg_monthly_savings=avg_savings or None,
            total_insurance_premium=total_premium or None,
        )

    try:
        base_url = os.getenv("ANTHROPIC_BASE_URL")
        llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=api_key,
            max_tokens=500,
            **({"base_url": base_url} if base_url else {}),
        )

        system = SystemMessage(content="""당신은 JB금융그룹의 노후 준비 전문 AI 어드바이저입니다.
고객의 재무 진단 결과를 분석하여 핵심 메시지를 2~3문장으로 간결하게 전달합니다.
반드시 한국어로 답변하고, 수치를 포함하여 구체적으로 설명하세요.
투자 권유가 아닌 정보 제공임을 명심하세요.
중요: 마크다운 문법(**, ##, -, * 등)을 절대 사용하지 마세요. 일반 텍스트로만 작성하세요.""")

        # 소비 분석 텍스트 구성
        spending_text = ""
        if spending_insights:
            over = [f"{i.category}(+{i.diff_pct}%)" for i in spending_insights if i.diff_pct > 10]
            under = [f"{i.category}({i.diff_pct}%)" for i in spending_insights if i.diff_pct < -10]
            if over:
                spending_text += f"동연령 대비 초과 지출: {', '.join(over)}. "
            if under:
                spending_text += f"절약 항목: {', '.join(under)}. "

        savings_text = f"월 평균 저축: {avg_savings:,}원. " if avg_savings else ""
        insurance_text = f"월 보험료 합계: {total_premium:,}원. " if total_premium else ""

        event_text = ""
        if profile.life_events:
            events = [f"{e.type}(월 {e.monthly_cost:,}원, {e.years_later}년 후)" for e in profile.life_events]
            event_text = f"생애이벤트: {', '.join(events)}"

        human = HumanMessage(content=f"""
[고객 정보]
나이: {profile.age}세, 직업: {profile.job_type}, 은퇴 목표: {profile.retirement_target_age}세
월 소득: {profile.monthly_income:,}원, 월 지출: {profile.monthly_expense:,}원
순자산: {(profile.financial_assets + profile.real_estate_assets - profile.liabilities):,}원
예상 연금(월): {profile.national_pension_expected + profile.personal_pension:,}원
{event_text}
건강 이슈: {'있음' if profile.health_issue else '없음'}
{spending_text}{savings_text}{insurance_text}

[진단 결과]
종합: {scores['total_score']}점, 재무: {scores['finance_score']}점, 생애이벤트: {scores['event_score']}점,
소비패턴: {scores['consumption_score']}점, 건강: {scores['health_score']}점
동연령 비교: {scores['peer_comparison']}, 월 부족분: {scores['monthly_shortfall']:,}원
취약 영역: {', '.join(scores['risk_areas']) if scores['risk_areas'] else '없음'}

위 결과를 바탕으로 핵심 진단 요약을 2~3문장으로 작성하세요.
""")

        resp = await llm.ainvoke([system, human])
        summary = resp.content.strip()

    except Exception as e:
        print(f"[diagnosis_agent ERROR] {type(e).__name__}: {e}")
        summary = _fallback_summary(profile, scores)

    return DiagnosisResult(
        **scores, summary=summary,
        spending_insights=spending_insights or None,
        avg_monthly_savings=avg_savings or None,
        total_insurance_premium=total_premium or None,
    )


def _fallback_summary(profile: UserProfile, scores: dict) -> str:
    risk = "·".join(scores["risk_areas"]) if scores["risk_areas"] else "없음"
    return (
        f"종합 은퇴 준비 점수는 {scores['total_score']}점으로 동연령 {scores['peer_comparison']}입니다. "
        f"취약 영역은 [{risk}]이며, 월 {scores['monthly_shortfall']:,}원이 부족한 상황입니다. "
        f"지금부터 체계적인 준비를 시작하시길 권장합니다."
    )
