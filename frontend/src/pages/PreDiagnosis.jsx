import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Plus, X } from 'lucide-react';
import { useAppContext } from '../App.jsx';

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

function MoneyInput({ label, value, onChange, placeholder = '0', style: extraStyle }) {
  const [display, setDisplay] = useState(value ? Number(value).toLocaleString('ko-KR') : '');
  const [numVal, setNumVal] = useState(value ? Number(value) : 0);

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
    <div>
      {label && <label style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, display: 'block', marginBottom: 6 }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          type="text" inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          style={{
            width: '100%', height: 44, background: '#fff',
            border: '1.5px solid var(--border)', borderRadius: 8,
            padding: '0 32px 0 12px', fontSize: 15, fontFamily: 'inherit', outline: 'none',
            boxSizing: 'border-box',
            ...extraStyle,
          }}
        />
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-secondary)', fontSize: 13, pointerEvents: 'none',
        }}>원</span>
      </div>
      {korean && (
        <span style={{ fontSize: 12, color: 'var(--primary)', marginTop: 3, display: 'block' }}>
          ({korean}원)
        </span>
      )}
    </div>
  );
}

const HEALTH_TYPES = [
  '고혈압', '당뇨', '심장질환', '암·종양', '관절·척추', '기타 만성질환',
];

// kind: 'recurring' = 지속형(몇 년간 + 월 비용), 'lump' = 일시형(총 비용만)
const EVENT_PRESETS = [
  {
    label: '자녀 대학 등록금', kind: 'recurring',
    hint: '대학 재학 기간 동안 반복 지출',
    value: { type: '자녀대학', duration_years: 4, monthly_cost: 1000000 },
  },
  {
    label: '부모님 부양', kind: 'recurring',
    hint: '매월 지속적으로 발생하는 부양 비용',
    value: { type: '부모부양', duration_years: 10, monthly_cost: 500000 },
  },
  {
    label: '자녀 결혼 비용', kind: 'lump',
    hint: '결혼 시 한 번 발생하는 일시 비용',
    value: { type: '자녀결혼', years_later: 5, total_cost: 30000000 },
  },
  {
    label: '주택 구입·이사', kind: 'lump',
    hint: '구입·이사 시 한 번 발생하는 일시 비용',
    value: { type: '주택', years_later: 3, total_cost: 50000000 },
  },
];

// 일시 비용 → 월 환산 (1개월로 처리, 시뮬레이션에서 단발 충격으로 반영)
const toMonthlyEvent = (preset, data) => {
  if (preset.kind === 'recurring') {
    return {
      type: data.type,
      years_later: 0,
      monthly_cost: data.monthly_cost,
      duration_years: data.duration_years,
    };
  } else {
    // 일시금: 총 비용을 12개월로 나눠서 1년치 월 비용으로 환산
    return {
      type: data.type,
      years_later: data.years_later,
      monthly_cost: Math.round(data.total_cost / 12),
    };
  }
};

// step 계산용 — 건강 이슈 있음 선택 시 건강 세부 질문 삽입
const BASE_QUESTIONS = [
  'retirement_target_age',
  'monthly_target_living_cost',
  'health_issue',
  // health_detail 은 동적으로 삽입
  'life_events',
  'risk_type',
];

const JOB_TYPES = ['직장인', '자영업자', '공무원', '프리랜서'];

