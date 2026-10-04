import { worldToScreen } from './cadCoordinates';

// Helper geometry math
function distance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Line segment intersection
function lineIntersection(p1, p2, p3, p4) {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(denom) < 1e-6) return null;

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

    if (ua >= -0.01 && ua <= 1.01 && ub >= -0.01 && ub <= 1.01) {
        return {
            x: p1.x + ua * (p2.x - p1.x),
            y: p1.y + ua * (p2.y - p1.y)
        };
    }
    return null;
}

// Perpendicular foot from point P onto line segment AB
function perpendicularFoot(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return null;

    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    if (t >= 0 && t <= 1) {
        return {
            x: a.x + t * dx,
            y: a.y + t * dy
        };
    }
    return null;
}

/**
 * Extract candidate OSnap points from geometry list
 */
export function extractSnapCandidates(objects) {
    const candidates = [];
    const segments = []; // For intersection & perpendicular checks

    (objects || []).forEach(obj => {
        if (obj.type === 'LINE') {
            candidates.push({ type: 'endpoint', x: obj.start.x, y: obj.start.y, priority: 1 });
            candidates.push({ type: 'endpoint', x: obj.end.x, y: obj.end.y, priority: 1 });
            candidates.push({ type: 'midpoint', x: (obj.start.x + obj.end.x) / 2, y: (obj.start.y + obj.end.y) / 2, priority: 3 });
            segments.push({ p1: obj.start, p2: obj.end });
        } else if (obj.type === 'CIRCLE') {
            candidates.push({ type: 'center', x: obj.center.x, y: obj.center.y, priority: 4 });
            candidates.push({ type: 'endpoint', x: obj.center.x + obj.radius, y: obj.center.y, priority: 1 });
            candidates.push({ type: 'endpoint', x: obj.center.x - obj.radius, y: obj.center.y, priority: 1 });
            candidates.push({ type: 'endpoint', x: obj.center.x, y: obj.center.y + obj.radius, priority: 1 });
            candidates.push({ type: 'endpoint', x: obj.center.x, y: obj.center.y - obj.radius, priority: 1 });
        } else if (obj.type === 'RECTANGLE') {
            const c1 = { x: obj.x, y: obj.y };
            const c2 = { x: obj.x + obj.width, y: obj.y };
            const c3 = { x: obj.x + obj.width, y: obj.y + obj.height };
            const c4 = { x: obj.x, y: obj.y + obj.height };

            candidates.push({ type: 'endpoint', ...c1, priority: 1 });
            candidates.push({ type: 'endpoint', ...c2, priority: 1 });
            candidates.push({ type: 'endpoint', ...c3, priority: 1 });
            candidates.push({ type: 'endpoint', ...c4, priority: 1 });

            candidates.push({ type: 'midpoint', x: (c1.x + c2.x) / 2, y: c1.y, priority: 3 });
            candidates.push({ type: 'midpoint', x: c2.x, y: (c2.y + c3.y) / 2, priority: 3 });
            candidates.push({ type: 'midpoint', x: (c4.x + c3.x) / 2, y: c3.y, priority: 3 });
            candidates.push({ type: 'midpoint', x: c1.x, y: (c1.y + c4.y) / 2, priority: 3 });

            candidates.push({ type: 'center', x: obj.x + obj.width / 2, y: obj.y + obj.height / 2, priority: 4 });

            segments.push({ p1: c1, p2: c2 }, { p1: c2, p2: c3 }, { p1: c3, p2: c4 }, { p1: c4, p2: c1 });
        } else if (obj.type === 'POLYLINE') {
            const pts = obj.points || [];
            pts.forEach((pt, i) => {
                candidates.push({ type: 'endpoint', x: pt.x, y: pt.y, priority: 1 });
                if (i < pts.length - 1) {
                    const nextPt = pts[i + 1];
                    candidates.push({ type: 'midpoint', x: (pt.x + nextPt.x) / 2, y: (pt.y + nextPt.y) / 2, priority: 3 });
                    segments.push({ p1: pt, p2: nextPt });
                }
            });
        } else if (obj.type === 'ARC') {
            candidates.push({ type: 'center', x: obj.center.x, y: obj.center.y, priority: 4 });
            const startPt = { x: obj.center.x + obj.radius * Math.cos(obj.startAngle), y: obj.center.y + obj.radius * Math.sin(obj.startAngle) };
            const endPt = { x: obj.center.x + obj.radius * Math.cos(obj.endAngle), y: obj.center.y + obj.radius * Math.sin(obj.endAngle) };
            candidates.push({ type: 'endpoint', x: startPt.x, y: startPt.y, priority: 1 });
            candidates.push({ type: 'endpoint', x: endPt.x, y: endPt.y, priority: 1 });
        }
    });

    // Compute segment intersections
    for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
            const pt = lineIntersection(segments[i].p1, segments[i].p2, segments[j].p1, segments[j].p2);
            if (pt) {
                candidates.push({ type: 'intersection', x: pt.x, y: pt.y, priority: 2 });
            }
        }
    }

    return { candidates, segments };
}

