import os
import json
import uuid
from typing import AsyncGenerator
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from app.schemas import ChatRequest, ChatResponse, QuickOption

SYSTEM_PROMPT = """당신은 JB금융그룹의 나로(NaRo) 서비스 AI 어드바이저입니다.
50~60대 은퇴 준비 고객을 대상으로 친절하고 명확하게 답변합니다.

답변 가능한 범위:
- 연금(국민·퇴직·개인), 자산 관리, 부동산, 세금, 보험, 소비·저축 등 금융·재무 전반
- 노후 생활, 건강, 의료비, 생애 이벤트(자녀·부모 부양 등) 관련 고민
- 서비스 진단 결과 해석 및 추천 내용 설명
- 위 주제와 자연스럽게 연결되는 일상적인 질문

규칙:
1. 반드시 한국어로 답변하세요.
2. 금융 수치는 구체적으로 언급하세요.
3. 투자 권유가 아닌 정보 제공임을 명심하세요.
4. 답변은 3~5문장으로 간결하게 유지하세요.
5. 고령 친화적 언어를 사용하세요 (쉬운 단어, 명확한 설명).
6. 모르는 내용은 "전문 상담사와 상담을 권장합니다"라고 안내하세요.
7. 금융·노후와 전혀 무관한 질문은 부드럽게 본 주제로 안내하세요."""

# ── 프로액티브 질문 흐름 정의 ──
PROACTIVE_FLOW = [
    {
        "step": 1,
        "question": "안녕하세요! 노후 준비 상담을 시작하겠습니다 😊\n\n은퇴 후 가장 걱정되시는 것이 무엇인가요?",
        "options": [
            {"label": "생활비가 부족할 것 같다", "value": "생활비_걱정"},
            {"label": "건강·의료비가 걱정된다", "value": "건강_걱정"},
            {"label": "자녀에게 짐이 될까 봐 걱정된다", "value": "자녀_걱정"},
            {"label": "아직 은퇴가 먼 것 같아 잘 모르겠다", "value": "모름"},
        ],
    },
    {
        "step": 2,
        "question": "현재 국민연금 외에 따로 준비하고 계신 노후 자금이 있으신가요?",
        "options": [
            {"label": "퇴직연금(IRP)을 가입 중이다", "value": "irp_있음"},
            {"label": "개인연금을 납입 중이다", "value": "개인연금_있음"},
            {"label": "별도로 준비한 것이 없다", "value": "준비_없음"},
            {"label": "부동산이 있어 활용할 계획이다", "value": "부동산_활용"},
        ],
    },
    {
        "step": 3,
        "question": "은퇴 후 한 달에 얼마 정도의 생활비가 필요하다고 생각하시나요?",
        "options": [
            {"label": "150만원 이하", "value": "150만원_이하"},
            {"label": "150~250만원", "value": "150_250만원"},
            {"label": "250~350만원", "value": "250_350만원"},
            {"label": "350만원 이상", "value": "350만원_이상"},
        ],
    },
    {
        "step": 4,
        "question": "현재 건강 관련 보험(실손·암보험 등)에 가입되어 계신가요?",
        "options": [
            {"label": "실손보험이 있다", "value": "실손_있음"},
            {"label": "암·중대질병 보험도 있다", "value": "중대질병_있음"},
            {"label": "보험이 거의 없다", "value": "보험_없음"},
            {"label": "잘 모르겠다", "value": "보험_모름"},
        ],
    },
    {
        "step": 5,
        "question": "마지막으로, 앞으로 예상되는 큰 지출 이벤트가 있으신가요?",
        "options": [
            {"label": "자녀 학비·결혼 비용이 있다", "value": "자녀_비용"},
            {"label": "부모님 부양 비용이 예상된다", "value": "부양_비용"},
            {"label": "주택 구입·이사 계획이 있다", "value": "주택_비용"},
            {"label": "특별히 없다", "value": "이벤트_없음"},
        ],
    },
]


def _get_proactive_step(history: list[dict]) -> int:
    proactive_answers = [h for h in history if h.get("proactive_step", 0) > 0]
    return len(proactive_answers) + 1


def _build_proactive_summary(history: list[dict]) -> str:
    answers = [h for h in history if h.get("role") == "user" and h.get("proactive_step", 0) > 0]
    if not answers:
        return ""
    lines = ["[사용자 응답 요약]"]
    step_labels = {
        1: "주요 걱정", 2: "노후 자금 준비 현황",
        3: "목표 월 생활비", 4: "보험 현황", 5: "예상 지출 이벤트",
    }
    for a in answers:
        step = a.get("proactive_step", 0)
        label = step_labels.get(step, f"질문 {step}")
        lines.append(f"- {label}: {a['content']}")
    return "\n".join(lines)


