import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { TrendingDown, TrendingUp, Info, Sparkles, AlertTriangle, CheckCircle2, ClipboardList, CalendarDays } from 'lucide-react';
import { useAppContext } from '../App.jsx';
import { runSimulation } from '../api/apiClient.js';

const fmtAxis = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100000000) return sign + (abs / 100000000).toFixed(1) + '억';
  if (abs >= 10000) return sign + Math.round(abs / 10000) + '만';
  return sign + abs.toLocaleString('ko-KR');
};

const fmtKor = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  const uk = Math.floor(abs / 100000000);
  const man = Math.floor((abs % 100000000) / 10000);
  const parts = [];
  if (uk > 0) parts.push(`${uk}억`);
  if (man > 0) parts.push(`${man}만`);
  if (!parts.length) parts.push(abs.toLocaleString('ko-KR'));
  return sign + parts.join(' ') + '원';
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', padding: '12px 16px',
      borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
      fontSize: 13, minWidth: 160,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
        {d.age}세
      </p>
      <p style={{ color: d.monthly_cash_flow >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
        예측: {fmtKor(d.monthly_cash_flow)}/월
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
        범위: {fmtAxis(d.lower_cash_flow)} ~ {fmtAxis(d.upper_cash_flow)}
      </p>
      {d.events?.length > 0 && (
        <p style={{ color: 'var(--warning)', marginTop: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <CalendarDays size={12} color="var(--warning)" />
          {d.events.join(', ')}
        </p>
      )}
    </div>
  );
};

export default function Simulation() {
  const navigate = useNavigate();
  const { profile, simulation, setSimulation } = useAppContext();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  useEffect(() => {
    if (!profile || simulation) return;
    setLoading(true);
    setError(null);
    runSimulation(profile)
      .then(d => setSimulation(d))
      .catch(e => setError(e?.message || '서버 연결에 실패했습니다.'))
      .finally(() => setLoading(false));
  }, [profile]);

  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <ClipboardList size={48} color="var(--text-hint)" style={{ marginBottom: 16 }} />
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
          경제 지표를 반영해<br />현금흐름을 계산 중입니다...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertTriangle size={48} color="var(--warning)" style={{ marginBottom: 16 }} />
        <p style={{ fontWeight: 700, marginBottom: 8 }}>시뮬레이션 생성 실패</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>{error}</p>
        <button className="btn-primary" style={{ maxWidth: 200, margin: '0 auto', display: 'block' }}
          onClick={() => { setError(null); setSimulation(null); }}>다시 시도</button>
      </div>
    );
  }

  if (!simulation) return null;

  const { data: rawData, deficit_start_age, total_deficit_months, key_risk_message, assumptions, ai_insight } = simulation;

  // Recharts Area용: band 필드를 [lower, upper] 배열로 변환
  const data = rawData.map(d => ({
    ...d,
    band: [d.lower_cash_flow, d.upper_cash_flow],
  }));

  // 적자 구간 계산
  const deficitRanges = [];
  let rangeStart = null;
  data.forEach((d) => {
    if (d.is_deficit && rangeStart === null) rangeStart = d.age;
    if (!d.is_deficit && rangeStart !== null) {
      deficitRanges.push({ start: rangeStart, end: d.age });
      rangeStart = null;
    }
  });
  if (rangeStart !== null) deficitRanges.push({ start: rangeStart, end: data[data.length - 1].age });

  // 이벤트 발생 시점
  const eventAges = data.filter(d => d.events?.length > 0);

  const isRisk = !!deficit_start_age;

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/diagnosis')}>‹</button>
        <span className="header-title">생애 현금흐름 예측</span>
        <div className="header-right" />
      </div>

      <div style={{ padding: '20px 20px 0' }}>

        {/* ① 핵심 요약 카드 */}
        <div style={{
          background: isRisk ? '#FFF3F3' : '#EDFAF4',
          borderRadius: 14, padding: '16px 18px', marginBottom: 16,
          borderLeft: `4px solid ${isRisk ? 'var(--danger)' : 'var(--success)'}`,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          {isRisk
            ? <TrendingDown size={22} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
            : <TrendingUp size={22} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
          }
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: isRisk ? 'var(--danger)' : 'var(--success)', marginBottom: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isRisk
                  ? <AlertTriangle size={15} color="var(--danger)" />
                  : <CheckCircle2 size={15} color="var(--success)" />
                }
                {isRisk ? '위험 구간 감지됨' : '전 기간 흑자 예측'}
              </span>
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>
              {key_risk_message}
            </p>
          </div>
        </div>

        {/* AI 인사이트 카드 */}
        {ai_insight && (
          <div style={{
            background: 'var(--primary-light)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 16,
            borderLeft: '4px solid var(--primary)',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sparkles size={14} color="var(--primary)" />
              AI 노후 설계 인사이트
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-primary)' }}>
              {ai_insight}
            </p>
          </div>
        )}

        {/* ② 주요 수치 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>적자 전환 시점</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: isRisk ? 'var(--danger)' : 'var(--success)' }}>
              {isRisk ? `${deficit_start_age}세` : '없음'}
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>총 부족 기간</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: isRisk ? 'var(--danger)' : 'var(--success)' }}>
              {total_deficit_months > 0 ? `${Math.round(total_deficit_months / 12)}년` : '없음'}
            </div>
          </div>
        </div>

        {/* ③ 분포형 현금흐름 차트 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title" style={{ marginBottom: 4 }}>월 현금흐름 예측</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            실선은 예측값, 음영은 불확실성 범위입니다.
          </p>

          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="age"
                tickFormatter={v => v + '세'}
                tick={{ fontSize: 11 }}
                interval={4}
              />
              <YAxis
                tickFormatter={fmtAxis}
                tick={{ fontSize: 11 }}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="var(--text-secondary)" strokeDasharray="5 4" strokeWidth={1.5} />

              {/* 적자 구간 배경 */}
              {deficitRanges.map((r, i) => (
                <ReferenceArea key={i} x1={r.start} x2={r.end}
                  fill="var(--danger)" fillOpacity={0.08} />
              ))}

              {/* 신뢰구간 밴드: [lower, upper] 배열 Area */}
              <Area
                type="monotone"
                dataKey="band"
                stroke="none"
                fill="#1264D3"
                fillOpacity={0.13}
                legendType="none"
                activeDot={false}
                isAnimationActive={false}
              />

              {/* 중앙 예측선 */}
              <Line
                type="monotone"
                dataKey="monthly_cash_flow"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: 'var(--primary)' }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* 범례 */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 3, background: 'var(--primary)', borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>예측 현금흐름</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 10, background: 'var(--primary)', opacity: 0.18, borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>불확실성 범위</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 10, background: 'var(--danger)', opacity: 0.15, borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>적자 구간</span>
            </div>
          </div>
        </div>

        {/* ④ 경제 지표 가정 */}
        {assumptions && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Info size={16} color="var(--primary)" strokeWidth={1.8} />
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>적용된 경제 지표 (최근 5년 평균)</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: '소비자 물가 상승률', value: assumptions.inflation_rate.toFixed(1) + '%' },
                { label: '임금 상승률', value: assumptions.wage_growth_rate.toFixed(1) + '%' },
                { label: '의료비 상승률', value: assumptions.medical_cost_growth_rate.toFixed(1) + '%' },
                { label: '미래 불확실성 (±)', value: assumptions.uncertainty_rate.toFixed(0) + '%' },
              ].map((item) => (
                <div key={item.label} style={{
                  background: 'var(--bg-section)', borderRadius: 10,
                  padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 10, lineHeight: 1.6 }}>
              한국 통계청 2019~2024년 평균 데이터 기반 · 예측 결과는 참고용이며 실제와 다를 수 있습니다.
            </p>
          </div>
        )}

        {/* ⑤ 생애 이벤트 영향 */}
        {profile.life_events?.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">등록된 생애 이벤트</h3>
            {profile.life_events.map((e, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < profile.life_events.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{e.type}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                    {e.years_later === 0 ? '현재 진행 중' : `${e.years_later}년 후`}
                  </span>
                </div>
                <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
                  -{e.monthly_cost.toLocaleString('ko-KR')}원/월
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
