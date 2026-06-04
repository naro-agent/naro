import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  Wallet, Calendar, ShoppingCart, Heart, AlertTriangle, TrendingUp, TrendingDown, Minus,
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

function getScoreLabel(score) {
  if (score >= 70) return '양호';
  if (score >= 50) return '보통';
  return '위험';
}

function toKoreanUnit(num) {
  if (!num || num === 0) return '0원';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const uk = Math.floor(abs / 100000000);
  const man = Math.floor((abs % 100000000) / 10000);
  const parts = [];
  if (uk > 0) parts.push(`${uk}억`);
  if (man > 0) parts.push(`${man}만`);
  return sign + (parts.length ? parts.join(' ') + '원' : abs.toLocaleString('ko-KR') + '원');
}

const AREA_HINTS = {
  재무: '연금·저축 늘리기',
  생애이벤트: '이벤트 자금 준비',
  소비패턴: '지출 줄이기',
  건강: '실손보험 점검',
};

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

        {/* ① 종합 점수 카드 */}
        <div className="card-primary" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ScoreRing score={diagnosis.total_score} />
            <div style={{ flex: 1 }}>
              <p style={{ opacity: 0.8, fontSize: 13, marginBottom: 6 }}>종합 은퇴 준비 점수</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {diff > 0
                  ? <TrendingUp size={16} color="#fff" />
                  : diff < 0
                    ? <TrendingDown size={16} color="rgba(255,255,255,0.7)" />
                    : <Minus size={16} color="rgba(255,255,255,0.7)" />
                }
                <span style={{ fontSize: 13, opacity: 0.9 }}>
                  동연령 평균보다 {diff >= 0 ? '+' : ''}{diff}점
                </span>
              </div>
              {/* 동연령 비교 게이지 */}
              <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 4 }}>
                동연령 평균 {peerScore}점
              </div>
              <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 100, height: 8, width: '100%', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 100, background: '#fff',
                  width: `${diagnosis.total_score}%`, transition: 'width 0.8s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.65, marginTop: 3 }}>
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>
          </div>
        </div>

        {/* ② 핵심 수치 2개 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>매달 부족한 금액</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: diagnosis.monthly_shortfall > 0 ? 'var(--danger)' : 'var(--success)', lineHeight: 1.1 }}>
              {diagnosis.monthly_shortfall > 0 ? '-' : ''}{toKoreanUnit(Math.abs(diagnosis.monthly_shortfall))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4 }}>
              월 {Math.abs(diagnosis.monthly_shortfall).toLocaleString('ko-KR')}원
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>총 자산 부족분</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: diagnosis.asset_gap > 0 ? 'var(--danger)' : 'var(--success)', lineHeight: 1.1 }}>
              {diagnosis.asset_gap > 0 ? '-' : ''}{toKoreanUnit(Math.abs(diagnosis.asset_gap))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4 }}>
              {Math.abs(diagnosis.asset_gap).toLocaleString('ko-KR')}원
            </div>
          </div>
        </div>

        {/* ③ 4개 영역 — 레이더 + 점수 바 통합 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title" style={{ marginBottom: 4 }}>4개 영역 분석</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            70점 이상 <span style={{ color: 'var(--success)', fontWeight: 700 }}>●</span> 양호 &nbsp;
            50~69점 <span style={{ color: 'var(--warning)', fontWeight: 700 }}>●</span> 보통 &nbsp;
            50점 미만 <span style={{ color: 'var(--danger)', fontWeight: 700 }}>●</span> 위험
          </p>

          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13, fill: 'var(--text-primary)', fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="점수" dataKey="score" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip formatter={v => [v + '점']} />
            </RadarChart>
          </ResponsiveContainer>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            {areaDetails.map(({ key, label, Icon, desc }) => {
              const score = diagnosis[key];
              const color = getScoreColor(score);
              const isRisk = diagnosis.risk_areas.includes(label);
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 30, height: 30, background: color + '18', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} color={color} strokeWidth={1.8} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 48, textAlign: 'right' }}>
                      {score}점 <span style={{ fontSize: 11, fontWeight: 400 }}>({getScoreLabel(score)})</span>
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 10 }}>
                    <div className="fill" style={{ width: `${score}%`, background: color, borderRadius: 100 }} />
                  </div>
                  {isRisk && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <AlertTriangle size={12} color="var(--danger)" strokeWidth={2} />
                      <span style={{ fontSize: 12, color: 'var(--danger)' }}>
                        취약 — {AREA_HINTS[label]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ④ 지금 당장 할 일 (취약 영역 기반) */}
        {diagnosis.risk_areas.length > 0 && (
          <div className="card" style={{ marginBottom: 16, border: '1.5px solid var(--danger)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={18} color="var(--danger)" strokeWidth={2} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', margin: 0 }}>
                지금 바로 챙겨야 할 것
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {diagnosis.risk_areas.map((area, i) => (
                <div key={area} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--bg-section)', borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--danger)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{area} </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>→ {AREA_HINTS[area]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/simulation')}>
            시뮬레이션
          </button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={() => navigate('/recommend')}>
            맞춤 추천 보기
          </button>
        </div>
      </div>
    </div>
  );
}
