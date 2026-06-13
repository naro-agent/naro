# 나로(NaRo) API 명세서

> Base URL (로컬): `http://localhost:8000`  
> Base URL (프로덕션): `https://naro-api.railway.app`

---

## 공통 사항

| 항목 | 내용 |
|------|------|
| 콘텐츠 타입 | `application/json` |
| 인증 | 없음 (서버 간 인증은 환경변수로 관리) |
| 에러 형식 | `{ "detail": "에러 메시지" }` |

---

## 1. 서버 상태 확인

### `GET /health`

서버 정상 동작 여부 확인.

**Response `200`**
```json
{ "status": "ok" }
```

---

## 2. 시연용 페르소나

### `GET /api/personas`

시연용 페르소나 목록 반환.

**Response `200`**
```json
[
  {
    "id": "persona_1",
    "name": "김철수",
    "age": 55,
    "job_type": "직장인",
    "label": "재무 취약 · 이벤트 多",
    "color": "#1264D3",
    "monthly_income": 5200000,
    "monthly_expense": 3800000,
    "financial_assets": 85000000,
    "real_estate_assets": 320000000,
    "liabilities": 120000000,
    "national_pension_expected": 870000,
    "retirement_pension": 45000000,
    "personal_pension": 0,
    "retirement_target_age": 62,
    "monthly_target_living_cost": 3000000,
    "risk_type": "중립형",
    "health_issue": false,
    "life_events": [
      { "type": "자녀대학", "years_later": 2, "monthly_cost": 1000000 },
      { "type": "부모부양", "years_later": 0, "monthly_cost": 500000 }
    ]
  }
]
```

---

### `GET /api/personas/{id}`

특정 페르소나 반환.

**Path Parameter**: `id` — 페르소나 ID (`persona_1` / `persona_2` / `persona_3`)

**Response `200`**: 단일 페르소나 객체 (위와 동일)

**Response `404`**
```json
{ "detail": "페르소나를 찾을 수 없습니다." }
```

---

## 3. 노후 준비 진단

### `POST /api/diagnosis`

재무 프로필 기반 노후 준비 점수 및 위험 영역 산출.

**Request Body**
```json
{
  "profile": {
    "age": 55,
    "job_type": "직장인",
    "retirement_target_age": 62,
    "monthly_target_living_cost": 3000000,
    "monthly_income": 5200000,
    "monthly_expense": 3800000,
    "financial_assets": 85000000,
    "real_estate_assets": 320000000,
    "liabilities": 120000000,
    "national_pension_expected": 870000,
    "retirement_pension": 45000000,
    "personal_pension": 0,
    "risk_type": "중립형",
    "health_issue": false,
    "life_events": [
      { "type": "자녀대학", "years_later": 2, "monthly_cost": 1000000 }
    ]
  }
}
```

**UserProfile 필드 상세**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `age` | int | ✅ | 현재 나이 (30~80) |
| `job_type` | string | ✅ | 직장인 / 자영업자 / 공무원 / 프리랜서 |
| `retirement_target_age` | int | ✅ | 목표 은퇴 나이 |
| `monthly_target_living_cost` | int | ✅ | 노후 월 목표 생활비 (원) |
| `monthly_income` | int | ✅ | 현재 월 소득 (세후, 원) |
| `monthly_expense` | int | ✅ | 현재 월 지출 (원) |
| `financial_assets` | int | ✅ | 금융 자산 총액 (원) |
| `real_estate_assets` | int | ✅ | 부동산 자산 총액 (원) |
| `liabilities` | int | ✅ | 부채 총액 (원) |
| `national_pension_expected` | int | ✅ | 국민연금 예상 월 수령액 (원) |
| `retirement_pension` | int | ✅ | 퇴직연금 총 적립액 (원) |
| `personal_pension` | int | ✅ | 개인연금 월 수령액 (원) |
| `risk_type` | string | ✅ | 보수형 / 중립형 / 적극형 |
| `health_issue` | bool | ❌ | 건강 이슈 여부 (기본값: false) |
| `life_events` | array | ❌ | 생애 이벤트 목록 |
| `spending_categories` | object | ❌ | 카테고리별 월 지출 (JB연동 시) |
| `monthly_savings_trend` | array | ❌ | 최근 12개월 저축액 추이 |
| `insurance` | array | ❌ | 보험 가입 현황 |
| `accounts` | array | ❌ | 계좌 목록 |

**LifeEvent 필드**

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | string | 이벤트 유형 (자녀대학/자녀결혼/부모부양 등) |
| `years_later` | int | 현재로부터 몇 년 후 (0 = 현재 진행 중) |
| `monthly_cost` | int | 월 발생 비용 (원) |

