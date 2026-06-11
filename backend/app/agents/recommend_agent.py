"""
RAG 기반 맞춤 추천 Agent
1. 사용자 프로필 + 설문 점수 → 검색 쿼리 생성
2. ChromaDB에서 유사 상품 검색 (실제 + 가상 상품)
3. Claude API로 최종 추천 이유 생성 및 상품 선별
"""

import os
import json
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.schemas import UserProfile, DiagnosisResult, RecommendResult, ActionCard, ProductRecommendation
from app.rag.product_store import search_products


# ── 액션카드 생성 ────────────────────────────────────────────

def _build_action_cards(
    profile: UserProfile,
    diagnosis: DiagnosisResult,
    survey_scores: dict,
) -> list[ActionCard]:
    cards = []
    priority = 1

    # 재무 취약 (설문 60점 미만 또는 진단 위험 영역)
    finance_score = survey_scores.get("finance", 100)
    if finance_score < 60 or "재무" in diagnosis.risk_areas:
        if profile.national_pension_expected == 0 and profile.job_type in ["직장인", "자영업자"]:
            cards.append(ActionCard(
                priority=priority,
                title="국민연금 납부이력 점검",
                description="납부 공백 기간을 확인하고 추납 신청으로 월 수령액을 늘리세요.",
                expected_effect="월 연금 수령액 최대 +12만 원 증가 예상",
                category="연금",
                action_label="국민연금공단 바로가기",
            ))
            priority += 1

        if diagnosis.monthly_shortfall > 0:
            save_amt = min(500_000, diagnosis.monthly_shortfall)
            cards.append(ActionCard(
                priority=priority,
                title="노후 준비 적금 개설",
                description=f"월 {save_amt:,}원 추가 저축으로 노후 부족분 해소를 시작하세요.",
                expected_effect=f"10년 후 약 {save_amt * 120 // 10_000:,}만 원 추가 확보",
                category="저축",
                action_label="JB 적금 상품 보기",
            ))
            priority += 1

        if profile.personal_pension == 0:
            cards.append(ActionCard(
                priority=priority,
                title="개인연금 3층 구조 완성",
                description="세액공제 혜택이 있는 IRP·연금저축으로 3층 연금 체계를 갖추세요.",
                expected_effect="연간 최대 66만 원 세금 환급 + 노후 소득 보완",
                category="연금",
                action_label="IRP·연금저축 상품 보기",
            ))
            priority += 1

    # 건강 취약 (설문 60점 미만)
    health_score = survey_scores.get("health", 100)
    if health_score < 60 or profile.health_issue:
        cards.append(ActionCard(
            priority=priority,
            title="노후 의료비 리스크 대비",
            description="실손보험 및 중대질병 보험으로 예상치 못한 의료비를 대비하세요.",
            expected_effect="연간 의료비 리스크 최대 2,000만 원 보장",
            category="보험",
            action_label="건강보험 상품 보기",
        ))
        priority += 1

    # 여가활동 취약 (설문 60점 미만)
    leisure_score = survey_scores.get("leisure", 100)
    if leisure_score < 60:
        cards.append(ActionCard(
            priority=priority,
            title="노후 여가 목적 자금 마련",
            description="여행·취미·문화활동을 위한 전용 적립 계좌를 개설하세요.",
            expected_effect="노후 여가 활동의 경제적 기반 확보",
            category="저축",
            action_label="여가 목적 적금 보기",
        ))
        priority += 1

    # 대인관계 취약 (설문 60점 미만)
    relation_score = survey_scores.get("relation", 100)
    if relation_score < 60:
        cards.append(ActionCard(
            priority=priority,
            title="가족·사회 연계 자산 준비",
            description="가족신탁 또는 사회활동 지원 금융 상품으로 관계망을 금융적으로 뒷받침하세요.",
            expected_effect="배우자·자녀 지원 및 사회활동 비용 안정화",
            category="신탁",
            action_label="가족 연계 상품 보기",
        ))
        priority += 1

    # 부동산 활용
    if profile.real_estate_assets > 100_000_000 and profile.financial_assets < 30_000_000:
        cards.append(ActionCard(
            priority=priority,
            title="부동산 활용 유동성 확보",
            description="부동산 자산을 담보로 유동성을 확보하거나 주택연금 전환을 검토하세요.",
            expected_effect="금융 유동성 확보로 생활비 안정화",
            category="자산관리",
            action_label="담보대출·주택연금 상담",
        ))
        priority += 1

    return cards[:5]


# ── RAG 기반 상품 추천 ───────────────────────────────────────

def _build_search_query(profile: UserProfile, diagnosis: DiagnosisResult, survey_scores: dict) -> str:
    """사용자 상황을 자연어 쿼리로 변환."""
    parts = []

    parts.append(f"만 {profile.age}세 {profile.job_type}")

    weak_areas = []
    if survey_scores.get("finance", 100) < 60:
        weak_areas.append("재무")
    if survey_scores.get("health", 100) < 60:
        weak_areas.append("건강")
    if survey_scores.get("leisure", 100) < 60:
        weak_areas.append("여가활동")
    if survey_scores.get("relation", 100) < 60:
        weak_areas.append("대인관계")

    if weak_areas:
        parts.append(f"노후 준비 취약 영역: {', '.join(weak_areas)}")

    parts.append(f"리스크 성향: {profile.risk_type}")

    if profile.personal_pension == 0:
        parts.append("개인연금 미가입")
    if profile.health_issue:
        parts.append("건강 이슈 있음")
    if diagnosis.monthly_shortfall > 0:
        parts.append(f"월 {diagnosis.monthly_shortfall:,}원 노후 자금 부족")

    return " / ".join(parts)


