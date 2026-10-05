import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

const CameraMonitor = forwardRef(({ onMetrics, reference }, ref) => {
    const { theme: t } = useTheme();
    const videoRef = useRef(null);
    const [active, setActive] = useState(false);
    const [error, setError] = useState('');
    const streamRef = useRef(null);
    const faceTimeoutRef = useRef(null);
    const objectTimeoutRef = useRef(null);
    const landmarkerRef = useRef(null);
    const objectDetectorRef = useRef(null);
    const mismatchCountRef = useRef(0);
    const metricsRef = useRef({
        eyeDeviation: 0,
        headMovement: 0,
        faceScale: 0,
        faceNotDetected: false,
        multipleFacesDetected: false,
        phoneDetected: false,
        identityMismatch: false
    });

    const latestAnomalySnapshotRef = useRef(null);
    const lastSnapshotTimeRef = useRef(0);
    const lastFaceVideoTimeRef = useRef(-1);

    // Identity Comparison Logic
    const normalizeLandmarks = (landmarks) => {
        if (!landmarks || landmarks.length < 10) return null;
        const noseTip = landmarks[1]; 
        const p1 = landmarks[33];
        const p2 = landmarks[263];
        const scale = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        if (scale === 0) return null;
        return landmarks.map(p => ({
            x: (p.x - noseTip.x) / scale,
            y: (p.y - noseTip.y) / scale,
        }));
    };

    const calculateLandmarkDistance = (l1, l2) => {
        let sum = 0;
        const len = Math.min(l1.length, l2.length);
        for (let i = 0; i < len; i++) {
            sum += Math.pow(l1[i].x - l2[i].x, 2) + Math.pow(l1[i].y - l2[i].y, 2);
        }
        return Math.sqrt(sum / len);
    };

    const captureImmediateSnapshot = (force = false) => {
        if (!videoRef.current) return;
        const now = Date.now();
        // Throttle automatic snapshots to at most once every 30 seconds unless forced
        if (!force && now - lastSnapshotTimeRef.current < 30000) {
            return;
        }
        lastSnapshotTimeRef.current = now;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            latestAnomalySnapshotRef.current = canvas.toDataURL('image/jpeg', 0.6);
        } catch (e) {
            console.error("Failed to capture immediate snapshot:", e);
        }
    };

    useImperativeHandle(ref, () => ({
        capture() {
            if (!landmarkerRef.current || !videoRef.current) return null;
            const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
            if (results.faceLandmarks && results.faceLandmarks[0]) {
                const norm = normalizeLandmarks(results.faceLandmarks[0]);
                console.log("Identity captured by CameraMonitor.");
                return norm;
            }
            return null;
        },
        takeSnapshot(force = false) {
            if (latestAnomalySnapshotRef.current) {
                const snap = latestAnomalySnapshotRef.current;
                latestAnomalySnapshotRef.current = null;
                return snap;
            }
            if (!force) return null; // Do NOT capture standard frame if no severe anomaly exists and force is false
            if (!videoRef.current) return null;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 240;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                return canvas.toDataURL('image/jpeg', 0.6); 
            } catch (e) {
                return null;
            }
        },
        getStream() {
            return streamRef.current;
        }
    }));

    useEffect(() => {
        let isCancelled = false;
        const init = async () => {
            try {
                // Initialize TensorFlow.js and set environment variables
                await tf.ready();
                if (tf.getBackend() === 'webgl') {
                    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
                    tf.env().set('WEBGL_PACK', true);
                }
                console.log("TensorFlow.js ready. Backend:", tf.getBackend());

                // Initialize MediaPipe Face Landmark
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
                );

                let landmarker;
                try {
                    landmarker = await FaceLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                            delegate: "GPU"
                        },
                        outputFaceBlendshapes: true,
                        runningMode: "VIDEO",
                        numFaces: 3,
                    });
                } catch (gpuErr) {
                    landmarker = await FaceLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                            delegate: "CPU"
                        },
                        outputFaceBlendshapes: true,
                        runningMode: "VIDEO",
                        numFaces: 3,
                    });
                }
                
                // Initialize COCO-SSD for Mobile Phone Detection safely
                let objDetector = null;
                try {
                    objDetector = await cocoSsd.load();
                } catch (objErr) {
                    console.warn("COCO-SSD object detector failed to load, face detection active:", objErr);
                }

                if (!isCancelled) {
                    landmarkerRef.current = landmarker;
                    objectDetectorRef.current = objDetector;
                    startCamera();
                }
            } catch (err) {
                console.error("Vision AI Load Error:", err);
                if (!isCancelled) setError(`Failed to load Vision AI. Please check camera permissions.`);
            }
        };
        init();
        
        return () => {
            isCancelled = true;
            stopCamera();
            if (landmarkerRef.current) landmarkerRef.current.close();
        };
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
            streamRef.current = stream;
            if (videoRef.current) { 
                videoRef.current.srcObject = stream; 
                videoRef.current.play(); 
            }
            setActive(true);
            
            // Decoupled Metrics Dispatching
            const updateMetrics = (newMetrics) => {
                metricsRef.current = { ...metricsRef.current, ...newMetrics };
                onMetrics?.({ ...metricsRef.current });
            };

            // Offscreen Canvas setup for downscaled object detection
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');

            let isCancelledLoop = false;

            // Face Landmark Loop (Lightweight, runs every 200ms)
            const runFaceDetection = () => {
                if (isCancelledLoop || !videoRef.current || !landmarkerRef.current) return;

                if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0 && videoRef.current.currentTime !== lastFaceVideoTimeRef.current) {
                    lastFaceVideoTimeRef.current = videoRef.current.currentTime;
                    try {
                        const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
                        const numFaces = results.faceLandmarks ? results.faceLandmarks.length : 0;
                        
                        const faceNotDetected = numFaces === 0;
                        const multipleFacesDetected = numFaces > 1;
                        
                        let eyeDeviation = 0;
                        let headMovement = 0;
                        let faceScale = 0;
                        let identityMismatch = false;
                        
                        if (numFaces === 1 && results.faceLandmarks && results.faceLandmarks[0]) {
                            const landmarks = results.faceLandmarks[0];
                            
                            // Identity Verification
                            if (reference) {
                                const currentNorm = normalizeLandmarks(landmarks);
                                const distance = calculateLandmarkDistance(currentNorm, reference);
                                
                                if (distance > 0.14) {
                                    mismatchCountRef.current += 1;
                                    if (mismatchCountRef.current >= 3) {
                                        identityMismatch = true;
                                    }
                                } else {
                                    mismatchCountRef.current = 0;
                                }
                            }

                            const p1 = landmarks[33];
                            const p2 = landmarks[263];
                            if (p1 && p2) {
                                faceScale = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
                            }

                            if (results.faceBlendshapes && results.faceBlendshapes[0]) {
                                const shapes = results.faceBlendshapes[0].categories;
                                const lookLeft = shapes.find(s => s.categoryName === "eyeLookOutLeft")?.score || 0;
                                const lookRight = shapes.find(s => s.categoryName === "eyeLookOutRight")?.score || 0;
                                eyeDeviation = Math.round(Math.max(lookLeft, lookRight) * 80); 
                                
                                const nose = landmarks[1];
                                if (nose) {
                                    headMovement = Math.round(Math.abs(nose.x - 0.5) * 120);
                                }
                            }
                        }

                        // Only capture visual proof snapshot for SEVERE anomalies (missing face, multiple faces, identity mismatch)
                        if (faceNotDetected || multipleFacesDetected || identityMismatch) {
                            captureImmediateSnapshot();
                        }

                        updateMetrics({
                            eyeDeviation,
                            headMovement,
                            faceScale,
                            faceNotDetected,
                            multipleFacesDetected,
                            identityMismatch
                        });

                    } catch (e) {
                        console.error("Face landmarker error:", e);
                    }
                }

                if (!isCancelledLoop) {
                    faceTimeoutRef.current = setTimeout(runFaceDetection, 200);
                }
            };

            // Object Detection Loop (Heavy, runs every 800ms, non-overlapping)
            const runObjectDetection = async () => {
                if (isCancelledLoop || !videoRef.current || !objectDetectorRef.current) return;

                if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
                    try {
                        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                        const objectPredictions = await objectDetectorRef.current.detect(canvas);
                        const phoneDetected = objectPredictions.some(pred => 
                            (pred.class === 'cell phone' || pred.class === 'mobile phone' || pred.class === 'phone' || pred.class === 'remote' || pred.class === 'book') && pred.score > 0.3
                        );
                        
                        if (phoneDetected) {
                            captureImmediateSnapshot();
                        }
                        
                        updateMetrics({ phoneDetected });
                    } catch (e) {
                        console.error("Object detector error:", e);
                    }
                }

                if (!isCancelledLoop) {
                    objectTimeoutRef.current = setTimeout(runObjectDetection, 800);
                }
            };

            // Start loops
            runFaceDetection();
            runObjectDetection();

            // Store cancellation handle
            streamRef.current.cleanupLoops = () => {
                isCancelledLoop = true;
            };

        } catch {
            setError('Camera access denied.');
            setActive(false);
        }
    };

    const stopCamera = () => {
        if (faceTimeoutRef.current) clearTimeout(faceTimeoutRef.current);
        if (objectTimeoutRef.current) clearTimeout(objectTimeoutRef.current);
        if (streamRef.current?.cleanupLoops) {
            streamRef.current.cleanupLoops();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        setActive(false);
    };

    const css = `
        .cm-box {
            position: relative; width: 100%; aspect-ratio: 4/3;
            background: ${t.surfaceAlt}; border: 1px solid ${t.border};
            border-radius: 10px; overflow: hidden;
            transition: background 0.4s, border-color 0.4s;
        }
        .cm-error {
            display: flex; align-items: center; justify-content: center;
            height: 100%; padding: 16px; text-align: center;
            font-size: 12.5px; color: #ef4444; line-height: 1.5;
        }
        .cm-overlay {
            position: absolute; bottom: 8px; left: 8px;
        }
        .cm-status {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 4px 10px; border-radius: 100px;
            background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
            font-size: 11.5px; font-weight: 600; color: #fff;
        }
        .cm-dot { width: 7px; height: 7px; border-radius: 50%; }
        .cm-dot.on { background: #10b981; box-shadow: 0 0 6px #10b981; animation: cmpulse 2s infinite; }
        .cm-dot.off { background: #ef4444; }
        @keyframes cmpulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .cm-hint { font-size: 11.5px; color: ${t.textSub}; text-align: center; margin-top: 8px; }
    `;

    return (
        <>
            <style>{css}</style>
            <div className="cm-box">
                {error
                    ? <div className="cm-error">{error}</div>
                    : <>
                        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div className="cm-overlay">
                            <div className="cm-status">
                                <span className={`cm-dot ${active ? 'on' : 'off'}`} />
                                {active ? 'Monitoring' : 'Starting…'}
                            </div>
                        </div>
                    </>
                }
            </div>
            <p className="cm-hint"> Eye & head tracking active</p>
        </>
    );
});

export default CameraMonitor;
