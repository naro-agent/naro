import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Lock, Briefcase, Store, Building } from 'lucide-react';
import { useAppContext } from '../App.jsx';
import { PERSONAS } from '../data/mockPersonas.js';

/* ── JB금융 연동 로딩 화면 ── */
function LinkingScreen({ persona, onDone }) {
  const [phase, setPhase] = useState('loading');

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
          <CheckCircle2 size={52} color="var(--success)" style={{ marginBottom: 16 }} />
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
  const [linking, setLinking] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState(null);

  const resetAll = () => {
    setDiagnosis(null); setSimulation(null); setRecommend(null);
  };

  const selectAccount = (persona) => {
    setSelectedPersona(persona);
    setLinking(true);
  };

  const onLinkingDone = () => {
    const { id, name, label, color, ...profile } = selectedPersona;
    resetAll();
    setProfile(profile);
    navigate('/survey');
  };

  if (linking) {
    return <LinkingScreen persona={selectedPersona} onDone={onLinkingDone} />;
  }

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/area-select')}>‹</button>
        <span className="header-title">JB금융 계정 선택</span>
        <div className="header-right" />
      </div>

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
                transition: 'border-color 0.15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: p.color + '22',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {p.job_type === '직장인'
                  ? <Briefcase size={22} color={p.color} strokeWidth={1.8} />
                  : p.job_type === '자영업자'
                  ? <Store size={22} color={p.color} strokeWidth={1.8} />
                  : <Building size={22} color={p.color} strokeWidth={1.8} />
                }
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

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-hint)', marginTop: 24, lineHeight: 1.7, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Lock size={12} /> 계정 정보는 진단 목적으로만 사용되며 저장되지 않습니다.
        </p>
      </div>
    </div>
  );
}
