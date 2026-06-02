from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas import ChatRequest, ChatResponse
from app.agents.chat_agent import run_chat, stream_chat

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        return await run_chat(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    try:
        return StreamingResponse(
            stream_chat(req),
            media_type="text/event-stream",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
