from fastapi import APIRouter, HTTPException
from app.schemas import DiagnosisRequest, DiagnosisResult
from app.agents.diagnosis_agent import run_diagnosis

router = APIRouter()


@router.post("/diagnosis", response_model=DiagnosisResult)
async def diagnose(req: DiagnosisRequest):
    try:
        return await run_diagnosis(req.profile)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
