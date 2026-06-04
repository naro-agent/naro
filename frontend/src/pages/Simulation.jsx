import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useAppContext } from '../App.jsx';
import { runSimulation } from '../api/apiClient.js';

const SCENARIO_LABELS = {
  optimistic: { label: '낙관', color: 'var(--success)', desc: '이벤트 비용 -20%' },
  neutral: { label: '중립', color: 'var(--primary)', desc: '기준 시나리오' },
  pessimistic: { label: '비관', color: 'var(--danger)', desc: '이벤트 비용 +30%' },
};

const fmtWon = (n) => n.toLocaleString('ko-KR') + '원';
const fmtAxis = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100000000) return sign + (abs / 100000000).toFixed(0) + '억';
  if (abs >= 10000) return sign + (abs / 10000).toFixed(0) + '만';
  return n.toLocaleString('ko-KR');
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-card)', padding: '10px 14px',
      borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      fontSize: 13,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{d.age}세 ({d.year + 1}년 후)</p>
      <p style={{ color: d.monthly_cash_flow >= 0 ? 'var(--success)' : 'var(--danger)' }}>
        월 {d.monthly_cash_flow >= 0 ? '+' : ''}{d.monthly_cash_flow.toLocaleString('ko-KR')}원
      </p>
      {d.events?.length > 0 && (
        <p style={{ color: 'var(--warning)', marginTop: 4 }}>📅 {d.events.join(', ')}</p>
      )}
    </div>
  );
};

export default function Simulation() {
  const navigate = useNavigate();
  const { profile, simulation, setSimulation } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('neutral');

  useEffect(() => {
    if (!profile || simulation) return;
    setLoading(true);
    runSimulation(profile)
      .then(d => setSimulation(d))
      .catch(console.error)
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
        <p style={{ color: 'var(--text-secondary)' }}>시뮬레이션을 계산 중입니다...</p>
      </div>
    );
  }

  if (!simulation) return null;

  const currentScenario = simulation[tab];
  const scenarioMeta = SCENARIO_LABELS[tab];

  const deficitRanges = [];
  let start = null;
  currentScenario.data.forEach((d, i) => {
    if (d.is_deficit && start === null) start = d.age;
    if (!d.is_deficit && start !== null) {
      deficitRanges.push({ start, end: d.age });
      start = null;
    }
  });
  if (start !== null) deficitRanges.push({ start, end: currentScenario.data[currentScenario.data.length - 1].age });

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/diagnosis')}>‹</button>
        <span className="header-title">생애 시뮬레이션</span>
        <div className="header-right" />
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {/* 핵심 리스크 메시지 */}
        <div style={{
          background: simulation.neutral.deficit_start_age ? '#FFF3F3' : '#EDFAF4',
          borderRadius: 14, padding: '16px 18px', marginBottom: 16,
          borderLeft: `4px solid ${simulation.neutral.deficit_start_age ? 'var(--danger)' : 'var(--success)'}`,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700,
            color: simulation.neutral.deficit_start_age ? 'var(--danger)' : 'var(--success)',
            marginBottom: 4 }}>
            {simulation.neutral.deficit_start_age ? '⚠️ 위험 신호 감지' : '✅ 현금흐름 안정'}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>
            {simulation.key_risk_message}
          </p>
        </div>

        {/* 시나리오 탭 */}
        <div className="tab-group" style={{ marginBottom: 16 }}>
          {Object.entries(SCENARIO_LABELS).map(([key, meta]) => (
            <button key={key} className={`tab ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}>
              {meta.label}
            </button>
          ))}
        </div>

        {/* 시나리오 설명 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{scenarioMeta.desc}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {currentScenario.deficit_start_age
              ? <span style={{ color: 'var(--danger)' }}>적자 전환: {currentScenario.deficit_start_age}세</span>
              : <span style={{ color: 'var(--success)' }}>전 기간 흑자</span>
            }
          </span>
        </div>

        {/* 현금흐름 차트 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title">월 현금흐름 예측</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={currentScenario.data} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="age" tickFormatter={v => v + '세'} tick={{ fontSize: 11 }} interval={4} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} width={52} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="var(--text-secondary)" strokeDasharray="4 4" />
              {deficitRanges.map((r, i) => (
                <ReferenceArea key={i} x1={r.start} x2={r.end}
                  fill="var(--danger)" fillOpacity={0.12} />
              ))}
              <Line
                type="monotone" dataKey="monthly_cash_flow"
                stroke={scenarioMeta.color} strokeWidth={2.5}
                dot={false} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 3, background: scenarioMeta.color, borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>월 현금흐름</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, background: 'var(--danger)', opacity: 0.3, borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>적자 구간</span>
            </div>
          </div>
        </div>

        {/* 시나리오 비교 요약 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title">3가지 시나리오 비교</h3>
          {Object.entries(SCENARIO_LABELS).map(([key, meta]) => {
            const s = simulation[key];
            return (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderBottom: key !== 'pessimistic' ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{meta.label} 시나리오</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{meta.desc}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {s.deficit_start_age ? (
                    <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 14 }}>
                      {s.deficit_start_age}세 적자
                    </div>
                  ) : (
                    <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: 14 }}>전기간 흑자</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    적자 {s.total_deficit_months}개월
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 생애 이벤트 목록 */}
        {profile.life_events?.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">등록된 생애 이벤트 영향</h3>
            {profile.life_events.map((e, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: i < profile.life_events.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontWeight: 600 }}>{e.type}</span>
                <span style={{ color: 'var(--danger)' }}>
                  -{fmtWon(e.monthly_cost)}/월 · {e.years_later}년 후~
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="btn-primary" style={{ marginBottom: 24 }} onClick={() => navigate('/recommend')}>
          맞춤 추천 받기 →
        </button>
      </div>
    </div>
  );
}
