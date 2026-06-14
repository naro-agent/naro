"""
RAG 기반 맞춤 추천 Agent
1. 사용자 프로필 + 설문 점수 → 검색 쿼리 생성
2. ChromaDB에서 유사 상품 검색 (실제 + 가상 상품)
3. Claude API로 최종 추천 이유 생성 및 상품 선별
"""

import os
import re
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

_AREA_QUERY_KEYWORDS = {
    "finance":  "연금 적금 예금 IRP 재무 노후자금 퇴직연금",
    "health":   "건강 의료비 실버케어 질병 보험 요양",
    "leisure":  "여가 여행 문화생활 취미 액티브 시니어",
    "relation": "가족 커뮤니티 사회활동 가족신탁 대인관계",
}

_AREA_LABEL = {
    "finance": "재무", "health": "건강",
    "leisure": "여가활동", "relation": "대인관계",
}


def _clean_content(text: str) -> str:
    """마크다운 헤더·기호를 제거하고 핵심 텍스트만 추출."""
    # ### 헤더 제거
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # 구분선 제거
    text = re.sub(r"^-{3,}$", "", text, flags=re.MULTILINE)
    # 프론트매터 제거
    text = re.sub(r"^---[\s\S]*?---\n", "", text)
    # 굵게·기울임 마커 제거
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text)
    # 연속 빈 줄 정리
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _build_customer_summary(profile: UserProfile, diagnosis: DiagnosisResult, survey_scores: dict) -> str:
    parts = [f"만 {profile.age}세 {profile.job_type}, 리스크 성향: {profile.risk_type}"]
    if diagnosis.monthly_shortfall > 0:
        parts.append(f"월 {diagnosis.monthly_shortfall:,}원 노후 자금 부족")
    if profile.personal_pension == 0:
        parts.append("개인연금 미가입")
    if profile.health_issue:
        parts.append("건강 이슈 있음")
    weak = [_AREA_LABEL[k] for k in ["finance", "health", "leisure", "relation"]
            if survey_scores.get(k, 100) < 60]
    if weak:
        parts.append(f"취약 영역: {', '.join(weak)}")
    return " / ".join(parts)


