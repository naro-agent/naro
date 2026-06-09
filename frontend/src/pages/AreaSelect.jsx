import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { useAppContext } from '../App.jsx';

const AREAS = [
  {
    id: 'finance',
    icon: '💰',
    label: '재무',
    desc: '자산·부채·연금·소득·소비패턴',
    color: '#1264D3',
  },
  {
    id: 'health',
    icon: '❤️',
    label: '건강',
    desc: '건강 상태·의료비·보험 현황',
    color: '#F03E3E',
  },
  {
    id: 'leisure',
    icon: '🌿',
    label: '여가활동',
    desc: '취미·여행·문화생활·여가 지출',
    color: '#12B886',
  },
  {
    id: 'relation',
    icon: '🤝',
    label: '대인관계',
    desc: '사회활동·가족교류·모임·봉사',
    color: '#F5A623',
  },
];

export default function AreaSelect() {
  const navigate = useNavigate();
  const { setSelectedAreas } = useAppContext();
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setSelectedAreas(selected);
    navigate('/onboarding');
  };

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/consent')}>‹</button>
        <span className="header-title">진단 영역 선택</span>
        <div className="header-right" />
      </div>

      {/* 진행률 */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>STEP 1</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>진단 영역 선택</span>
        </div>
        <div className="progress-bar">
          <div className="fill" style={{ width: '25%' }} />
        </div>
      </div>

      <div style={{ padding: '28px 20px 24px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, lineHeight: 1.4 }}>
          어떤 영역을 진단받고 싶으신가요?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          원하는 영역을 모두 선택해 주세요.<br />
          선택한 영역에 맞는 설문과 진단 결과를 제공합니다.
        </p>

        {/* 영역 카드 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {AREAS.map(area => {
            const isSelected = selected.includes(area.id);
            return (
              <button
                key={area.id}
                onClick={() => toggle(area.id)}
                style={{
                  background: isSelected ? area.color + '12' : 'var(--bg-card)',
                  border: `2px solid ${isSelected ? area.color : 'var(--border)'}`,
                  borderRadius: 16, padding: '20px 16px',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                  position: 'relative',
                }}
              >
                {/* 체크 아이콘 */}
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  {isSelected
                    ? <CheckCircle2 size={20} color={area.color} strokeWidth={2} />
                    : <Circle size={20} color="var(--border)" strokeWidth={1.5} />
                  }
                </div>

                <div style={{ fontSize: 32, marginBottom: 10 }}>{area.icon}</div>
                <div style={{
                  fontSize: 16, fontWeight: 700, marginBottom: 6,
                  color: isSelected ? area.color : 'var(--text-primary)',
                }}>
                  {area.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {area.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* 선택 현황 */}
        {selected.length > 0 ? (
          <div style={{
            background: 'var(--primary-light)', borderRadius: 12,
            padding: '12px 16px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
              선택됨:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selected.map(id => {
                const area = AREAS.find(a => a.id === id);
                return (
                  <span key={id} style={{
                    fontSize: 12, fontWeight: 700,
                    background: area.color, color: '#fff',
                    padding: '3px 10px', borderRadius: 100,
                  }}>
                    {area.icon} {area.label}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-section)', borderRadius: 12,
            padding: '12px 16px', marginBottom: 8,
            fontSize: 13, color: 'var(--text-hint)', textAlign: 'center',
          }}>
            1개 이상 선택해 주세요
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-hint)', textAlign: 'center', lineHeight: 1.6 }}>
          전체 선택 시 더 종합적인 진단 결과를 받을 수 있습니다.
        </p>

        {/* 이전 / 다음 버튼 — 콘텐츠 바로 아래 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, marginBottom: 32 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/consent')}>
            ← 이전
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={selected.length === 0}
            onClick={handleNext}
          >
            다음 단계로 →
          </button>
        </div>
      </div>
    </div>
  );
}
