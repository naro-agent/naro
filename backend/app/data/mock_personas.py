PERSONAS = {
    "persona_a": {
        "id": "persona_a",
        "name": "김철수",
        "age": 55,
        "job_type": "직장인",
        "retirement_target_age": 62,
        "monthly_target_living_cost": 2500000,
        "monthly_income": 5200000,
        "financial_assets": 120000000,
        "real_estate_assets": 0,
        "liabilities": 80000000,
        "national_pension_expected": 870000,
        "retirement_pension": 40000000,
        "personal_pension": 0,
        "monthly_expense": 3800000,
        "risk_type": "중립형",
        "life_events": [
            {"type": "자녀대학", "years_later": 2, "monthly_cost": 1200000},
            {"type": "부모부양", "years_later": 0, "monthly_cost": 500000},
        ],
        "health_issue": False,

        # ── 소비 카테고리 (월 평균, 단위: 원) ──
        "spending_categories": {
            "식비": 620000,
            "교통·주유": 280000,
            "의료·건강": 150000,
            "교육·자녀": 480000,
            "문화·여가": 190000,
            "통신": 95000,
            "보험료": 320000,
            "대출상환": 650000,
            "기타고정지출": 215000,
        },

        # ── 월별 저축 추이 (최근 12개월, 단위: 원) ──
        "monthly_savings_trend": [
            820000, 750000, 1100000, 680000, 900000, 780000,
            1050000, 720000, 850000, 940000, 610000, 730000,
        ],

        # ── 보험 가입 현황 ──
        "insurance": [
            {"name": "종신보험", "company": "삼성생명", "monthly_premium": 180000, "coverage": "사망 3억"},
            {"name": "실손보험", "company": "현대해상", "monthly_premium": 87000, "coverage": "의료비 실손"},
            {"name": "암보험", "company": "한화생명", "monthly_premium": 53000, "coverage": "암진단금 3,000만원"},
        ],

        # ── 계좌 현황 ──
        "accounts": [
            {"type": "주거래통장", "bank": "광주은행", "balance": 8500000},
            {"type": "적금", "bank": "전북은행", "balance": 24000000, "monthly_deposit": 500000},
            {"type": "주식·펀드", "bank": "증권사", "balance": 87500000},
        ],

        # ── 신용 정보 ──
        "credit_score": 782,
        "loan_history": "정상 상환 중 (주택담보대출 잔액 8,000만원, 잔여 기간 8년)",

        "diagnosis": {
            "total_score": 55,
            "finance_score": 41,
            "event_score": 48,
            "consumption_score": 62,
            "health_score": 75,
            "asset_gap": 180000000,
            "monthly_shortfall": 430000,
            "peer_comparison": "평균보다 낮음",
            "risk_areas": ["재무", "생애이벤트"],
            "summary": "재무 준비 상태가 취약합니다. 자녀 대학 입학과 부모 부양이 겹치는 시점에 현금흐름 적자 위험이 있습니다.",
        },
    },

    "persona_b": {
        "id": "persona_b",
        "name": "이영희",
        "age": 53,
        "job_type": "자영업자",
        "retirement_target_age": 65,
        "monthly_target_living_cost": 2000000,
        "monthly_income": 3500000,
        "financial_assets": 20000000,
        "real_estate_assets": 350000000,
        "liabilities": 150000000,
        "national_pension_expected": 420000,
        "retirement_pension": 0,
        "personal_pension": 0,
        "monthly_expense": 2800000,
        "risk_type": "보수형",
        "life_events": [],
        "health_issue": False,

        "spending_categories": {
            "식비": 480000,
            "교통·주유": 210000,
            "의료·건강": 95000,
            "교육·자녀": 0,
            "문화·여가": 120000,
            "통신": 78000,
            "보험료": 195000,
            "대출상환": 980000,
            "사업운영비": 642000,
        },

        "monthly_savings_trend": [
            320000, 180000, 450000, 220000, 380000, 150000,
            510000, 290000, 120000, 400000, 260000, 340000,
        ],

        "insurance": [
            {"name": "실손보험", "company": "DB손해보험", "monthly_premium": 112000, "coverage": "의료비 실손"},
            {"name": "화재보험", "company": "메리츠화재", "monthly_premium": 83000, "coverage": "건물·집기 2억"},
        ],

        "accounts": [
            {"type": "사업자통장", "bank": "광주은행", "balance": 5200000},
            {"type": "개인통장", "bank": "전북은행", "balance": 3800000},
            {"type": "정기예금", "bank": "광주은행", "balance": 11000000, "monthly_deposit": 0},
        ],

        "credit_score": 694,
        "loan_history": "부동산담보대출 15,000만원 (변동금리 4.8%), 잔여 기간 15년",

        "diagnosis": {
            "total_score": 49,
            "finance_score": 38,
            "event_score": 72,
            "consumption_score": 55,
            "health_score": 68,
            "asset_gap": 240000000,
            "monthly_shortfall": 610000,
            "peer_comparison": "평균보다 낮음",
            "risk_areas": ["재무", "소비패턴"],
            "summary": "유동 금융자산이 매우 부족합니다. 부동산 자산 활용 전략과 국민연금 추납이 시급합니다.",
        },
    },

    "persona_c": {
        "id": "persona_c",
        "name": "박민준",
        "age": 58,
        "job_type": "공무원",
        "retirement_target_age": 60,
        "monthly_target_living_cost": 3000000,
        "monthly_income": 4800000,
        "financial_assets": 280000000,
        "real_estate_assets": 220000000,
        "liabilities": 0,
        "national_pension_expected": 0,
        "retirement_pension": 0,
        "personal_pension": 2100000,
        "monthly_expense": 4500000,
        "risk_type": "적극형",
        "life_events": [],
        "health_issue": True,

        "spending_categories": {
            "식비": 820000,
            "교통·주유": 350000,
            "의료·건강": 580000,
            "교육·자녀": 0,
            "문화·여가": 640000,
            "통신": 120000,
            "보험료": 410000,
            "대출상환": 0,
            "기타고정지출": 580000,
        },

        "monthly_savings_trend": [
            180000, 220000, 95000, 310000, 150000, 80000,
            260000, 190000, 120000, 340000, 70000, 210000,
        ],

        "insurance": [
            {"name": "공무원단체보험", "company": "공제회", "monthly_premium": 145000, "coverage": "사망·상해"},
            {"name": "실손보험", "company": "삼성화재", "monthly_premium": 134000, "coverage": "의료비 실손"},
            {"name": "암·중대질병", "company": "교보생명", "monthly_premium": 131000, "coverage": "암·뇌·심장 각 5,000만원"},
        ],

        "accounts": [
            {"type": "주거래통장", "bank": "전북은행", "balance": 12300000},
            {"type": "주식·ETF", "bank": "증권사", "balance": 185000000},
            {"type": "채권·펀드", "bank": "증권사", "balance": 82700000},
        ],

        "credit_score": 851,
        "loan_history": "대출 없음 (무부채)",

        "diagnosis": {
            "total_score": 62,
            "finance_score": 71,
            "event_score": 80,
            "consumption_score": 45,
            "health_score": 44,
            "asset_gap": 60000000,
            "monthly_shortfall": 150000,
            "peer_comparison": "평균보다 높음",
            "risk_areas": ["소비패턴", "건강"],
            "summary": "연금은 안정적이나 소비 과다와 건강 이슈로 의료비 리스크가 높습니다. 지출 구조 조정이 필요합니다.",
        },
    },
}

