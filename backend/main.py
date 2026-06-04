from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.routers import diagnosis, simulation, recommend, chat, feedback
from app.data.mock_personas import PERSONAS

load_dotenv()

app = FastAPI(title="나로(NaRo) API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173"), "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(diagnosis.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
app.include_router(recommend.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")


@app.get("/api/personas")
async def get_personas():
    return list(PERSONAS.values())


@app.get("/api/personas/{persona_id}")
async def get_persona(persona_id: str):
    if persona_id not in PERSONAS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="페르소나를 찾을 수 없습니다.")
    return PERSONAS[persona_id]


@app.get("/health")
async def health():
    return {"status": "ok", "service": "나로(NaRo) API"}
