import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function AudioMonitor({ onMetrics, compact = false, darkTheme = false, style }) {
    const { theme: t } = useTheme();
    const [status, setStatus] = useState('initializing');
    const [error, setError] = useState('');
    const audioCtxRef = useRef(null);
    const streamRef = useRef(null);
    const analyserRef = useRef(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        let isCancelled = false;
        
        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                if (isCancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;

                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const audioCtx = new AudioContext();
                audioCtxRef.current = audioCtx;

                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 1024;
                analyserRef.current = analyser;

                const hpFilter = audioCtx.createBiquadFilter();
                hpFilter.type = 'highpass';
                hpFilter.frequency.setValueAtTime(200, audioCtx.currentTime);

                const lpFilter = audioCtx.createBiquadFilter();
                lpFilter.type = 'lowpass';
                lpFilter.frequency.setValueAtTime(4000, audioCtx.currentTime);

                source.connect(hpFilter);
                hpFilter.connect(lpFilter);
                lpFilter.connect(analyser);

                setStatus('monitoring');

                const freqData = new Uint8Array(analyser.frequencyBinCount);
                let speechStreak = 0;
                let noiseBaseline = 40;

                intervalRef.current = setInterval(() => {
                    analyser.getByteFrequencyData(freqData);
                    
                    const binSize = audioCtx.sampleRate / analyser.fftSize;
                    const speechStartIndex = Math.floor(300 / binSize);
                    const speechEndIndex = Math.floor(3000 / binSize);
                    
                    let speechEnergy = 0;
                    let peakFreq = 0;
                    let maxVal = 0;

                    for (let i = speechStartIndex; i < speechEndIndex; i++) {
                        speechEnergy += freqData[i];
                        if (freqData[i] > maxVal) {
                            maxVal = freqData[i];
                            peakFreq = i * binSize;
                        }
                    }
                    const avgSpeechEnergy = speechEnergy / (speechEndIndex - speechStartIndex);
                    const peakRatio = maxVal / (avgSpeechEnergy || 1);

                    const isPotentiallySpeech = avgSpeechEnergy > (noiseBaseline + 15) && peakRatio > 2.2;
                    
                    if (!isPotentiallySpeech && avgSpeechEnergy > 0) {
                        noiseBaseline = (noiseBaseline * 0.95) + (avgSpeechEnergy * 0.05);
                    }

                    if (isPotentiallySpeech) {
                        speechStreak++;
                    } else {
                        speechStreak = Math.max(0, speechStreak - 1);
                    }

                    const speechDetected = speechStreak >= 4;
                    const multipleVoicesPossible = speechDetected && peakRatio > 4.5;

                    onMetrics?.({
                        speechDetected,
                        speechLevel: Math.min(100, Math.round(avgSpeechEnergy)),
                        multipleVoicesDetected: multipleVoicesPossible,
                        audioStatus: 'active'
                    });

                }, 300);

            } catch (err) {
                console.error("Audio Load Error:", err);
                if (!isCancelled) setError("Microphone access denied.");
                setStatus('error');
            }
        };

        initAudio();

        return () => {
            isCancelled = true;
            clearInterval(intervalRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
            audioCtxRef.current?.close();
        };
    }, []);

    const isDark = darkTheme || compact;
    const bg = isDark ? '#1e1e24' : (t?.surfaceAlt || '#f8fafc');
    const borderColor = isDark ? '#333340' : (t?.border || '#e2e8f0');
    const textColor = isDark ? '#e2e8f0' : (t?.text || '#0f172a');

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: compact ? 6 : 10,
            padding: compact ? '6px 10px' : '10px 16px',
            borderRadius: 8,
            background: bg,
            border: `1px solid ${borderColor}`,
            transition: 'all 0.3s',
            boxSizing: 'border-box',
            width: '100%',
            ...style
        }}>
            <div style={{ fontSize: compact ? 14 : 18 }}>{error ? '' : ''}</div>
            <div style={{ fontSize: compact ? 11 : 12.5, fontWeight: 600, color: textColor, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {error || 'Voice Monitor'}
            </div>
            <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: 4,
                background: status === 'monitoring' ? 'rgba(16,185,129,0.2)' : status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)',
                color: status === 'monitoring' ? '#10b981' : status === 'error' ? '#ef4444' : '#94a3b8'
            }}>
                {status}
            </div>
        </div>
    );
}
