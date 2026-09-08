const fs = require('fs');

const filePath = 'd:/AdaptiveOnlineExam/frontend/src/pages/CodingAssessment.jsx';
let code = fs.readFileSync(filePath, 'utf8');

const targetStart = '        const detectGaze = async () => {';
const targetEnd = '        detectGaze();';

const startIdx = code.indexOf(targetStart);
const endIdx = code.indexOf(targetEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error('Target markers not found!');
  process.exit(1);
}

const cleanDetectGaze = `        const detectGaze = async () => {
          if (!isActive || !videoRef.current || !faceModelRef.current) return;
          
          if (videoRef.current && videoRef.current.readyState >= 2) {
             const faces = await faceModelRef.current.estimateFaces(videoRef.current);

             if (faces.length === 0) {
               // ── FACE NOT VISIBLE ─────────────────────────────────────
               offScreenCount++;
               if (offScreenCount > 10) {
                 setFaceAlert('no_face');
                 if (offScreenCount === 11) {
                   addEvent('face_not_detected', { count: offScreenCount });
                 }
               }
             } else if (faces.length > 1) {
               // ── MULTIPLE FACES DETECTED ───────────────────────────────
               offScreenCount = 0;
               setFaceAlert('multiple_faces');
               if (multipleFacesCooldown === 0) {
                 addEvent('multiple_faces_detected', { count: faces.length });
                 multipleFacesCooldown = 60;
               }
             } else {
               // ── SINGLE FACE — NORMAL (Instantly clears warnings) ──────
               offScreenCount = 0;
               setFaceAlert(null);

               // 📷 Capture Candidate Initial Exam Snapshot
               captureCandidateSnapshot();

               // 📐 MediaPipe 468 Landmark Geometry (Accurate 3D Angles)
               const kps = faces[0].keypoints;
               if (Array.isArray(kps) && kps.length >= 10) {
                 const videoW = videoRef.current.videoWidth  || 640;
                 const videoH = videoRef.current.videoHeight || 480;

                 // Landmark indices from MediaPipe 468 Face Mesh standard topology:
                 // 1   = Nose Tip
                 // 33  = Left Eye Outer Corner
                 // 263 = Right Eye Outer Corner
                 // 234 = Left Face Boundary (Ear / Cheek)
                 // 454 = Right Face Boundary (Ear / Cheek)
                 // 10  = Forehead Top
                 // 152 = Chin Bottom
                 const nose      = kps[1]   || kps[0];
                 const leftEye   = kps[33]  || kps[133] || kps[1];
                 const rightEye  = kps[263] || kps[362] || kps[0];
                 const leftEdge  = kps[234] || kps[127] || kps[33];
                 const rightEdge = kps[454] || kps[356] || kps[263];
                 const forehead  = kps[10]  || kps[1];
                 const chin      = kps[152] || kps[1];

                 if (nose && leftEye && rightEye && leftEdge && rightEdge) {
                   // ── 1. HEAD YAW (Left/Right Turn Degree 0°–90°) ──────
                   const faceWidth = Math.abs(rightEdge.x - leftEdge.x) || 1;
                   const faceMidlineX = (leftEdge.x + rightEdge.x) / 2;
                   const noseYawOffset = Math.abs(nose.x - faceMidlineX);
                   const yawRatio = noseYawOffset / (faceWidth / 2);
                   const headYawDeg = Math.min(90, Math.round(yawRatio * 90));

                   // ── 2. HEAD PITCH (Nodding Up/Down Degree 0°–45°) ───
                   const faceHeight = Math.abs((chin.y || 0) - (forehead.y || 0)) || 1;
                   const faceMidlineY = ((forehead.y || 0) + (chin.y || 0)) / 2;
                   const nosePitchOffset = Math.abs(nose.y - faceMidlineY);
                   const pitchRatio = nosePitchOffset / (faceHeight / 2);
                   const headPitchDeg = Math.min(45, Math.round(pitchRatio * 45));

                   const headMovementDeg = Math.max(headYawDeg, headPitchDeg);

                   // ── 3. EYE GAZE DEVIATION DEGREE (0°–90°) ─────────────
                   const eyeMidX = (leftEye.x + rightEye.x) / 2;
                   const gazeOffsetPx = Math.abs(eyeMidX - (videoW / 2));
                   const gazeRatio = gazeOffsetPx / (videoW / 2);
                   const eyeDeviationDeg = Math.min(90, Math.round(gazeRatio * 75));

                   // ── 4. FACE SCALE (Distance Proxy 0.0–1.0) ───────────
                   const faceScale = parseFloat(Math.min(1.0, faceWidth / videoW).toFixed(3));

                   // ── 5. LIVE REAL-TIME REF UPDATES ────────────────────
                   maxEyeDeviationRef.current  = Math.max(maxEyeDeviationRef.current,  eyeDeviationDeg);
                   maxHeadMovementRef.current  = Math.max(maxHeadMovementRef.current,  headMovementDeg);
                   faceScaleRef.current        = faceScale;

                   // Track frame-to-frame nose movement
                   if (lastKeypoints && nose) {
                     const dx = nose.x - (lastKeypoints.x || 0);
                     const dy = nose.y - (lastKeypoints.y || 0);
                     const delta = Math.sqrt(dx * dx + dy * dy);
                     if (delta > 8 && movementCooldown === 0) {
                       movementCooldown = 10;
                       addEvent('head_movement', { delta: Math.round(delta) });
                     }
                   }
                   lastKeypoints = { x: nose.x, y: nose.y };

                   // ── EMIT LIVE DEGREES PERIODICALLY ──────────────────────
                   if (Math.random() < 0.25) {
                     addEvent('gaze_pose_degrees', {
                       eyeDeviation:  eyeDeviationDeg,
                       headMovement:  headMovementDeg,
                       headYaw:       headYawDeg,
                       headPitch:     headPitchDeg,
                       faceScale
                     });
                   }
                 }
               }
             }
             if (movementCooldown > 0) movementCooldown--;
             if (multipleFacesCooldown > 0) multipleFacesCooldown--;
             
             if (offScreenCount > 30) {
                addEvent('off_screen_gaze', {});
                offScreenCount = 0;
             }
          }
          if (isActive) gazeLoopRef.current = requestAnimationFrame(detectGaze);
        };\n\n`;

code = code.slice(0, startIdx) + cleanDetectGaze + code.slice(endIdx);
fs.writeFileSync(filePath, code);
console.log('Successfully updated MediaPipe 468 landmark geometry in CodingAssessment.jsx');
