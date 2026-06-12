import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, PiggyBank, BarChart3, ShieldCheck, Building2, Info, TrendingUp, Lightbulb, AlertTriangle, MessageCircle, ClipboardList } from 'lucide-react';
import { useAppContext } from '../App.jsx';
import { runRecommend } from '../api/apiClient.js';
import { SURVEY_DATA } from '../data/surveyData.js';

// surveyScores → 백엔드 DiagnosisResult 형태로 변환
function buildDiagnosisFromSurvey(surveyScores, selectedAreas) {
  if (!surveyScores) return null;
  const areas = Object.keys(surveyScores);
  const total = Math.round(
    areas.reduce((s, a) => s + surveyScores[a], 0) / areas.length
  );
  const riskAreas = areas
    .filter(a => surveyScores[a] < 60)
    .map(a => SURVEY_DATA[a]?.label || a);
  return {
    total_score: total,
    finance_score: surveyScores.finance ?? 0,
    event_score: surveyScores.leisure ?? 0,
    consumption_score: surveyScores.relation ?? 0,
    health_score: surveyScores.health ?? 0,
    asset_gap: 0,
    monthly_shortfall: 0,
    peer_comparison: '평균',
    risk_areas: riskAreas,
    summary: '',
  };
}

const CATEGORY_ICON = {
  연금: Landmark, 저축: PiggyBank, 지출관리: BarChart3, 보험: ShieldCheck, 자산관리: Building2,
};

const BANK_COLOR = {
  '광주은행': '#1264D3',
  '전북은행': '#0F52B8',
  'JB우리캐피탈': '#3D8EFF',
};

// 영역별 컬러 (설문조사·진단 결과와 통일)
const AREA_COLOR = {
  '재무':    { bg: '#E8F1FF', border: '#1264D3', text: '#1264D3', badge: '#1264D3' },
  '건강':    { bg: '#FFF0F0', border: '#F03E3E', text: '#C92A2A', badge: '#F03E3E' },
  '여가활동': { bg: '#FFF8E1', border: '#F5A623', text: '#B8690A', badge: '#F5A623' },
  '대인관계': { bg: '#F0FFF4', border: '#12B886', text: '#0A7A5A', badge: '#12B886' },
};

export default function Recommend() {
  const navigate = useNavigate();
  const { profile, surveyScores, selectedAreas, recommend, setRecommend } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // surveyScores를 백엔드 형태로 변환
  const diagnosisPayload = buildDiagnosisFromSurvey(surveyScores, selectedAreas);

  useEffect(() => {
    if (!profile || !diagnosisPayload || recommend) return;
    setLoading(true);
    setError(null);
    runRecommend(profile, diagnosisPayload, surveyScores)
      .then(d => setRecommend(d))
      .catch(e => setError(e?.message || '서버 연결에 실패했습니다.'))
      .finally(() => setLoading(false));
  }, [profile, surveyScores]);

  if (!profile || !surveyScores) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <ClipboardList size={48} color="var(--text-hint)" style={{ marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
          먼저 노후 준비 진단 설문을 완료해주세요.
        </p>
        <button className="btn-primary" style={{ maxWidth: 240, margin: '0 auto', display: 'block' }}
          onClick={() => navigate('/area-select')}>진단 시작하기 →</button>
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

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertTriangle size={48} color="var(--warning)" style={{ marginBottom: 16 }} />
        <p style={{ fontWeight: 700, marginBottom: 8 }}>추천 생성 실패</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>{error}</p>
        <button className="btn-primary" style={{ maxWidth: 200, margin: '0 auto', display: 'block' }}
          onClick={() => { setError(null); setRecommend(null); }}>다시 시도</button>
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
          {diagnosisPayload && (
            <p style={{ opacity: 0.8, fontSize: 13, marginTop: 8 }}>
              종합 점수 {diagnosisPayload.total_score}점 기준 · 취약 영역: {diagnosisPayload.risk_areas.join(', ') || '없음'}
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
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <TrendingUp size={14} color="var(--primary)" />
                  예상 효과: {card.expected_effect}
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
            {recommend.products.map((prod, i) => {
              const areaColor = AREA_COLOR[prod.area] || AREA_COLOR['재무'];
              return (
                <div key={i} style={{
                  background: '#fff',
                  borderRadius: 16,
                  marginBottom: 12,
                  overflow: 'hidden',
                  border: prod.is_virtual ? '1.5px dashed #F5A623' : `1.5px solid ${areaColor.border}`,
                  boxShadow: 'var(--shadow-card)',
                }}>
                  {/* 영역 컬러 헤더 바 */}
                  <div style={{
                    background: areaColor.bg,
                    borderBottom: `1px solid ${areaColor.border}20`,
                    padding: '10px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {prod.area && (
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          background: areaColor.badge, color: '#fff',
                          padding: '2px 8px', borderRadius: 100,
                        }}>{prod.area}</span>
                      )}
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        background: '#fff', color: areaColor.text,
                        padding: '2px 8px', borderRadius: 100,
                        border: `1px solid ${areaColor.border}40`,
                      }}>{prod.type}</span>
                      {prod.is_virtual && (
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          background: '#FFF3CD', color: '#B8690A',
                          padding: '2px 8px', borderRadius: 100,
                          border: '1px solid #F5A623',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          <AlertTriangle size={10} color="#B8690A" /> 가상
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: areaColor.text }}>{prod.rate}</span>
                  </div>

                  {/* 본문 */}
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, flex: 1 }}>{prod.name}</h4>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
                      {prod.description}
                    </p>
                    <div style={{
                      background: areaColor.bg,
                      borderRadius: 8, padding: '8px 12px',
                      fontSize: 12, color: areaColor.text, fontWeight: 600, lineHeight: 1.6,
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                    }}>
                      <Lightbulb size={13} color={areaColor.text} style={{ flexShrink: 0, marginTop: 2 }} />
                      {prod.reason}
                    </div>
                    {prod.is_virtual && (
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} color="var(--warning)" />
                        현재 출시되지 않은 기획 단계 상품입니다.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* 면책 조항 */}
        <div style={{
          margin: '16px 0', padding: '14px 16px',
          background: 'var(--bg-section)', borderRadius: 12,
          fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7,
          display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <AlertTriangle size={13} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: 1 }} />
          {recommend.disclaimer}
        </div>

        <button className="btn-primary" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => navigate('/chat')}>
          <MessageCircle size={18} />
          AI에게 더 물어보기
        </button>
      </div>
    </div>
  );
}