/**
 * Calculate constrained / snapped world position using OSnap, Ortho, Angle Snap, and Grid Snap
 */
export function computeSnapAndConstraints({
    rawWorld,
    screenPt,
    viewport,
    canvasWidth,
    canvasHeight,
    objects,
    osnapEnabled = true,
    orthoEnabled = false,
    angleEnabled = false,
    angleIncrement = 45,
    snapEnabled = true,
    gridSpacing = 10,
    basePoint = null
}) {
    let resultX = rawWorld.x;
    let resultY = rawWorld.y;
    let activeSnap = null;

    // 1. Object Snap (OSnap)
    if (osnapEnabled) {
        const { candidates, segments } = extractSnapCandidates(objects);

        // Include perpendicular candidates if basePoint exists
        if (basePoint) {
            segments.forEach(seg => {
                const foot = perpendicularFoot(rawWorld, seg.p1, seg.p2);
                if (foot) {
                    candidates.push({ type: 'perpendicular', x: foot.x, y: foot.y, priority: 5 });
                }
            });
        }

        const snapThresholdPx = 14;
        let bestCandidate = null;
        let minPx = Infinity;

        for (const cand of candidates) {
            const candScreen = worldToScreen(cand.x, cand.y, viewport, canvasWidth, canvasHeight);
            const dPx = Math.hypot(screenPt.x - candScreen.x, screenPt.y - candScreen.y);

            if (dPx <= snapThresholdPx) {
                // Priority check: lower priority number means higher precedence
                if (!bestCandidate || cand.priority < bestCandidate.priority || (cand.priority === bestCandidate.priority && dPx < minPx)) {
                    bestCandidate = cand;
                    minPx = dPx;
                }
            }
        }

        if (bestCandidate) {
            activeSnap = { type: bestCandidate.type, point: { x: bestCandidate.x, y: bestCandidate.y } };
            return {
                x: Math.round(bestCandidate.x * 100) / 100,
                y: Math.round(bestCandidate.y * 100) / 100,
                activeSnap,
                isSnapped: true
            };
        }
    }

    // 2. Ortho Mode (when relative to basePoint)
    if (orthoEnabled && basePoint) {
        const dx = Math.abs(resultX - basePoint.x);
        const dy = Math.abs(resultY - basePoint.y);
        if (dx >= dy) {
            resultY = basePoint.y; // Constrain to Horizontal
        } else {
            resultX = basePoint.x; // Constrain to Vertical
        }
    }
    // 3. Angle Snap (when angleEnabled and relative to basePoint)
    else if (angleEnabled && basePoint && angleIncrement > 0) {
        const dist = distance(basePoint, { x: resultX, y: resultY });
        if (dist > 1e-4) {
            let rad = Math.atan2(resultY - basePoint.y, resultX - basePoint.x);
            let deg = rad * (180 / Math.PI);
            if (deg < 0) deg += 360;

            const snappedDeg = Math.round(deg / angleIncrement) * angleIncrement;
            const snappedRad = snappedDeg * (Math.PI / 180);

            resultX = basePoint.x + dist * Math.cos(snappedRad);
            resultY = basePoint.y + dist * Math.sin(snappedRad);
        }
    }

    // 4. Grid Snap (if enabled and no Ortho override)
    let isGridSnapped = false;
    if (snapEnabled && !orthoEnabled && !activeSnap) {
        const sp = Math.max(gridSpacing, 1);
        resultX = Math.round(resultX / sp) * sp;
        resultY = Math.round(resultY / sp) * sp;
        isGridSnapped = true;
    }

    return {
        x: Math.round(resultX * 100) / 100,
        y: Math.round(resultY * 100) / 100,
        activeSnap: isGridSnapped ? { type: 'grid', point: { x: resultX, y: resultY } } : null,
        isSnapped: isGridSnapped
    };
}
