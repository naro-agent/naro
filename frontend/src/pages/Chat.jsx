import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Bot, ArrowUp, RefreshCw, ThumbsUp, ThumbsDown, Sparkles, MessageCircle, ChevronRight } from 'lucide-react';
import { useAppContext } from '../App.jsx';
import { sendChat, submitFeedback } from '../api/apiClient.js';

const QUICK_QUESTIONS = [
  '왜 내 재무 점수가 낮은가요?',
  '연금을 더 납입하면 어떻게 되나요?',
  '지출을 어떻게 줄일 수 있나요?',
  '의료비 보험은 어떤 것이 좋나요?',
  '63세에 은퇴하면 어떻게 달라지나요?',
];

function Bubble({ msg, onFeedback }) {
  const isUser = msg.role === 'user';
  const [rated, setRated] = useState(null);

  const handleFeedback = (rating) => {
    if (rated) return;
    setRated(rating);
    if (onFeedback) onFeedback(msg, rating);
  };

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginRight: 8, alignSelf: 'flex-end',
        }}>
          <Bot size={16} color="var(--primary)" strokeWidth={1.8} />
        </div>
      )}
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          background: isUser ? 'var(--primary)' : 'var(--bg-card)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          fontSize: 15, lineHeight: 1.7,
          boxShadow: 'var(--shadow-card)',
          whiteSpace: 'pre-wrap',
        }}>
          {isUser ? msg.content : (
            <ReactMarkdown components={{
              p: ({ children }) => <p style={{ margin: '0 0 6px 0' }}>{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
              ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
              li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
            }}>{msg.content}</ReactMarkdown>
          )}
        </div>

        {!isUser && msg.message_id && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingLeft: 4 }}>
            {rated ? (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {rated === 'good' ? '도움이 됐다고 표시했습니다' : '피드백 감사합니다'}
              </span>
            ) : (
              <>
                <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>도움이 됐나요?</span>
                <button onClick={() => handleFeedback('good')} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
                  fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'inherit',
                }}>
                  <ThumbsUp size={12} strokeWidth={1.8} /> 도움돼요
                </button>
                <button onClick={() => handleFeedback('bad')} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
                  fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'inherit',
                }}>
                  <ThumbsDown size={12} strokeWidth={1.8} /> 아쉬워요
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const navigate = useNavigate();
  const { profile, diagnosis, simulation, surveyScores } = useAppContext();

  const FREE_INIT_MSG = { role: 'assistant', content: '안녕하세요! 진단 결과나 노후 준비에 대해 궁금한 점을 자유롭게 질문해 주세요.' };

  // mode: null(선택 전) | 'free' | 'proactive'
  const [mode, setMode] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickOptions, setQuickOptions] = useState([]);
  const [proactiveStep, setProactiveStep] = useState(0);
  const [proactiveQuestions, setProactiveQuestions] = useState([]);
  const lastUserMsgRef = useRef('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleFeedback = async (msg, rating) => {
    try {
      await submitFeedback({
        message_id: msg.message_id,
        rating,
        user_message: lastUserMsgRef.current,
        ai_response: msg.content,
        mode,
        profile_age: profile?.age || null,
        profile_job_type: profile?.job_type || null,
        risk_areas: diagnosis?.risk_areas || [],
      });
    } catch (e) {
      console.warn('피드백 저장 실패', e);
    }
  };

  const resetChat = () => {
    setMode(null);
    setMessages([]);
    setInput('');
    setQuickOptions([]);
    setProactiveStep(0);
    setProactiveQuestions([]);
  };

  const startFree = () => {
    setMode('free');
    setMessages([FREE_INIT_MSG]);
    setInput('');
    setQuickOptions([]);
    setProactiveStep(0);
    setProactiveQuestions([]);
  };

  const sendMessage = async (text, stepOverride) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setQuickOptions([]);
    lastUserMsgRef.current = msg;

    const currentMode = stepOverride !== undefined ? 'proactive' : mode;
    const currentQuestion = (currentMode === 'proactive' && proactiveStep > 0 && proactiveQuestions[proactiveStep - 1])
      ? proactiveQuestions[proactiveStep - 1].question
      : undefined;
    const userMsg = {
      role: 'user',
      content: msg,
      ...(currentMode === 'proactive' && proactiveStep > 0 ? {
        proactive_step: proactiveStep,
        ...(currentQuestion ? { proactive_question: currentQuestion } : {}),
      } : {}),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    const savedQuestions = proactiveQuestions.length > 0 ? proactiveQuestions : [];
    const history = [
      ...(savedQuestions.length > 0 ? [{ role: 'system', proactive_questions: savedQuestions }] : []),
      ...newMessages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.proactive_step ? { proactive_step: m.proactive_step } : {}),
        ...(m.proactive_question ? { proactive_question: m.proactive_question } : {}),
      })),
    ];

    try {
      const resp = await sendChat(msg, profile, diagnosis, simulation, surveyScores, history, currentMode);
      const assistantMsg = { role: 'assistant', content: resp.reply, message_id: resp.message_id };
      setMessages(prev => [...prev, assistantMsg]);

      if (resp.proactive_questions) {
        setProactiveQuestions(resp.proactive_questions);
      }
      if (resp.quick_options?.length > 0) {
        setQuickOptions(resp.quick_options);
        setProactiveStep(resp.proactive_step || 0);
      } else {
        setProactiveStep(0);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '죄송합니다. 일시적인 오류가 발생했습니다.' }]);
    } finally {
      setLoading(false);
    }
  };

  const startProactive = async () => {
    setMode('proactive');
    setMessages([]);
    setInput('');
    setQuickOptions([]);
    setProactiveStep(0);
    setProactiveQuestions([]);
    setLoading(true);

    try {
      const resp = await sendChat('시작', profile, diagnosis, simulation, surveyScores, [], 'proactive');
      setMessages([{ role: 'assistant', content: resp.reply, message_id: resp.message_id }]);
      if (resp.proactive_questions) {
        setProactiveQuestions(resp.proactive_questions);
      }
      if (resp.quick_options?.length > 0) {
        setQuickOptions(resp.quick_options);
        setProactiveStep(resp.proactive_step || 1);
      }
    } catch {
      setMessages([{ role: 'assistant', content: '죄송합니다. 일시적인 오류가 발생했습니다.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── 모드 선택 화면 ──────────────────────────────────────────
  if (mode === null) {
    return (
      <div style={{ background: 'var(--bg-page)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="app-header">
          <button className="back-btn" onClick={() => navigate('/recommend')}>‹</button>
          <span className="header-title">AI 노후 상담</span>
          <div className="header-right" />
        </div>

        <div style={{ padding: '24px 20px', flex: 1 }}>
          {/* 헤드 */}
          <div className="card-primary" style={{ marginBottom: 24 }}>
            <p style={{ opacity: 0.8, fontSize: 13, marginBottom: 6 }}>나로(NaRo) AI 어드바이저</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4 }}>
              어떤 방식으로<br />상담받으시겠어요?
            </h2>
            {surveyScores && (
              <p style={{ opacity: 0.75, fontSize: 12, marginTop: 8 }}>
                설문 완료 · 취약 영역: {Object.entries(surveyScores).filter(([, v]) => v < 60).map(([k]) => ({finance:'재무',health:'건강',leisure:'여가활동',relation:'대인관계'})[k]).join(', ') || '없음'}
              </p>
            )}
          </div>

          {/* 가이드 상담 카드 */}
          <button
            onClick={startProactive}
            disabled={!surveyScores}
            style={{
              width: '100%', textAlign: 'left', background: '#fff',
              border: surveyScores ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
              borderRadius: 16, padding: '20px', marginBottom: 12,
              cursor: surveyScores ? 'pointer' : 'not-allowed',
              boxShadow: surveyScores ? 'var(--shadow-card)' : 'none',
              fontFamily: 'inherit',
              opacity: surveyScores ? 1 : 0.5,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: surveyScores ? 'var(--primary)' : 'var(--bg-section)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14, flexShrink: 0,
              }}>
                <Sparkles size={22} color={surveyScores ? '#fff' : 'var(--text-hint)'} strokeWidth={1.8} />
              </div>
              <ChevronRight size={18} color={surveyScores ? 'var(--primary)' : 'var(--text-hint)'} style={{ marginTop: 4 }} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              AI 분석 기반 가이드 상담
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              진단 결과를 바탕으로 AI가 맞춤 질문을 생성합니다.<br />
              답변하시면 현재 상황에 맞는 종합 분석을 드려요.
            </div>
            {surveyScores && (() => {
              const weakAreas = Object.entries(surveyScores)
                .filter(([, v]) => v < 60)
                .map(([k]) => ({finance:'재무',health:'건강',leisure:'여가활동',relation:'대인관계'})[k]);
              return (
                <div style={{
                  marginTop: 14, background: 'var(--primary-light)', borderRadius: 10,
                  padding: '8px 12px', fontSize: 12, color: 'var(--primary)', fontWeight: 600,
                }}>
                  <Sparkles size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {weakAreas.length > 0
                    ? `${weakAreas.join(', ')} 취약 영역 중심으로 질문이 생성됩니다`
                    : '전체 영역 균형 상담을 진행합니다'}
                </div>
              );
            })()}
            {!surveyScores && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-hint)' }}>
                설문 완료 후 이용 가능합니다
              </div>
            )}
          </button>

          {/* 자유 상담 카드 */}
          <button
            onClick={startFree}
            style={{
              width: '100%', textAlign: 'left', background: '#fff',
              border: '1.5px solid var(--border)',
              borderRadius: 16, padding: '20px', marginBottom: 24,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--bg-section)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14, flexShrink: 0,
              }}>
                <MessageCircle size={22} color="var(--text-secondary)" strokeWidth={1.8} />
              </div>
              <ChevronRight size={18} color="var(--text-secondary)" style={{ marginTop: 4 }} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              자유 질문
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              연금, 자산 관리, 의료비, 생애 이벤트 등<br />
              노후 준비 관련 궁금한 점을 자유롭게 물어보세요.
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── 채팅 화면 ────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--bg-page)', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div className="app-header">
        <button className="back-btn" onClick={resetChat}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {mode === 'proactive' ? 'AI 가이드 상담' : '자유 질문'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--success)' }}>● 온라인</div>
        </div>
        <button
          onClick={resetChat}
          style={{ width: 40, height: 40, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
        >
          <RefreshCw size={18} color="var(--text-secondary)" strokeWidth={1.8} />
        </button>
      </div>

      {/* 모드 배지 */}
      {mode === 'proactive' && (
        <div style={{
          background: 'var(--primary-light)', padding: '8px 16px',
          fontSize: 12, color: 'var(--primary)', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Sparkles size={12} />
          진단 결과 기반 맞춤 가이드 상담 · 질문에 답하시면 종합 분석을 드립니다
        </div>
      )}

      {/* 메시지 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {messages.map((m, i) => (
          <Bubble key={i} msg={m} onFeedback={handleFeedback} />
        ))}

        {/* 로딩 */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={16} color="var(--primary)" strokeWidth={1.8} />
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '18px 18px 18px 4px', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-hint)', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 자유 모드 — 첫 화면 추천 질문 */}
        {mode === 'free' && messages.length === 1 && !loading && (
          <div style={{ paddingLeft: 40, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {QUICK_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} style={{
                border: '1.5px solid var(--border)', background: 'var(--bg-card)',
                borderRadius: 12, padding: '11px 14px', fontSize: 13,
                cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left',
                fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >{q}</button>
            ))}
          </div>
        )}

        {/* proactive 선택지 버튼 */}
        {quickOptions.length > 0 && !loading && (
          <div style={{ margin: '4px 0 12px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quickOptions.map((opt, i) => (
              <button key={i} onClick={() => sendMessage(opt.label)} style={{
                border: '1.5px solid var(--primary)', background: 'var(--primary-light)',
                borderRadius: 12, padding: '11px 14px', fontSize: 13,
                cursor: 'pointer', color: 'var(--primary)', textAlign: 'left',
                fontFamily: 'inherit', fontWeight: 500,
              }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <div style={{
        background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
        padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-end',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={mode === 'proactive' ? '선택지를 고르거나 직접 입력하세요...' : '궁금한 것을 질문해보세요...'}
          rows={1}
          style={{
            flex: 1, background: 'var(--bg-input)', border: 'none',
            borderRadius: 20, padding: '12px 16px', fontSize: 15,
            fontFamily: 'inherit', resize: 'none', outline: 'none',
            lineHeight: 1.5, maxHeight: 100, overflowY: 'auto',
          }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: input.trim() && !loading ? 'var(--primary)' : 'var(--bg-section)',
            border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          {loading
            ? <div style={{ width: 18, height: 18, border: '2px solid var(--text-hint)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            : <ArrowUp size={18} color={input.trim() ? '#fff' : 'var(--text-hint)'} strokeWidth={2} />
          }
        </button>
      </div>

      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