def _build_context(req: ChatRequest) -> str:
    context = ""
    if req.profile:
        p = req.profile
        context += f"\n[고객 정보] {p.age}세 {p.job_type}, 은퇴 목표: {p.retirement_target_age}세"
        context += f", 월 소득: {p.monthly_income:,}원, 리스크 성향: {p.risk_type}"
    if req.diagnosis:
        d = req.diagnosis
        context += f"\n[진단 결과] 종합: {d.total_score}점, 취약영역: {', '.join(d.risk_areas) if d.risk_areas else '없음'}"
        context += f", 월 부족분: {d.monthly_shortfall:,}원"
    return context


async def run_chat(req: ChatRequest) -> ChatResponse:
    # ── 프로액티브 모드 ──
    if req.mode == "proactive":
        return await _handle_proactive(req)

    # ── 일반 대화 모드 ──
    api_key = os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return ChatResponse(
            reply=_fallback_reply(req.message),
            suggestions=_get_suggestions(req),
        )

    try:
        base_url = os.getenv("ANTHROPIC_BASE_URL")
        llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=api_key,
            max_tokens=600,
            **({"base_url": base_url} if base_url else {}),
        )

        context = _build_context(req)
        proactive_summary = _build_proactive_summary(req.history)
        system_content = SYSTEM_PROMPT
        if context:
            system_content += f"\n\n{context}"
        if proactive_summary:
            system_content += f"\n\n{proactive_summary}"

        messages = [SystemMessage(content=system_content)]
        for h in req.history[-8:]:
            if h.get("role") == "user":
                messages.append(HumanMessage(content=h["content"]))
            elif h.get("role") == "assistant":
                messages.append(AIMessage(content=h["content"]))
        messages.append(HumanMessage(content=req.message))

        resp = await llm.ainvoke(messages)
        reply = resp.content.strip()

    except Exception as e:
        print(f"[chat_agent ERROR] {type(e).__name__}: {e}")
        reply = _fallback_reply(req.message)

    return ChatResponse(reply=reply, message_id=str(uuid.uuid4()), suggestions=_get_suggestions(req))


async def _handle_proactive(req: ChatRequest) -> ChatResponse:
    current_step = _get_proactive_step(req.history)

    # 아직 질문이 남아있으면 다음 질문 반환
    if current_step <= len(PROACTIVE_FLOW):
        flow = PROACTIVE_FLOW[current_step - 1]

        # 이전 답변에 대한 짧은 공감 멘트 생성
        empathy = ""
        if req.message and current_step > 1:
            empathy = _get_empathy(req.message, current_step - 1) + "\n\n"

        return ChatResponse(
            reply=empathy + flow["question"],
            quick_options=[QuickOption(label=o["label"], value=o["value"]) for o in flow["options"]],
            is_proactive=True,
            proactive_step=current_step,
        )

    # 모든 질문 완료 → AI가 종합 분석
    return await _generate_proactive_summary(req)


async def _generate_proactive_summary(req: ChatRequest) -> ChatResponse:
    proactive_summary = _build_proactive_summary(req.history)
    context = _build_context(req)

    api_key = os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return ChatResponse(
            reply=_fallback_proactive_summary(req.history),
            suggestions=["연금 추납 방법이 궁금해요", "보험은 어떤 것을 들어야 하나요?", "지출을 어떻게 줄일 수 있나요?"],
        )

    try:
        base_url = os.getenv("ANTHROPIC_BASE_URL")
        llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=api_key,
            max_tokens=700,
            **({"base_url": base_url} if base_url else {}),
        )

        system = SystemMessage(content=f"""당신은 JB금융그룹의 노후 준비 전문 AI 어드바이저입니다.
고객의 응답을 바탕으로 노후 준비 상태를 분석하고, 따뜻하고 친절한 말투로 핵심 조언을 제공하세요.
반드시 한국어로 답변하고, 마크다운 기호(**, ##, - 등)는 사용하지 마세요.
투자 권유가 아닌 정보 제공 목적임을 명심하세요.
{context}""")

        human = HumanMessage(content=f"""{proactive_summary}

위 고객의 응답을 종합하여:
1. 현재 노후 준비 상태에 대한 따뜻한 평가 (1~2문장)
2. 가장 시급하게 챙겨야 할 것 2가지 (구체적으로)
3. JB금융에서 도움받을 수 있는 방향 (1문장)

총 4~6문장으로 작성하세요.""")

        resp = await llm.ainvoke([system, human])
        reply = resp.content.strip()

    except Exception as e:
        print(f"[chat_agent proactive ERROR] {type(e).__name__}: {e}")
        reply = _fallback_proactive_summary(req.history)

    return ChatResponse(
        reply=reply,
        message_id=str(uuid.uuid4()),
        suggestions=["연금 추납 방법이 궁금해요", "보험은 어떤 것을 들어야 하나요?", "지출을 어떻게 줄일 수 있나요?"],
    )


