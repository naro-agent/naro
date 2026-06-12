import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, TrendingDown, PiggyBank, Landmark,
  Calendar, Banknote, ShieldCheck, CreditCard, BadgeCheck, Compass,
} from 'lucide-react';
import { useAppContext } from '../App.jsx';

const fmtWon = (n) => n.toLocaleString('ko-KR') + '원';
const fmtAxis = (n) => {
  const abs = Math.abs(n);
  if (abs >= 100000000) return (n / 100000000).toFixed(0) + '억';
  if (abs >= 10000) return (n / 10000).toFixed(0) + '만';
  return n.toLocaleString('ko-KR');
};

const SPENDING_COLORS = [
  '#1264D3', '#3D8EFF', '#7CB8FF', '#12B886', '#F5A623',
  '#F03E3E', '#8B95A1', '#7C5CFF', '#FF6B6B',
];

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAppContext();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'spending' | 'accounts'

  if (!profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Compass size={48} color="var(--text-hint)" style={{ marginBottom: 16 }} />
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
    { name: '퇴직연금', value: Math.round(profile.retirement_pension / 240), color: '#3D8EFF' },
    { name: '개인연금', value: profile.personal_pension, color: '#7CB8FF' },
  ];

  const assetData = [
    { name: '금융자산', value: profile.financial_assets },
    { name: '부동산', value: profile.real_estate_assets },
    { name: '부채', value: profile.liabilities },
  ];

  // 소비 카테고리 차트 데이터
  const spendingData = profile.spending_categories
    ? Object.entries(profile.spending_categories)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    : [];

  // 월별 저축 추이
  const savingsTrendData = profile.monthly_savings_trend
    ? profile.monthly_savings_trend.map((v, i) => ({ month: MONTHS[i], amount: v }))
    : [];

  const avgSavings = savingsTrendData.length
    ? Math.round(savingsTrendData.reduce((s, d) => s + d.amount, 0) / savingsTrendData.length)
    : 0;

  const totalPremium = profile.insurance
    ? profile.insurance.reduce((s, i) => s + i.monthly_premium, 0)
    : 0;

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/')}>‹</button>
        <span className="header-title">재무 현황</span>
        <div className="header-right" />
      </div>

      {/* 프로필 카드 */}
      <div style={{ padding: '16px 20px 0' }}>
        <div className="card-primary" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ opacity: 0.8, fontSize: 13, marginBottom: 4 }}>
                {profile.job_type} · {profile.age}세
                {profile.credit_score && (
                  <span style={{ marginLeft: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 100, padding: '1px 8px', fontSize: 11 }}>
                    신용 {profile.credit_score}점
                  </span>
                )}
              </p>
              <p style={{ fontSize: 20, fontWeight: 700 }}>은퇴 목표: {profile.retirement_target_age}세</p>
              <p style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                D-{profile.retirement_target_age - profile.age}년 · {profile.risk_type}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ opacity: 0.8, fontSize: 12 }}>순자산</p>
              <p style={{ fontSize: 20, fontWeight: 700 }}>{fmtWon(net)}</p>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="tab-group" style={{ marginBottom: 16 }}>
          {[
            { key: 'overview', label: '자산 개요' },
            { key: 'spending', label: '소비 패턴' },
            { key: 'accounts', label: '계좌·보험' },
          ].map(t => (
            <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* ── 자산 개요 탭 ── */}
        {activeTab === 'overview' && (
          <>
            {/* 월 현금흐름 요약 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: '월 소득', value: fmtWon(profile.monthly_income), Icon: TrendingUp, color: 'var(--success)' },
                { label: '월 지출', value: fmtWon(profile.monthly_expense), Icon: TrendingDown, color: 'var(--danger)' },
                { label: '저축률', value: savingsRate + '%', Icon: PiggyBank, color: 'var(--primary)' },
                { label: '월 연금 합계', value: fmtWon(monthlyPension), Icon: Landmark, color: '#7C5CFF' },
              ].map((item, i) => (
                <div key={i} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, background: item.color + '18', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <item.Icon size={18} color={item.color} strokeWidth={1.8} />
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: item.color, wordBreak: 'keep-all' }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* 3층 연금 */}
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 className="section-title">연금 수령 예상액 (월)</h3>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={pensionData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-primary)' }} width={56} />
                  <Tooltip formatter={v => [fmtWon(Math.round(v)), '예상 수령액']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                    {pensionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                * 퇴직연금은 20년 분할 수령 기준 월 환산액입니다
              </p>
            </div>

            {/* 자산·부채 */}
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 className="section-title">자산·부채 현황</h3>
              {assetData.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: i < assetData.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{item.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: item.name === '부채' ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {item.name === '부채' ? '-' : ''}{fmtWon(item.value)}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '2px solid var(--primary)' }}>
                <span style={{ fontWeight: 700 }}>순자산</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: net >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
                  {fmtWon(net)}
                </span>
              </div>
            </div>

            {/* 생애 이벤트 */}
            {profile.life_events?.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 className="section-title">등록된 생애 이벤트</h3>
                {profile.life_events.map((e, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: i < profile.life_events.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 32, height: 32, background: 'var(--primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Calendar size={15} color="var(--primary)" strokeWidth={1.8} /></span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{e.type}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {e.years_later === 0 ? '현재 진행 중' : `${e.years_later}년 후`}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>월 {fmtWon(e.monthly_cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 소비 패턴 탭 ── */}
        {activeTab === 'spending' && (
          <>
            {/* 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, background: 'var(--danger)' + '18', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={18} color="var(--danger)" strokeWidth={1.8} />
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>{fmtWon(profile.monthly_expense)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>월 총 지출</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, background: 'var(--success)' + '18', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PiggyBank size={18} color="var(--success)" strokeWidth={1.8} />
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{fmtWon(avgSavings)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>월 평균 저축</div>
              </div>
            </div>

            {/* 카테고리별 지출 */}
            {spendingData.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 className="section-title">카테고리별 지출</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={spendingData} margin={{ left: 8, right: 8 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                    <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10 }} width={44} />
                    <Tooltip formatter={v => [fmtWon(v), '지출']} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={28}>
                      {spendingData.map((_, i) => <Cell key={i} fill={SPENDING_COLORS[i % SPENDING_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* 카테고리 목록 */}
                <div style={{ marginTop: 12 }}>
                  {spendingData.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < spendingData.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: SPENDING_COLORS[i % SPENDING_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 14 }}>{item.name}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtWon(item.value)}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>
                          {Math.round(item.value / profile.monthly_expense * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 월별 저축 추이 */}
            {savingsTrendData.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 className="section-title">월별 저축 추이 (최근 12개월)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={savingsTrendData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10 }} width={44} />
                    <Tooltip formatter={v => [fmtWon(v), '저축액']} />
                    <Line type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                  12개월 평균 저축: <strong>{fmtWon(avgSavings)}</strong>
                </p>
              </div>
            )}
          </>
        )}

        {/* ── 계좌·보험 탭 ── */}
        {activeTab === 'accounts' && (
          <>
            {/* 계좌 현황 */}
            {profile.accounts?.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 className="section-title">계좌 현황</h3>
                {profile.accounts.map((acc, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: i < profile.accounts.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, background: 'var(--primary-light)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Banknote size={18} color="var(--primary)" strokeWidth={1.8} /></div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{acc.type}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{acc.bank}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtWon(acc.balance)}</div>
                      {acc.monthly_deposit > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--success)' }}>월 {fmtWon(acc.monthly_deposit)} 납입</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 보험 현황 */}
            {profile.insurance?.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 className="section-title" style={{ marginBottom: 0 }}>보험 가입 현황</h3>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                    월 {fmtWon(totalPremium)}
                  </span>
                </div>
                {profile.insurance.map((ins, i) => (
                  <div key={i} style={{
                    padding: '12px 0',
                    borderBottom: i < profile.insurance.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{ins.name}</span>
                      <span style={{ fontSize: 14, color: 'var(--danger)', fontWeight: 600 }}>월 {fmtWon(ins.monthly_premium)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {ins.company} · {ins.coverage}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 신용 정보 */}
            {profile.credit_score && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 className="section-title">신용 정보</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: profile.credit_score >= 800 ? 'var(--success)' : profile.credit_score >= 700 ? 'var(--primary)' : 'var(--warning)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{profile.credit_score}</span>
                    <span style={{ fontSize: 10 }}>점</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {profile.credit_score >= 800 ? '우수' : profile.credit_score >= 700 ? '양호' : '보통'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {profile.loan_history}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <button className="btn-primary" style={{ marginBottom: 24 }} onClick={() => navigate('/diagnosis')}>
          은퇴 준비 진단 시작 →
        </button>
      </div>
    </div>
  );
}
