import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  Wallet, Calendar, ShoppingCart, Heart, Bot, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { useAppContext } from '../App.jsx';
import { runDiagnosis } from '../api/apiClient.js';

const AREA_LABELS = {
  finance_score: '재무',
  event_score: '생애이벤트',
  consumption_score: '소비패턴',
  health_score: '건강',
};

const PEER_AVG = { '50': 52, '55': 58, '58': 61, '60': 63 };

function getScoreColor(score) {
  if (score >= 70) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

function ScoreRing({ score }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const timer = setInterval(() => {
      start += 2;
      if (start >= score) { setDisplayed(score); clearInterval(timer); }
      else setDisplayed(start);
    }, 20);
    return () => clearInterval(timer);
  }, [score]);

  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (displayed / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
      <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="12" />
        <circle cx="80" cy="80" r="60" fill="none" stroke="#fff" strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.05s' }} />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{displayed}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>/ 100점</div>
      </div>
    </div>
  );
}

export default function Diagnosis() {
  const navigate = useNavigate();
  const { profile, diagnosis, setDiagnosis } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile || diagnosis) return;
    setLoading(true);
    runDiagnosis(profile)
      .then(d => { setDiagnosis(d); setError(''); })
      .catch(() => setError('진단 중 오류가 발생했습니다. 다시 시도해 주세요.'))
      .finally(() => setLoading(false));
  }, [profile]);

  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>프로필을 먼저 입력해주세요.</p>
        <button className="btn-primary" style={{ maxWidth: 200, margin: '0 auto', display: 'block' }}
          onClick={() => navigate('/')}>홈으로</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div className="spinner" style={{ marginBottom: 20 }} />
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          AI가 노후 준비 상태를 분석 중입니다.<br />잠시만 기다려주세요...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', marginBottom: 20 }}>{error}</p>
        <button className="btn-primary" style={{ maxWidth: 200, margin: '0 auto', display: 'block' }}
          onClick={() => { setError(''); setDiagnosis(null); }}>다시 시도</button>
      </div>
    );
  }

  if (!diagnosis) return null;

  const radarData = Object.entries(AREA_LABELS).map(([key, label]) => ({
    subject: label, score: diagnosis[key], fullMark: 100,
  }));

  const peerAge = String(Math.min(60, Math.floor(profile.age / 5) * 5));
  const peerScore = PEER_AVG[peerAge] || 58;
  const diff = diagnosis.total_score - peerScore;

  const areaDetails = [
    { key: 'finance_score', label: '재무', Icon: Wallet, desc: '자산·연금·저축률' },
    { key: 'event_score', label: '생애이벤트', Icon: Calendar, desc: '이벤트 대비 현금흐름' },
    { key: 'consumption_score', label: '소비패턴', Icon: ShoppingCart, desc: '지출 구조·저축 여력' },
    { key: 'health_score', label: '건강', Icon: Heart, desc: '의료비 리스크' },
  ];

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>‹</button>
        <span className="header-title">은퇴 준비 진단</span>
        <div className="header-right" />
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {/* 종합 점수 카드 */}
        <div className="card-primary" style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ opacity: 0.85, fontSize: 14, marginBottom: 16 }}>종합 은퇴 준비 점수</p>
          <ScoreRing score={diagnosis.total_score} />
          <div style={{ marginTop: 16 }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 100, padding: '4px 16px', fontSize: 13 }}>
              동연령 평균 {peerScore}점 대비 {diff >= 0 ? '+' : ''}{diff}점
            </span>
          </div>
          <p style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>{diagnosis.peer_comparison}</p>
        </div>

        {/* AI 요약 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 38, height: 38, background: 'var(--primary-light)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Bot size={20} color="var(--primary)" strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>AI 진단 요약</p>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>{diagnosis.summary}</p>
            </div>
          </div>
        </div>

        {/* 레이더 차트 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title">4개 영역 분석</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13, fill: 'var(--text-primary)' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="점수" dataKey="score" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
              <Tooltip formatter={v => [v + '점']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* 영역별 점수 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title">영역별 상세 점수</h3>
          {areaDetails.map(({ key, label, Icon, desc }) => {
            const score = diagnosis[key];
            const color = getScoreColor(score);
            return (
              <div key={key} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, background: color + '18', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color={color} strokeWidth={1.8} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>{desc}</span>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color, fontSize: 16 }}>{score}점</span>
                </div>
                <div className="progress-bar">
                  <div className="fill" style={{ width: `${score}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 부족분 분석 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title">부족분 분석</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[
              { label: '월 부족분', value: diagnosis.monthly_shortfall.toLocaleString('ko-KR') + '원' },
              { label: '총 자산 부족분', value: diagnosis.asset_gap.toLocaleString('ko-KR') + '원' },
            ].map((item, i) => (
              <div key={i} style={{ background: 'var(--bg-section)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)', wordBreak: 'keep-all' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {diagnosis.risk_areas.length > 0 && (
            <div style={{ padding: '12px 14px', background: '#FFF5F5', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <AlertTriangle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} strokeWidth={1.8} />
              <div>
                <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 700, marginBottom: 6 }}>취약 영역</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {diagnosis.risk_areas.map(area => (
                    <span key={area} className="badge badge-danger">{area}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/simulation')}>
            시뮬레이션
          </button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={() => navigate('/recommend')}>
            맞춤 추천
          </button>
        </div>
      </div>
    </div>
  );
}
