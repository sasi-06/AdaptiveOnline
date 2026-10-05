import React from 'react';
import { useTheme } from '../context/ThemeContext';

const eventMap = {
    'face_missing': { label: 'Face Connection Lost', icon: '', color: '#ef4444', desc: 'The student moved out of the camera frame.' },
    'head_turn': { label: 'Head Movement', icon: '', color: '#f59e0b', desc: 'Significant head rotation detected.' },
    'gaze_away': { label: 'Eye Deviation', icon: '', color: '#f59e0b', desc: 'Eyes were focused away from the exam screen.' },
    'multiple_faces': { label: 'Proxy Detected', icon: '', color: '#ef4444', desc: 'More than one person was seen in the frame.' },
    'phone_detected': { label: 'Prohibited Object', icon: '', color: '#ef4444', desc: 'A mobile phone or similar device was detected.' },
    'identity_mismatch': { label: 'Identity Violation', icon: '', color: '#ef4444', desc: 'A different person was detected attending the exam.' },
    'speech_detected': { label: 'Audio Violation', icon: '', color: '#ef4444', desc: 'Human speech was detected in the surroundings.' },
    'multiple_voices': { label: 'Background Help', icon: '', color: '#ef4444', desc: 'Multiple distinct voices were detected.' },
    'fullscreen_exit': { label: 'Tab Switch', icon: '', color: '#f59e0b', desc: 'The student exited the secure fullscreen mode.' },
    'ADAPTIVE_VALIDATION_TRIGGERED': { label: 'Security Check', icon: '', color: '#10b981', desc: 'System forced a validation question due to high risk.' }
};

export default function BehaviorTimeline({ logs }) {
    const { theme: t } = useTheme();

    if (!logs || logs.length === 0) {
        return <div className="tl-empty">No behavioral flags found for this session.</div>;
    }

    // Filter logs that have events, high risk, or photo snapshot proof for evidence timeline
    const timelineData = logs.filter(l => (l.events && l.events.length > 0) || l.riskScore > 30 || l.snapshot);

    const getHumanMetrics = (log) => {
        const details = [];
        if (log.eyeDeviation > 25) details.push(`Gazed away at ${Math.round(log.eyeDeviation)}°`);
        if (log.headMovement > 25) details.push(`Turned head by ${Math.round(log.headMovement)}°`);
        if (log.mouseIdleTime > 60) details.push(`Inactive for ${Math.round(log.mouseIdleTime)}s`);
        if (log.faceScale < 0.1 && log.faceScale > 0) details.push(`Moved far from camera`);
        return details.join(' • ');
    };

    return (
        <div className="tl-root">
            <style>{`
                .tl-root { padding: 20px 0; }
                .tl-container { position: relative; padding-left: 40px; }
                .tl-container::before { content: ''; position: absolute; left: 16px; top: 0; bottom: 0; width: 2px; background: ${t.border}; border-radius: 2px; }
                
                .tl-item { position: relative; margin-bottom: 32px; animation: tlFade 0.4s ease backwards; }
                @keyframes tlFade { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
                
                .tl-dot { position: absolute; left: -32px; top: 4px; width: 18px; height: 18px; border-radius: 50%; background: ${t.surface}; border: 3px solid ${t.accent}; z-index: 2; }
                .tl-time { font-size: 11px; font-weight: 700; color: ${t.textSub}; text-transform: uppercase; margin-bottom: 6px; display: block; letter-spacing: 0.5px; }
                
                .tl-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 12px; padding: 16px; transition: all 0.2s; cursor: pointer; }
                .tl-card:hover { border-color: ${t.accent}; transform: translateY(-2px); box-shadow: 0 8px 24px ${t.cardShadow}; }
                
                .tl-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
                .tl-icon { font-size: 18px; }
                .tl-label { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; color: ${t.text}; }
                .tl-risk-tag { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 100px; margin-left: auto; text-transform: uppercase; }
                
                .tl-desc { font-size: 13px; color: ${t.textMuted}; line-height: 1.5; margin-bottom: 10px; }
                .tl-evidence { background: ${t.surfaceAlt}; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; color: ${t.textMuted}; display: flex; align-items: center; gap: 6px; }
                .tl-evidence span { color: ${t.accent}; }
                
                .tl-empty { text-align: center; padding: 40px; color: ${t.textMuted}; font-size: 14px; border: 2px dashed ${t.border}; border-radius: 16px; }
            `}</style>

            <div className="tl-container">
                {timelineData.map((log, idx) => {
                    const primaryEvent = log.events && log.events[0];
                    const cfg = eventMap[primaryEvent] || { label: 'Behavioral Anomaly', icon: '', color: t.accent, desc: 'Unusual patterns detected in behavior metrics.' };
                    const riskColor = log.riskScore > 70 ? '#ef4444' : log.riskScore > 30 ? '#f59e0b' : '#10b981';
                    
                    return (
                        <div key={log._id} className="tl-item" style={{ animationDelay: `${idx * 0.05}s` }}>
                            <div className="tl-dot" style={{ borderColor: cfg.color }} />
                            <span className="tl-time">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            
                            <div className="tl-card">
                                <div className="tl-header">
                                    <span className="tl-icon">{cfg.icon}</span>
                                    <span className="tl-label">{cfg.label}</span>
                                    <span className="tl-risk-tag" style={{ background: `${riskColor}15`, color: riskColor }}>Risk: {Math.round(log.riskScore)}%</span>
                                </div>
                                <div className="tl-desc">{cfg.desc}</div>
                                {getHumanMetrics(log) && (
                                    <div className="tl-evidence">
                                        <span>Evidence:</span> {getHumanMetrics(log)}
                                    </div>
                                )}
                                {log.snapshot && (
                                    <div className="tl-snapshot-proof" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: t.textSub, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                             Visual Proof Snapshot:
                                        </div>
                                        <img 
                                            src={log.snapshot} 
                                            alt="Proctoring Anomaly Evidence" 
                                            style={{ 
                                                width: '100%', 
                                                maxWidth: '280px', 
                                                borderRadius: '8px', 
                                                border: `1.5px solid ${t.border}`,
                                                boxShadow: `0 4px 12px ${t.cardShadow}`
                                            }} 
                                        />
                                    </div>
                                )}
                                {log.question_id && (
                                    <div style={{ fontSize: '11px', marginTop: '8px', color: t.textSub }}>
                                        During Question: {log.question_id?.question_text?.substring(0, 60)}...
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
