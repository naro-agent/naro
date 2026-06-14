import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Wallet, Heart, Palmtree, Users } from 'lucide-react';
import { useAppContext } from '../App.jsx';

const LOADING_STEPS = [
  { label: '노후 준비 모델을 불러오는 중...', duration: 600 },
  { label: '4대 영역 진단 기준 로딩 중...', duration: 600 },
  { label: '맞춤 진단 환경을 준비하는 중...', duration: 500 },
  { label: '준비 완료!', duration: 400 },
];

function LoadingOverlay() {
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let accumulated = 0;
    const total = LOADING_STEPS.reduce((s, st) => s + st.duration, 0);
    let currentStep = 0;

    const tick = () => {
      if (currentStep >= LOADING_STEPS.length) return;
      accumulated += LOADING_STEPS[currentStep].duration;
      setProgress(Math.round((accumulated / total) * 100));
      currentStep += 1;
      setStepIdx(currentStep < LOADING_STEPS.length ? currentStep : LOADING_STEPS.length - 1);
      if (currentStep < LOADING_STEPS.length) {
        setTimeout(tick, LOADING_STEPS[currentStep].duration);
      }
    };
    setTimeout(tick, LOADING_STEPS[0].duration);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #1264D3 0%, #0F52B8 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#fff',
    }}>
      {/* 아이콘 펄스 */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
        animation: 'pulse 1.4s ease-in-out infinite',
      }}>
        <Compass size={40} color="#fff" strokeWidth={1.4} />
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>나로(NaRo)</div>
      <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 36 }}>노후 준비 점수 예측 중</div>

      {/* 프로그레스 바 */}
      <div style={{ width: 220, height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 10,
          background: '#fff',
          width: `${progress}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* 단계 메시지 */}
      <div style={{ fontSize: 13, opacity: 0.85, minHeight: 20 }}>
        {LOADING_STEPS[stepIdx].label}
      </div>

      {/* 점 3개 로딩 */}
      <div style={{ display: 'flex', gap: 6, marginTop: 24 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'rgba(255,255,255,0.7)',
            animation: `dotBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { setProfile, setDiagnosis, setSimulation, setRecommend } = useAppContext();
  const [loading, setLoading] = useState(false);

  const handleStart = () => {
    setProfile(null);
    setDiagnosis(null);
    setSimulation(null);
    setRecommend(null);
    setLoading(true);
    const total = LOADING_STEPS.reduce((s, st) => s + st.duration, 0);
    setTimeout(() => navigate('/consent'), total);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
      {loading && <LoadingOverlay />}
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

        <Compass size={52} color="#fff" strokeWidth={1.4} style={{ marginBottom: 16, opacity: 0.95 }} />
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
            { Icon: Wallet, label: '재무' },
            { Icon: Heart, label: '건강' },
            { Icon: Palmtree, label: '여가활동' },
            { Icon: Users, label: '대인관계' },
          ].map(({ Icon, label }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.18)', borderRadius: 100,
              padding: '6px 14px', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Icon size={14} color="#fff" strokeWidth={2} /><span>{label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          style={{
            width: '100%', maxWidth: 320, height: 56,
            background: '#fff', color: 'var(--primary)',
            fontWeight: 700, fontSize: 17,
            border: 'none', borderRadius: 16,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
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
