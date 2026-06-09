import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App.jsx';
import { PERSONAS } from '../data/mockPersonas.js';

/* ── 직접 입력 폼에서 사용하는 공통 컴포넌트 ── */
const JOB_TYPES = ['직장인', '자영업자', '공무원', '프리랜서'];
const RISK_TYPES = ['보수형', '중립형', '적극형'];
const EVENT_TYPES = ['자녀대학', '자녀결혼', '부모부양', '이직·퇴직', '기타'];
// 직접 입력은 재무 정보만 — 나이/직업/은퇴시기/건강/리스크/이벤트는 PreDiagnosis에서 수집
const MANUAL_STEPS = ['재무 정보'];

function SelectGroup({ options, value, onChange }) {
  return (
    <div className="select-group">
      {options.map(opt => (
        <button key={opt} type="button"
          className={`select-btn ${value === opt ? 'selected' : ''}`}
          onClick={() => onChange(opt)}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function toKoreanUnit(num) {
  if (!num || num === 0) return '';
  const uk = Math.floor(num / 100000000);
  const man = Math.floor((num % 100000000) / 10000);
  const rest = num % 10000;
  const parts = [];
  if (uk > 0) parts.push(`${uk}억`);
  if (man > 0) parts.push(`${man}만`);
  if (rest > 0 && uk === 0) parts.push(`${rest.toLocaleString('ko-KR')}`);
  return parts.join(' ');
}

function NumInput({ label, value, onChange, placeholder = '0' }) {
  const [display, setDisplay] = React.useState(value ? Number(value).toLocaleString('ko-KR') : '');
  const [numVal, setNumVal] = React.useState(value ? Number(value) : 0);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || raw === '0') {
      setDisplay(raw);
      setNumVal(0);
      onChange(0);
      return;
    }
    if (!/^\d+$/.test(raw)) return;
    const num = Number(raw);
    setDisplay(num.toLocaleString('ko-KR'));
    setNumVal(num);
    onChange(num);
  };

  const korean = toKoreanUnit(numVal);

  return (
    <div className="input-group">
      <label className="input-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="text" inputMode="numeric" className="input-field"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          style={{ paddingRight: 36 }}
        />
        <span style={{
          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-secondary)', fontSize: 14, pointerEvents: 'none',
        }}>원</span>
      </div>
      {korean && (
        <span style={{ fontSize: 13, color: 'var(--primary)', marginTop: 4, display: 'block' }}>
          ({korean}원)
        </span>
      )}
    </div>
  );
}

/* ── JB금융 연동 로딩 화면 ── */
function LinkingScreen({ persona, onDone }) {
  const [phase, setPhase] = useState('loading'); // 'loading' | 'done'

  React.useEffect(() => {
    const t = setTimeout(() => setPhase('done'), 2200);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (phase === 'done') {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [phase]);

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-page)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, textAlign: 'center',
    }}>
      <img src="/favicon.png" alt="JB금융그룹" style={{ height: 32, marginBottom: 32, opacity: 0.8 }} />

      {phase === 'loading' ? (
        <>
          <div className="spinner" style={{ marginBottom: 24 }} />
          <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>계정 정보를 불러오는 중...</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            JB금융 계정에서<br />재무 데이터를 안전하게 연동하고 있습니다.
          </p>
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
            {['계좌·자산 정보 조회', '국민연금 예상 수령액 연동', '소비 패턴 분석'].map((item, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)', borderRadius: 10,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: 'var(--shadow-card)', fontSize: 14,
              }}>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>연동 완료!</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {persona.name}님의 정보를 성공적으로 불러왔습니다.
          </p>
        </>
      )}
    </div>
  );
}

