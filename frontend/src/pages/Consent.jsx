import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';

const CONSENTS = [
  {
    id: 'privacy',
    title: '개인정보 수집 및 이용에 대한 안내 (필수)',
    sections: [
      {
        heading: '가. 개인정보의 수집·이용 목적',
        content: `"노후준비 종합진단" 서비스는 다음의 목적을 위해 개인정보를 수집 및 이용합니다. 수집된 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며 수집 목적이 변경될 경우 사전에 알리고 동의를 받을 예정입니다.\n\n• 노후준비 종합진단 이용\n• 노후준비 종합진단 이용 시 수집된 개인정보는 진단내용 조회·삭제를 위한 목적으로 이용됩니다.`,
      },
      {
        heading: '나. 수집하는 개인정보의 항목',
        content: '필수항목 : 성명',
      },
      {
        heading: '다. 개인정보의 보유 및 이용기간',
        content: `이용자 개인정보는 원칙적으로 처리목적이 달성되면 지체 없이 파기됩니다.\n\n단, 다음의 정보는 아래의 사유로 명시한 기간 동안 보유·이용합니다.\n\n• 보유항목 : 성명\n• 보유기간 : 이용일이 속한 연도로부터 5년\n• 보유근거 : 노후준비지원법 제6조, 제9조`,
      },
      {
        heading: '라. 동의를 거부할 권리',
        content: '이용자는 "노후준비 종합진단" 서비스에서 수집하는 개인정보에 대해 동의를 거부할 권리가 있으며 동의 거부 시에는 "노후준비 종합진단" 결과 저장 및 조회가 제한됩니다.',
      },
    ],
  },
  {
    id: 'identifier',
    title: '고유식별정보 수집에 대한 안내 (필수)',
    sections: [
      {
        heading: '수집 목적',
        content: '"노후준비 서비스"는 민원사무처리를 위해 고유식별정보(주민등록번호, 외국인등록번호 등)를 수집 및 이용합니다. 수집된 고유식별정보는 해당 목적 이외의 용도로는 이용되지 않습니다.',
      },
      {
        heading: '가. 고유식별정보의 보유 및 이용기간',
        content: `이용자 고유식별정보는 원칙적으로 처리목적이 달성되면 지체없이 파기합니다.\n\n• 고유식별정보 : 주민등록번호, 외국인등록번호\n• 보유기간 : 이용일이 속한 연도로부터 5년\n• 보유근거 : 노후준비지원법 시행령 제18조(고유식별정보의 처리)`,
      },
    ],
  },
];

function ConsentItem({ consent, agreed, onToggleAgree }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14,
      border: `1.5px solid ${agreed ? 'var(--primary)' : 'var(--border)'}`,
      overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => onToggleAgree()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
        >
          {agreed
            ? <CheckCircle2 size={24} color="var(--primary)" strokeWidth={2} />
            : <Circle size={24} color="var(--border)" strokeWidth={1.5} />
          }
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, flex: 1, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {consent.title}
        </span>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }}
        >
          {expanded
            ? <ChevronUp size={18} strokeWidth={1.8} />
            : <ChevronDown size={18} strokeWidth={1.8} />
          }
        </button>
      </div>

      {/* 상세 내용 */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 18px',
          background: 'var(--bg-section)',
          maxHeight: 280, overflowY: 'auto',
        }}>
          {consent.sections.map((sec, i) => (
            <div key={i} style={{ marginBottom: i < consent.sections.length - 1 ? 16 : 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
                {sec.heading}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {sec.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Consent() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState({ privacy: false, identifier: false });
  const allAgreed = Object.values(agreed).every(Boolean);

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreed({ privacy: next, identifier: next });
  };

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div className="app-header">
        <button className="back-btn" onClick={() => navigate('/')}>‹</button>
        <span className="header-title">개인정보 수집 동의</span>
        <div className="header-right" />
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 안내 문구 */}
        <div style={{
          background: 'var(--primary-light)', borderRadius: 12,
          padding: '14px 16px', marginBottom: 4,
          fontSize: 13, color: 'var(--primary)', lineHeight: 1.7,
        }}>
          노후준비 종합진단 서비스 이용을 위해<br />
          아래 개인정보 수집·이용에 동의해 주세요.
        </div>

        {/* 전체 동의 */}
        <button
          onClick={toggleAll}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: allAgreed ? 'var(--primary)' : 'var(--bg-card)',
            border: `1.5px solid ${allAgreed ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
            transition: 'all 0.15s', fontFamily: 'inherit', width: '100%',
          }}
        >
          {allAgreed
            ? <CheckCircle2 size={24} color="#fff" strokeWidth={2} />
            : <Circle size={24} color="var(--border)" strokeWidth={1.5} />
          }
          <span style={{
            fontSize: 16, fontWeight: 700,
            color: allAgreed ? '#fff' : 'var(--text-primary)',
          }}>
            전체 동의하기
          </span>
        </button>

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

        {/* 개별 동의 항목 */}
        {CONSENTS.map(consent => (
          <ConsentItem
            key={consent.id}
            consent={consent}
            agreed={agreed[consent.id]}
            onToggleAgree={() => setAgreed(prev => ({ ...prev, [consent.id]: !prev[consent.id] }))}
          />
        ))}

        <p style={{ fontSize: 11, color: 'var(--text-hint)', lineHeight: 1.7, textAlign: 'center', marginTop: 4 }}>
          항목을 펼쳐 내용을 확인하신 후 동의해 주세요.<br />
          필수 항목 미동의 시 서비스 이용이 제한됩니다.
        </p>

        {/* 버튼 — 콘텐츠 바로 아래 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24, marginBottom: 32 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/')}>
            ← 이전
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={!allAgreed}
            onClick={() => navigate('/area-select')}
          >
            동의하고 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
