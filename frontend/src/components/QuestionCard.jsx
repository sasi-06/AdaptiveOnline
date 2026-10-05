import React from 'react';
import { useTheme } from '../context/ThemeContext';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function QuestionCard({ question, index, total, selected, onSelect, isReplaced }) {
    const { theme: t } = useTheme();
    if (!question) return null;

    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');

        .qc-card {
            background: ${t.surface}; border: 1px solid ${t.border};
            border-radius: 16px; padding: 28px;
            transition: background 0.4s, border-color 0.4s;
        }
        .qc-meta {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 20px; flex-wrap: wrap; gap: 8px;
        }
        .qc-num {
            font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700;
            color: ${t.textMuted}; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .qc-badges { display: flex; gap: 7px; flex-wrap: wrap; }
        .qc-badge {
            display: inline-flex; align-items: center; padding: 3px 11px;
            border-radius: 100px; font-size: 12px; font-weight: 600;
        }
        .qc-badge-easy { background: rgba(5,150,105,0.12); color: #059669; }
        .qc-badge-medium { background: rgba(234,179,8,0.12); color: #ca8a04; }
        .qc-badge-hard { background: ${t.errorBg}; color: ${t.errorText}; }
        .qc-badge-topic { background: ${t.tabActiveBg}; color: ${t.accent}; }
        .qc-badge-adapted { background: rgba(245,158,11,0.12); color: #f59e0b; }

        .qc-text {
            font-size: 17px; font-weight: 500; color: ${t.text};
            line-height: 1.65; margin-bottom: 26px;
            transition: color 0.4s;
        }

        .qc-options { display: flex; flex-direction: column; gap: 10px; }
        .qc-option {
            display: flex; align-items: center; gap: 14px;
            padding: 14px 18px; border-radius: 11px; cursor: pointer;
            border: 1.5px solid ${t.border};
            background: ${t.surfaceAlt};
            transition: all 0.18s ease;
            user-select: none;
        }
        .qc-option:hover { border-color: ${t.accent}; background: ${t.tabActiveBg}; }
        .qc-option.selected {
            border-color: ${t.accent};
            background: ${t.tabActiveBg};
            box-shadow: 0 0 0 3px ${t.accentGlow};
        }
        .qc-letter {
            width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 800;
            border: 2px solid ${t.border};
            background: ${t.inputBg}; color: ${t.textMuted};
            transition: all 0.18s ease;
        }
        .qc-option.selected .qc-letter {
            background: ${t.accent}; border-color: ${t.accent}; color: #fff;
        }
        .qc-option:hover .qc-letter {
            border-color: ${t.accent}; color: ${t.accent};
        }
        .qc-option.selected:hover .qc-letter { color: #fff; }
        .qc-opt-text { font-size: 15px; font-weight: 400; color: ${t.text}; line-height: 1.5; transition: color 0.4s; }
    `;

    return (
        <>
            <style>{css}</style>
            <div className="qc-card">
                <div className="qc-meta">
                    <span className="qc-num">Question {index + 1} of {total}</span>
                    <div className="qc-badges">
                        <span className={`qc-badge qc-badge-${question.difficulty}`}>{question.difficulty}</span>
                        <span className="qc-badge qc-badge-topic">{question.topic}</span>
                        {isReplaced && <span className="qc-badge qc-badge-adapted"> Adapted</span>}
                    </div>
                </div>

                <p className="qc-text">{question.question_text}</p>

                {question.circuit_diagram_url && (
                    <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                        <img 
                            src={question.circuit_diagram_url} 
                            alt="Circuit Schematic" 
                            style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', border: `1px solid ${t.border}` }}
                        />
                    </div>
                )}

                <div className="qc-options">
                    {question.options?.map((opt, i) => (
                        <div key={i} className={`qc-option ${selected === opt ? 'selected' : ''}`} onClick={() => onSelect(opt)}>
                            <div className="qc-letter">{LETTERS[i]}</div>
                            <span className="qc-opt-text">{opt}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
