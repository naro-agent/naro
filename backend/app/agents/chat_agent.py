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

def _get_proactive_step(history: list[dict]) -> int:
    proactive_answers = [h for h in history if h.get("proactive_step", 0) > 0]
    return len(proactive_answers) + 1


def _build_proactive_summary(history: list[dict]) -> str:
    answers = [h for h in history if h.get("role") == "user" and h.get("proactive_step", 0) > 0]
    if not answers:
        return ""
    lines = ["[사용자 심층 응답 요약]"]
    for i, a in enumerate(answers, 1):
        question = a.get("proactive_question", f"질문 {i}")
        lines.append(f"- Q{i}. {question}: {a['content']}")
    return "\n".join(lines)


async def _generate_proactive_questions(req: "ChatRequest") -> list[dict]:
    """진단 결과 기반으로 Claude가 맞춤 질문 3~4개를 동적 생성."""
    api_key = os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return _fallback_questions(req)

    try:
        base_url = os.getenv("ANTHROPIC_BASE_URL")
        llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=api_key,
            max_tokens=800,
            **({"base_url": base_url} if base_url else {}),
        )

        context = _build_diagnosis_context(req)

        system = SystemMessage(content="""당신은 JB금융그룹의 노후 준비 전문 AI 어드바이저입니다.
고객의 진단 결과를 바탕으로 고객이 스스로 미처 생각하지 못한 노후 준비 공백을 탐색할 수 있도록
3~4개의 맞춤 심층 질문을 생성하세요.

규칙:
- 진단 결과에서 취약하거나 개선이 필요한 영역에 집중
- 이미 설문에서 수집한 정보(은퇴 나이, 생활비, 리스크 성향)는 다시 묻지 말 것
- 각 질문은 고객이 구체적으로 답할 수 있도록 짧고 명확하게
- 반드시 JSON 배열로만 반환:
[{"question": "질문 내용", "options": ["선택지1", "선택지2", "선택지3"]}]
- options는 2~3개, 없어도 되면 빈 배열 []
- JSON 외 다른 텍스트 없이 [ 로 시작해서 ] 로 끝낼 것""")

        human = HumanMessage(content=f"{context}\n\n위 고객에게 맞는 심층 질문 3~4개를 JSON 배열로 생성하세요.")

        resp = await llm.ainvoke([system, human])
        raw = resp.content.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        questions = json.loads(raw.strip())
        if isinstance(questions, list) and len(questions) > 0:
            return questions[:4]
    except Exception as e:
        print(f"[chat_agent] 질문 생성 오류: {e}")

    return _fallback_questions(req)


def _build_diagnosis_context(req: "ChatRequest") -> str:
    """진단·설문·시뮬레이션 결과를 텍스트로 요약."""
    lines = []
    if req.profile:
        p = req.profile
        lines.append(f"[고객 기본 정보] {p.age}세 {p.job_type}, 은퇴 목표 {p.retirement_target_age}세, 리스크 성향: {p.risk_type}")
        lines.append(f"월 소득: {p.monthly_income:,}원, 금융자산: {p.financial_assets:,}원, 부동산: {p.real_estate_assets:,}원")
        lines.append(f"국민연금: {p.national_pension_expected:,}원, 개인연금: {p.personal_pension:,}원")
        if p.health_issue:
            lines.append("건강 이슈 있음")
        if p.life_events:
            lines.append(f"예상 생애이벤트: {[e.type for e in p.life_events]}")

    if req.survey_scores:
        s = req.survey_scores
        score_str = ", ".join([f"{k}: {v}점" for k, v in s.items()])
        lines.append(f"[설문 점수] {score_str}")
        weak = [k for k, v in s.items() if v < 60]
        if weak:
            lines.append(f"취약 영역 (60점 미만): {', '.join(weak)}")

    if req.diagnosis:
        d = req.diagnosis
        lines.append(f"[진단 결과] 종합 {d.total_score}점, 월 부족분: {d.monthly_shortfall:,}원")
        if d.risk_areas:
            lines.append(f"위험 영역: {', '.join(d.risk_areas)}")

    if req.simulation:
        sim = req.simulation
        if sim.deficit_start_age:
            lines.append(f"[시뮬레이션] {sim.deficit_start_age}세부터 적자 전환, 총 {sim.total_deficit_months}개월 부족 예상")
        else:
            lines.append("[시뮬레이션] 전체 기간 흑자 유지")

    return "\n".join(lines)


