import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useTheme } from '../context/ThemeContext';

export default function AdminLiveProctor() {
    const { theme: t } = useTheme();
    const [activeStudents, setActiveStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [riskInfo, setRiskInfo] = useState({ score: 0, messages: [] });
    
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const selectedRef = useRef(null);
    useEffect(() => { selectedRef.current = selectedStudent; }, [selectedStudent]);

    useEffect(() => {
        const socket = io('http://localhost:5000');
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log("Admin connected to socket:", socket.id);
            socket.emit('get-active-students');
        });

        socket.on('active-students-update', (list) => {
            setActiveStudents(list);
            // Sync risk score if current student's data is updated in the list
            const current = list.find(s => s.studentId === selectedRef.current?.studentId);
            if (current) setRiskInfo(prev => ({ ...prev, score: current.riskScore }));
        });

        socket.on('risk-sync', ({ studentId, riskScore, messages }) => {
            if (studentId === selectedRef.current?.studentId) {
                console.log("Risk Sync received for monitored student:", studentId, riskScore);
                setRiskInfo({ score: riskScore, messages });
            }
        });

        socket.on('signal', async ({ from, signal }) => {
            console.log("Received signal from student:", from, signal.type || 'candidate');
            if (signal.type === 'answer') {
                if (peerRef.current) {
                    await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal));
                }
            } else if (signal.candidate) {
                try {
                    await peerRef.current?.addIceCandidate(new RTCIceCandidate(signal));
                } catch (e) {
                    console.error("Error adding Ice Candidate:", e);
                }
            }
        });

        return () => socket.disconnect();
    }, []);

    const startProctoring = async (student) => {
        if (peerRef.current) peerRef.current.close();
        
        setSelectedStudent(student);
        setRiskInfo({ score: student.riskScore, messages: [] });

        // Join the student's room to receive live risk-sync updates
        socketRef.current?.emit('join-exam', { 
            studentId: student.studentId, 
            examId: student.examId, 
            role: 'proctor' 
        });

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        peerRef.current = pc;

        pc.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", pc.iceConnectionState);
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                socketRef.current.emit('signal', { to: student.socketId, from: socketRef.current.id, signal: e.candidate });
            }
        };

        pc.ontrack = (e) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = e.streams[0];
            }
        };

        // Create offer with both audio and video
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        socketRef.current.emit('signal', { to: student.socketId, from: socketRef.current.id, signal: offer });
    };

    const stopProctoring = () => {
        peerRef.current?.close();
        setSelectedStudent(null);
        setRiskInfo({ score: 0, messages: [] });
    };

    const riskColor = riskInfo.score > 70 ? '#ef4444' : riskInfo.score > 30 ? '#f59e0b' : '#10b981';

    const css = `
        .alp-root { display: flex; flex-direction: column; gap: 24px; animation: alpFade 0.4s ease; }
        @keyframes alpFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .alp-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .student-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 16px; padding: 20px; transition: all 0.2s; cursor: pointer; position: relative; overflow: hidden; }
        .student-card:hover { border-color: ${t.accent}; transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .student-card.active { border-color: ${t.accent}; background: ${t.tabActiveBg}; }
        
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .live-dot { display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; animation: alppulse 2s infinite; }
        @keyframes alppulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        
        .student-name { font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 700; color: ${t.text}; }
        .student-exam { font-size: 12px; color: ${t.textMuted}; margin-top: 2px; }
        
        .risk-gauge-mini { height: 4px; width: 100%; background: ${t.border}; border-radius: 2px; margin-top: 16px; overflow: hidden; }
        .risk-fill-mini { height: 100%; transition: width 0.5s ease; }

        .proctor-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: 40px; }
        .proctor-modal { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 24px; width: 100%; max-width: 1100px; display: grid; grid-template-columns: 1fr 340px; overflow: hidden; max-height: 90vh; }
        
        .video-container { background: #000; position: relative; aspect-ratio: 16/9; }
        .video-stream { width: 100%; height: 100%; object-fit: contain; }
        .video-label { position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.5); padding: 6px 12px; border-radius: 8px; color: #fff; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; }

        .proctor-sidebar { padding: 32px; border-left: 1px solid ${t.border}; display: flex; flex-direction: column; gap: 24px; }
        .risk-main { text-align: center; }
        .risk-score-big { font-family: 'Outfit', sans-serif; font-size: 48px; font-weight: 800; line-height: 1; }
        .risk-label-big { font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${t.textSub}; margin-top: 8px; letter-spacing: 1px; }
        
        .alert-feed { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .alert-item { padding: 10px 14px; border-radius: 10px; background: ${t.surfaceAlt}; border-left: 3px solid ${t.accent}; font-size: 12.5px; color: ${t.text}; animation: alpslide 0.3s ease; }
        @keyframes alpslide { from { opacity: 0; x: 10px; } to { opacity: 1; x: 0; } }

        .close-btn { position: absolute; top: 20px; right: 20px; background: #fff; color: #000; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-weight: 900; }
    `;

    return (
        <div className="alp-root">
            <style>{css}</style>
            
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800 }}>Live Exam Monitoring</h2>
            
            {activeStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: t.textMuted }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>🍃</div>
                    <p>No ongoing exams currently.</p>
                </div>
            ) : (
                <div className="alp-list">
                    {activeStudents.map(student => (
                        <div key={student.studentId} className={`student-card ${selectedStudent?.studentId === student.studentId ? 'active' : ''}`} onClick={() => startProctoring(student)}>
                            <div className="card-header">
                                <span className="live-dot" />
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>LIVE</span>
                            </div>
                            <div className="student-name">{student.name}</div>
                            <div className="student-exam">ID: {student.studentId}</div>
                            
                            <div className="risk-gauge-mini">
                                <div className="risk-fill-mini" style={{ width: `${student.riskScore}%`, background: student.riskScore > 70 ? '#ef4444' : '#10b981' }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedStudent && (
                <div className="proctor-overlay">
                    <button className="close-btn" onClick={stopProctoring}>✕</button>
                    <div className="proctor-modal">
                        <div className="video-container">
                            <video ref={remoteVideoRef} className="video-stream" autoPlay playsInline />
                            <div className="video-label">
                                <span className="live-dot" /> LIVE STREAM: {selectedStudent.name}
                            </div>
                        </div>
                        
                        <div className="proctor-sidebar">
                            <div className="risk-main">
                                <div className="risk-score-big" style={{ color: riskColor }}>{Math.round(riskInfo.score)}%</div>
                                <div className="risk-label-big">BEHAVIOR RISK</div>
                            </div>
                            
                            <div className="alert-feed">
                                <div style={{ fontSize: '11px', fontWeight: 700, color: t.textMuted, marginBottom: '4px' }}>RECENT ALERTS</div>
                                {riskInfo.messages.slice(0, 5).map((m, i) => (
                                    <div key={i} className="alert-item">{m}</div>
                                ))}
                                {riskInfo.messages.length === 0 && <div style={{ fontSize: '12px', color: t.textMuted }}>Normal behavior detected.</div>}
                            </div>
                            
                            <button className="ad-btn ad-btn-secondary" style={{ width: '100%', marginTop: 'auto' }} onClick={stopProctoring}>Stop Monitoring</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