export default function PreDiagnosis() {
  const navigate = useNavigate();
  const { profile, setProfile } = useAppContext();

  const [step, setStep] = useState(0);
  // JB연동이면 나이·직업 이미 있으므로 건너뜀
  const isLinked = !!(profile?.spending_categories); // 연동 페르소나는 spending_categories 있음
  const [answers, setAnswers] = useState({
    age: profile?.age || '',
    job_type: profile?.job_type || '',
  });

  // 생애 이벤트
  const [multiSelected, setMultiSelected] = useState([]);
  const [customEvent, setCustomEvent] = useState({ type: '', kind: 'recurring', years_later: '', duration_years: '', monthly_cost: '', total_cost: '' });
  const [showCustomForm, setShowCustomForm] = useState(false);

  // 건강 세부
  const [healthTypes, setHealthTypes] = useState([]);

  const hasHealthIssue = answers.health_issue === true;

  // 동적 질문 목록 생성
  const getSteps = () => {
    const steps = [];
    // 직접 입력 시에만 나이·직업 질문 추가
    if (!isLinked) {
      steps.push('age');
      steps.push('job_type');
    }
    steps.push('retirement_target_age', 'monthly_target_living_cost', 'health_issue');
    if (hasHealthIssue) steps.push('health_detail');
    steps.push('life_events', 'risk_type');
    return steps;
  };

  const steps = getSteps();
  const currentId = steps[step];
  const totalSteps = steps.length;
  const isLast = step === totalSteps - 1;

  const goNext = (newAnswers) => {
    if (!isLast) {
      setStep(s => s + 1);
    } else {
      finalize(newAnswers);
    }
  };

  // 선택만 저장, 넘어가지 않음
  const handleChoice = (value) => {
    const newAnswers = { ...answers, [currentId]: value };
    setAnswers(newAnswers);
  };

  // 건강 세부 선택 토글
  const toggleHealthType = (type) => {
    setHealthTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleHealthDetailNext = () => {
    const newAnswers = { ...answers, health_detail: healthTypes };
    setAnswers(newAnswers);
    goNext(newAnswers);
  };

  // 생애 이벤트 프리셋 토글 — 선택 시 편집 가능한 상태로 저장
  const handleEventToggle = (preset) => {
    setMultiSelected(prev => {
      const exists = prev.some(p => p.type === preset.value.type);
      if (exists) return prev.filter(p => p.type !== preset.value.type);
      // 초기값: preset 기본값 복사
      return [...prev, { ...preset.value, _kind: preset.kind }];
    });
  };

  // 직접 입력 이벤트 추가
  const addCustomEvent = () => {
    if (!customEvent.type) return;
    if (customEvent.kind === 'recurring' && (!customEvent.duration_years || !customEvent.monthly_cost)) return;
    if (customEvent.kind === 'lump' && (!customEvent.years_later || !customEvent.total_cost)) return;

    const event = customEvent.kind === 'recurring'
      ? { type: customEvent.type, years_later: 0, monthly_cost: Number(customEvent.monthly_cost), duration_years: Number(customEvent.duration_years), _kind: 'recurring' }
      : { type: customEvent.type, years_later: Number(customEvent.years_later), monthly_cost: Math.round(Number(customEvent.total_cost) / 12), _kind: 'lump' };

    setMultiSelected(prev => [...prev, event]);
    setCustomEvent({ type: '', kind: 'recurring', years_later: '', duration_years: '', monthly_cost: '', total_cost: '' });
    setShowCustomForm(false);
  };

  const removeEvent = (type) => {
    setMultiSelected(prev => prev.filter(p => p.type !== type));
  };

  const handleEventsNext = () => {
    // 각 이벤트를 시뮬레이션용 형태로 변환
    const converted = multiSelected.map(e => {
      const preset = EVENT_PRESETS.find(p => p.value.type === e.type);
      if (!preset) return e; // 직접 입력은 그대로
      return toMonthlyEvent(preset, e);
    });
    // 직접 입력 커스텀 이벤트 병합
    const customEvents = multiSelected.filter(e => !EVENT_PRESETS.some(p => p.value.type === e.type));
    const newAnswers = { ...answers, life_events: [...converted, ...customEvents] };
    setAnswers(newAnswers);
    goNext(newAnswers);
  };

  const finalize = (finalAnswers) => {
    const updated = {
      ...profile,
      age: Number(finalAnswers.age) || profile?.age || 55,
      job_type: finalAnswers.job_type || profile?.job_type || '직장인',
      retirement_target_age: finalAnswers.retirement_target_age ?? 62,
      monthly_target_living_cost: finalAnswers.monthly_target_living_cost ?? 2500000,
      health_issue: finalAnswers.health_issue ?? false,
      health_detail: finalAnswers.health_detail ?? [],
      life_events: finalAnswers.life_events ?? [],
      risk_type: finalAnswers.risk_type ?? '중립형',
    };
    setProfile(updated);
    navigate('/dashboard');
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
    else navigate('/onboarding');
  };

  // 현재 단계에서 다음으로 넘어갈 수 있는지 검증
  const canGoNext = () => {
    if (currentId === 'age') return !!answers.age;
    if (currentId === 'job_type') return !!answers.job_type;
    if (currentId === 'retirement_target_age') return !!answers.retirement_target_age;
    if (currentId === 'monthly_target_living_cost') return !!answers.monthly_target_living_cost;
    if (currentId === 'health_issue') return answers.health_issue !== undefined;
    if (currentId === 'risk_type') return !!answers.risk_type;
    return true; // health_detail, life_events는 선택 없이도 다음 가능
  };

  // 다음 버튼 클릭 핸들러
  const handleNext = () => {
    if (currentId === 'health_detail') { handleHealthDetailNext(); return; }
    if (currentId === 'life_events') { handleEventsNext(); return; }
    const newAnswers = { ...answers };
    goNext(newAnswers);
  };

  // ── 질문별 UI 렌더 ──
  const renderQuestion = () => {
    // 공통 선택 버튼
    const ChoiceBtn = ({ label, value, selected, onClick }) => (
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: selected ? 'var(--primary-light)' : 'var(--bg-card)',
          border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
          textAlign: 'left', transition: 'all 0.15s', fontFamily: 'inherit', width: '100%',
        }}
      >
        {selected
          ? <CheckCircle2 size={20} color="var(--primary)" strokeWidth={2} />
          : <Circle size={20} color="var(--border)" strokeWidth={1.5} />
        }
        <span style={{ fontSize: 16, fontWeight: selected ? 700 : 400, color: selected ? 'var(--primary)' : 'var(--text-primary)' }}>
          {label}
        </span>
      </button>
    );

    if (currentId === 'age') {
      return (
        <>
          <h2 style={titleStyle}>현재 나이를 알려주세요.</h2>
          <p style={subStyle}>노후 준비 기간과 동연령 비교에 활용됩니다.</p>
          <div className="input-group">
            <input
              type="number" className="input-field" placeholder="예: 55"
              value={answers.age || ''}
              onChange={e => setAnswers(p => ({ ...p, age: e.target.value }))}
              style={{ fontSize: 22, fontWeight: 700, textAlign: 'center' }}
            />
          </div>
        </>
      );
    }

    if (currentId === 'job_type') {
      return (
        <>
          <h2 style={titleStyle}>직업 유형을 선택해주세요.</h2>
          <p style={subStyle}>직업 유형에 따라 연금·퇴직금 구조가 달라집니다.</p>
          <div style={listStyle}>
            {JOB_TYPES.map(jt => (
              <ChoiceBtn key={jt} label={jt} value={jt}
                selected={answers.job_type === jt}
                onClick={() => setAnswers(p => ({ ...p, job_type: jt }))} />
            ))}
          </div>
        </>
      );
    }

    if (currentId === 'retirement_target_age') {
      return (
        <>
          <h2 style={titleStyle}>몇 세에 은퇴하고 싶으신가요?</h2>
          <p style={subStyle}>목표 은퇴 시기는 노후 준비 기간 계산의 핵심입니다.</p>
          <div style={listStyle}>
            {[{ label: '55세 이전', value: 55 }, { label: '58세', value: 58 }, { label: '60세', value: 60 }, { label: '62세', value: 62 }, { label: '65세 이상', value: 65 }].map(opt => (
              <ChoiceBtn key={opt.value} label={opt.label} value={opt.value}
                selected={answers.retirement_target_age === opt.value}
                onClick={() => handleChoice(opt.value)} />
            ))}
          </div>
        </>
      );
    }

    if (currentId === 'monthly_target_living_cost') {
      return (
        <>
          <h2 style={titleStyle}>은퇴 후 한 달 생활비로 얼마가 필요하신가요?</h2>
          <p style={subStyle}>현재 생활 수준을 유지하는 데 필요한 금액을 선택해 주세요.</p>
          <div style={listStyle}>
            {[{ label: '150만원 이하', value: 1500000 }, { label: '150~200만원', value: 1750000 }, { label: '200~250만원', value: 2250000 }, { label: '250~300만원', value: 2750000 }, { label: '300만원 이상', value: 3500000 }].map(opt => (
              <ChoiceBtn key={opt.value} label={opt.label} value={opt.value}
                selected={answers.monthly_target_living_cost === opt.value}
                onClick={() => handleChoice(opt.value)} />
            ))}
          </div>
        </>
      );
    }

    if (currentId === 'health_issue') {
      return (
        <>
          <h2 style={titleStyle}>현재 건강 이슈가 있으신가요?</h2>
          <p style={subStyle}>만성질환, 정기 치료 등이 있으면 의료비 리스크에 반영됩니다.</p>
          <div style={listStyle}>
            <ChoiceBtn label="없음" value={false} selected={answers.health_issue === false} onClick={() => handleChoice(false)} />
            <ChoiceBtn label="있음" value={true} selected={answers.health_issue === true} onClick={() => handleChoice(true)} />
          </div>
        </>
      );
    }

    if (currentId === 'health_detail') {
      return (
        <>
          <h2 style={titleStyle}>어떤 건강 이슈가 있으신가요?</h2>
          <p style={subStyle}>해당하는 항목을 모두 선택해 주세요. 의료비 리스크 계산에 활용됩니다.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {HEALTH_TYPES.map(type => {
              const selected = healthTypes.includes(type);
              return (
                <button key={type} onClick={() => toggleHealthType(type)} style={{
                  padding: '10px 18px', borderRadius: 100,
                  border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                  background: selected ? 'var(--primary-light)' : 'var(--bg-card)',
                  color: selected ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: selected ? 700 : 400, fontSize: 15,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                  {selected && '✓ '}{type}
                </button>
              );
            })}
          </div>
        </>
      );
    }

    if (currentId === 'life_events') {
      return (
        <>
          <h2 style={titleStyle}>앞으로 예상되는 큰 지출 이벤트가 있으신가요?</h2>
          <p style={subStyle}>해당 항목을 선택하거나 직접 입력하세요. (중복 선택 가능)</p>

          {/* 프리셋 선택 + 인라인 금액 편집 */}
          <div style={listStyle}>
            {EVENT_PRESETS.map((opt, i) => {
              const selected = multiSelected.some(p => p.type === opt.value.type);
              const selectedData = multiSelected.find(p => p.type === opt.value.type);
              return (
                <div key={i}>
                  <button onClick={() => handleEventToggle(opt)} style={{
                    display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                    background: selected ? 'var(--primary-light)' : 'var(--bg-card)',
                    border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: selected ? '14px 14px 0 0' : 14,
                    padding: '14px 18px', cursor: 'pointer',
                    textAlign: 'left', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}>
                    {selected ? <CheckCircle2 size={20} color="var(--primary)" strokeWidth={2} /> : <Circle size={20} color="var(--border)" strokeWidth={1.5} />}
                    <span style={{ fontSize: 15, fontWeight: selected ? 700 : 400, color: selected ? 'var(--primary)' : 'var(--text-primary)', flex: 1 }}>
                      {opt.label}
                    </span>
                    {selected && (
                      <span style={{ fontSize: 12, color: 'var(--primary)', opacity: 0.75 }}>
                        {opt.kind === 'recurring'
                          ? `${selectedData.duration_years}년간 · 월 ${(selectedData.monthly_cost || 0).toLocaleString('ko-KR')}원`
                          : `${selectedData.years_later}년 후 · 총 ${(selectedData.total_cost || 0).toLocaleString('ko-KR')}원`
                        }
                      </span>
                    )}
                  </button>

                  {/* 선택 시 인라인 편집 영역 */}
                  {selected && selectedData && (
                    <div style={{
                      background: '#EAF1FF', border: '1.5px solid var(--primary)',
                      borderTop: 'none', borderRadius: '0 0 14px 14px',
                      padding: '14px 16px',
                    }}>
                      <p style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 10, opacity: 0.8 }}>
                        {opt.hint} — 기본값을 본인 상황에 맞게 수정하세요.
                      </p>

                      {opt.kind === 'recurring' ? (
                        /* 지속형: 몇 년간 + 월 비용 */
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={editLabelStyle}>몇 년간</label>
                            <input type="number" min="1" max="30"
                              value={selectedData.duration_years}
                              onChange={e => setMultiSelected(prev => prev.map(p =>
                                p.type === opt.value.type ? { ...p, duration_years: Number(e.target.value) } : p
                              ))}
                              style={editInputStyle}
                            />
                          </div>
                          <MoneyInput
                            label="월 비용"
                            value={selectedData.monthly_cost}
                            onChange={v => setMultiSelected(prev => prev.map(p =>
                              p.type === opt.value.type ? { ...p, monthly_cost: v } : p
                            ))}
                            placeholder="예: 500,000"
                          />
                          <p style={{ gridColumn: '1/-1', fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                            총 예상 비용: 약 {(selectedData.monthly_cost * 12 * selectedData.duration_years).toLocaleString('ko-KR')}원
                            {toKoreanUnit(selectedData.monthly_cost * 12 * selectedData.duration_years) && ` (${toKoreanUnit(selectedData.monthly_cost * 12 * selectedData.duration_years)}원)`}
                          </p>
                        </div>
                      ) : (
                        /* 일시형: 몇 년 후 + 총 비용 */
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={editLabelStyle}>몇 년 후</label>
                            <input type="number" min="0" max="30"
                              value={selectedData.years_later}
                              onChange={e => setMultiSelected(prev => prev.map(p =>
                                p.type === opt.value.type ? { ...p, years_later: Number(e.target.value) } : p
                              ))}
                              style={editInputStyle}
                            />
                          </div>
                          <MoneyInput
                            label="총 비용"
                            value={selectedData.total_cost}
                            onChange={v => setMultiSelected(prev => prev.map(p =>
                              p.type === opt.value.type ? { ...p, total_cost: v } : p
                            ))}
                            placeholder="예: 30,000,000"
                          />
                          <p style={{ gridColumn: '1/-1', fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                            월 환산: 약 {Math.round((selectedData.total_cost || 0) / 12).toLocaleString('ko-KR')}원/월 (1년 분할 기준)
                            {toKoreanUnit(Math.round((selectedData.total_cost || 0) / 12)) && ` (${toKoreanUnit(Math.round((selectedData.total_cost || 0) / 12))}원)`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 직접 입력한 이벤트 목록 */}
          {multiSelected.filter(e => !EVENT_PRESETS.some(p => p.value.type === e.type)).map((e, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--primary-light)', border: '1.5px solid var(--primary)',
              borderRadius: 14, padding: '14px 18px', marginTop: 8,
            }}>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 15 }}>{e.type}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  {e.years_later}년 후 · 월 {e.monthly_cost.toLocaleString('ko-KR')}원
                </span>
              </div>
              <button onClick={() => removeEvent(e.type)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={16} color="var(--danger)" />
              </button>
            </div>
          ))}

          {/* 직접 입력 폼 */}
          {showCustomForm ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px', marginTop: 12, boxShadow: 'var(--shadow-card)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>직접 입력</p>

              {/* 이벤트명 */}
              <div className="input-group">
                <label className="input-label">이벤트명</label>
                <input className="input-field" placeholder="예: 사업 자금, 해외여행 등"
                  value={customEvent.type}
                  onChange={e => setCustomEvent(p => ({ ...p, type: e.target.value }))} />
              </div>

              {/* 지속/일시 선택 */}
              <div className="input-group">
                <label className="input-label">비용 유형</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ label: '지속 비용 (매월)', value: 'recurring' }, { label: '일시 비용 (한 번)', value: 'lump' }].map(opt => (
                    <button key={opt.value} type="button"
                      className={`select-btn ${customEvent.kind === opt.value ? 'selected' : ''}`}
                      style={{ flex: 1, fontSize: 13 }}
                      onClick={() => setCustomEvent(p => ({ ...p, kind: opt.value }))}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 지속형 필드 */}
              {customEvent.kind === 'recurring' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">몇 년간</label>
                    <input type="number" className="input-field" placeholder="예: 4"
                      value={customEvent.duration_years}
                      onChange={e => setCustomEvent(p => ({ ...p, duration_years: e.target.value }))} />
                  </div>
                  <MoneyInput
                    label="월 비용"
                    value={customEvent.monthly_cost ? Number(customEvent.monthly_cost) : 0}
                    onChange={v => setCustomEvent(p => ({ ...p, monthly_cost: v }))}
                    placeholder="예: 500,000"
                  />
                </div>
              )}

              {/* 일시형 필드 */}
              {customEvent.kind === 'lump' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">몇 년 후</label>
                    <input type="number" className="input-field" placeholder="예: 3"
                      value={customEvent.years_later}
                      onChange={e => setCustomEvent(p => ({ ...p, years_later: e.target.value }))} />
                  </div>
                  <MoneyInput
                    label="총 비용"
                    value={customEvent.total_cost ? Number(customEvent.total_cost) : 0}
                    onChange={v => setCustomEvent(p => ({ ...p, total_cost: v }))}
                    placeholder="예: 30,000,000"
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn-secondary" style={{ flex: 1, height: 44 }} onClick={() => setShowCustomForm(false)}>취소</button>
                <button className="btn-primary" style={{ flex: 1, height: 44 }} onClick={addCustomEvent}>추가</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCustomForm(true)} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
              border: '1.5px dashed var(--border)', background: 'transparent',
              borderRadius: 14, padding: '14px 18px', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 15, fontFamily: 'inherit', width: '100%',
            }}>
              <Plus size={18} strokeWidth={1.8} /> 직접 입력하기
            </button>
          )}

        </>
      );
    }

    if (currentId === 'risk_type') {
      return (
        <>
          <h2 style={titleStyle}>투자 성향은 어느 쪽에 가까우신가요?</h2>
          <p style={subStyle}>맞춤 상품 추천에 활용됩니다.</p>
          <div style={listStyle}>
            {[
              { label: '안전 위주 (원금 보존 중심)', value: '보수형' },
              { label: '균형 (수익과 안전 균형)', value: '중립형' },
              { label: '수익 위주 (다소 위험 감수)', value: '적극형' },
            ].map(opt => (
              <ChoiceBtn key={opt.value} label={opt.label} value={opt.value}
                selected={answers.risk_type === opt.value}
                onClick={() => handleChoice(opt.value)} />
            ))}
          </div>
        </>
      );
    }
  };

  const titleStyle = { fontSize: 20, fontWeight: 700, lineHeight: 1.4, marginBottom: 8 };
  const subStyle = { fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 };
  const listStyle = { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 };
  const editLabelStyle = { fontSize: 12, color: 'var(--primary)', fontWeight: 700, display: 'block', marginBottom: 6 };
  const editInputStyle = {
    width: '100%', height: 44, background: '#fff',
    border: '1.5px solid var(--border)', borderRadius: 8,
    padding: '0 12px', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div className="app-header">
        <button className="back-btn" onClick={handleBack}>‹</button>
        <span className="header-title">노후 준비 사전 질문</span>
        <div className="header-right" />
      </div>

      {/* 진행률 */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>
            {step + 1} / {totalSteps}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            잠깐만요, 딱 {totalSteps}가지만 확인할게요
          </span>
        </div>
        <div className="progress-bar">
          <div className="fill" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>
      </div>

      {/* 질문 영역 */}
      <div style={{ flex: 1, padding: '28px 20px 24px', overflowY: 'auto' }}>
        {step === 0 && (
          <div style={{
            background: 'var(--primary-light)', borderRadius: 12, padding: '14px 16px',
            marginBottom: 24, fontSize: 13, color: 'var(--primary)', lineHeight: 1.7,
          }}>
            JB금융 계정에서 재무 데이터를 불러왔습니다.<br />
            은행 데이터에 없는 <strong>노후 준비 핵심 정보</strong> 몇 가지만 확인할게요.
          </div>
        )}

        {renderQuestion()}

        {/* 이전 / 다음 버튼 — 질문 바로 아래 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={handleBack}
          >
            ← 이전
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={!canGoNext()}
            onClick={handleNext}
          >
            {isLast ? '진단 시작' : '다음 →'}
          </button>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-hint)', padding: '0 20px 16px', lineHeight: 1.7 }}>
        입력하신 정보는 진단 목적으로만 사용되며 저장되지 않습니다.
      </p>
    </div>
  );
}
