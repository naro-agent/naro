import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App.jsx';

export default function Home() {
  const navigate = useNavigate();
  const { setProfile, setDiagnosis, setSimulation, setRecommend } = useAppContext();

  const handleStart = () => {
    setProfile(null);
    setDiagnosis(null);
    setSimulation(null);
    setRecommend(null);
    navigate('/onboarding');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
      {/* 히어로 */}
      <div style={{
        background: 'linear-gradient(160deg, #1264D3 0%, #0F52B8 100%)',
        padding: '64px 24px 48px',
        textAlign: 'center',
        color: '#fff',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <img src="/favicon.png" alt="JB금융그룹" style={{ height: 32, opacity: 0.95 }} />
          <span style={{ fontSize: 16, fontWeight: 700, opacity: 0.95, letterSpacing: '-0.3px' }}>
            JB금융그룹
          </span>
        </div>

        <div style={{ fontSize: 52, marginBottom: 16 }}>🧭</div>
        <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.35, marginBottom: 14 }}>
          나만의 노후 항로,<br />나로(NaRo)
        </h1>
        <p style={{ fontSize: 15, opacity: 0.88, lineHeight: 1.8, marginBottom: 28, maxWidth: 320 }}>
          재무 · 건강 · 여가활동 · 대인관계<br />
          4대 영역 기반 초개인화 노후 준비 진단 서비스
        </p>

        {/* 4대 영역 뱃지 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { icon: '💰', label: '재무' },
            { icon: '❤️', label: '건강' },
            { icon: '🌿', label: '여가활동' },
            { icon: '🤝', label: '대인관계' },
          ].map(({ icon, label }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.18)', borderRadius: 100,
              padding: '6px 14px', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{icon}</span><span>{label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleStart}
          style={{
            width: '100%', maxWidth: 320, height: 56,
            background: '#fff', color: 'var(--primary)',
            fontWeight: 700, fontSize: 17,
            border: 'none', borderRadius: 16,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          노후 준비 진단 시작하기
          <span style={{ fontSize: 20 }}>→</span>
        </button>

        <p style={{ marginTop: 16, fontSize: 12, opacity: 0.65 }}>무료 · 5분 이내 완료</p>
      </div>

      <div style={{ padding: '20px 20px 40px', background: 'var(--bg-page)' }}>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-hint)', lineHeight: 1.7 }}>
          본 서비스는 정보 제공 목적이며 투자 권유가 아닙니다.<br />
          금융 의사결정 전 전문가 상담을 권장합니다.
        </p>
      </div>
    </div>
  );
}
