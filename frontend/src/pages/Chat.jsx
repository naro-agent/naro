import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App.jsx';
import { sendChat } from '../api/apiClient.js';

const QUICK_QUESTIONS = [
  '왜 내 재무 점수가 낮은가요?',
  '연금을 더 납입하면 점수가 얼마나 오르나요?',
  '63세에 은퇴하면 어떻게 달라지나요?',
  '의료비 대비는 어떻게 하면 되나요?',
];

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--primary-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0, marginRight: 8, alignSelf: 'flex-end',
        }}>🤖</div>
      )}
      <div style={{
        maxWidth: '78%',
        background: isUser ? 'var(--primary)' : 'var(--bg-card)',
        color: isUser ? '#fff' : 'var(--text-primary)',
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        fontSize: 15,
        lineHeight: 1.7,
        boxShadow: 'var(--shadow-card)',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

export default function Chat() {
  const navigate = useNavigate();
  const { profile, diagnosis } = useAppContext();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '안녕하세요! 나로(NaRo) AI 어드바이저입니다. 노후 준비에 관해 궁금한 점을 자유롭게 질문해 주세요. 진단 결과나 시뮬레이션에 대한 추가 설명도 드릴 수 있습니다.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await sendChat(msg, profile, diagnosis, history);
      setMessages(prev => [...prev, { role: 'assistant', content: resp.reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인해 주세요.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{
      background: 'var(--bg-page)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/recommend')}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>AI 노후 상담</div>
          <div style={{ fontSize: 11, color: 'var(--success)' }}>● 온라인</div>
        </div>
        <div className="header-right" />
      </div>

      {/* 컨텍스트 배너 */}
      {diagnosis && (
        <div style={{
          background: 'var(--primary-light)', padding: '10px 16px',
          fontSize: 12, color: 'var(--primary)', fontWeight: 600,
          display: 'flex', gap: 12,
        }}>
          <span>📊 진단 점수 {diagnosis.total_score}점</span>
          {diagnosis.risk_areas.length > 0 && (
            <span>⚠️ 취약: {diagnosis.risk_areas.join(', ')}</span>
          )}
        </div>
      )}

      {/* 메시지 영역 */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 16px 8px',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>🤖</div>
            <div style={{
              background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '18px 18px 18px 4px',
              boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--text-hint)',
                    animation: `bounce 1.2s ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 추천 질문 */}
      {messages.length < 3 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {QUICK_QUESTIONS.slice(0, 3).map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)} style={{
              flexShrink: 0,
              border: '1.5px solid var(--border)',
              background: 'var(--bg-card)',
              borderRadius: 20,
              padding: '8px 14px',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}>
              {q}
            </button>
          ))}
        </div>
      )}

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
          placeholder="노후 준비에 대해 질문해보세요..."
          rows={1}
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            border: 'none',
            borderRadius: 20,
            padding: '12px 16px',
            fontSize: 15,
            fontFamily: 'inherit',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
            maxHeight: 100,
            overflowY: 'auto',
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
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          {loading ? '⏳' : '↑'}
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
