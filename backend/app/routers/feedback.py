from fastapi import APIRouter
from app.schemas import FeedbackRequest, FeedbackResponse
from app.data.feedback_store import save_feedback, load_feedback_stats

router = APIRouter()


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(req: FeedbackRequest):
    success = save_feedback({
        "message_id": req.message_id,
        "rating": req.rating,
        "user_message": req.user_message,
        "ai_response": req.ai_response[:300],  # 너무 길면 잘라서 저장
        "mode": req.mode,
        "profile_age": req.profile_age,
        "profile_job_type": req.profile_job_type,
        "risk_areas": req.risk_areas or [],
    })
    return FeedbackResponse(
        success=success,
        message="피드백이 저장되었습니다." if success else "저장 중 오류가 발생했습니다.",
    )


@router.get("/feedback/stats")
async def get_feedback_stats():
    return load_feedback_stats()
