import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAppContext } from '../App.jsx';
import { SURVEY_DATA, getInterpretation } from '../data/surveyData.js';

// 노후준비지원법 기준 동연령 평균 점수
const PEER_AVG = {
  finance:  61.9,
  health:   76.0,
  leisure:  60.3,
  relation: 69.8,
};

const AREA_HINTS = {
  finance:  '연금·저축·자산 관리 강화',
  health:   '건강검진·운동·식습관 개선',
  leisure:  '여가활동 계획 수립',
  relation: '사회활동·가족 교류 늘리기',
};

function getScoreColor(score) {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  if (score >= 40) return '#FF8C00';
  return 'var(--danger)';
}

function ScoreRing({ score, color }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let cur = 0;
    const timer = setInterval(() => {
      cur += 2;
      if (cur >= score) { setDisplayed(score); clearInterval(timer); }
      else setDisplayed(cur);
    }, 20);
    return () => clearInterval(timer);
  }, [score]);

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
  const { profile, surveyScores, selectedAreas } = useAppContext();

  if (!surveyScores || selectedAreas.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>설문을 먼저 완료해주세요.</p>
        <button className="btn-primary" style={{ maxWidth: 200, margin: '0 auto', display: 'block' }}
          onClick={() => navigate('/area-select')}>진단 시작하기</button>
      </div>
    );
  }

  // 선택 영역만 처리
  const areas = ['finance', 'health', 'leisure', 'relation'].filter(a => selectedAreas.includes(a));
  const scores = areas.map(a => surveyScores[a] ?? 0);

  // 종합 점수: 선택 영역 평균
  const totalScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  // 동연령 평균 종합 (선택 영역 평균)
  const peerTotal = Math.round(
    areas.reduce((s, a) => s + PEER_AVG[a], 0) / areas.length * 10
  ) / 10;
  const diff = Math.round((totalScore - peerTotal) * 10) / 10;

  // 취약 영역 (60점 미만)
  const riskAreas = areas.filter(a => surveyScores[a] < 60);

  // 레이더 데이터
  const radarData = areas.map(a => ({
    subject: SURVEY_DATA[a].label,
    score: surveyScores[a],
    peer: PEER_AVG[a],
    fullMark: 100,
  }));

  const totalInterp = getInterpretation(totalScore);

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>‹</button>
        <span className="header-title">노후 준비 진단 결과</span>
        <div className="header-right" />
      </div>

      <div style={{ padding: '20px 20px 0' }}>

        {/* ① 종합 점수 카드 */}
        <div className="card-primary" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ScoreRing score={totalScore} />
            <div style={{ flex: 1 }}>
              <p style={{ opacity: 0.8, fontSize: 13, marginBottom: 4 }}>종합 노후 준비 점수</p>
              <div style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.2)', borderRadius: 100,
                padding: '3px 12px', fontSize: 13, fontWeight: 700, marginBottom: 10,
              }}>
                {totalInterp.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {diff > 0
                  ? <TrendingUp size={14} color="#fff" />
                  : diff < 0
                    ? <TrendingDown size={14} color="rgba(255,255,255,0.7)" />
                    : <Minus size={14} color="rgba(255,255,255,0.7)" />
                }
                <span style={{ fontSize: 12, opacity: 0.9 }}>
                  동연령 평균({peerTotal}점)보다 {diff >= 0 ? '+' : ''}{diff}점
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 100, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 100, background: '#fff',
                  width: `${totalScore}%`, transition: 'width 0.8s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.6, marginTop: 3 }}>
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>
          </div>

          {/* 해석 문구 */}
          <div style={{
            marginTop: 16, background: 'rgba(255,255,255,0.15)',
            borderRadius: 10, padding: '10px 14px',
            fontSize: 13, lineHeight: 1.6, opacity: 0.95,
          }}>
            {totalInterp.desc}
          </div>
        </div>

        {/* ② 영역별 점수 카드 (2열 그리드) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {areas.map(areaId => {
            const area = SURVEY_DATA[areaId];
            const score = surveyScores[areaId];
            const interp = getInterpretation(score);
            const peer = PEER_AVG[areaId];
            const d = Math.round((score - peer) * 10) / 10;
            const isRisk = score < 60;
            return (
              <div key={areaId} className="card" style={{
                padding: '16px 14px',
                border: isRisk ? `1.5px solid ${interp.color}` : '1.5px solid var(--border)',
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{area.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                  {area.label}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: interp.color, lineHeight: 1 }}>
                  {score}
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 2 }}>점</span>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: interp.color,
                  background: interp.color + '18', borderRadius: 100,
                  padding: '2px 8px', display: 'inline-block', marginTop: 4, marginBottom: 8,
                }}>
                  {interp.label}
                </div>
                {/* 점수 바 */}
                <div style={{ background: 'var(--bg-section)', borderRadius: 100, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{
                    height: '100%', borderRadius: 100,
                    background: interp.color, width: `${score}%`,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
                {/* 동연령 평균 비교 */}
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  평균 {peer}점 대비 <span style={{ color: d >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {d >= 0 ? '+' : ''}{d}점
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ③ 레이더 차트 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title" style={{ marginBottom: 4 }}>영역별 분석</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            80점↑ <span style={{ color: 'var(--success)', fontWeight: 700 }}>●</span> 양호 &nbsp;
            60~79 <span style={{ color: 'var(--warning)', fontWeight: 700 }}>●</span> 보통 &nbsp;
            40~59 <span style={{ color: '#FF8C00', fontWeight: 700 }}>●</span> 미흡 &nbsp;
            40↓ <span style={{ color: 'var(--danger)', fontWeight: 700 }}>●</span> 위험
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13, fill: 'var(--text-primary)', fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="내 점수" dataKey="score" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} strokeWidth={2.5} />
              <Radar name="동연령 평균" dataKey="peer" stroke="var(--text-hint)" fill="transparent" strokeWidth={1.5} strokeDasharray="4 3" />
              <Tooltip formatter={(v, name) => [v + '점', name]} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 3, background: 'var(--primary)', borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>내 점수</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 2, background: 'var(--text-hint)', borderRadius: 2, borderTop: '1px dashed var(--text-hint)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>동연령 평균</span>
            </div>
          </div>
        </div>

        {/* ④ 취약 영역 — 지금 바로 챙겨야 할 것 */}
        {riskAreas.length > 0 && (
          <div className="card" style={{ marginBottom: 16, border: '1.5px solid var(--danger)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={18} color="var(--danger)" strokeWidth={2} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', margin: 0 }}>
                지금 바로 챙겨야 할 것
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {riskAreas.map((areaId, i) => {
                const area = SURVEY_DATA[areaId];
                return (
                  <div key={areaId} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'var(--bg-section)', borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'var(--danger)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</div>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{area.icon}</span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {area.label} ({surveyScores[areaId]}점)
                      </span>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        → {AREA_HINTS[areaId]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ⑤ 점수 기준 안내 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title" style={{ marginBottom: 10 }}>점수 기준</h3>
          {[
            { range: '80~100점', label: '양호', color: 'var(--success)', desc: '현재 습관과 계획을 유지하면서 세부 실행계획 보완' },
            { range: '60~79점', label: '보통', color: 'var(--warning)', desc: '기본 준비는 되어 있으나 구체성 부족 — 낮은 문항 우선 보완' },
            { range: '40~59점', label: '미흡', color: '#FF8C00', desc: '준비가 부분적 — 점검, 계획 수립, 정보 탐색 필요' },
            { range: '0~39점',  label: '위험', color: 'var(--danger)', desc: '준비가 취약 — 우선순위를 정해 실천 목표 수립 필요' },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 0',
              borderBottom: item.label !== '위험' ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                minWidth: 56, fontSize: 11, fontWeight: 700,
                color: item.color, background: item.color + '18',
                borderRadius: 100, padding: '3px 8px', textAlign: 'center',
              }}>{item.label}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{item.range}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
          <p style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 10, lineHeight: 1.6 }}>
            기준: 2024년 노후준비실태조사 및 진단지표 세부화 방안 연구 (국민연금공단)
          </p>
        </div>

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