async def _rag_select_products(
    profile: UserProfile,
    diagnosis: DiagnosisResult,
    survey_scores: dict,
    selected_areas: list[str] | None = None,
) -> list[ProductRecommendation]:
    """영역별 RAG 검색 후 Claude로 영역당 2개 이상 균형 추천."""

    # 선택 영역 결정 (없으면 survey_scores 키 기준)
    areas = selected_areas or [k for k in ["finance", "health", "leisure", "relation"]
                                if k in survey_scores]
    if not areas:
        areas = ["finance"]

    customer_summary = _build_customer_summary(profile, diagnosis, survey_scores)

    # 영역별 RAG 검색 — 영역마다 3개씩
    area_docs: dict[str, list] = {}
    for area_key in areas:
        label = _AREA_LABEL[area_key]
        kw = _AREA_QUERY_KEYWORDS.get(area_key, label)
        query = f"{customer_summary} / {kw}"
        docs = search_products(query, k=4, filter_virtual=None)
        # 해당 영역 docs 우선, 나머지로 보완
        area_docs[area_key] = docs

    # 전체 후보 풀 구성 (중복 제거)
    seen_ids = set()
    all_docs = []
    for docs in area_docs.values():
        for doc in docs:
            pid = doc.metadata.get("product_id", "")
            if pid not in seen_ids:
                seen_ids.add(pid)
                all_docs.append(doc)

    if not all_docs:
        return []

    # 상품 컨텍스트: 마크다운 제거 후 200자
    products_context = []
    for doc in all_docs:
        m = doc.metadata
        clean = _clean_content(doc.page_content)
        products_context.append({
            "id": m.get("product_id", ""),
            "name": m.get("name", ""),
            "bank": m.get("bank", ""),
            "category": m.get("category", ""),
            "area": m.get("area", ""),
            "is_virtual": m.get("is_virtual", False),
            "content": clean[:250],
        })

    area_labels = [_AREA_LABEL[a] for a in areas]
    total_needed = max(len(areas) * 2, 5)

    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY 또는 ANTHROPIC_AUTH_TOKEN 환경변수가 설정되지 않았습니다.")
    base_url = os.getenv("ANTHROPIC_BASE_URL")
    llm_kwargs = dict(model="claude-sonnet-4-6", api_key=api_key, max_tokens=1200, timeout=120)
    if base_url:
        llm_kwargs["base_url"] = base_url
    llm = ChatAnthropic(**llm_kwargs)

    system_prompt = f"""JB금융그룹 노후 준비 상담사입니다.
고객이 선택한 진단 영역: {', '.join(area_labels)}

아래 규칙을 반드시 지켜 JSON 배열만 반환하세요.
규칙:
1. 각 영역({', '.join(area_labels)})마다 최소 2개 이상 상품 포함
2. 총 {total_needed}개 상품 선별 (중복 없이)
3. priority: 1이 가장 중요, 순서대로 번호 부여
4. description: 상품 핵심 특징을 한 문장으로 직접 작성 (마크다운 기호 금지)
5. reason: 이 고객에게 추천하는 이유를 두 문장으로 작성 (마크다운 기호 금지)
6. rate: 금리나 혜택 수치가 있으면 기재, 없으면 빈 문자열 ""
7. JSON 배열 외 다른 텍스트 출력 금지

형식:
[{{"id":"","name":"","bank":"","type":"적금|예금|펀드|보험|신탁|연금","description":"한 문장","rate":"예) 연 3.5% 또는 연 최대 148만원 세액공제","reason":"두 문장 추천 이유","is_virtual":true|false,"area":"재무|건강|여가활동|대인관계","priority":1}}]"""

    user_message = f"""고객 정보: {customer_summary}
월 부족액: {diagnosis.monthly_shortfall:,}원
위험 영역: {', '.join(diagnosis.risk_areas) if diagnosis.risk_areas else '없음'}

후보 상품 목록:
{json.dumps(products_context, ensure_ascii=False, indent=2)}

위 규칙에 따라 JSON 배열만 반환하세요."""

    def _parse_and_validate(raw: str) -> list[ProductRecommendation] | None:
        try:
            cleaned = raw.strip()
            if "```" in cleaned:
                parts = cleaned.split("```")
                cleaned = parts[1] if len(parts) > 1 else parts[0]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            parsed = json.loads(cleaned.strip())
            if not isinstance(parsed, list) or len(parsed) == 0:
                return None
            products = []
            for i, p in enumerate(sorted(parsed, key=lambda x: x.get("priority", 99)), 1):
                products.append(ProductRecommendation(
                    id=p.get("id", ""),
                    bank=p.get("bank", ""),
                    name=p.get("name", ""),
                    type=p.get("type", ""),
                    description=p.get("description", ""),
                    rate=p.get("rate", ""),
                    reason=p.get("reason", ""),
                    is_virtual=p.get("is_virtual", False),
                    area=p.get("area"),
                    priority=i,
                ))
            if all(p.name and p.reason for p in products):
                return products
            print("[recommend_agent] 검증 실패: 상품명 또는 추천이유 누락")
            return None
        except json.JSONDecodeError as e:
            print(f"[recommend_agent] JSON 파싱 오류: {e}")
            return None

    # 1차 시도
    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ])
        products = _parse_and_validate(response.content)
        if products:
            return products
        print("[recommend_agent] 1차 응답 검증 실패 → 재시도")
    except Exception as e:
        print(f"[recommend_agent] 1차 호출 오류: {e}")

    # 2차 재시도
    try:
        retry_message = (
            f"{user_message}\n\n"
            "중요: 반드시 유효한 JSON 배열만 반환하세요. "
            "[ 로 시작하고 ] 로 끝나는 JSON만 출력하세요."
        )
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=retry_message),
        ])
        products = _parse_and_validate(response.content)
        if products:
            print("[recommend_agent] 2차 재시도 성공")
            return products
        print("[recommend_agent] 2차 재시도도 검증 실패 → 폴백")
    except Exception as e:
        print(f"[recommend_agent] 2차 호출 오류: {e}")

    # 최종 폴백: RAG 결과 직접 반환
    fallback = []
    for i, doc in enumerate(all_docs[:total_needed], 1):
        m = doc.metadata
        clean = _clean_content(doc.page_content)
        fallback.append(ProductRecommendation(
            id=m.get("product_id", ""),
            bank=m.get("bank", ""),
            name=m.get("name", ""),
            type=m.get("category", ""),
            description=clean[:80],
            rate="",
            reason="고객님의 노후 준비 상황에 적합한 상품입니다.",
            is_virtual=m.get("is_virtual", False),
            area=m.get("area"),
            priority=i,
        ))
    return fallback


# ── 메인 엔트리포인트 ────────────────────────────────────────

async def run_recommend(
    profile: UserProfile,
    diagnosis: DiagnosisResult,
    survey_scores: dict | None = None,
    selected_areas: list[str] | None = None,
) -> RecommendResult:
    if survey_scores is None:
        survey_scores = {}

    action_cards = _build_action_cards(profile, diagnosis, survey_scores)
    products = await _rag_select_products(profile, diagnosis, survey_scores, selected_areas)

    return RecommendResult(
        action_cards=action_cards,
        products=products,
        disclaimer=(
            "본 추천은 정보 제공 목적이며 투자 권유가 아닙니다. "
            "금융 의사결정 전 전문가 상담을 권장합니다. (금융소비자보호법 준수) "
            "⚠️ [가상상품]은 현재 출시되지 않은 기획 단계 상품입니다."
        ),
    )
