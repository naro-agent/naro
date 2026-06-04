from pydantic import BaseModel, Field
from typing import Optional


class LifeEvent(BaseModel):
    type: str
    years_later: int
    monthly_cost: int


class InsuranceItem(BaseModel):
    name: str
    company: str
    monthly_premium: int
    coverage: str


class AccountItem(BaseModel):
    type: str
    bank: str
    balance: int
    monthly_deposit: Optional[int] = 0


class UserProfile(BaseModel):
    age: int = Field(..., ge=30, le=80)
    job_type: str
    retirement_target_age: int
    monthly_target_living_cost: int
    monthly_income: int
    financial_assets: int
    real_estate_assets: int
    liabilities: int
    national_pension_expected: int
    retirement_pension: int
    personal_pension: int
    monthly_expense: int
    risk_type: str
    life_events: list[LifeEvent] = []
    health_issue: bool = False

    # 고도화 필드 (은행 앱 연동 데이터)
    spending_categories: Optional[dict[str, int]] = None
    monthly_savings_trend: Optional[list[int]] = None
    insurance: Optional[list[InsuranceItem]] = None
    accounts: Optional[list[AccountItem]] = None
    credit_score: Optional[int] = None
    loan_history: Optional[str] = None


class DiagnosisRequest(BaseModel):
    profile: UserProfile


class SpendingInsight(BaseModel):
    category: str
    amount: int
    peer_avg: int
    diff_pct: float  # 동연령 평균 대비 % (양수=초과, 음수=절약)


class DiagnosisResult(BaseModel):
    total_score: int
    finance_score: int
    event_score: int
    consumption_score: int
    health_score: int
    asset_gap: int
    monthly_shortfall: int
    peer_comparison: str
    risk_areas: list[str]
    summary: str
    spending_insights: Optional[list[SpendingInsight]] = None
    avg_monthly_savings: Optional[int] = None
    total_insurance_premium: Optional[int] = None


class SimulationRequest(BaseModel):
    profile: UserProfile


class CashFlowPoint(BaseModel):
    year: int
    age: int
    monthly_cash_flow: int        # 기댓값 (중앙선)
    upper_cash_flow: int          # 신뢰구간 상단 (+1σ)
    lower_cash_flow: int          # 신뢰구간 하단 (-1σ)
    is_deficit: bool              # 기댓값 기준 적자 여부
    events: list[str] = []


class SimulationAssumptions(BaseModel):
    inflation_rate: float         # 물가상승률 (연 %)
    wage_growth_rate: float       # 임금상승률 (연 %)
    medical_cost_growth_rate: float  # 의료비 상승률 (연 %)
    uncertainty_rate: float       # 연간 불확실성 σ (%)


class SimulationResult(BaseModel):
    data: list[CashFlowPoint]
    deficit_start_age: Optional[int] = None
    total_deficit_months: int
    key_risk_message: str
    assumptions: SimulationAssumptions


class RecommendRequest(BaseModel):
    profile: UserProfile
    diagnosis: DiagnosisResult


class ActionCard(BaseModel):
    priority: int
    title: str
    description: str
    expected_effect: str
    category: str
    action_label: str


class ProductRecommendation(BaseModel):
    id: str
    bank: str
    name: str
    type: str
    description: str
    rate: str
    reason: str


class RecommendResult(BaseModel):
    action_cards: list[ActionCard]
    products: list[ProductRecommendation]
    disclaimer: str


class ChatRequest(BaseModel):
    message: str
    profile: Optional[UserProfile] = None
    diagnosis: Optional[DiagnosisResult] = None
    history: list[dict] = []
    mode: str = "free"  # "proactive" | "free"


class QuickOption(BaseModel):
    label: str
    value: str


class ChatResponse(BaseModel):
    reply: str
    message_id: Optional[str] = None       # 피드백용 메시지 ID
    suggestions: list[str] = []
    quick_options: list[QuickOption] = []
    is_proactive: bool = False
    proactive_step: int = 0


class FeedbackRequest(BaseModel):
    message_id: str
    rating: str                            # "good" | "bad"
    user_message: str
    ai_response: str
    mode: str = "free"
    profile_age: Optional[int] = None
    profile_job_type: Optional[str] = None
    risk_areas: Optional[list[str]] = None


class FeedbackResponse(BaseModel):
    success: bool
    message: str
