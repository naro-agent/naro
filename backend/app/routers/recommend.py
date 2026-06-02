from fastapi import APIRouter, HTTPException
from app.schemas import RecommendRequest, RecommendResult
from app.agents.recommend_agent import run_recommend

router = APIRouter()


@router.post("/recommend", response_model=RecommendResult)
async def recommend(req: RecommendRequest):
    try:
        return await run_recommend(req.profile, req.diagnosis)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
