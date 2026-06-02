import os
import json
from typing import AsyncGenerator
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from app.schemas import ChatRequest, ChatResponse


SYSTEM_PROMPT = """당신은 JB금융그룹의 나로(NaRo) 서비스 AI 어드바이저입니다.
50~60대 은퇴 준비 고객을 대상으로 노후 준비 관련 질문에 친절하고 명확하게 답변합니다.

규칙:
1. 반드시 한국어로 답변하세요.
2. 금융 수치는 구체적으로 언급하세요.
3. 투자 권유가 아닌 정보 제공임을 명심하세요.
4. 답변은 3~5문장으로 간결하게 유지하세요.
5. 고령 친화적 언어를 사용하세요 (쉬운 단어, 명확한 설명).
6. 모르는 내용은 "전문 상담사와 상담을 권장합니다"라고 안내하세요."""


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
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        return ChatResponse(
            reply=_fallback_reply(req.message),
            suggestions=_get_suggestions(req),
        )

    try:
        llm = ChatAnthropic(
            model="claude-sonnet-4-20250514",
            api_key=api_key,
            max_tokens=500,
        )

        context = _build_context(req)
        system_content = SYSTEM_PROMPT
        if context:
            system_content += f"\n\n{context}"

        messages = [SystemMessage(content=system_content)]

        for h in req.history[-6:]:
            if h.get("role") == "user":
                messages.append(HumanMessage(content=h["content"]))
            elif h.get("role") == "assistant":
                messages.append(AIMessage(content=h["content"]))

        messages.append(HumanMessage(content=req.message))

        resp = await llm.ainvoke(messages)
        reply = resp.content.strip()

    except Exception:
        reply = _fallback_reply(req.message)

    return ChatResponse(
        reply=reply,
        suggestions=_get_suggestions(req),
    )


async def stream_chat(req: ChatRequest) -> AsyncGenerator[str, None]:
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        fallback = _fallback_reply(req.message)
        yield f"data: {json.dumps({'text': fallback})}\n\n"
        yield "data: [DONE]\n\n"
        return

    try:
        llm = ChatAnthropic(
            model="claude-sonnet-4-20250514",
            api_key=api_key,
            max_tokens=500,
            streaming=True,
        )

        context = _build_context(req)
        system_content = SYSTEM_PROMPT
        if context:
            system_content += f"\n\n{context}"

        messages = [SystemMessage(content=system_content)]
        for h in req.history[-6:]:
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
        yield f"data: {json.dumps({'text': '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'})}\n\n"
        yield "data: [DONE]\n\n"


def _fallback_reply(message: str) -> str:
    msg_lower = message.lower()
    if "연금" in message:
        return "국민연금은 납부 기간과 금액에 따라 수령액이 달라집니다. 국민연금공단 홈페이지에서 예상 수령액을 조회하실 수 있습니다. 추납을 통해 납부 공백을 메우면 수령액을 늘릴 수 있습니다."
    elif "은퇴" in message or "노후" in message:
        return "노후 준비는 빠를수록 좋습니다. 3층 연금(국민연금+퇴직연금+개인연금) 체계를 갖추고, 생애 이벤트를 고려한 현금흐름 관리가 중요합니다."
    elif "점수" in message:
        return "은퇴 준비 점수는 재무 상태, 생애이벤트 대비, 소비 패턴, 건강 상태 4가지 영역을 종합 평가합니다. 취약 영역부터 집중 개선하시면 효과적입니다."
    else:
        return "노후 준비와 관련한 질문을 자유롭게 해주세요. 연금, 자산 관리, 생애 이벤트 대비 등 다양한 주제로 도움을 드릴 수 있습니다."


def _get_suggestions(req: ChatRequest) -> list[str]:
    base = [
        "왜 내 재무 점수가 낮은가요?",
        "연금을 더 납입하면 점수가 얼마나 오르나요?",
        "63세에 은퇴하면 어떻게 달라지나요?",
    ]
    if req.diagnosis and "건강" in (req.diagnosis.risk_areas or []):
        base[2] = "의료비 보험은 어떤 것이 좋나요?"
    return base