def _fallback_questions(req: "ChatRequest") -> list[dict]:
    """API 실패 시 취약 영역 기반 기본 질문 반환."""
    questions = []
    survey_scores = req.survey_scores or {}

    if survey_scores.get("finance", 100) < 60 or (req.diagnosis and req.diagnosis.monthly_shortfall > 0):
        questions.append({
            "question": "퇴직 후 국민연금 외에 매달 수령 가능한 연금이 있으신가요?",
            "options": ["IRP·연금저축 수령 예정", "없음", "잘 모르겠음"]
        })
    if survey_scores.get("health", 100) < 60 or (req.profile and req.profile.health_issue):
        questions.append({
            "question": "현재 실손보험이나 중대질병 보험에 가입되어 계신가요?",
            "options": ["실손보험 있음", "중대질병 포함", "거의 없음"]
        })
    if survey_scores.get("leisure", 100) < 60:
        questions.append({
            "question": "은퇴 후 여가·취미 활동을 위한 별도 자금을 준비하고 계신가요?",
            "options": ["준비 중", "아직 없음"]
        })
    if not questions:
        questions.append({
            "question": "노후 준비에서 지금 가장 불안하게 느끼는 부분은 무엇인가요?",
            "options": ["생활비", "의료비", "외로움·사회 단절", "잘 모르겠음"]
        })
    return questions[:4]


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

        # 품질 검증: 너무 짧거나 한국어 없으면 재시도
        if not _is_valid_reply(reply):
            print(f"[chat_agent] 응답 품질 미달({len(reply)}자) → 재시도")
            retry_messages = messages[:]
            retry_messages[-1] = HumanMessage(
                content=req.message + "\n\n(반드시 한국어로 3문장 이상 답변하세요.)"
            )
            resp2 = await llm.ainvoke(retry_messages)
            retry_reply = resp2.content.strip()
            reply = retry_reply if _is_valid_reply(retry_reply) else reply

    except Exception as e:
        print(f"[chat_agent ERROR] {type(e).__name__}: {e}")
        reply = _fallback_reply(req.message)

    return ChatResponse(reply=reply, message_id=str(uuid.uuid4()), suggestions=_get_suggestions(req))


async def _handle_proactive(req: ChatRequest) -> ChatResponse:
    current_step = _get_proactive_step(req.history)

    # 히스토리에서 질문 목록 복원, 없으면 새로 생성
    proactive_questions = _extract_questions_from_history(req.history)
    is_first_call = not proactive_questions
    if is_first_call:
        proactive_questions = await _generate_proactive_questions(req)

    total_steps = len(proactive_questions)

    # 아직 질문이 남아있으면 다음 질문 제시
    if current_step <= total_steps:
        flow = proactive_questions[current_step - 1]
        question_text = flow.get("question", "")
        options = flow.get("options", [])

        empathy = ""
        if req.message and current_step > 1:
            empathy = "말씀 감사합니다.\n\n"

        # 첫 질문이면 안내 문구 추가
        intro = ""
        if current_step == 1:
            intro = "진단 결과를 바탕으로 몇 가지 여쭤볼게요. 답변해 주시면 더 정확한 상담을 드릴 수 있습니다.\n\n"

        return ChatResponse(
            reply=intro + empathy + question_text,
            quick_options=[QuickOption(label=o, value=o) for o in options],
            is_proactive=True,
            proactive_step=current_step,
            # 첫 응답에서 전체 질문 목록을 전달해 프론트가 저장
            proactive_questions=proactive_questions if is_first_call else None,
        )

    # 모든 질문 완료 → AI가 종합 분석
    return await _generate_proactive_summary(req)


def _extract_questions_from_history(history: list[dict]) -> list[dict]:
    """히스토리에 저장된 질문 목록 복원."""
    for h in history:
        if h.get("role") == "system" and h.get("proactive_questions"):
            return h["proactive_questions"]
    return []


async def _generate_proactive_summary(req: ChatRequest) -> ChatResponse:
    proactive_summary = _build_proactive_summary(req.history)
    diagnosis_context = _build_diagnosis_context(req)

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

        system = SystemMessage(content="""당신은 JB금융그룹의 노후 준비 전문 AI 어드바이저입니다.
고객의 진단 결과와 심층 응답을 종합하여 따뜻하고 구체적인 조언을 제공하세요.
반드시 한국어로 답변하고, 마크다운 기호(**, ##, - 등)는 사용하지 마세요.
투자 권유가 아닌 정보 제공 목적임을 명심하세요.""")

        human = HumanMessage(content=f"""{diagnosis_context}

{proactive_summary}

위 고객의 진단 결과와 심층 응답을 종합하여:
1. 현재 노후 준비 상태에 대한 따뜻한 평가 (1~2문장)
2. 진단과 응답을 연결한 가장 시급한 행동 2가지 (구체적으로)
3. JB금융에서 도움받을 수 있는 방향 (1문장)

총 4~6문장으로 작성하세요.""")

        resp = await llm.ainvoke([system, human])
        reply = resp.content.strip()

        if not _is_valid_reply(reply):
            print(f"[chat_agent proactive] 응답 품질 미달 → 재시도")
            retry_human = HumanMessage(content=human.content + "\n\n(반드시 한국어로 4문장 이상 작성하세요.)")
            resp2 = await llm.ainvoke([system, retry_human])
            retry_reply = resp2.content.strip()
            reply = retry_reply if _is_valid_reply(retry_reply) else reply

    except Exception as e:
        print(f"[chat_agent proactive ERROR] {type(e).__name__}: {e}")
        reply = _fallback_proactive_summary(req.history)

    return ChatResponse(
        reply=reply,
        message_id=str(uuid.uuid4()),
        suggestions=["연금 추납 방법이 궁금해요", "보험은 어떤 것을 들어야 하나요?", "지출을 어떻게 줄일 수 있나요?"],
    )



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


def _is_valid_reply(text: str) -> bool:
    """응답이 충분한 길이이고 한국어를 포함하는지 검증."""
    return len(text) >= 50 and any('가' <= c <= '힣' for c in text)


def _get_suggestions(req: ChatRequest) -> list[str]:
    base = [
        "왜 내 재무 점수가 낮은가요?",
        "연금을 더 납입하면 어떻게 되나요?",
        "63세에 은퇴하면 어떻게 달라지나요?",
    ]
    if req.diagnosis and "건강" in (req.diagnosis.risk_areas or []):
        base[2] = "의료비 보험은 어떤 것이 좋나요?"
    return base
