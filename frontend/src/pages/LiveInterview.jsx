import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useTheme } from '../context/ThemeContext';
import { LogOut } from 'lucide-react';

export default function LiveInterview() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { theme: t } = useTheme();
    const [isJoined, setIsJoined] = useState(false);

    // If no room ID is provided, show an error or redirect
    if (!roomId) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, color: t.text }}>
                <h2>Invalid Interview Link</h2>
                <button onClick={() => navigate(-1)} style={{ marginLeft: '16px', padding: '8px 16px', background: t.accent, color: '#fff', borderRadius: '8px' }}>Go Back</button>
            </div>
        );
    }

    const styles = {
        container: {
            minHeight: '100vh',
            background: t.bg,
            color: t.text,
            display: 'flex',
            flexDirection: 'column',
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            background: t.surface,
            borderBottom: `1px solid ${t.border}`,
        },
        title: {
            fontSize: '18px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        },
        badge: {
            fontSize: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            padding: '4px 10px',
            borderRadius: '12px',
            fontWeight: 'bold',
            animation: 'pulse 2s infinite'
        },
        jitsiContainer: {
            flex: 1,
            width: '100%',
            height: 'calc(100vh - 70px)',
            display: 'flex',
            flexDirection: 'column'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div style={styles.title}>
                    Live Video Interview
                    <span style={styles.badge}> LIVE</span>
                </div>
                <button 
                    onClick={() => navigate('/student/dashboard')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', color: '#ef4444', border: `1px solid #ef4444`, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    <LogOut size={16} /> Leave Interview
                </button>
            </div>

            <div style={styles.jitsiContainer}>
                <JitsiMeeting
                    domain="meet.jit.si"
                    roomName={`AdaptExam-Interview-${roomId}`}
                    configOverwrite={{
                        startWithAudioMuted: false,
                        startWithVideoMuted: false,
                        disableModeratorIndicator: true,
                        enableEmailInStats: false,
                    }}
                    interfaceConfigOverwrite={{
                        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                    }}
                    userInfo={{
                        displayName: 'Participant', // This can be updated to actual user name if available in Redux
                    }}
                    onApiReady={(externalApi) => {
                        setIsJoined(true);
                        // Add any custom listeners here
                    }}
                    getIFrameRef={(node) => {
                        node.style.height = '100%';
                        node.style.flex = '1';
                    }}
                />
            </div>
            
            <style>{`
                /* Force Jitsi Meeting wrapper and iframe to fill the space */
                div[id^="jitsiMeeting"] {
                    height: calc(100vh - 70px) !important;
                    flex: 1 !important;
                    display: flex !important;
                    flex-direction: column !important;
                }
                div[id^="jitsiMeeting"] iframe {
                    height: 100% !important;
                    width: 100% !important;
                    min-height: calc(100vh - 70px) !important;
                    border: none !important;
                    flex: 1 !important;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
