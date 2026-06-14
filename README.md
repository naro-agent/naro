# 나로 (NaRo) — 나만의 노후 항로

> **나만의 노후 항로를 설계해주는 초개인화 은퇴 준비 진단 AI Agent 서비스**  
> JB금융그룹 Fin:AI Challenge 출품작 (지정주제 1: LifeLong WM AI Agent 서비스 개발)

---

## 서비스 소개

노후 준비는 목적지(은퇴)는 같지만, 항로는 사람마다 달라야 합니다.

**나로(NaRo)** 는 개인의 재무 현황, 생애 이벤트, 건강 상태, 소비 패턴을 종합 분석해 노후 준비 점수를 산출하고, 경제 지표 기반의 생애 현금흐름 예측과 RAG 기반 맞춤형 금융 상품 추천을 제공하는 모바일 웹 앱입니다.

### 주요 기능

| 기능 | 설명 |
|------|------|
| **노후 준비 진단** | 국민연금공단 기준 재무·건강·여가활동·대인관계 4개 영역 설문 점수 산출 및 동연령 비교 |
| **생애 현금흐름 예측** | 물가·임금·의료비 상승률 반영, 신뢰구간 분포형 그래프 |
| **RAG 기반 맞춤 추천** | 선택 영역별 ChromaDB 벡터 검색 + Claude가 영역당 2개 이상 JB금융 상품 우선순위 선별 |
| **AI 상담** | Claude 기반 자유 대화 및 진단 결과 기반 맞춤 가이드 상담 |
| **MLOps 파이프라인** | KReIS 10차 공공데이터 기반 노후 준비 점수 예측 모델 학습·관리 (DVC + XGBoost + SHAP) |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19 · Vite · react-router-dom v7 · Recharts · Axios |
| 백엔드 | Python 3.11 · FastAPI · Uvicorn |
| AI Agent | LangChain · Anthropic Claude API (`claude-sonnet-4-6`) |
| RAG | ChromaDB · sentence-transformers (`jhgan/ko-sroberta-multitask`) |
| MLOps | DVC · XGBoost · RandomForest · SHAP |
| 배포 | Vercel (프론트) · Railway (백엔드) |

---

## 시작하기

### 사전 요구사항

- Node.js 18 이상
- Python 3.11 이상
- Anthropic API 키

### 1. 저장소 클론

```bash
git clone https://github.com/naro-agent/naro.git
cd naro
```

### 2. 백엔드 설정

```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv venv

# Windows (Git Bash)
source venv/Scripts/activate
# macOS / Linux
source venv/bin/activate

# 패키지 설치 (torch, chromadb, sentence-transformers 포함 — 약 2~3GB)
pip install -r requirements.txt
```

#### 환경변수 설정

`backend/.env` 파일을 생성하고 아래 내용을 입력합니다.

```env
# 표준 Anthropic API
ANTHROPIC_API_KEY=sk-ant-여기에_API_키_입력

# AjouLLM 게이트웨이 사용 시 (선택)
# ANTHROPIC_AUTH_TOKEN=...
# ANTHROPIC_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway/claude

FRONTEND_URL=http://localhost:5173
```

#### 백엔드 실행

```bash
uvicorn main:app --reload --port 8000
```

> **최초 실행 시**: 한국어 임베딩 모델 `jhgan/ko-sroberta-multitask` (~400MB)를 자동 다운로드합니다.  
> 다운로드 완료 후 ChromaDB 벡터 스토어를 자동 빌드합니다 (1회만).  
> 이후 실행부터는 캐시에서 즉시 로드됩니다.

> 실행 후 http://localhost:8000/health 에서 정상 동작을 확인할 수 있습니다.

### 3. 프론트엔드 설정

```bash
cd frontend

# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

> 브라우저에서 http://localhost:5173 으로 접속합니다.

### 4. MLOps 파이프라인 실행 (선택)

```bash
cd mlops