**Response `200`**
```json
{
  "total_score": 68,
  "finance_score": 62,
  "event_score": 55,
  "consumption_score": 70,
  "health_score": 75,
  "asset_gap": 180000000,
  "monthly_shortfall": 1230000,
  "peer_comparison": "동연령 평균 수준",
  "risk_areas": ["재무", "생애이벤트"],
  "summary": "자산 규모는 양호하나 유동성 부족과 이벤트 부담이 큰 상황입니다.",
  "spending_insights": null,
  "avg_monthly_savings": null,
  "total_insurance_premium": null
}
```

---

## 4. 생애 현금흐름 시뮬레이션

### `POST /api/simulation`

35년간 월별 현금흐름 예측 + AI 인사이트 생성.

**Request Body**
```json
{
  "profile": { /* UserProfile — 위와 동일 */ }
}
```

**Response `200`**
```json
{
  "data": [
    {
      "year": 0,
      "age": 55,
      "monthly_cash_flow": 1400000,
      "upper_cash_flow": 1512000,
      "lower_cash_flow": 1288000,
      "is_deficit": false,
      "events": []
    },
    {
      "year": 7,
      "age": 62,
      "monthly_cash_flow": -230000,
      "upper_cash_flow": 356000,
      "lower_cash_flow": -816000,
      "is_deficit": true,
      "events": ["은퇴"]
    }
  ],
  "deficit_start_age": 62,
  "total_deficit_months": 276,
  "key_risk_message": "물가상승률(연 3.2%)·의료비 상승 반영 시 62세부터 월 현금흐름이 적자로 전환됩니다. 총 276개월(23년) 동안 부족이 예상됩니다.",
  "assumptions": {
    "inflation_rate": 3.2,
    "wage_growth_rate": 3.5,
    "medical_cost_growth_rate": 4.5,
    "uncertainty_rate": 8.0
  },
  "ai_insight": "은퇴 직후 소득 공백이 가장 큰 리스크입니다. 개인연금이 전혀 없는 상태에서 국민연금만으로는 목표 생활비를 충족하기 어렵습니다. 지금부터 IRP 또는 연금저축에 가입하시면 9년간의 복리 효과로 은퇴 후 월 수령액을 크게 높일 수 있습니다."
}
```

**CashFlowPoint 필드**

| 필드 | 타입 | 설명 |
|------|------|------|
| `year` | int | 현재로부터 경과 연수 (0~34) |
| `age` | int | 해당 시점 나이 |
| `monthly_cash_flow` | int | 예측 월 현금흐름 (원, 음수=적자) |
| `upper_cash_flow` | int | 신뢰구간 상단 (+1σ) |
| `lower_cash_flow` | int | 신뢰구간 하단 (-1σ) |
| `is_deficit` | bool | 적자 여부 |
| `events` | array | 해당 연도 생애 이벤트 목록 |

---

## 5. 맞춤 추천

### `POST /api/recommend`

규칙 기반 액션카드 + RAG 기반 맞춤 금융 상품 추천.

**Request Body**
```json
{
  "profile": { /* UserProfile */ },
  "diagnosis": {
    "total_score": 68,
    "finance_score": 62,
    "event_score": 55,
    "consumption_score": 70,
    "health_score": 75,
    "asset_gap": 180000000,
    "monthly_shortfall": 1230000,
    "peer_comparison": "동연령 평균 수준",
    "risk_areas": ["재무"],
    "summary": ""
  },
  "survey_scores": {
    "basic": 80,
    "finance": 58,
    "health": 72,
    "leisure": 55,
    "relation": 68
  }
}
```

**Response `200`**
```json
{
  "action_cards": [
    {
      "priority": 1,
      "title": "개인연금 3층 구조 완성",
      "description": "세액공제 혜택이 있는 IRP·연금저축으로 3층 연금 체계를 갖추세요.",
      "expected_effect": "연간 최대 66만 원 세금 환급 + 노후 소득 보완",
      "category": "연금",
      "action_label": "IRP·연금저축 상품 보기"
    }
  ],
  "products": [
    {
      "id": "jb_irp_001",
      "bank": "전북은행",
      "name": "JB 퇴직연금 IRP",
      "type": "연금",
      "description": "세액공제 연 900만원 한도, 납입액의 13.2~16.5% 환급",
      "rate": "실적배당",
      "reason": "개인연금이 없는 고객님께 세제 혜택과 노후 소득을 동시에 확보할 수 있는 최적 상품입니다.",
      "is_virtual": false,
      "area": "재무"
    },
    {
      "id": "jb_health_001",
      "bank": "JB금융",
      "name": "JB 실버케어 건강적금",
      "type": "적금",
      "description": "건강 관련 목적 저축 + 의료비 긴급 출금 기능",
      "rate": "연 3.5%",
      "reason": "여가활동 점수가 낮은 고객님의 노후 의료비 리스크를 대비하는 기획 단계의 특화 상품입니다.",
      "is_virtual": true,
      "area": "건강"
    }
  ],
  "disclaimer": "본 추천은 정보 제공 목적이며 투자 권유가 아닙니다. 금융 의사결정 전 전문가 상담을 권장합니다. (금융소비자보호법 준수) [가상상품]은 현재 출시되지 않은 기획 단계 상품입니다."
}
```

