import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App.jsx';
import { SURVEY_DATA, AREA_ORDER, getInterpretation } from '../data/surveyData.js';

export default function Survey() {
  const navigate = useNavigate();
  const { selectedAreas, setSurveyScores } = useAppContext();

  // 기본사항 먼저, 이후 선택된 영역 순서대로
  const areas = ['basic', ...AREA_ORDER.filter(a => selectedAreas.includes(a))];

  // 전체 문항 목록 생성 (영역 순서대로 평탄화)
  const allQuestions = areas.flatMap(areaId =>
    SURVEY_DATA[areaId].questions.map(q => ({ ...q, areaId }))
  );
  const total = allQuestions.length;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});  // { questionId: score }
  const [selected, setSelected] = useState(null);

  const current = allQuestions[currentIdx];
  const currentArea = current ? SURVEY_DATA[current.areaId] : null;
  const isLast = currentIdx === total - 1;

  // 문항 이동 시 이전 답변 복원
  useEffect(() => {
    setSelected(answers[current?.id] ?? null);
  }, [currentIdx]);

  const handleSelect = (score) => {
    setSelected(score);
  };

  const handleNext = () => {
    if (selected === null) return;
    const newAnswers = { ...answers, [current.id]: selected };
    setAnswers(newAnswers);

    if (isLast) {
      // 영역별 합산 (기본사항 포함)
      const scores = {};
      areas.forEach(areaId => {
        const areaQuestions = SURVEY_DATA[areaId].questions;
        const total = areaQuestions.reduce((sum, q) => sum + (newAnswers[q.id] ?? 0), 0);
        scores[areaId] = Math.round(total * 10) / 10;
      });
      setSurveyScores(scores);
      navigate('/pre-diagnosis');
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const handleBack = () => {
    if (currentIdx === 0) {
      navigate('/onboarding');
    } else {
      setAnswers(prev => ({ ...prev, [current.id]: selected }));
      setCurrentIdx(i => i - 1);
    }
  };

  if (!current || areas.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>선택된 진단 영역이 없습니다.</p>
        <button className="btn-primary" onClick={() => navigate('/area-select')}>영역 선택으로</button>
      </div>
    );
  }

  // 현재 영역 내 몇 번째 문항인지
  const areaQuestions = SURVEY_DATA[current.areaId].questions;
  const qIdxInArea = areaQuestions.findIndex(q => q.id === current.id);

  // 이전 영역 완료 문항 수
  const prevAreasDone = areas
    .slice(0, areas.indexOf(current.areaId))
    .reduce((sum, a) => sum + SURVEY_DATA[a].questions.length, 0);

  const progressPct = Math.round(((currentIdx) / total) * 100);

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div className="app-header">
        <button className="back-btn" onClick={handleBack}>‹</button>
        <span className="header-title">노후 준비 진단 설문</span>
        <div className="header-right" />
      </div>

      {/* 진행률 */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: currentArea.color }}>
            {currentArea.icon} {currentArea.label} · {qIdxInArea + 1}/{areaQuestions.length}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            전체 {currentIdx + 1}/{total}
          </span>
        </div>
        <div className="progress-bar">
          <div className="fill" style={{ width: `${progressPct}%`, background: currentArea.color }} />
        </div>

        {/* 영역 진행 표시 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {areas.map(areaId => {
            const a = SURVEY_DATA[areaId];
            const isDone = areas.indexOf(areaId) < areas.indexOf(current.areaId);
            const isCurrent = areaId === current.areaId;
            return (
              <div key={areaId} style={{
                flex: 1, height: 4, borderRadius: 100,
                background: isDone ? a.color : isCurrent ? a.color + '60' : 'var(--border)',
                transition: 'background 0.3s',
              }} />
            );
          })}
        </div>
      </div>

      {/* 문항 */}
      <div style={{ padding: '28px 20px 24px' }}>
        <div style={{
          background: currentArea.color + '12',
          borderRadius: 12, padding: '10px 14px',
          marginBottom: 20, fontSize: 12,
          color: currentArea.color, fontWeight: 600,
        }}>
          {currentArea.icon} {currentArea.label} 영역 Q{qIdxInArea + 1}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5, marginBottom: 24, color: 'var(--text-primary)' }}>
          {current.question}
        </h2>

        {/* 선택지 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {current.options.map((opt, idx) => {
            const isSelected = selected === opt.score;
            return (
              <button
                key={opt.score}
                onClick={() => handleSelect(opt.score)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: isSelected ? currentArea.color + '12' : 'var(--bg-card)',
                  border: `1.5px solid ${isSelected ? currentArea.color : 'var(--border)'}`,
                  borderRadius: 14, padding: '14px 16px',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', fontFamily: 'inherit', width: '100%',
                }}
              >
                <div style={{
                  minWidth: 28, height: 28, borderRadius: '50%',
                  background: isSelected ? currentArea.color : 'var(--bg-section)',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {idx + 1}
                </div>
                <span style={{
                  fontSize: 14, lineHeight: 1.6,
                  color: isSelected ? currentArea.color : 'var(--text-primary)',
                  fontWeight: isSelected ? 600 : 400,
                }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 이전 / 다음 버튼 — 선택지 바로 아래 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={handleBack}>
            ← 이전
          </button>
          <button
            className="btn-primary"
            style={{
              flex: 1,
              background: selected !== null ? currentArea.color : undefined,
              opacity: selected === null ? 0.4 : 1,
            }}
            disabled={selected === null}
            onClick={handleNext}
          >
            {isLast ? '설문 완료 →' : '다음 →'}
          </button>
        </div>
      </div>
    </div>
  );
}