async def _rag_select_products(
    profile: UserProfile,
    diagnosis: DiagnosisResult,
    survey_scores: dict,
) -> list[ProductRecommendation]:
    """RAG 검색 후 Claude로 최적 상품 3개 선별."""

    query = _build_search_query(profile, diagnosis, survey_scores)

    # 실제 상품 + 가상 상품 각각 검색
    real_docs = search_products(query, k=6, filter_virtual=False)
    virtual_docs = search_products(query, k=4, filter_virtual=True)
    all_docs = real_docs + virtual_docs

    if not all_docs:
        return []

    # 상품 컨텍스트 구성
    products_context = []
    for doc in all_docs:
        m = doc.metadata
        products_context.append({
            "id": m.get("product_id", ""),
            "name": m.get("name", ""),
            "bank": m.get("bank", ""),
            "category": m.get("category", ""),
            "area": m.get("area", ""),
            "is_virtual": m.get("is_virtual", False),
            "content": doc.page_content[:600],
        })

    # Claude에 최적 상품 3개 선별 요청
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY 또는 ANTHROPIC_AUTH_TOKEN 환경변수가 설정되지 않았습니다.")
    base_url = os.getenv("ANTHROPIC_BASE_URL")
    llm_kwargs = dict(model="claude-sonnet-4-6", api_key=api_key, max_tokens=1500)
    if base_url:
        llm_kwargs["base_url"] = base_url
    llm = ChatAnthropic(**llm_kwargs)

    system_prompt = """당신은 JB금융그룹의 노후 준비 전문 금융 상담사입니다.
고객의 상황을 분석하고 가장 적합한 금융 상품 3개를 선별하여 JSON 형식으로 반환하세요.

반환 형식 (반드시 JSON 배열만 반환):
[
  {
    "id": "상품 id",
    "name": "상품명",
    "bank": "은행명",
    "type": "상품유형(적금/예금/펀드/보험/신탁/대출/연금 중 하나)",
    "description": "상품 핵심 특징 1~2줄",
    "rate": "금리 또는 수익률 정보 (없으면 '상담 필요')",
    "reason": "이 고객에게 추천하는 이유 2~3줄",
    "is_virtual": true 또는 false,
    "area": "재무/건강/여가활동/대인관계 중 하나"
  }
]

주의:
- 가상 상품(is_virtual: true)은 실제 존재하지 않으므로 추천 이유에 반드시 "현재 기획 단계의 상품"임을 명시
- 실제 상품과 가상 상품을 고루 섞어 추천 (가상 상품 1~2개 포함)
- 고객의 취약 영역과 직접 관련된 상품 우선 추천"""

    user_message = f"""고객 정보:
{query}

월 부족액: {diagnosis.monthly_shortfall:,}원
위험 영역: {', '.join(diagnosis.risk_areas) if diagnosis.risk_areas else '없음'}

검색된 후보 상품 목록:
{json.dumps(products_context, ensure_ascii=False, indent=2)}

위 고객에게 가장 적합한 상품 3개를 선별하여 JSON 배열로만 반환하세요."""

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ])
        raw = response.content.strip()

        # JSON 파싱
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        selected = json.loads(raw.strip())

        return [
            ProductRecommendation(
                id=p.get("id", ""),
                bank=p.get("bank", ""),
                name=p.get("name", ""),
                type=p.get("type", ""),
                description=p.get("description", ""),
                rate=p.get("rate", "상담 필요"),
                reason=p.get("reason", ""),
                is_virtual=p.get("is_virtual", False),
                area=p.get("area"),
            )
            for p in selected[:3]
        ]

    except Exception as _e:
        import traceback; traceback.print_exc()
        # 폴백: RAG 결과 상위 3개를 그대로 반환
        fallback = []
        for doc in all_docs[:3]:
            m = doc.metadata
            fallback.append(ProductRecommendation(
                id=m.get("product_id", ""),
                bank=m.get("bank", ""),
                name=m.get("name", ""),
                type=m.get("category", ""),
                description=doc.page_content[:120],
                rate="상담 필요",
                reason="고객님의 노후 준비 상황에 적합한 상품입니다.",
                is_virtual=m.get("is_virtual", False),
                area=m.get("area"),
            ))
        return fallback


# ── 메인 엔트리포인트 ────────────────────────────────────────

async def run_recommend(
    profile: UserProfile,
    diagnosis: DiagnosisResult,
    survey_scores: dict | None = None,
) -> RecommendResult:
    if survey_scores is None:
        survey_scores = {}

    action_cards = _build_action_cards(profile, diagnosis, survey_scores)
    products = await _rag_select_products(profile, diagnosis, survey_scores)

    return RecommendResult(
        action_cards=action_cards,
        products=products,
        disclaimer=(
            "본 추천은 정보 제공 목적이며 투자 권유가 아닙니다. "
            "금융 의사결정 전 전문가 상담을 권장합니다. (금융소비자보호법 준수) "
            "⚠️ [가상상품]은 현재 출시되지 않은 기획 단계 상품입니다."
        ),
    )
