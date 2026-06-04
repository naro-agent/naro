# 나로 (NaRo) — 나만의 노후 항로

> **나만의 노후 항로를 설계해주는 초개인화 은퇴 준비 진단 AI Agent 서비스**  
> JB금융그룹 Fin:AI Challenge 출품작 (지정주제 1: LifeLong WM AI Agent 서비스 개발)

---

## 서비스 소개

노후 준비는 목적지(은퇴)는 같지만, 항로는 사람마다 달라야 합니다.

**나로(NaRo)** 는 개인의 재무 현황, 생애 이벤트, 건강 상태, 소비 패턴을 종합 분석해 은퇴 준비 점수를 산출하고, 경제 지표 기반의 생애 현금흐름 예측과 맞춤형 금융 상품 추천을 제공하는 모바일 웹 앱입니다.

### 주요 기능

| 기능 | 설명 |
|------|------|
| **은퇴 준비 진단** | 재무·생애이벤트·소비패턴·건강 4개 영역 점수 산출 및 동연령 비교 |
| **생애 현금흐름 예측** | 물가·임금·의료비 상승률 반영, 신뢰구간 분포형 그래프 |
| **맞춤 추천** | 취약 영역 기반 액션 카드 + JB금융 상품 연계 |
| **AI 상담** | Claude 기반 자유 대화 및 5단계 가이드 상담 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19 · Vite · react-router-dom v7 · Recharts · Axios |
| 백엔드 | Python 3.11 · FastAPI · Uvicorn |
| AI Agent | LangChain · Anthropic Claude API (`claude-sonnet-4-6`) |
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

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 패키지 설치
pip install -r requirements.txt
```

#### 환경변수 설정

`backend/.env` 파일을 생성하고 아래 내용을 입력합니다.

```env
ANTHROPIC_API_KEY=sk-ant-여기에_API_키_입력
FRONTEND_URL=http://localhost:5173
```

#### 백엔드 실행

```bash
uvicorn main:app --reload --port 8000
```

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

---

## 서비스 이용 가이드

### 1단계 — 정보 입력 방식 선택

홈 화면에서 두 가지 방법 중 하나를 선택합니다.

- **JB금융 계정 연동** (시연용): 광주은행·전북은행 계좌 보유 고객의 재무 데이터를 자동으로 불러옵니다.
- **직접 입력**: 월 소득·지출, 자산·부채, 연금 수령액 등을 수동으로 입력합니다.

### 2단계 — 노후 준비 사전 질문

- 목표 은퇴 나이, 은퇴 후 월 생활비 목표
- 건강 이슈 여부
- 앞으로 예상되는 큰 지출 이벤트 (자녀 대학·결혼, 부모 부양 등)
- 투자 성향 (보수형 / 중립형 / 적극형)

### 3단계 — 재무 현황 대시보드

3층 연금 구조(국민연금·퇴직연금·개인연금), 자산·부채 현황을 한눈에 확인합니다.

### 4단계 — 은퇴 준비 진단

4개 영역 점수와 레이더 차트로 현재 노후 준비 상태를 진단합니다.

| 영역 | 내용 |
|------|------|
| 재무 | 순자산, 연금, 저축률 |
| 생애이벤트 | 이벤트 대비 현금흐름 여력 |
| 소비패턴 | 지출 구조, 저축 여력 |
| 건강 | 의료비 리스크, 보험 현황 |

- 70점 이상: 양호 · 50~69점: 보통 · 50점 미만: 위험

### 5단계 — 생애 현금흐름 예측

최근 5년 평균 경제 지표를 반영한 예측 그래프를 제공합니다.

| 지표 | 적용값 |
|------|--------|
| 소비자 물가 상승률 | 연 3.2% |
| 임금 상승률 | 연 3.5% |
| 의료비 상승률 | 연 4.5% |
| 미래 불확실성 (±) | 연 8% |

실선은 예측 현금흐름, 음영은 불확실성 범위를 나타냅니다.

### 6단계 — 맞춤 추천

취약 영역을 기반으로 우선순위 액션 카드와 JB금융 맞춤 상품을 추천합니다.

### 7단계 — AI 상담

궁금한 점을 자유롭게 질문하거나, 5단계 가이드 상담을 통해 AI가 종합 분석을 제공합니다.

---

## 프로젝트 구조

```
naro/
├── frontend/                  # React 모바일 웹 앱
│   └── src/
│       ├── pages/             # 8개 페이지 컴포넌트
│       ├── api/               # Axios API 클라이언트
│       └── styles/            # 전역 CSS (와뱅크 디자인 시스템)
│
└── backend/                   # FastAPI 서버
    ├── main.py                # 앱 진입점
    └── app/
        ├── agents/            # AI Agent 로직
        │   ├── diagnosis_agent.py
        │   ├── simulation_agent.py
        │   ├── recommend_agent.py
        │   └── chat_agent.py
        ├── routers/           # API 라우터
        └── schemas.py         # Pydantic 데이터 모델
```

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/diagnosis` | 은퇴 준비 진단 실행 |
| `POST` | `/api/simulation` | 생애 현금흐름 시뮬레이션 |
| `POST` | `/api/recommend` | 맞춤 추천 생성 |
| `POST` | `/api/chat` | AI 상담 |
| `GET` | `/api/personas` | 시연용 페르소나 목록 |
| `GET` | `/health` | 서버 상태 확인 |

---

## 유의사항

- 본 서비스의 AI 추천은 **정보 제공 목적**이며 금융 투자 조언이 아닙니다. (금융소비자보호법 준수)
- 입력하신 정보는 진단 목적으로만 사용되며 외부에 제공되지 않습니다.
- 생애 현금흐름 예측 결과는 경제 지표 기반의 추정값으로 실제와 다를 수 있습니다.

---

## 라이선스

본 프로젝트는 JB금융그룹 Fin:AI Challenge 출품 목적으로 제작되었습니다.