PEER_AVERAGE_SCORES = {
    "50": {"total": 52, "finance": 48, "event": 60, "consumption": 55, "health": 65},
    "55": {"total": 58, "finance": 54, "event": 62, "consumption": 57, "health": 60},
    "58": {"total": 61, "finance": 58, "event": 65, "consumption": 58, "health": 55},
    "60": {"total": 63, "finance": 60, "event": 68, "consumption": 59, "health": 52},
}

# 동연령 소비 카테고리 평균 (월, 원)
PEER_SPENDING_AVERAGE = {
    "55": {
        "식비": 520000,
        "교통·주유": 240000,
        "의료·건강": 180000,
        "문화·여가": 210000,
        "보험료": 280000,
    },
    "58": {
        "식비": 540000,
        "교통·주유": 220000,
        "의료·건강": 250000,
        "문화·여가": 230000,
        "보험료": 310000,
    },
}

JB_PRODUCTS = [
    {
        "id": "prod_1",
        "bank": "광주은행",
        "name": "노후 든든 적금",
        "type": "적금",
        "description": "월 최소 10만원부터 가입 가능한 노후 준비 전용 적금",
        "rate": "연 4.2%",
        "for_risk_types": ["보수형", "중립형"],
    },
    {
        "id": "prod_2",
        "bank": "전북은행",
        "name": "연금 플러스 펀드",
        "type": "펀드",
        "description": "안정적 채권 중심의 노후 자산 증식 펀드",
        "rate": "기대수익률 연 5.5%",
        "for_risk_types": ["중립형", "적극형"],
    },
    {
        "id": "prod_3",
        "bank": "광주은행",
        "name": "실버 케어 보험",
        "type": "보험",
        "description": "60세 이상 의료비 집중 보장 건강보험",
        "rate": "월 보험료 82,000원",
        "for_risk_types": ["보수형", "중립형", "적극형"],
    },
    {
        "id": "prod_4",
        "bank": "JB우리캐피탈",
        "name": "부동산 담보 대출",
        "type": "대출",
        "description": "보유 부동산 담보로 유동성 확보 (노후 준비 목적)",
        "rate": "연 4.8% (변동금리)",
        "for_risk_types": ["보수형", "중립형"],
    },
    {
        "id": "prod_5",
        "bank": "전북은행",
        "name": "개인연금 저축보험",
        "type": "연금",
        "description": "세액공제 혜택이 있는 개인연금 저축보험",
        "rate": "연 3.8% 공시이율",
        "for_risk_types": ["보수형", "중립형", "적극형"],
    },
]