**ActionCard 필드**

| 필드 | 타입 | 설명 |
|------|------|------|
| `priority` | int | 우선순위 번호 (1이 최우선) |
| `title` | string | 액션 제목 |
| `description` | string | 상세 설명 |
| `expected_effect` | string | 예상 효과 |
| `category` | string | 연금 / 저축 / 보험 / 신탁 / 자산관리 |
| `action_label` | string | CTA 버튼 텍스트 |

**ProductRecommendation 필드**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 상품 ID |
| `bank` | string | 은행/기관명 |
| `name` | string | 상품명 |
| `type` | string | 적금/예금/펀드/보험/신탁/연금 |
| `description` | string | 핵심 특징 |
| `rate` | string | 금리/수익률 (없으면 "상담 필요") |
| `reason` | string | 이 고객에게 추천하는 이유 |
| `is_virtual` | bool | 가상 상품 여부 |
| `area` | string | 재무 / 건강 / 여가활동 / 대인관계 |

---

## 6. AI 상담

### `POST /api/chat`

Claude 기반 노후 설계 AI 상담 (단발 응답).

**Request Body**
```json
{
  "message": "개인연금을 지금 시작하면 얼마나 도움이 될까요?",
  "profile": { /* UserProfile, 선택 */ },
  "diagnosis": { /* DiagnosisResult, 선택 */ },
  "history": [
    { "role": "user", "content": "안녕하세요" },
    { "role": "assistant", "content": "안녕하세요! 노후 준비에 대해 무엇이든 물어보세요." }
  ],
  "mode": "free"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `message` | string | ✅ | 사용자 메시지 |
| `profile` | object | ❌ | 사용자 프로필 (컨텍스트용) |
| `diagnosis` | object | ❌ | 진단 결과 (컨텍스트용) |
| `history` | array | ❌ | 대화 이력 (role/content) |
| `mode` | string | ❌ | `free` (기본) / `proactive` |

**Response `200`**
```json
{
  "reply": "개인연금을 지금 시작하시면 큰 도움이 됩니다. 55세에 월 30만원씩 IRP에 납입하면 62세 은퇴까지 7년간 약 2,520만원을 적립할 수 있고, 세액공제로 연간 최대 49.5만원을 환급받으실 수 있습니다...",
  "message_id": "msg_abc123",
  "suggestions": [
    "IRP와 연금저축의 차이가 궁금해요",
    "세액공제 한도는 얼마인가요?"
  ],
  "quick_options": [],
  "is_proactive": false,
  "proactive_step": 0
}
```

---

### `POST /api/chat/stream`

Claude 기반 AI 상담 (SSE 스트리밍).

**Request Body**: `POST /api/chat`와 동일

**Response**: `text/event-stream`
```
data: 개인연금을

data: 지금 시작하시면

data: 큰 도움이 됩니다.

data: [DONE]
```

---

## 7. 피드백

### `POST /api/feedback`

AI 상담 응답에 대한 사용자 피드백 저장.

**Request Body**
```json
{
  "message_id": "msg_abc123",
  "rating": "good",
  "user_message": "개인연금을 지금 시작하면 얼마나 도움이 될까요?",
  "ai_response": "개인연금을 지금 시작하시면...",
  "mode": "free",
  "profile_age": 55,
  "profile_job_type": "직장인",
  "risk_areas": ["재무"]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `message_id` | string | ✅ | 응답 메시지 ID |
| `rating` | string | ✅ | `good` / `bad` |
| `user_message` | string | ✅ | 사용자가 보낸 메시지 |
| `ai_response` | string | ✅ | AI 응답 텍스트 |
| `mode` | string | ❌ | `free` / `proactive` |
| `profile_age` | int | ❌ | 사용자 나이 |
| `profile_job_type` | string | ❌ | 직업 유형 |
| `risk_areas` | array | ❌ | 취약 영역 목록 |

**Response `200`**
```json
{
  "success": true,
  "message": "피드백이 저장되었습니다."
}
```

---

## 8. 에러 코드

| HTTP 상태 | 발생 상황 | 예시 |
|-----------|----------|------|
| `422 Unprocessable Entity` | Request Body 스키마 불일치 | 필수 필드 누락, 타입 오류 |
| `500 Internal Server Error` | 서버 내부 오류 | Claude API 실패, ChromaDB 오류 |
| `404 Not Found` | 리소스 없음 | 존재하지 않는 페르소나 ID |

**422 에러 응답 예시**
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "profile", "age"],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```