# 백엔드 venv 재사용
source ../backend/venv/Scripts/activate

# MLOps 추가 패키지 설치
pip install -r requirements.txt

# KReIS 원본 데이터를 mlops/data/raw/ 에 넣은 후
dvc repro
```

---

## 서비스 이용 가이드

### 1단계 — 영역 선택 + 정보 입력

- **진단 영역 선택**: 재무, 건강, 여가활동, 대인관계 중 원하는 영역 선택 (복수 선택 가능)
- **JB금융 계정 연동** (시연용): 광주은행·전북은행 계좌 보유 고객의 재무 데이터를 자동으로 불러옵니다.
- **직접 입력**: 월 소득·지출, 자산·부채, 연금 수령액 등을 수동으로 입력합니다.

### 2단계 — 설문조사

**기본사항 5문항** (전체 필수) + **선택 영역별 5문항** 순서로 진행합니다.

- 기본사항: 은퇴 인식·가치관·정보탐색 행동 등 (정량 데이터로 파악하기 어려운 항목)
- 4대 영역: 인식·행동·태도 위주 (국민연금공단 2024년 노후준비실태조사 기준)

### 3단계 — 노후 준비 사전 질문

- 목표 은퇴 나이, 은퇴 후 월 생활비 목표
- 건강 이슈 여부
- 앞으로 예상되는 큰 지출 이벤트 (자녀 대학·결혼, 부모 부양 등)
- 투자 성향 (보수형 / 중립형 / 적극형)

### 4단계 — 재무 현황 대시보드

3층 연금 구조(국민연금·퇴직연금·개인연금), 자산·부채 현황을 한눈에 확인합니다.

### 5단계 — 노후 준비 진단

선택 영역 수에 따라 차트가 자동으로 전환됩니다.

| 선택 영역 수 | 차트 형태 |
|------|------|
| 1~2개 | 수평 바 차트 (내 점수 vs 동연령 평균 비교) |
| 3~4개 | 레이더 차트 |

| 영역 | 동연령 평균 (국민연금공단) |
|------|------|
| 재무 | 61.9점 |
| 건강 | 76.0점 |
| 여가활동 | 60.3점 |
| 대인관계 | 69.8점 |

점수 기준: 80점↑ 양호 · 60~79점 보통 · 40~59점 미흡 · 0~39점 위험

### 6단계 — 생애 현금흐름 예측

최근 5년 평균 경제 지표를 반영한 예측 그래프를 제공합니다.

| 지표 | 적용값 |
|------|--------|
| 소비자 물가 상승률 | 연 3.2% |
| 임금 상승률 | 연 3.5% |
| 의료비 상승률 | 연 4.5% |
| 미래 불확실성 (±) | 연 8% |

실선은 예측 현금흐름, 음영은 불확실성 범위, 빨간 음영은 적자 구간을 나타냅니다.

### 7단계 — 맞춤 추천

선택한 진단 영역별로 ChromaDB 벡터 검색을 수행하고, Claude가 영역당 최소 2개 이상 우선순위 순으로 JB금융 상품을 선별합니다.

| 상품 구분 | UI 표시 |
|------|------|
| 전북은행 실제 상품 | 우선순위 번호 뱃지 + 영역 색상 카드 |
| JB금융 미출시 기획 상품 | `⚠️ 가상 상품` 뱃지 + 점선 테두리 |

> 가상 상품은 건강·여가활동·대인관계 영역에 특화된 기획 단계 상품입니다. 타 금융사 유사 상품을 참고해 제작되었으며 실제 가입은 불가합니다.

### 8단계 — AI 상담

궁금한 점을 자유롭게 질문(자유 상담)하거나, 진단 결과를 바탕으로 AI가 맞춤 질문을 생성하는 가이드 상담을 통해 종합 분석을 받을 수 있습니다.

---

## 프로젝트 구조

```
naro/
├── frontend/                  # React 모바일 웹 앱
│   └── src/
│       ├── pages/             # 11개 페이지 컴포넌트
│       ├── data/              # 설문 문항 + 페르소나 데이터
│       ├── api/               # Axios API 클라이언트
│       └── styles/            # 전역 CSS (와뱅크 디자인 시스템)
│
├── backend/                   # FastAPI 서버
│   ├── main.py                # 앱 진입점
│   └── app/
│       ├── agents/            # AI Agent 로직
│       │   ├── simulation_agent.py  # 룰 기반 현금흐름 예측
│       │   ├── recommend_agent.py   # RAG + Claude 상품 추천
│       │   └── chat_agent.py        # AI 상담 (스트리밍 지원)
│       ├── rag/               # ChromaDB 벡터 스토어
│       ├── routers/           # API 라우터
│       ├── schemas.py         # Pydantic 데이터 모델
│       └── data/
│           └── products/      # 상품 RAG 문서 (실제 6개 + 가상 1개)
│
└── mlops/                     # MLOps 파이프라인
    ├── dvc.yaml               # DVC 파이프라인 (featurize → train → explain)
    ├── params.yaml            # 하이퍼파라미터 중앙 관리
    └── src/
        ├── features/          # KReIS 데이터 Feature Engineering
        ├── models/            # XGBoost / RandomForest 학습
        └── explain/           # SHAP 피처 중요도 시각화
