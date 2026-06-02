from pydantic import BaseModel, Field
from typing import Optional


class LifeEvent(BaseModel):
    type: str
    years_later: int
    monthly_cost: int


class UserProfile(BaseModel):
    age: int = Field(..., ge=30, le=80)
    job_type: str  # "직장인" | "자영업자" | "공무원"
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
    risk_type: str  # "보수형" | "중립형" | "적극형"
    life_events: list[LifeEvent] = []
    health_issue: bool = False


class DiagnosisRequest(BaseModel):
    profile: UserProfile


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


class SimulationRequest(BaseModel):
    profile: UserProfile
    scenario: str = "neutral"  # "optimistic" | "neutral" | "pessimistic"


class CashFlowPoint(BaseModel):
    year: int
    age: int
    monthly_cash_flow: int
    is_deficit: bool
    events: list[str] = []


class ScenarioResult(BaseModel):
    scenario: str
    data: list[CashFlowPoint]
    deficit_start_age: Optional[int] = None
    total_deficit_months: int


class SimulationResult(BaseModel):
    optimistic: ScenarioResult
    neutral: ScenarioResult
    pessimistic: ScenarioResult
    key_risk_message: str


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


class ChatResponse(BaseModel):
    reply: str
    suggestions: list[str] = []
