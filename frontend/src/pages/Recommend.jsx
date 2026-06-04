import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, PiggyBank, BarChart3, ShieldCheck, Building2, ChevronRight, Info } from 'lucide-react';
import { useAppContext } from '../App.jsx';
import { runRecommend } from '../api/apiClient.js';

const CATEGORY_ICON = {
  연금: Landmark, 저축: PiggyBank, 지출관리: BarChart3, 보험: ShieldCheck, 자산관리: Building2,
};

const BANK_COLOR = {
  '광주은행': '#1264D3',
  '전북은행': '#0F52B8',
  'JB우리캐피탈': '#3D8EFF',
};

export default function Recommend() {
  const navigate = useNavigate();
  const { profile, diagnosis, recommend, setRecommend } = useAppContext();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile || !diagnosis || recommend) return;
    setLoading(true);
    runRecommend(profile, diagnosis)
      .then(d => setRecommend(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [profile, diagnosis]);

  const needDiagnosis = profile && !diagnosis;

  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>프로필을 먼저 입력해주세요.</p>
        <button className="btn-primary" style={{ maxWidth: 200, margin: '0 auto', display: 'block' }}
          onClick={() => navigate('/')}>홈으로</button>
      </div>
    );
  }

  if (needDiagnosis) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
          추천을 받으려면 먼저 진단이 필요합니다.
        </p>
        <button className="btn-primary" style={{ maxWidth: 240, margin: '0 auto', display: 'block' }}
          onClick={() => navigate('/diagnosis')}>진단 받기 →</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div className="spinner" style={{ marginBottom: 20 }} />
        <p style={{ color: 'var(--text-secondary)' }}>맞춤 추천을 생성 중입니다...</p>
      </div>
    );
  }

  if (!recommend) return null;

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/diagnosis')}>‹</button>
        <span className="header-title">맞춤 추천</span>
        <div className="header-right" />
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {/* 헤드 */}
        <div className="card-primary" style={{ marginBottom: 16 }}>
          <p style={{ opacity: 0.85, fontSize: 13, marginBottom: 6 }}>AI 분석 기반 맞춤 액션 플랜</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4 }}>
            지금 바로 시작할 수 있는<br />우선순위 행동을 알려드립니다
          </h2>
          {diagnosis && (
            <p style={{ opacity: 0.8, fontSize: 13, marginTop: 8 }}>
              진단 점수 {diagnosis.total_score}점 기준 · 취약 영역: {diagnosis.risk_areas.join(', ') || '없음'}
            </p>
          )}
        </div>

        {/* 액션 카드 */}
        <h3 className="section-title" style={{ marginBottom: 12 }}>우선순위 액션</h3>
        {recommend.action_cards.map((card, i) => (
          <div key={i} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 44, height: 44, background: 'var(--primary-light)', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {React.createElement(CATEGORY_ICON[card.category] || Info, { size: 20, color: 'var(--primary)', strokeWidth: 1.8 })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 20, height: 20, background: 'var(--primary)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{card.priority}</div>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{card.title}</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
                  {card.description}
                </p>
                <div style={{
                  background: 'var(--bg-section)', borderRadius: 8, padding: '8px 12px',
                  fontSize: 13, color: 'var(--primary)', fontWeight: 600, marginBottom: 12,
                }}>
                  📈 예상 효과: {card.expected_effect}
                </div>
                <button
                  className="btn-secondary"
                  style={{ height: 40, fontSize: 14, borderRadius: 8 }}
                  onClick={() => navigate('/chat')}
                >
                  {card.action_label} →
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* JB금융 상품 */}
        {recommend.products.length > 0 && (
          <>
            <h3 className="section-title" style={{ marginTop: 8, marginBottom: 12 }}>JB금융 맞춤 상품</h3>
            {recommend.products.map((prod, i) => (
              <div key={i} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, background: (BANK_COLOR[prod.bank] || 'var(--primary)') + '22',
                      color: BANK_COLOR[prod.bank] || 'var(--primary)',
                      padding: '2px 8px', borderRadius: 100, marginRight: 8,
                    }}>{prod.bank}</span>
                    <span className="badge" style={{ fontSize: 11 }}>{prod.type}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{prod.rate}</span>
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{prod.name}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{prod.description}</p>
                <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>💡 {prod.reason}</p>
              </div>
            ))}
          </>
        )}

        {/* 면책 조항 */}
        <div style={{
          margin: '16px 0', padding: '14px 16px',
          background: 'var(--bg-section)', borderRadius: 12,
          fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7,
        }}>
          ⚠️ {recommend.disclaimer}
        </div>

        <button className="btn-primary" style={{ marginBottom: 24 }} onClick={() => navigate('/chat')}>
          AI에게 더 물어보기 💬
        </button>
      </div>
    </div>
  );
}