def _get_empathy(answer: str, step: int) -> str:
    empathy_map = {
        "생활비_걱정": "생활비 걱정은 많은 분들이 공통적으로 느끼시는 부분입니다.",
        "건강_걱정": "건강과 의료비는 노후 준비에서 매우 중요한 부분입니다.",
        "자녀_걱정": "자녀를 생각하는 마음이 느껴집니다. 체계적인 준비로 자립할 수 있습니다.",
        "모름": "괜찮습니다. 지금부터 하나씩 알아가시면 됩니다.",
        "준비_없음": "지금 파악하신 것만으로도 큰 첫걸음입니다.",
        "irp_있음": "퇴직연금을 준비하고 계시는군요. 좋은 출발점입니다.",
        "개인연금_있음": "개인연금까지 준비하고 계시다니 훌륭합니다.",
        "부동산_활용": "부동산 활용 계획이 있으시군요. 유동성 전략도 함께 고려해보겠습니다.",
        "보험_없음": "보험 공백은 노후에 큰 부담이 될 수 있어 빠른 검토가 필요합니다.",
    }
    for key, msg in empathy_map.items():
        if key in answer:
            return msg
    return "말씀 감사합니다."


def _fallback_proactive_summary(history: list[dict]) -> str:
    return (
        "말씀해 주신 내용을 바탕으로 보면, 노후 준비를 위한 체계적인 점검이 필요한 시점입니다. "
        "가장 먼저 국민연금 예상 수령액을 확인하시고, 부족한 부분은 개인연금이나 저축으로 보완하시길 권장합니다. "
        "JB금융그룹의 상담 서비스를 통해 더 자세한 도움을 받으실 수 있습니다."
    )


async def stream_chat(req: ChatRequest) -> AsyncGenerator[str, None]:
    api_key = os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        fallback = _fallback_reply(req.message)
        yield f"data: {json.dumps({'text': fallback})}\n\n"
        yield "data: [DONE]\n\n"
        return

    try:
        base_url = os.getenv("ANTHROPIC_BASE_URL")
        llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=api_key,
            max_tokens=600,
            streaming=True,
            **({"base_url": base_url} if base_url else {}),
        )

        context = _build_context(req)
        proactive_summary = _build_proactive_summary(req.history)
        system_content = SYSTEM_PROMPT
        if context:
            system_content += f"\n\n{context}"
        if proactive_summary:
            system_content += f"\n\n{proactive_summary}"

        messages = [SystemMessage(content=system_content)]
        for h in req.history[-8:]:
            if h.get("role") == "user":
                messages.append(HumanMessage(content=h["content"]))
            elif h.get("role") == "assistant":
                messages.append(AIMessage(content=h["content"]))
        messages.append(HumanMessage(content=req.message))

        async for chunk in llm.astream(messages):
            if chunk.content:
                yield f"data: {json.dumps({'text': chunk.content})}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'text': '죄송합니다. 일시적인 오류가 발생했습니다.'})}\n\n"
        yield "data: [DONE]\n\n"


def _fallback_reply(message: str) -> str:
    if "연금" in message:
        return "국민연금은 납부 기간과 금액에 따라 수령액이 달라집니다. 국민연금공단 홈페이지에서 예상 수령액을 조회하실 수 있으며, 추납을 통해 납부 공백을 메우면 수령액을 늘릴 수 있습니다."
    elif "은퇴" in message or "노후" in message:
        return "노후 준비는 빠를수록 좋습니다. 국민연금, 퇴직연금, 개인연금 3가지를 균형 있게 준비하고, 생애 이벤트를 고려한 현금흐름 관리가 중요합니다."
    elif "점수" in message:
        return "은퇴 준비 점수는 재무 상태, 생애이벤트 대비, 소비 패턴, 건강 상태 4가지 영역을 종합 평가합니다. 취약 영역부터 집중 개선하시면 효과적입니다."
    else:
        return "노후 준비와 관련한 질문을 자유롭게 해주세요. 연금, 자산 관리, 생애 이벤트 대비 등 다양한 주제로 도움을 드릴 수 있습니다."


def _get_suggestions(req: ChatRequest) -> list[str]:
    base = [
        "왜 내 재무 점수가 낮은가요?",
        "연금을 더 납입하면 어떻게 되나요?",
        "63세에 은퇴하면 어떻게 달라지나요?",
    ]
    if req.diagnosis and "건강" in (req.diagnosis.risk_areas or []):
        base[2] = "의료비 보험은 어떤 것이 좋나요?"
    return base
