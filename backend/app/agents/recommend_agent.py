import os
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from app.schemas import UserProfile, DiagnosisResult, RecommendResult, ActionCard, ProductRecommendation
from app.data.mock_personas import JB_PRODUCTS


def _build_action_cards(profile: UserProfile, diagnosis: DiagnosisResult) -> list[ActionCard]:
    cards = []
    priority = 1

    if "재무" in diagnosis.risk_areas:
        if profile.job_type in ["직장인", "자영업자"]:
            monthly_add = min(300000, max(50000, (profile.monthly_income - profile.monthly_expense) // 2))
            cards.append(ActionCard(
                priority=priority,
                title="국민연금 추납 신청",
                description="납부 공백 기간을 메워 월 수령액을 늘릴 수 있습니다.",
                expected_effect=f"월 연금 수령액 최대 +12만원 증가 예상",
                category="연금",
                action_label="국민연금공단 바로가기",
            ))
            priority += 1

        if diagnosis.monthly_shortfall > 0:
            cards.append(ActionCard(
                priority=priority,
                title="노후 준비 적금 개설",
                description=f"월 {min(500000, diagnosis.monthly_shortfall):,}원 추가 저축으로 부족분 해소를 시작하세요.",
                expected_effect=f"10년 후 약 {min(500000, diagnosis.monthly_shortfall) * 120 // 10000:,}만원 추가 확보",
                category="저축",
                action_label="광주은행 노후 든든 적금 가입",
            ))
            priority += 1

    if "소비패턴" in diagnosis.risk_areas:
        cards.append(ActionCard(
            priority=priority,
            title="변동 지출 15% 절감 플랜",
            description="월 변동 지출 항목을 분석하여 절감 목표를 설정하세요.",
            expected_effect=f"월 {int(profile.monthly_expense * 0.15):,}원 절약, 연 {int(profile.monthly_expense * 0.15 * 12):,}원",
            category="지출관리",
            action_label="지출 분석 시작",
        ))
        priority += 1

    if "건강" in diagnosis.risk_areas or profile.health_issue:
        cards.append(ActionCard(
            priority=priority,
            title="의료비 리스크 헤지 보험 가입",
            description="건강 이슈가 있는 경우 실손 및 중대질병 보험으로 미래 의료비를 대비하세요.",
            expected_effect="연간 의료비 리스크 최대 2,000만원 보장",
            category="보험",
            action_label="광주은행 실버 케어 보험 상담",
        ))
        priority += 1

    if profile.real_estate_assets > 100000000 and profile.financial_assets < 30000000:
        cards.append(ActionCard(
            priority=priority,
            title="부동산 활용 유동성 확보",
            description="부동산 자산을 담보로 유동성을 확보하거나 주택연금 전환을 검토하세요.",
            expected_effect="금융 유동성 확보로 생활비 안정화",
            category="자산관리",
            action_label="JB우리캐피탈 담보대출 상담",
        ))
        priority += 1

    if profile.personal_pension == 0:
        cards.append(ActionCard(
            priority=priority,
            title="개인연금 3층 구조 완성",
            description="세액공제 혜택이 있는 개인연금 저축보험으로 3층 연금 체계를 갖추세요.",
            expected_effect="연간 최대 66만원 세금 환급 + 노후 소득 보완",
            category="연금",
            action_label="전북은행 개인연금 가입",
        ))

    return cards[:5]


def _select_products(profile: UserProfile, diagnosis: DiagnosisResult) -> list[ProductRecommendation]:
    selected = []
    for p in JB_PRODUCTS:
        if profile.risk_type in p["for_risk_types"]:
            reason = ""
            if p["type"] == "적금" and "재무" in diagnosis.risk_areas:
                reason = "재무 점수 개선을 위한 안정적 저축 수단입니다."
            elif p["type"] == "보험" and ("건강" in diagnosis.risk_areas or profile.health_issue):
                reason = "건강 리스크 대비 필수 상품입니다."
            elif p["type"] == "연금" and profile.personal_pension == 0:
                reason = "3층 연금 구조 완성을 위해 추천드립니다."
            elif p["type"] == "펀드" and "재무" in diagnosis.risk_areas:
                reason = "장기 자산 증식을 위한 투자 상품입니다."
            elif p["type"] == "대출" and profile.real_estate_assets > 100000000:
                reason = "부동산 활용 유동성 확보 수단입니다."
            else:
                reason = "고객님의 성향에 맞는 상품입니다."

            selected.append(ProductRecommendation(
                id=p["id"],
                bank=p["bank"],
                name=p["name"],
                type=p["type"],
                description=p["description"],
                rate=p["rate"],
                reason=reason,
            ))

    return selected[:3]


async def run_recommend(profile: UserProfile, diagnosis: DiagnosisResult) -> RecommendResult:
    action_cards = _build_action_cards(profile, diagnosis)
    products = _select_products(profile, diagnosis)

    return RecommendResult(
        action_cards=action_cards,
        products=products,
        disclaimer="본 추천은 정보 제공 목적이며 투자 권유가 아닙니다. 금융 의사결정 전 전문가 상담을 권장합니다. (금융소비자보호법 준수)",
    )