/* ── 메인 Onboarding 컴포넌트 ── */
export default function Onboarding() {
  const navigate = useNavigate();
  const { setProfile, setDiagnosis, setSimulation, setRecommend } = useAppContext();

  // 'method'(연동방식선택) | 'account'(계정선택) | 'linking'(로딩) | 'manual'(직접입력)
  const [screen, setScreen] = useState('method');
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [manualStep, setManualStep] = useState(0);

  /* 직접 입력 상태 — 재무 정보만 */
  const [finance, setFinance] = useState({
    monthly_income: '', monthly_expense: '', financial_assets: '',
    real_estate_assets: '', liabilities: '', national_pension_expected: '',
    retirement_pension: '', personal_pension: '',
  });

  const resetAll = () => {
    setDiagnosis(null); setSimulation(null); setRecommend(null);
  };

  /* JB금융 연동 계정 선택 → 로딩 → 대시보드 */
  const selectAccount = (persona) => {
    setSelectedPersona(persona);
    setScreen('linking');
  };

  const onLinkingDone = () => {
    const { id, name, label, color, ...profile } = selectedPersona;
    resetAll();
    setProfile(profile);
    navigate('/survey');
  };

  const handleManualNext = () => {
    const profile = {
      // 나이·직업·은퇴시기·건강·리스크·이벤트는 PreDiagnosis에서 수집
      age: 50, job_type: '직장인',
      retirement_target_age: 62,
      monthly_target_living_cost: 2500000,
      risk_type: '중립형',
      health_issue: false,
      life_events: [],
      monthly_income: Number(finance.monthly_income),
      monthly_expense: Number(finance.monthly_expense),
      financial_assets: Number(finance.financial_assets),
      real_estate_assets: Number(finance.real_estate_assets),
      liabilities: Number(finance.liabilities),
      national_pension_expected: Number(finance.national_pension_expected),
      retirement_pension: Number(finance.retirement_pension),
      personal_pension: Number(finance.personal_pension),
    };
    resetAll();
    setProfile(profile);
    navigate('/survey');
  };

  const canManualNext = () => finance.monthly_income && finance.monthly_expense;

  const handleBack = () => {
    if (screen === 'account') { setScreen('method'); return; }
    if (screen === 'manual') {
      if (manualStep > 0) { setManualStep(s => s - 1); return; }
      setScreen('method'); return;
    }
    navigate('/');
  };

  /* ── JB금융 연동 로딩 화면 ── */
  if (screen === 'linking') {
    return <LinkingScreen persona={selectedPersona} onDone={onLinkingDone} />;
  }

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div className="app-header">
        <button className="back-btn" onClick={handleBack}>‹</button>
        <span className="header-title">
          {screen === 'method' ? '진단 시작' : screen === 'account' ? 'JB금융 계정 선택' : '직접 입력'}
        </span>
        <div className="header-right" />
      </div>

      {/* ── 연동 방식 선택 화면 ── */}
      {screen === 'method' && (
        <div style={{ padding: '32px 20px' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>STEP 1</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>정보 연동 방식을 선택하세요</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.7 }}>
            JB금융 계정으로 연동하면 재무 정보를<br />자동으로 불러와 더 정확한 진단이 가능합니다.
          </p>

          {/* JB금융 연동 버튼 (메인) */}
          <button
            onClick={() => setScreen('account')}
            style={{
              width: '100%', background: 'var(--primary)', border: 'none',
              borderRadius: 16, padding: '24px 20px', cursor: 'pointer',
              textAlign: 'left', color: '#fff', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 4px 16px rgba(18,100,211,0.25)',
            }}
          >
            <img src="/favicon.png" alt="JB" style={{ height: 36, borderRadius: 8, background: '#fff', padding: 4 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>JB금융 계정으로 연동</div>
              <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                광주은행·전북은행 계좌 정보를<br />자동으로 불러옵니다
              </div>
            </div>
            <div style={{ fontSize: 22, opacity: 0.8 }}>›</div>
          </button>

          {/* 추천 뱃지 */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span className="badge" style={{ fontSize: 12 }}>✨ 추천 — 더 정확한 진단 결과</span>
          </div>

          {/* 구분선 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-hint)' }}>또는</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* 직접 입력 버튼 */}
          <button
            onClick={() => setScreen('manual')}
            style={{
              width: '100%', background: 'var(--bg-card)', border: '1.5px solid var(--border)',
              borderRadius: 16, padding: '20px', cursor: 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
            }}
          >
            <div style={{
              width: 48, height: 48, background: 'var(--bg-section)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
            }}>✏️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                직접 입력하기
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                재무 정보를 직접 입력하여 진단합니다
              </div>
            </div>
            <div style={{ fontSize: 20, color: 'var(--text-hint)' }}>›</div>
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-hint)', marginTop: 28, lineHeight: 1.7 }}>
            🔒 입력하신 정보는 진단 목적으로만 사용되며<br />외부에 제공되지 않습니다.
          </p>
        </div>
      )}

      {/* ── JB금융 계정 선택 화면 ── */}
      {screen === 'account' && (
        <div style={{ padding: '24px 20px' }}>
          <div style={{
            background: 'var(--primary-light)', borderRadius: 12, padding: '14px 16px',
            marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <img src="/favicon.png" alt="JB" style={{ height: 22 }} />
            <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
              JB금융 고객 계정을 선택해주세요
            </span>
          </div>

          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.7 }}>
            연동할 계정을 선택하면 해당 계정의 재무 정보를<br />자동으로 불러와 진단을 시작합니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectAccount(p)}
                style={{
                  background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                  borderRadius: 16, padding: '18px 20px', textAlign: 'left',
                  cursor: 'pointer', boxShadow: 'var(--shadow-card)',
                  display: 'flex', alignItems: 'center', gap: 16,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: p.color + '22',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {p.job_type === '직장인' ? '👔' : p.job_type === '자영업자' ? '🏪' : '🏛️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.age}세 · {p.job_type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, background: p.color + '18', color: p.color,
                      padding: '2px 8px', borderRadius: 100, fontWeight: 600,
                    }}>{p.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      광주은행·전북은행 계좌 보유
                    </span>
                  </div>
                </div>
                <span style={{ color: 'var(--text-hint)', fontSize: 20 }}>›</span>
              </button>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-hint)', marginTop: 24, lineHeight: 1.7 }}>
            🔒 계정 정보는 진단 목적으로만 사용되며 저장되지 않습니다.
          </p>
        </div>
      )}

      {/* ── 직접 입력 화면 ── */}
      {screen === 'manual' && (
        <>
          {/* 진행률 */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              {MANUAL_STEPS.map((s, i) => (
                <span key={s} style={{
                  fontSize: 12, fontWeight: i === manualStep ? 700 : 400,
                  color: i <= manualStep ? 'var(--primary)' : 'var(--text-hint)',
                }}>{s}</span>
              ))}
            </div>
            <div className="progress-bar">
              <div className="fill" style={{ width: `${((manualStep + 1) / MANUAL_STEPS.length) * 100}%` }} />
            </div>
          </div>

          <div style={{ padding: '24px 20px' }}>
            {/* 재무 정보만 입력 — 나이·직업·은퇴시기 등은 다음 단계(PreDiagnosis)에서 수집 */}
            <div style={{ background: 'var(--primary-light)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--primary)', lineHeight: 1.7 }}>
              재무 정보를 입력해 주세요.<br />나이·직업 등 나머지 정보는 다음 단계에서 입력합니다.
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>재무 현황을 입력해주세요</h2>
            <p className="section-sub">모든 금액은 원(₩) 단위입니다.</p>

            <NumInput label="월 소득 (세후)" value={finance.monthly_income}
              onChange={v => setFinance(p => ({ ...p, monthly_income: v }))} placeholder="예: 5,200,000" />
            <NumInput label="월 고정 지출" value={finance.monthly_expense}
              onChange={v => setFinance(p => ({ ...p, monthly_expense: v }))} placeholder="예: 3,800,000" />
            <NumInput label="금융 자산 (예금·주식 등)" value={finance.financial_assets}
              onChange={v => setFinance(p => ({ ...p, financial_assets: v }))} placeholder="예: 120,000,000" />
            <NumInput label="부동산 자산" value={finance.real_estate_assets}
              onChange={v => setFinance(p => ({ ...p, real_estate_assets: v }))} placeholder="예: 350,000,000" />
            <NumInput label="부채 (대출 잔액 등)" value={finance.liabilities}
              onChange={v => setFinance(p => ({ ...p, liabilities: v }))} placeholder="예: 80,000,000" />

            <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />
            <p className="section-sub">예상 연금 수령액</p>

            <NumInput label="국민연금 예상 수령액/월" value={finance.national_pension_expected}
              onChange={v => setFinance(p => ({ ...p, national_pension_expected: v }))} placeholder="예: 870,000" />
            <NumInput label="퇴직연금 총 적립액" value={finance.retirement_pension}
              onChange={v => setFinance(p => ({ ...p, retirement_pension: v }))} placeholder="예: 40,000,000" />
            <NumInput label="개인연금 수령액/월" value={finance.personal_pension}
              onChange={v => setFinance(p => ({ ...p, personal_pension: v }))} placeholder="0" />

            <button className="btn-primary" style={{ marginTop: 32 }}
              disabled={!canManualNext()} onClick={handleManualNext}>
              다음 단계로 →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
