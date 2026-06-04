import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Bot, ArrowUp, RefreshCw, MessageSquare } from 'lucide-react';
import { useAppContext } from '../App.jsx';
import { sendChat } from '../api/apiClient.js';

const TOTAL_STEPS = 5;

// ── 말풍선 컴포넌트 ──
function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginRight: 8, alignSelf: 'flex-end',
        }}>
          <Bot size={16} color="var(--primary)" strokeWidth={1.8} />
        </div>
      )}
      <div style={{
        maxWidth: '78%',
        background: isUser ? 'var(--primary)' : 'var(--bg-card)',
        color: isUser ? '#fff' : 'var(--text-primary)',
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        fontSize: 15, lineHeight: 1.7,
        boxShadow: 'var(--shadow-card)',
        whiteSpace: 'pre-wrap',
      }}>
        {isUser ? msg.content : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ margin: '0 0 6px 0' }}>{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
              ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
              li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
            }}
          >{msg.content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}

// ── 버튼 선택지 컴포넌트 ──
function QuickOptions({ options, onSelect, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0 16px 40px' }}>
      {options.map((opt, i) => (
        <button
          key={i}
          disabled={disabled}
          onClick={() => onSelect(opt)}
          style={{
            background: disabled ? 'var(--bg-section)' : 'var(--bg-card)',
            border: `1.5px solid ${disabled ? 'var(--border)' : 'var(--primary)'}`,
            borderRadius: 12, padding: '12px 16px',
            fontSize: 14, color: disabled ? 'var(--text-secondary)' : 'var(--primary)',
            fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
            textAlign: 'left', transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--primary-light)'; }}
          onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'var(--bg-card)'; }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── 진행률 표시 ──
function ProactiveProgress({ step }) {
  return (
    <div style={{ padding: '10px 16px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        질문 {step}/{TOTAL_STEPS}
      </span>
      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--primary)', borderRadius: 4, width: `${(step / TOTAL_STEPS) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

export default function Chat() {
  const navigate = useNavigate();
  const { profile, diagnosis } = useAppContext();

  const [mode, setMode] = useState(null); // null | 'proactive' | 'free'
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [proactiveStep, setProactiveStep] = useState(0);
  const [proactiveDone, setProactiveDone] = useState(false);
  const [optionsDisabled, setOptionsDisabled] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, currentOptions]);

  // ── 프로액티브 모드 시작 ──
  const startProactive = async () => {
    setMode('proactive');
    setLoading(true);
    try {
      const resp = await sendChat('', profile, diagnosis, [], 'proactive');
      setMessages([{ role: 'assistant', content: resp.reply }]);
      setCurrentOptions(resp.quick_options || []);
      setProactiveStep(resp.proactive_step || 1);
    } catch {
      setMessages([{ role: 'assistant', content: '죄송합니다. 잠시 후 다시 시도해 주세요.' }]);
    } finally {
      setLoading(false);
    }
  };

  // ── 자유 대화 모드 시작 ──
  const startFree = () => {
    setMode('free');
    setMessages([{
      role: 'assistant',
      content: '안녕하세요! 노후 준비에 관해 궁금한 점을 자유롭게 질문해 주세요.\n진단 결과나 추천 상품에 대한 추가 설명도 드릴 수 있습니다.',
    }]);
  };

  // ── 버튼 선택지 클릭 ──
  const handleOptionSelect = async (option) => {
    if (loading || optionsDisabled) return;
    setOptionsDisabled(true);
    setCurrentOptions([]);

    const userMsg = { role: 'user', content: option.label, proactive_step: proactiveStep };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    const history = newMessages.map(m => ({
      role: m.role, content: m.content, proactive_step: m.proactive_step || 0,
    }));

    try {
      const resp = await sendChat(option.value, profile, diagnosis, history, 'proactive');
      const assistantMsg = { role: 'assistant', content: resp.reply };
      setMessages(prev => [...prev, assistantMsg]);

      if (resp.quick_options?.length > 0) {
        setCurrentOptions(resp.quick_options);
        setProactiveStep(resp.proactive_step || proactiveStep + 1);
        setOptionsDisabled(false);
      } else {
        // 모든 질문 완료
        setProactiveDone(true);
        setMode('free');
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '죄송합니다. 잠시 후 다시 시도해 주세요.' }]);
      setOptionsDisabled(false);
    } finally {
      setLoading(false);
    }
  };

  // ── 자유 입력 전송 ──
  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    const history = newMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await sendChat(msg, profile, diagnosis, history, 'free');
      setMessages(prev => [...prev, { role: 'assistant', content: resp.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '죄송합니다. 일시적인 오류가 발생했습니다.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const resetChat = () => {
    setMode(null); setMessages([]); setCurrentOptions([]);
    setProactiveStep(0); setProactiveDone(false); setOptionsDisabled(false); setInput('');
  };

  // ── 모드 선택 화면 ──
  if (!mode) {
    return (
      <div style={{ background: 'var(--bg-page)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="app-header">
          <button className="back-btn" onClick={() => navigate('/recommend')}>‹</button>
          <span className="header-title">AI 노후 상담</span>
          <div className="header-right" />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
          <div style={{ width: 64, height: 64, background: 'var(--primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Bot size={32} color="var(--primary)" strokeWidth={1.6} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
            AI 노후 준비 상담
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.7, marginBottom: 36 }}>
            상담 방식을 선택해 주세요.<br />처음이시라면 AI 질문 가이드를 추천합니다.
          </p>

          {/* 프로액티브 모드 */}
          <button
            onClick={startProactive}
            style={{
              width: '100%', background: 'var(--primary)', border: 'none',
              borderRadius: 16, padding: '22px 20px', cursor: 'pointer',
              textAlign: 'left', color: '#fff', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 4px 16px rgba(18,100,211,0.25)',
            }}
          >
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={24} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>AI 질문 가이드</div>
              <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                AI가 먼저 질문을 드립니다.<br />버튼 선택만으로 쉽게 진행하세요.
              </div>
            </div>
            <div style={{ fontSize: 11, background: 'rgba(255,255,255,0.25)', borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap' }}>
              추천
            </div>
          </button>

          {/* 자유 대화 모드 */}
          <button
            onClick={startFree}
            style={{
              width: '100%', background: 'var(--bg-card)', border: '1.5px solid var(--border)',
              borderRadius: 16, padding: '20px', cursor: 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
            }}
          >
            <div style={{ width: 48, height: 48, background: 'var(--primary-light)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageSquare size={22} color="var(--primary)" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>자유 질문</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                궁금한 것을 직접 입력해서 질문하세요.
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── 채팅 화면 ──
  return (
    <div style={{ background: 'var(--bg-page)', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div className="app-header">
        <button className="back-btn" onClick={resetChat}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>AI 노후 상담</div>
          <div style={{ fontSize: 11, color: 'var(--success)' }}>● 온라인</div>
        </div>
        <button
          onClick={resetChat}
          style={{ width: 40, height: 40, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
        >
          <RefreshCw size={18} color="var(--text-secondary)" strokeWidth={1.8} />
        </button>
      </div>

      {/* 프로액티브 진행률 */}
      {mode === 'proactive' && !proactiveDone && proactiveStep > 0 && (
        <ProactiveProgress step={proactiveStep} />
      )}

      {/* 진단 컨텍스트 배너 */}
      {diagnosis && (
        <div style={{ background: 'var(--primary-light)', padding: '8px 16px', fontSize: 12, color: 'var(--primary)', fontWeight: 600, display: 'flex', gap: 12 }}>
          <span>진단 점수 {diagnosis.total_score}점</span>
          {diagnosis.risk_areas.length > 0 && (
            <span>취약: {diagnosis.risk_areas.join(', ')}</span>
          )}
        </div>
      )}

      {/* 메시지 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}

        {/* 버튼 선택지 */}
        {currentOptions.length > 0 && !loading && (
          <QuickOptions
            options={currentOptions}
            onSelect={handleOptionSelect}
            disabled={optionsDisabled}
          />
        )}

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

        {/* 프로액티브 완료 후 자유 질문 안내 */}
        {proactiveDone && !loading && (
          <div style={{ textAlign: 'center', margin: '16px 0', padding: '14px', background: 'var(--primary-light)', borderRadius: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>상담이 완료되었습니다</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>아래 입력창으로 추가 질문을 하실 수 있습니다.</p>
          </div>
        )}

        {/* 자유 모드 추천 질문 */}
        {mode === 'free' && messages.length === 1 && (
          <div style={{ margin: '4px 0 12px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['왜 내 재무 점수가 낮은가요?', '연금을 더 납입하면 어떻게 되나요?', '지출을 어떻게 줄일 수 있나요?'].map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} style={{
                border: '1.5px solid var(--border)', background: 'var(--bg-card)',
                borderRadius: 12, padding: '10px 14px', fontSize: 13,
                cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left',
                fontFamily: 'inherit',
              }}>{q}</button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 — 자유 대화 모드이거나 프로액티브 완료 후 */}
      {(mode === 'free' || proactiveDone) && (
        <div style={{
          background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
          padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-end',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="노후 준비에 대해 질문해보세요..."
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
              ? <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : <ArrowUp size={18} color={input.trim() ? '#fff' : 'var(--text-hint)'} strokeWidth={2} />
            }
          </button>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
