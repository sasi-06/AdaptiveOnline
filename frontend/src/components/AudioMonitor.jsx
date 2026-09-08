import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function AudioMonitor({ onMetrics }) {
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

                // 200Hz High-Pass Filter to remove fan hum/low noise
                const hpFilter = audioCtx.createBiquadFilter();
                hpFilter.type = 'highpass';
                hpFilter.frequency.setValueAtTime(200, audioCtx.currentTime);

                // 4000Hz Low-Pass Filter to remove high-frequency hiss
                const lpFilter = audioCtx.createBiquadFilter();
                lpFilter.type = 'lowpass';
                lpFilter.frequency.setValueAtTime(4000, audioCtx.currentTime);

                source.connect(hpFilter);
                hpFilter.connect(lpFilter);
                lpFilter.connect(analyser);

                setStatus('monitoring');

                const freqData = new Uint8Array(analyser.frequencyBinCount);
                let speechStreak = 0;
                let noiseBaseline = 40; // Initial noise floor approximation

                intervalRef.current = setInterval(() => {
                    analyser.getByteFrequencyData(freqData);
                    
                    // 1. Calculate Average Energy in Speech Range (300Hz - 3000Hz)
                    // Sample rate is typically 44.1k or 48k. 
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

                    // 2. Spectral Flatness Heuristic (Ratio of peak to average)
                    // Speech has concentrated energy (Low flatness). Fan noise is broadband (High flatness).
                    const peakRatio = maxVal / (avgSpeechEnergy || 1);

                    // 3. Classification Logic (Smart VAD)
                    // - Must be above baseline energy (Loudness check)
                    // - Must have peakRatio > 2.0 (Structural check — speech is harmonic, noise is flat)
                    // - Human speech usually has fundamental between 85-255Hz, harmonics in 300-3000Hz.
                    const isPotentiallySpeech = avgSpeechEnergy > (noiseBaseline + 15) && peakRatio > 2.2;
                    
                    // Smoothing Noise Floor (Slowly adapt to room ambiance)
                    if (!isPotentiallySpeech && avgSpeechEnergy > 0) {
                        noiseBaseline = (noiseBaseline * 0.95) + (avgSpeechEnergy * 0.05);
                    }

                    if (isPotentiallySpeech) {
                        speechStreak++;
                    } else {
                        speechStreak = Math.max(0, speechStreak - 1);
                    }

                    // Report Metrics
                    // speechDetected = confirmed speech (>1.5s sustained or high intensity spikes)
                    // isMultipleVoices = heuristics on pitch variance (Simplified)
                    const speechDetected = speechStreak >= 4; // Approx 1.2s at 300ms polling
                    const multipleVoicesPossible = speechDetected && peakRatio > 4.5; // Very distinct multiple peaks

                    onMetrics?.({
                        speechDetected,
                        speechLevel: Math.min(100, Math.round(avgSpeechEnergy)),
                        multipleVoicesDetected: multipleVoicesPossible,
                        audioStatus: 'active'
                    });

                }, 300);

            } catch (err) {
                console.error("Audio Load Error:", err);
                if (!isCancelled) setError("Microphone access denied. Voice monitoring disabled.");
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

    const css = `
        .am-box {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 16px; border-radius: 12px;
            background: ${t.surfaceAlt}; border: 1px solid ${t.border};
            margin-top: 12px; transition: all 0.3s;
        }
        .am-icon { font-size: 18px; }
        .am-text { font-size: 12.5px; font-weight: 500; color: ${t.text}; }
        .am-status { font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; }
        .am-status.monitoring { background: rgba(16,185,129,0.15); color: #10b981; }
        .am-status.error { background: rgba(239,68,68,0.15); color: #ef4444; }
        .am-status.initializing { background: rgba(0,0,0,0.1); color: ${t.textMuted}; }
    `;

    return (
        <>
            <style>{css}</style>
            <div className="am-box">
                <div className="am-icon">{error ? '🔇' : '🎙️'}</div>
                <div className="am-text">{error || 'Voice Detection Module'}</div>
                <div className={`am-status ${status}`}>{status}</div>
            </div>
        </>
    );
}