```

---

## MLOps 파이프라인

국민연금공단 **KReIS 10차 노후준비실태조사** 데이터(8,736명)를 기반으로 노후 준비 점수 예측 모델을 학습·관리합니다.

### 파이프라인 구조

```
data/raw/ (KReIS CSV)
    ↓ featurize
data/processed/naro_features.csv  (8,736명 × 39컬럼)
    ↓ train
models/{target}_best.pkl  (4개 영역별 최적 모델)
    ↓ explain
reports/shap_{target}_*.png  (SHAP 피처 중요도)
```

### 모델 성능 (5-Fold CV)

| 영역 | 최적 모델 | MAE | R² |
|------|----------|-----|-----|
| 재무 | RandomForest | 2.60 | 0.764 |
| 건강 | XGBoost | 8.42 | 0.530 |
| 여가활동 | XGBoost | 7.56 | 0.212 |
| 대인관계 | XGBoost | 10.78 | 0.317 |

### 파이프라인 실행

```bash
cd mlops
source ../backend/venv/Scripts/activate

# 전체 파이프라인 실행 (변경된 스테이지만 재실행)
dvc repro

# params.yaml 수정 후 실험 재현
dvc repro --force
```

`params.yaml`에서 하이퍼파라미터를 수정하면 DVC가 변경된 스테이지부터 자동으로 재실행합니다.

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/simulation` | 생애 현금흐름 시뮬레이션 |
| `POST` | `/api/recommend` | RAG 기반 맞춤 추천 생성 |
| `POST` | `/api/chat` | AI 상담 |
| `POST` | `/api/chat/stream` | AI 상담 (스트리밍) |
| `POST` | `/api/feedback` | 피드백 저장 |
| `GET` | `/api/personas` | 시연용 페르소나 목록 |
| `GET` | `/health` | 서버 상태 확인 |

---

## 유의사항

- 본 서비스의 AI 추천은 **정보 제공 목적**이며 금융 투자 조언이 아닙니다. (금융소비자보호법 준수)
- **가상 상품**은 현재 출시되지 않은 기획 단계 상품으로 실제 가입이 불가합니다.
- 입력하신 정보는 진단 목적으로만 사용되며 외부에 제공되지 않습니다.
- 생애 현금흐름 예측 결과는 경제 지표 기반의 추정값으로 실제와 다를 수 있습니다.

---

## 라이선스

본 프로젝트는 JB금융그룹 Fin:AI Challenge 출품 목적으로 제작되었습니다.
