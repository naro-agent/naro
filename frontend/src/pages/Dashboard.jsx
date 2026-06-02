import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAppContext } from '../App.jsx';

const fmt = (n) => n >= 10000 ? (n / 10000).toFixed(0) + '만' : n.toLocaleString();
const fmtWon = (n) => n.toLocaleString() + '원';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAppContext();

  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧭</div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>먼저 프로필을 설정해주세요.</p>
        <button className="btn-primary" style={{ maxWidth: 240, margin: '0 auto', display: 'block' }}
          onClick={() => navigate('/')}>홈으로 이동</button>
      </div>
    );
  }

  const net = profile.financial_assets + profile.real_estate_assets - profile.liabilities;
  const monthlyPension = profile.national_pension_expected + profile.personal_pension;
  const savingsRate = Math.max(0, ((profile.monthly_income - profile.monthly_expense) / profile.monthly_income * 100)).toFixed(1);

  const pensionData = [
    { name: '국민연금', value: profile.national_pension_expected, color: '#1264D3' },
    { name: '퇴직연금', value: profile.retirement_pension / 240, color: '#3D8EFF' },
    { name: '개인연금', value: profile.personal_pension, color: '#7CB8FF' },
  ];

  const assetData = [
    { name: '금융자산', value: profile.financial_assets },
    { name: '부동산', value: profile.real_estate_assets },
    { name: '부채', value: profile.liabilities },
  ];

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/')}>‹</button>
        <span className="header-title">재무 현황</span>
        <div className="header-right" />
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {/* 프로필 카드 */}
        <div className="card-primary" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ opacity: 0.8, fontSize: 13, marginBottom: 4 }}>
                {profile.job_type} · {profile.age}세
              </p>
              <p style={{ fontSize: 20, fontWeight: 700 }}>
                은퇴 목표: {profile.retirement_target_age}세
              </p>
              <p style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                D-{(profile.retirement_target_age - profile.age)}년 · {profile.risk_type}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ opacity: 0.8, fontSize: 12 }}>순자산</p>
              <p style={{ fontSize: 22, fontWeight: 700 }}>{fmt(net)}원</p>
            </div>
          </div>
        </div>

        {/* 월 현금흐름 요약 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: '월 소득', value: fmt(profile.monthly_income), icon: '💰', color: 'var(--success)' },
            { label: '월 지출', value: fmt(profile.monthly_expense), icon: '🛒', color: 'var(--danger)' },
            { label: '저축률', value: savingsRate + '%', icon: '📈', color: 'var(--primary)' },
            { label: '월 연금 합계', value: fmt(monthlyPension), icon: '🏦', color: '#7C5CFF' },
          ].map((item, i) => (
            <div key={i} className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* 3층 연금 차트 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title">3층 연금 현황 (월 수령 예상)</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={pensionData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 13, fill: 'var(--text-primary)' }} width={56} />
              <Tooltip formatter={v => [fmtWon(v), '예상 수령액']} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                {pensionData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
            * 퇴직연금은 20년 분할 수령 기준 월 환산액
          </p>
        </div>

        {/* 자산·부채 요약 */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title">자산·부채 현황</h3>
          {assetData.map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0',
              borderBottom: i < assetData.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{item.name}</span>
              <span style={{
                fontSize: 16, fontWeight: 700,
                color: item.name === '부채' ? 'var(--danger)' : 'var(--text-primary)',
              }}>
                {item.name === '부채' ? '-' : ''}{fmt(item.value)}원
              </span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: 12, borderTop: '2px solid var(--primary)',
          }}>
            <span style={{ fontWeight: 700 }}>순자산</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: net >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
              {fmt(net)}원
            </span>
          </div>
        </div>

        {/* 생애 이벤트 */}
        {profile.life_events && profile.life_events.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="section-title">등록된 생애 이벤트</h3>
            {profile.life_events.map((e, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < profile.life_events.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 32, height: 32, background: 'var(--primary-light)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>📅</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{e.type}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {e.years_later === 0 ? '현재 진행 중' : `${e.years_later}년 후`}
                    </div>
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                  월 {e.monthly_cost.toLocaleString()}원
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="btn-primary" style={{ marginBottom: 24 }} onClick={() => navigate('/diagnosis')}>
          은퇴 준비 진단 시작 →
        </button>
      </div>
    </div>
  );
}
