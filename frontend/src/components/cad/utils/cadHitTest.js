// CAD Geometry Hit Testing, Distance, Reflection, Offset, Bounding Box Containment & Crossing Utilities

export function distToSegment(p, a, b) {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
}

export function distToCircle(p, center, radius) {
    const d = Math.hypot(p.x - center.x, p.y - center.y);
    return Math.abs(d - radius);
}

export function distToRect(p, rect) {
    const { x, y, width: w, height: h } = rect;
    const p1 = { x, y };
    const p2 = { x: x + w, y };
    const p3 = { x: x + w, y: y + h };
    const p4 = { x, y: y + h };
    const d1 = distToSegment(p, p1, p2);
    const d2 = distToSegment(p, p2, p3);
    const d3 = distToSegment(p, p3, p4);
    const d4 = distToSegment(p, p4, p1);
    const edgeDist = Math.min(d1, d2, d3, d4);
    const isInside = p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    return isInside ? 0 : edgeDist;
}

export function distToPolyline(p, points = []) {
    if (points.length < 2) return Infinity;
    let minDist = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
        const d = distToSegment(p, points[i], points[i + 1]);
        if (d < minDist) minDist = d;
    }
    return minDist;
}

export function distToArc(p, arc) {
    const { center, radius, startAngle, endAngle } = arc;
    const dCenter = Math.hypot(p.x - center.x, p.y - center.y);
    const dCircle = Math.abs(dCenter - radius);

    let pAngle = Math.atan2(p.y - center.y, p.x - center.x);
    const norm = (a) => (a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    pAngle = norm(pAngle);
    const sAngle = norm(startAngle);
    const eAngle = norm(endAngle);

    let inSpan = false;
    if (sAngle <= eAngle) {
        inSpan = pAngle >= sAngle && pAngle <= eAngle;
    } else {
        inSpan = pAngle >= sAngle || pAngle <= eAngle;
    }

    if (inSpan) return dCircle;

    const pStart = { x: center.x + radius * Math.cos(startAngle), y: center.y + radius * Math.sin(startAngle) };
    const pEnd = { x: center.x + radius * Math.cos(endAngle), y: center.y + radius * Math.sin(endAngle) };
    return Math.min(Math.hypot(p.x - pStart.x, p.y - pStart.y), Math.hypot(p.x - pEnd.x, p.y - pEnd.y));
}

// Single Click Hit Test
export function hitTestObject(obj, targetWorld, toleranceWorld) {
    let d = Infinity;
    if (obj.type === 'LINE') {
        d = distToSegment(targetWorld, obj.start, obj.end);
    } else if (obj.type === 'CIRCLE') {
        d = distToCircle(targetWorld, obj.center, obj.radius);
    } else if (obj.type === 'RECTANGLE') {
        d = distToRect(targetWorld, obj);
    } else if (obj.type === 'POLYLINE') {
        d = distToPolyline(targetWorld, obj.points);
    } else if (obj.type === 'ARC') {
        d = distToArc(targetWorld, obj);
    } else if (obj.type === 'LINEAR_DIMENSION' || obj.type === 'ALIGNED_DIMENSION') {
        const { start, end, offset = 0, isVertical } = obj;
        if (!start || !end) return { hit: false, distance: Infinity };
        let dimS, dimE;
        if (obj.type === 'LINEAR_DIMENSION' && isVertical) {
            dimS = { x: start.x + offset, y: start.y };
            dimE = { x: end.x + offset, y: end.y };
        } else if (obj.type === 'LINEAR_DIMENSION' && !isVertical) {
            dimS = { x: start.x, y: start.y + offset };
            dimE = { x: end.x, y: end.y + offset };
        } else {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const L = Math.hypot(dx, dy) || 1;
            const nx = -dy / L;
            const ny = dx / L;
            dimS = { x: start.x + offset * nx, y: start.y + offset * ny };
            dimE = { x: end.x + offset * nx, y: end.y + offset * ny };
        }
        d = distToSegment(targetWorld, dimS, dimE);
    } else if (obj.type === 'ANGULAR_DIMENSION') {
        if (!obj.center) return { hit: false, distance: Infinity };
        d = distToArc(targetWorld, { center: obj.center, radius: obj.radius || 40, startAngle: obj.startAngle || 0, endAngle: obj.endAngle || Math.PI / 2 });
    } else if (obj.type === 'RADIUS_DIMENSION' || obj.type === 'DIAMETER_DIMENSION') {
        if (!obj.center) return { hit: false, distance: Infinity };
        const ang = obj.angle || 0;
        const r = obj.radius || 30;
        const textPt = { x: obj.center.x + r * Math.cos(ang), y: obj.center.y + r * Math.sin(ang) };
        d = distToSegment(targetWorld, obj.center, textPt);
    } else if (obj.type === 'TEXT') {
        const pos = obj.position || { x: 0, y: 0 };
        const h = obj.height || 25;
        const txt = obj.text || '';
        const w = Math.max(txt.length * h * 0.6, h);
        const rotRad = (obj.rotation || 0) * (Math.PI / 180);

        const dx = targetWorld.x - pos.x;
        const dy = targetWorld.y - pos.y;

        const localX = dx * Math.cos(-rotRad) - dy * Math.sin(-rotRad);
        const localY = dx * Math.sin(-rotRad) + dy * Math.cos(-rotRad);

        const rectLocal = { x: 0, y: -h * 0.2, width: w, height: h * 1.2 };
        d = distToRect({ x: localX, y: localY }, rectLocal);
    } else if (obj.type === 'HATCH') {
        const pts = obj.boundary || [];
        if (pts.length < 3) return { hit: false, distance: Infinity };
        if (isPointInPolygon(targetWorld, pts)) {
            return { hit: true, distance: 0 };
        }
        let minDist = Infinity;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            const segDist = distToSegment(targetWorld, p1, p2);
            if (segDist < minDist) minDist = segDist;
        }
        d = minDist;
    }
    return { hit: d <= toleranceWorld, distance: d };
}

// ── POINT & GEOMETRY REFLECTION MATHEMATICS ────────────────────────────
export function reflectPoint(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L2 = dx * dx + dy * dy;
    if (L2 === 0) return { x: p.x, y: p.y };

    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;

    return {
        x: Math.round((2 * projX - p.x) * 100) / 100,
        y: Math.round((2 * projY - p.y) * 100) / 100
    };
}

export function mirrorObject(obj, p1, p2) {
    const newId = obj.type.toLowerCase() + '_mirror_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    if (obj.type === 'LINE') {
        return {
            ...obj,
            id: newId,
            start: reflectPoint(obj.start, p1, p2),
            end: reflectPoint(obj.end, p1, p2)
        };
    } else if (obj.type === 'CIRCLE') {
        return {
            ...obj,
            id: newId,
            center: reflectPoint(obj.center, p1, p2)
        };
    } else if (obj.type === 'RECTANGLE') {
        const c1 = reflectPoint({ x: obj.x, y: obj.y }, p1, p2);
        const c2 = reflectPoint({ x: obj.x + obj.width, y: obj.y }, p1, p2);
        const c3 = reflectPoint({ x: obj.x + obj.width, y: obj.y + obj.height }, p1, p2);
        const c4 = reflectPoint({ x: obj.x, y: obj.y + obj.height }, p1, p2);

        const isAxisAligned = Math.abs(p1.x - p2.x) < 1e-4 || Math.abs(p1.y - p2.y) < 1e-4;
        if (isAxisAligned) {
            const minX = Math.min(c1.x, c2.x, c3.x, c4.x);
            const minY = Math.min(c1.y, c2.y, c3.y, c4.y);
            return {
                ...obj,
                id: newId,
                x: minX,
                y: minY,
                width: obj.width,
                height: obj.height
            };
        } else {
            return {
                id: newId,
                type: 'POLYLINE',
                points: [c1, c2, c3, c4, c1],
                color: obj.color || '#38bdf8'
            };
        }
    } else if (obj.type === 'POLYLINE') {
        return {
            ...obj,
            id: newId,
            points: (obj.points || []).map(pt => reflectPoint(pt, p1, p2))
        };
    } else if (obj.type === 'ARC') {
        const pStart = { x: obj.center.x + obj.radius * Math.cos(obj.startAngle), y: obj.center.y + obj.radius * Math.sin(obj.startAngle) };
        const pEnd = { x: obj.center.x + obj.radius * Math.cos(obj.endAngle), y: obj.center.y + obj.radius * Math.sin(obj.endAngle) };
        const rCenter = reflectPoint(obj.center, p1, p2);
        const rStart = reflectPoint(pStart, p1, p2);
        const rEnd = reflectPoint(pEnd, p1, p2);

        const a1Prime = Math.atan2(rStart.y - rCenter.y, rStart.x - rCenter.x);
        const a2Prime = Math.atan2(rEnd.y - rCenter.y, rEnd.x - rCenter.x);

        return {
            ...obj,
            id: newId,
            center: rCenter,
            startAngle: a2Prime,
            endAngle: a1Prime
        };
    } else if (obj.type === 'TEXT') {
        return {
            ...obj,
            id: newId,
            position: reflectPoint(obj.position, p1, p2)
        };
    } else if (obj.type === 'HATCH') {
        return {
            ...obj,
            id: newId,
            boundary: (obj.boundary || []).map(pt => reflectPoint(pt, p1, p2))
        };
    }
    return { ...obj, id: newId };
}

// ── OFFSET MATHEMATICS ──────────────────────────────────────────────────
function lineIntersection(p1, p2, p3, p4) {
    const d12x = p2.x - p1.x;
    const d12y = p2.y - p1.y;
    const d34x = p4.x - p3.x;
    const d34y = p4.y - p3.y;

    const denom = d12x * d34y - d12y * d34x;
    if (Math.abs(denom) < 1e-6) {
        return { x: p2.x, y: p2.y };
    }

    const t1 = ((p3.x - p1.x) * d34y - (p3.y - p1.y) * d34x) / denom;
    return {
        x: Math.round((p1.x + t1 * d12x) * 100) / 100,
        y: Math.round((p1.y + t1 * d12y) * 100) / 100
    };
}

export function offsetObject(obj, dist, cursorWorld) {
    if (dist <= 0) return { error: "Offset distance must be greater than zero." };
    const newId = obj.type.toLowerCase() + '_offset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    if (obj.type === 'LINE') {
        const dx = obj.end.x - obj.start.x;
        const dy = obj.end.y - obj.start.y;
        const L = Math.hypot(dx, dy);
        if (L === 0) return { error: "Invalid line length." };

        const nx = -dy / L;
        const ny = dx / L;

        // Determine side using cross product with cursor
        const cross = (obj.end.x - obj.start.x) * (cursorWorld.y - obj.start.y) - (obj.end.y - obj.start.y) * (cursorWorld.x - obj.start.x);
        const side = cross >= 0 ? 1 : -1;

        const offX = side * dist * nx;
        const offY = side * dist * ny;

        return {
            result: {
                ...obj,
                id: newId,
                start: { x: Math.round((obj.start.x + offX) * 100) / 100, y: Math.round((obj.start.y + offY) * 100) / 100 },
                end: { x: Math.round((obj.end.x + offX) * 100) / 100, y: Math.round((obj.end.y + offY) * 100) / 100 }
            }
        };
    } else if (obj.type === 'CIRCLE') {
        const dCursor = Math.hypot(cursorWorld.x - obj.center.x, cursorWorld.y - obj.center.y);
        const isOutward = dCursor >= obj.radius;
        const newRadius = isOutward ? obj.radius + dist : obj.radius - dist;

        if (newRadius <= 0) {
            return { error: "Offset distance is too large for inward offset." };
        }

        return {
            result: {
                ...obj,
                id: newId,
                radius: Math.round(newRadius * 100) / 100
            }
        };
    } else if (obj.type === 'RECTANGLE') {
        const isInside = cursorWorld.x >= obj.x && cursorWorld.x <= obj.x + obj.width &&
                         cursorWorld.y >= obj.y && cursorWorld.y <= obj.y + obj.height;

        let newX, newY, newW, newH;
        if (isInside) {
            newX = obj.x + dist;
            newY = obj.y + dist;
            newW = obj.width - 2 * dist;
            newH = obj.height - 2 * dist;
        } else {
            newX = obj.x - dist;
            newY = obj.y - dist;
            newW = obj.width + 2 * dist;
            newH = obj.height + 2 * dist;
        }

        if (newW <= 0 || newH <= 0) {
            return { error: "Offset distance is too large for inward rectangle offset." };
        }

        return {
            result: {
                ...obj,
                id: newId,
                x: Math.round(newX * 100) / 100,
                y: Math.round(newY * 100) / 100,
                width: Math.round(newW * 100) / 100,
                height: Math.round(newH * 100) / 100
            }
        };
    } else if (obj.type === 'POLYLINE') {
        const pts = obj.points || [];
        if (pts.length < 2) return { error: "Invalid polyline." };

        const p1 = pts[0];
        const p2 = pts[1];
        const cross = (p2.x - p1.x) * (cursorWorld.y - p1.y) - (p2.y - p1.y) * (cursorWorld.x - p1.x);
        const side = cross >= 0 ? 1 : -1;

        const offsetSegments = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const segStart = pts[i];
            const segEnd = pts[i + 1];
            const dx = segEnd.x - segStart.x;
            const dy = segEnd.y - segStart.y;
            const L = Math.hypot(dx, dy);
            if (L === 0) continue;
            const nx = -dy / L;
            const ny = dx / L;

            const offX = side * dist * nx;
            const offY = side * dist * ny;

            offsetSegments.push({
                start: { x: segStart.x + offX, y: segStart.y + offY },
                end: { x: segEnd.x + offX, y: segEnd.y + offY }
            });
        }

        if (offsetSegments.length === 0) return { error: "Polyline offset failed." };

        const newPts = [offsetSegments[0].start];
        for (let i = 0; i < offsetSegments.length - 1; i++) {
            const segA = offsetSegments[i];
            const segB = offsetSegments[i + 1];
            const inter = lineIntersection(segA.start, segA.end, segB.start, segB.end);
            
            const dOrig = pts[i + 1];
            const miterDist = Math.hypot(inter.x - dOrig.x, inter.y - dOrig.y);
            if (miterDist > dist * 5) {
                newPts.push(segA.end);
                newPts.push(segB.start);
            } else {
                newPts.push(inter);
            }
        }
        newPts.push(offsetSegments[offsetSegments.length - 1].end);

        return {
            result: {
                ...obj,
                id: newId,
                points: newPts
            }
        };
    } else if (obj.type === 'ARC') {
        const dCursor = Math.hypot(cursorWorld.x - obj.center.x, cursorWorld.y - obj.center.y);
        const isOutward = dCursor >= obj.radius;
        const newRadius = isOutward ? obj.radius + dist : obj.radius - dist;

        if (newRadius <= 0) {
            return { error: "Offset distance is too large for inward arc offset." };
        }

        return {
            result: {
                ...obj,
                id: newId,
                radius: Math.round(newRadius * 100) / 100
            }
        };
    }

    return { error: "Unsupported geometry type for offset." };
}

// Segment-Segment Intersection helper
function segmentsIntersect(p1, p2, p3, p4) {
    const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

function pointInBox(p, box) {
    return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
}

function segmentIntersectsBox(p1, p2, box) {
    if (pointInBox(p1, box) || pointInBox(p2, box)) return true;
    const b1 = { x: box.minX, y: box.minY };
    const b2 = { x: box.maxX, y: box.minY };
    const b3 = { x: box.maxX, y: box.maxY };
    const b4 = { x: box.minX, y: box.maxY };

    return segmentsIntersect(p1, p2, b1, b2) ||
           segmentsIntersect(p1, p2, b2, b3) ||
           segmentsIntersect(p1, p2, b3, b4) ||
           segmentsIntersect(p1, p2, b4, b1);
}

// Window Selection: Object must be 100% fully contained within box
export function isObjectInsideBox(obj, box) {
    if (obj.type === 'LINE') {
        return pointInBox(obj.start, box) && pointInBox(obj.end, box);
    } else if (obj.type === 'CIRCLE') {
        return obj.center.x - obj.radius >= box.minX &&
               obj.center.x + obj.radius <= box.maxX &&
               obj.center.y - obj.radius >= box.minY &&
               obj.center.y + obj.radius <= box.maxY;
    } else if (obj.type === 'RECTANGLE') {
        return obj.x >= box.minX &&
               obj.x + obj.width <= box.maxX &&
               obj.y >= box.minY &&
               obj.y + obj.height <= box.maxY;
    } else if (obj.type === 'POLYLINE') {
        const pts = obj.points || [];
        return pts.length > 0 && pts.every(p => pointInBox(p, box));
    } else if (obj.type === 'ARC') {
        const pStart = { x: obj.center.x + obj.radius * Math.cos(obj.startAngle), y: obj.center.y + obj.radius * Math.sin(obj.startAngle) };
        const pEnd = { x: obj.center.x + obj.radius * Math.cos(obj.endAngle), y: obj.center.y + obj.radius * Math.sin(obj.endAngle) };
        return pointInBox(obj.center, box) && pointInBox(pStart, box) && pointInBox(pEnd, box);
    } else if (obj.type === 'TEXT') {
        return pointInBox(obj.position, box);
    } else if (obj.type === 'HATCH') {
        const pts = obj.boundary || [];
        return pts.length > 0 && pts.every(p => pointInBox(p, box));
    }
    return false;
}

// Crossing Selection: Object is fully contained OR intersects the box
export function isObjectCrossingBox(obj, box) {
    if (isObjectInsideBox(obj, box)) return true;

    if (obj.type === 'LINE') {
        return segmentIntersectsBox(obj.start, obj.end, box);
    } else if (obj.type === 'CIRCLE') {
        const dCenter = distToRect(obj.center, { x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY });
        return dCenter <= obj.radius || pointInBox(obj.center, box);
    } else if (obj.type === 'RECTANGLE') {
        const { x, y, width: w, height: h } = obj;
        const p1 = { x, y };
        const p2 = { x: x + w, y };
        const p3 = { x: x + w, y: y + h };
        const p4 = { x, y: y + h };
        return segmentIntersectsBox(p1, p2, box) ||
               segmentIntersectsBox(p2, p3, box) ||
               segmentIntersectsBox(p3, p4, box) ||
               segmentIntersectsBox(p4, p1, box) ||
               pointInBox({ x: x + w / 2, y: y + h / 2 }, box);
    } else if (obj.type === 'POLYLINE') {
        const pts = obj.points || [];
        for (let i = 0; i < pts.length - 1; i++) {
            if (segmentIntersectsBox(pts[i], pts[i + 1], box)) return true;
        }
        return false;
    } else if (obj.type === 'ARC') {
        return pointInBox(obj.center, box);
    } else if (obj.type === 'HATCH') {
        const pts = obj.boundary || [];
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            if (segmentIntersectsBox(p1, p2, box)) return true;
        }
        return false;
    }
    return false;
}

// ── GEOMETRY INTERSECTION ENGINE & TRIM UTILITIES ──────────────────────

function normAngle(a) {
    return (a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
}

function isAngleOnArcSpan(ang, startAngle, endAngle) {
    const a = normAngle(ang);
    const s = normAngle(startAngle);
    const e = normAngle(endAngle);
    if (Math.abs(s - e) < 1e-6) return true;
    if (s <= e) {
        return a >= s - 1e-4 && a <= e + 1e-4;
    } else {
        return a >= s - 1e-4 || a <= e + 1e-4;
    }
}

function getLineLineIntersection(s1, e1, s2, e2) {
    const d12x = e1.x - s1.x;
    const d12y = e1.y - s1.y;
    const d34x = e2.x - s2.x;
    const d34y = e2.y - s2.y;

    const denom = d12x * d34y - d12y * d34x;
    if (Math.abs(denom) < 1e-7) return [];

    const t = ((s2.x - s1.x) * d34y - (s2.y - s1.y) * d34x) / denom;
    const u = ((s2.x - s1.x) * d12y - (s2.y - s1.y) * d12x) / denom;

    if (t >= -1e-5 && t <= 1 + 1e-5 && u >= -1e-5 && u <= 1 + 1e-5) {
        const clampT = Math.max(0, Math.min(1, t));
        return [{
            x: Math.round((s1.x + clampT * d12x) * 100) / 100,
            y: Math.round((s1.y + clampT * d12y) * 100) / 100,
            tTarget: clampT
        }];
    }
    return [];
}

function getLineCircleIntersections(s, e, center, radius) {
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const fx = s.x - center.x;
    const fy = s.y - center.y;

    const a = dx * dx + dy * dy;
    if (a < 1e-8) return [];
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;

    const disc = b * b - 4 * a * c;
    if (disc < -1e-5) return [];

    const pts = [];
    const sqrtDisc = Math.sqrt(Math.max(0, disc));
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    [t1, t2].forEach(t => {
        if (t >= -1e-5 && t <= 1 + 1e-5) {
            const clampT = Math.max(0, Math.min(1, t));
            pts.push({
                x: Math.round((s.x + clampT * dx) * 100) / 100,
                y: Math.round((s.y + clampT * dy) * 100) / 100,
                tTarget: clampT
            });
        }
    });
    return pts;
}

function getCircleCircleIntersections(c1, r1, c2, r2) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);

    if (d > r1 + r2 + 1e-4 || d < Math.abs(r1 - r2) - 1e-4 || d < 1e-6) return [];

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const hSq = r1 * r1 - a * a;
    const h = Math.sqrt(Math.max(0, hSq));

    const x2 = c1.x + (a * dx) / d;
    const y2 = c1.y + (a * dy) / d;

    const rx = -dy * (h / d);
    const ry = dx * (h / d);

    return [
        { x: Math.round((x2 + rx) * 100) / 100, y: Math.round((y2 + ry) * 100) / 100 },
        { x: Math.round((x2 - rx) * 100) / 100, y: Math.round((y2 - ry) * 100) / 100 }
    ];
}

// Convert object to line segments for generic intersection testing
function getObjectSegments(obj) {
    if (obj.type === 'LINE') {
        return [{ start: obj.start, end: obj.end }];
    } else if (obj.type === 'RECTANGLE') {
        const x = obj.x;
        const y = obj.y;
        const w = obj.width;
        const h = obj.height;
        return [
            { start: { x: x, y: y }, end: { x: x + w, y: y } },
            { start: { x: x + w, y: y }, end: { x: x + w, y: y + h } },
            { start: { x: x + w, y: y + h }, end: { x: x, y: y + h } },
            { start: { x: x, y: y + h }, end: { x: x, y: y } }
        ];
    } else if (obj.type === 'POLYLINE') {
        const pts = obj.points || [];
        const segs = [];
        for (let i = 0; i < pts.length - 1; i++) {
            segs.push({ start: pts[i], end: pts[i + 1] });
        }
        return segs;
    }
    return [];
}

// Generic intersection finder between two objects
export function getIntersections(objA, objB) {
    const results = [];

    const segsA = getObjectSegments(objA);
    const segsB = getObjectSegments(objB);

    if (segsA.length > 0 && segsB.length > 0) {
        for (const sA of segsA) {
            for (const sB of segsB) {
                const hits = getLineLineIntersection(sA.start, sA.end, sB.start, sB.end);
                results.push(...hits);
            }
        }
    } else if (segsA.length > 0 && (objB.type === 'CIRCLE' || objB.type === 'ARC')) {
        for (const sA of segsA) {
            const hits = getLineCircleIntersections(sA.start, sA.end, objB.center, objB.radius);
            if (objB.type === 'ARC') {
                results.push(...hits.filter(p => isAngleOnArcSpan(Math.atan2(p.y - objB.center.y, p.x - objB.center.x), objB.startAngle, objB.endAngle)));
            } else {
                results.push(...hits);
            }
        }
    } else if ((objA.type === 'CIRCLE' || objA.type === 'ARC') && segsB.length > 0) {
        for (const sB of segsB) {
            const hits = getLineCircleIntersections(sB.start, sB.end, objA.center, objA.radius);
            if (objA.type === 'ARC') {
                results.push(...hits.filter(p => isAngleOnArcSpan(Math.atan2(p.y - objA.center.y, p.x - objA.center.x), objA.startAngle, objA.endAngle)));
            } else {
                results.push(...hits);
            }
        }
    } else if ((objA.type === 'CIRCLE' || objA.type === 'ARC') && (objB.type === 'CIRCLE' || objB.type === 'ARC')) {
        const hits = getCircleCircleIntersections(objA.center, objA.radius, objB.center, objB.radius);
        const filtered = hits.filter(p => {
            const aOnA = objA.type === 'ARC' ? isAngleOnArcSpan(Math.atan2(p.y - objA.center.y, p.x - objA.center.x), objA.startAngle, objA.endAngle) : true;
            const aOnB = objB.type === 'ARC' ? isAngleOnArcSpan(Math.atan2(p.y - objB.center.y, p.x - objB.center.x), objB.startAngle, objB.endAngle) : true;
            return aOnA && aOnB;
        });
        results.push(...filtered);
    }

    // Deduplicate points within 1e-3
    const unique = [];
    results.forEach(pt => {
        if (!unique.some(u => Math.hypot(u.x - pt.x, u.y - pt.y) < 1e-3)) {
            unique.push(pt);
        }
    });

    return unique;
}

// ── TRIM CALCULATION ENGINE ──────────────────────────────────────────────
export function trimObject(targetObj, clickWorld, cuttingObjects = []) {
    let intersections = [];
    cuttingObjects.forEach(cutter => {
        if (cutter.id !== targetObj.id) {
            const hits = getIntersections(targetObj, cutter);
            intersections.push(...hits);
        }
    });

    const uniqueHits = [];
    intersections.forEach(pt => {
        if (!uniqueHits.some(u => Math.hypot(u.x - pt.x, u.y - pt.y) < 1e-3)) {
            uniqueHits.push(pt);
        }
    });

    if (uniqueHits.length === 0) {
        return { error: "No cutting intersection found for this object." };
    }

    const genId = (prefix) => `${prefix}_trim_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // ── LINE TRIM ─────────────────────────────────────────────────────────
    if (targetObj.type === 'LINE') {
        const dx = targetObj.end.x - targetObj.start.x;
        const dy = targetObj.end.y - targetObj.start.y;
        const L2 = dx * dx + dy * dy;
        if (L2 === 0) return { error: "Invalid line." };

        const getT = (p) => ((p.x - targetObj.start.x) * dx + (p.y - targetObj.start.y) * dy) / L2;

        const tValues = uniqueHits
            .map(p => getT(p))
            .filter(t => t > 1e-4 && t < 1 - 1e-4);

        if (tValues.length === 0) return { error: "No interior cutting intersection found." };

        const sortedT = Array.from(new Set([0, ...tValues, 1])).sort((a, b) => a - b);
        const clickT = Math.max(0, Math.min(1, getT(clickWorld)));

        let intervalIdx = -1;
        for (let i = 0; i < sortedT.length - 1; i++) {
            if (clickT >= sortedT[i] && clickT <= sortedT[i + 1]) {
                intervalIdx = i;
                break;
            }
        }
        if (intervalIdx === -1) return { error: "Could not identify trim segment." };

        const remStartT = sortedT[intervalIdx];
        const remEndT = sortedT[intervalIdx + 1];

        const pRemStart = {
            x: Math.round((targetObj.start.x + remStartT * dx) * 100) / 100,
            y: Math.round((targetObj.start.y + remStartT * dy) * 100) / 100
        };
        const pRemEnd = {
            x: Math.round((targetObj.start.x + remEndT * dx) * 100) / 100,
            y: Math.round((targetObj.start.y + remEndT * dy) * 100) / 100
        };

        const resultObjects = [];
        if (remStartT > 1e-4) {
            resultObjects.push({
                ...targetObj,
                id: targetObj.id,
                start: { ...targetObj.start },
                end: pRemStart
            });
        }
        if (remEndT < 1 - 1e-4) {
            resultObjects.push({
                ...targetObj,
                id: resultObjects.length === 0 ? targetObj.id : genId('line'),
                start: pRemEnd,
                end: { ...targetObj.end }
            });
        }

        return {
            resultObjects,
            removedSegment: { type: 'LINE', start: pRemStart, end: pRemEnd }
        };
    }

    // ── CIRCLE TRIM ───────────────────────────────────────────────────────
    if (targetObj.type === 'CIRCLE') {
        const { center, radius } = targetObj;
        const angles = uniqueHits
            .map(p => normAngle(Math.atan2(p.y - center.y, p.x - center.x)))
            .sort((a, b) => a - b);

        if (angles.length < 2) {
            return { error: "Circle requires at least two cutting intersections to trim." };
        }

        const clickAngle = normAngle(Math.atan2(clickWorld.y - center.y, clickWorld.x - center.x));

        let trimIdx = -1;
        for (let i = 0; i < angles.length; i++) {
            const a1 = angles[i];
            const a2 = i === angles.length - 1 ? angles[0] + 2 * Math.PI : angles[i + 1];
            const clickCheck = clickAngle < angles[0] && i === angles.length - 1 ? clickAngle + 2 * Math.PI : clickAngle;
            if (clickCheck >= a1 && clickCheck <= a2) {
                trimIdx = i;
                break;
            }
        }

        if (trimIdx === -1) trimIdx = 0;

        const aStartRemove = angles[trimIdx];
        const aEndRemove = trimIdx === angles.length - 1 ? angles[0] : angles[trimIdx + 1];

        const newArc = {
            id: targetObj.id,
            type: 'ARC',
            center: { ...center },
            radius,
            startAngle: aEndRemove,
            endAngle: aStartRemove,
            color: targetObj.color || '#38bdf8'
        };

        return {
            resultObjects: [newArc],
            removedSegment: {
                type: 'ARC',
                center: { ...center },
                radius,
                startAngle: aStartRemove,
                endAngle: aEndRemove
            }
        };
    }

    // ── ARC TRIM ──────────────────────────────────────────────────────────
    if (targetObj.type === 'ARC') {
        const { center, radius, startAngle, endAngle } = targetObj;
        const sNorm = normAngle(startAngle);
        const eNorm = normAngle(endAngle);
        const sweep = eNorm >= sNorm ? eNorm - sNorm : 2 * Math.PI - sNorm + eNorm;

        const uValues = uniqueHits
            .map(p => {
                const a = normAngle(Math.atan2(p.y - center.y, p.x - center.x));
                const rel = eNorm >= sNorm ? a - sNorm : (a >= sNorm ? a - sNorm : 2 * Math.PI - sNorm + a);
                return rel / sweep;
            })
            .filter(u => u > 1e-4 && u < 1 - 1e-4)
            .sort((a, b) => a - b);

        if (uValues.length === 0) return { error: "No interior cutting intersection found." };

        const sortedU = Array.from(new Set([0, ...uValues, 1])).sort((a, b) => a - b);
        const clickA = normAngle(Math.atan2(clickWorld.y - center.y, clickWorld.x - center.x));
        const clickRel = eNorm >= sNorm ? clickA - sNorm : (clickA >= sNorm ? clickA - sNorm : 2 * Math.PI - sNorm + clickA);
        const clickU = Math.max(0, Math.min(1, clickRel / sweep));

        let idx = -1;
        for (let i = 0; i < sortedU.length - 1; i++) {
            if (clickU >= sortedU[i] && clickU <= sortedU[i + 1]) {
                idx = i;
                break;
            }
        }
        if (idx === -1) return { error: "Could not identify trim segment." };

        const uStart = sortedU[idx];
        const uEnd = sortedU[idx + 1];

        const aRemStart = startAngle + uStart * sweep;
        const aRemEnd = startAngle + uEnd * sweep;

        const resultObjects = [];
        if (uStart > 1e-4) {
            resultObjects.push({
                ...targetObj,
                id: targetObj.id,
                startAngle,
                endAngle: aRemStart
            });
        }
        if (uEnd < 1 - 1e-4) {
            resultObjects.push({
                ...targetObj,
                id: resultObjects.length === 0 ? targetObj.id : genId('arc'),
                startAngle: aRemEnd,
                endAngle
            });
        }

        return {
            resultObjects,
            removedSegment: {
                type: 'ARC',
                center: { ...center },
                radius,
                startAngle: aRemStart,
                endAngle: aRemEnd
            }
        };
    }

    // ── RECTANGLE TRIM (Converts to Polyline/Lines) ─────────────────────────
    if (targetObj.type === 'RECTANGLE') {
        const { x, y, width: w, height: h } = targetObj;
        const polyObj = {
            id: targetObj.id,
            type: 'POLYLINE',
            points: [
                { x: x, y: y },
                { x: x + w, y: y },
                { x: x + w, y: y + h },
                { x: x, y: y + h },
                { x: x, y: y }
            ],
            color: targetObj.color || '#38bdf8'
        };
        return trimObject(polyObj, clickWorld, cuttingObjects);
    }

    // ── POLYLINE TRIM ─────────────────────────────────────────────────────
    if (targetObj.type === 'POLYLINE') {
        const pts = targetObj.points || [];
        if (pts.length < 2) return { error: "Invalid polyline." };

        const segHits = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const segStart = pts[i];
            const segEnd = pts[i + 1];
            const segLine = { type: 'LINE', start: segStart, end: segEnd };

            cuttingObjects.forEach(cutter => {
                if (cutter.id !== targetObj.id) {
                    const hits = getIntersections(segLine, cutter);
                    hits.forEach(pt => {
                        const dx = segEnd.x - segStart.x;
                        const dy = segEnd.y - segStart.y;
                        const L2 = dx * dx + dy * dy;
                        if (L2 > 0) {
                            const t = ((pt.x - segStart.x) * dx + (pt.y - segStart.y) * dy) / L2;
                            if (t > 1e-4 && t < 1 - 1e-4) {
                                segHits.push({ segIdx: i, t, pt, param: i + t });
                            }
                        }
                    });
                }
            });
        }

        if (segHits.length === 0) return { error: "No interior polyline cutting intersections found." };

        segHits.sort((a, b) => a.param - b.param);
        const params = Array.from(new Set([0, ...segHits.map(s => s.param), pts.length - 1])).sort((a, b) => a - b);

        let clickSegIdx = 0;
        let minD = Infinity;
        let clickT = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const dx = pts[i + 1].x - pts[i].x;
            const dy = pts[i + 1].y - pts[i].y;
            const L2 = dx * dx + dy * dy;
            if (L2 > 0) {
                const t = Math.max(0, Math.min(1, ((clickWorld.x - pts[i].x) * dx + (clickWorld.y - pts[i].y) * dy) / L2));
                const proj = { x: pts[i].x + t * dx, y: pts[i].y + t * dy };
                const d = Math.hypot(clickWorld.x - proj.x, clickWorld.y - proj.y);
                if (d < minD) {
                    minD = d;
                    clickSegIdx = i;
                    clickT = t;
                }
            }
        }

        const clickParam = clickSegIdx + clickT;

        let intervalIdx = -1;
        for (let i = 0; i < params.length - 1; i++) {
            if (clickParam >= params[i] && clickParam <= params[i + 1]) {
                intervalIdx = i;
                break;
            }
        }

        if (intervalIdx === -1) return { error: "Could not identify trim segment." };

        const pStartParam = params[intervalIdx];
        const pEndParam = params[intervalIdx + 1];

        const getPtAtParam = (pVal) => {
            const segIdx = Math.min(pts.length - 2, Math.floor(pVal));
            const t = pVal - segIdx;
            return {
                x: Math.round((pts[segIdx].x + t * (pts[segIdx + 1].x - pts[segIdx].x)) * 100) / 100,
                y: Math.round((pts[segIdx].y + t * (pts[segIdx + 1].y - pts[segIdx].y)) * 100) / 100
            };
        };

        const remStartPt = getPtAtParam(pStartParam);
        const remEndPt = getPtAtParam(pEndParam);

        const resultObjects = [];

        if (pStartParam > 1e-4) {
            const leftPts = [];
            const endSeg = Math.floor(pStartParam);
            for (let i = 0; i <= endSeg; i++) {
                leftPts.push(pts[i]);
            }
            if (Math.hypot(leftPts[leftPts.length - 1].x - remStartPt.x, leftPts[leftPts.length - 1].y - remStartPt.y) > 1e-3) {
                leftPts.push(remStartPt);
            }
            if (leftPts.length >= 2) {
                resultObjects.push({
                    ...targetObj,
                    id: targetObj.id,
                    points: leftPts
                });
            }
        }

        if (pEndParam < pts.length - 1 - 1e-4) {
            const rightPts = [];
            const startSeg = Math.ceil(pEndParam);
            rightPts.push(remEndPt);
            for (let i = startSeg; i < pts.length; i++) {
                rightPts.push(pts[i]);
            }
            if (rightPts.length >= 2) {
                resultObjects.push({
                    ...targetObj,
                    id: resultObjects.length === 0 ? targetObj.id : genId('poly'),
                    points: rightPts
                });
            }
        }

        return {
            resultObjects,
            removedSegment: { type: 'LINE', start: remStartPt, end: remEndPt }
        };
    }

    return { error: "Unsupported geometry type for trim." };
}

// ── EXTEND CALCULATION ENGINE ────────────────────────────────────────────

// Ray intersection solver for infinite ray starting at origin O in direction dir
function getRayIntersections(origin, dir, boundaryObj) {
    const hits = [];
    const FAR_DIST = 100000; // 100 meters extension range
    const rayEnd = { x: origin.x + dir.x * FAR_DIST, y: origin.y + dir.y * FAR_DIST };
    const raySeg = { type: 'LINE', start: origin, end: rayEnd };

    const rawHits = getIntersections(raySeg, boundaryObj);
    rawHits.forEach(pt => {
        const t = (pt.x - origin.x) * dir.x + (pt.y - origin.y) * dir.y;
        if (t > 1e-3) {
            hits.push({ ...pt, dist: t });
        }
    });

    hits.sort((a, b) => a.dist - b.dist);
    return hits;
}

export function extendObject(targetObj, clickWorld, boundaryObjects = []) {
    // Unsupported full closed shapes
    if (targetObj.type === 'CIRCLE') {
        return { error: "Circle has no extendable endpoint." };
    }
    if (targetObj.type === 'RECTANGLE') {
        return { error: "Rectangle has no extendable endpoint." };
    }

    const availableBoundaries = boundaryObjects.filter(b => b.id !== targetObj.id);
    if (availableBoundaries.length === 0) {
        return { error: "No boundary objects selected or available." };
    }

    // ── LINE EXTEND ───────────────────────────────────────────────────────
    if (targetObj.type === 'LINE') {
        const { start, end } = targetObj;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const L = Math.hypot(dx, dy);
        if (L === 0) return { error: "Invalid line." };

        const unitD = { x: dx / L, y: dy / L };

        // Determine which endpoint user clicked closer to
        const tClick = ((clickWorld.x - start.x) * dx + (clickWorld.y - start.y) * dy) / (L * L);
        const isNearEnd = tClick >= 0.5;

        const origin = isNearEnd ? end : start;
        const rayDir = isNearEnd ? unitD : { x: -unitD.x, y: -unitD.y };

        let candidateHits = [];
        availableBoundaries.forEach(b => {
            const hits = getRayIntersections(origin, rayDir, b);
            candidateHits.push(...hits);
        });

        candidateHits.sort((a, b) => a.dist - b.dist);

        if (candidateHits.length === 0) {
            return { error: "No boundary found in extension direction." };
        }

        const nearest = candidateHits[0];
        const newPt = { x: nearest.x, y: nearest.y };

        const updatedObj = {
            ...targetObj,
            id: targetObj.id,
            start: isNearEnd ? { ...start } : newPt,
            end: isNearEnd ? newPt : { ...end }
        };

        return {
            result: updatedObj,
            extendedSegment: {
                type: 'LINE',
                start: isNearEnd ? { ...end } : { ...start },
                end: newPt
            }
        };
    }

    // ── ARC EXTEND ────────────────────────────────────────────────────────
    if (targetObj.type === 'ARC') {
        const { center, radius, startAngle, endAngle } = targetObj;
        const sNorm = normAngle(startAngle);
        const eNorm = normAngle(endAngle);
        const sweep = eNorm >= sNorm ? eNorm - sNorm : 2 * Math.PI - sNorm + eNorm;

        const clickA = normAngle(Math.atan2(clickWorld.y - center.y, clickWorld.x - center.x));
        const clickRel = eNorm >= sNorm ? clickA - sNorm : (clickA >= sNorm ? clickA - sNorm : 2 * Math.PI - sNorm + clickA);
        const uClick = clickRel / sweep;

        const isNearEnd = uClick >= 0.5;

        // Find boundary intersections with full circle
        const circleObj = { type: 'CIRCLE', center, radius };
        let candidateHits = [];
        availableBoundaries.forEach(b => {
            const hits = getIntersections(circleObj, b);
            candidateHits.push(...hits);
        });

        if (candidateHits.length === 0) {
            return { error: "No boundary found in arc extension direction." };
        }

        let validHits = [];
        candidateHits.forEach(pt => {
            const a = normAngle(Math.atan2(pt.y - center.y, pt.x - center.x));
            if (isNearEnd) {
                const delta = eNorm <= a ? a - eNorm : 2 * Math.PI - eNorm + a;
                if (delta > 1e-4 && delta < 2 * Math.PI - 1e-4) {
                    validHits.push({ pt, delta, newAngle: startAngle + sweep + delta });
                }
            } else {
                const delta = sNorm >= a ? sNorm - a : 2 * Math.PI - a + sNorm;
                if (delta > 1e-4 && delta < 2 * Math.PI - 1e-4) {
                    validHits.push({ pt, delta, newAngle: startAngle - delta });
                }
            }
        });

        validHits.sort((a, b) => a.delta - b.delta);

        if (validHits.length === 0) {
            return { error: "No boundary found in arc extension direction." };
        }

        const nearest = validHits[0];
        const updatedObj = {
            ...targetObj,
            id: targetObj.id,
            startAngle: isNearEnd ? startAngle : nearest.newAngle,
            endAngle: isNearEnd ? nearest.newAngle : endAngle
        };

        return {
            result: updatedObj,
            extendedSegment: {
                type: 'ARC',
                center: { ...center },
                radius,
                startAngle: isNearEnd ? endAngle : nearest.newAngle,
                endAngle: isNearEnd ? nearest.newAngle : startAngle
            }
        };
    }

    // ── POLYLINE EXTEND ───────────────────────────────────────────────────
    if (targetObj.type === 'POLYLINE') {
        const pts = targetObj.points || [];
        if (pts.length < 2) return { error: "Invalid polyline." };

        const firstPt = pts[0];
        const lastPt = pts[pts.length - 1];

        const dFirst = Math.hypot(clickWorld.x - firstPt.x, clickWorld.y - firstPt.y);
        const dLast = Math.hypot(clickWorld.x - lastPt.x, clickWorld.y - lastPt.y);

        let minDistToSeg = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = distToSegment(clickWorld, pts[i], pts[i + 1]);
            if (d < minDistToSeg) minDistToSeg = d;
        }

        if (dFirst > 40 && dLast > 40) {
            return { error: "Select a polyline endpoint to extend." };
        }

        const isNearEnd = dLast <= dFirst;

        let origin, rayDir;
        if (isNearEnd) {
            origin = lastPt;
            const prevPt = pts[pts.length - 2];
            const dx = lastPt.x - prevPt.x;
            const dy = lastPt.y - prevPt.y;
            const L = Math.hypot(dx, dy);
            if (L === 0) return { error: "Invalid polyline end segment." };
            rayDir = { x: dx / L, y: dy / L };
        } else {
            origin = firstPt;
            const nextPt = pts[1];
            const dx = firstPt.x - nextPt.x;
            const dy = firstPt.y - nextPt.y;
            const L = Math.hypot(dx, dy);
            if (L === 0) return { error: "Invalid polyline start segment." };
            rayDir = { x: dx / L, y: dy / L };
        }

        let candidateHits = [];
        availableBoundaries.forEach(b => {
            const hits = getRayIntersections(origin, rayDir, b);
            candidateHits.push(...hits);
        });

        candidateHits.sort((a, b) => a.dist - b.dist);

        if (candidateHits.length === 0) {
            return { error: "No boundary found in polyline extension direction." };
        }

        const nearest = candidateHits[0];
        const newPt = { x: nearest.x, y: nearest.y };

        const newPts = [...pts];
        if (isNearEnd) {
            newPts[newPts.length - 1] = newPt;
        } else {
            newPts[0] = newPt;
        }

        return {
            result: {
                ...targetObj,
                id: targetObj.id,
                points: newPts
            },
            extendedSegment: {
                type: 'LINE',
                start: { ...origin },
                end: newPt
            }
        };
    }

    return { error: "Unsupported geometry type for extend." };
}

// ── FILLET CALCULATION ENGINE ───────────────────────────────────────────

export function filletObjects(obj1, click1, obj2, click2, R) {
    if (R <= 0 || isNaN(R)) {
        return { error: "Fillet radius must be greater than zero." };
    }

    if (obj1.type === 'CIRCLE' || obj2.type === 'CIRCLE') {
        return { error: "Fillet between full circles is not supported." };
    }

    // Helper to get line segment representation
    const getLines = (obj) => {
        if (obj.type === 'LINE') {
            return [{ objId: obj.id, start: obj.start, end: obj.end, originalObj: obj }];
        } else if (obj.type === 'RECTANGLE') {
            const x = obj.x;
            const y = obj.y;
            const w = obj.width;
            const h = obj.height;
            return [
                { objId: obj.id, start: { x: x, y: y }, end: { x: x + w, y: y }, originalObj: obj, segIndex: 0 },
                { objId: obj.id, start: { x: x + w, y: y }, end: { x: x + w, y: y + h }, originalObj: obj, segIndex: 1 },
                { objId: obj.id, start: { x: x + w, y: y + h }, end: { x: x, y: y + h }, originalObj: obj, segIndex: 2 },
                { objId: obj.id, start: { x: x, y: y + h }, end: { x: x, y: y }, originalObj: obj, segIndex: 3 }
            ];
        } else if (obj.type === 'POLYLINE') {
            const pts = obj.points || [];
            const segs = [];
            for (let i = 0; i < pts.length - 1; i++) {
                segs.push({ objId: obj.id, start: pts[i], end: pts[i + 1], originalObj: obj, segIndex: i });
            }
            return segs;
        }
        return [];
    };

    const lines1 = getLines(obj1);
    const lines2 = getLines(obj2);

    if (lines1.length === 0 || lines2.length === 0) {
        return { error: "Unsupported geometry type for fillet." };
    }

    // Find closest segment in obj1 to click1 and obj2 to click2
    const getClosestSeg = (segs, clickP) => {
        let minD = Infinity;
        let bestSeg = segs[0];
        segs.forEach(s => {
            const d = distToSegment(clickP, s.start, s.end);
            if (d < minD) {
                minD = d;
                bestSeg = s;
            }
        });
        return bestSeg;
    };

    const seg1 = getClosestSeg(lines1, click1);
    const seg2 = getClosestSeg(lines2, click2);

    if (seg1.objId === seg2.objId && seg1.segIndex === seg2.segIndex) {
        return { error: "Select two different intersecting lines or segments." };
    }

    // ── LINE ↔ LINE FILLET MATH ───────────────────────────────────────────
    const A1 = seg1.start;
    const B1 = seg1.end;
    const A2 = seg2.start;
    const B2 = seg2.end;

    const v1 = { x: B1.x - A1.x, y: B1.y - A1.y };
    const v2 = { x: B2.x - A2.x, y: B2.y - A2.y };
    const L1 = Math.hypot(v1.x, v1.y);
    const L2 = Math.hypot(v2.x, v2.y);
    if (L1 === 0 || L2 === 0) return { error: "Invalid line segment." };

    const denom = v1.x * v2.y - v1.y * v2.x;
    if (Math.abs(denom) < 1e-6) {
        return { error: "Parallel lines cannot be filleted." };
    }

    // Solve infinite line intersection Pint
    const tInt1 = ((A2.x - A1.x) * v2.y - (A2.y - A1.y) * v2.x) / denom;
    const Pint = {
        x: A1.x + tInt1 * v1.x,
        y: A1.y + tInt1 * v1.y
    };

    // Branch vectors pointing from Pint towards click1 and click2
    const w1 = { x: click1.x - Pint.x, y: click1.y - Pint.y };
    const dot1 = w1.x * v1.x + w1.y * v1.y;
    const u1 = dot1 >= 0
        ? { x: v1.x / L1, y: v1.y / L1 }
        : { x: -v1.x / L1, y: -v1.y / L1 };

    const w2 = { x: click2.x - Pint.x, y: click2.y - Pint.y };
    const dot2 = w2.x * v2.x + w2.y * v2.y;
    const u2 = dot2 >= 0
        ? { x: v2.x / L2, y: v2.y / L2 }
        : { x: -v2.x / L2, y: -v2.y / L2 };

    const cosTheta = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
    const theta = Math.acos(cosTheta);
    if (theta < 1e-4 || theta > Math.PI - 1e-4) {
        return { error: "Invalid corner angle for fillet." };
    }

    const halfAlpha = theta / 2;
    const tDist = R / Math.tan(halfAlpha);

    // Tangent points T1 and T2
    const T1 = {
        x: Math.round((Pint.x + tDist * u1.x) * 100) / 100,
        y: Math.round((Pint.y + tDist * u1.y) * 100) / 100
    };
    const T2 = {
        x: Math.round((Pint.x + tDist * u2.x) * 100) / 100,
        y: Math.round((Pint.y + tDist * u2.y) * 100) / 100
    };

    // Fillet center point
    const bisectUnnorm = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bisectL = Math.hypot(bisectUnnorm.x, bisectUnnorm.y);
    if (bisectL < 1e-6) return { error: "Invalid bisector calculation." };

    const bisectDir = { x: bisectUnnorm.x / bisectL, y: bisectUnnorm.y / bisectL };
    const centerDist = R / Math.sin(halfAlpha);

    const Cfillet = {
        x: Math.round((Pint.x + centerDist * bisectDir.x) * 100) / 100,
        y: Math.round((Pint.y + centerDist * bisectDir.y) * 100) / 100
    };

    // Angles from Cfillet to T1 and T2
    const aT1 = normAngle(Math.atan2(T1.y - Cfillet.y, T1.x - Cfillet.x));
    const aT2 = normAngle(Math.atan2(T2.y - Cfillet.y, T2.x - Cfillet.x));

    const cross = u1.x * u2.y - u1.y * u2.x;
    let arcStart, arcEnd;
    if (cross > 0) {
        arcStart = aT1;
        arcEnd = aT2;
    } else {
        arcStart = aT2;
        arcEnd = aT1;
    }

    // Verify distance check against segment length bounds
    const seg1DistFromPint1 = Math.hypot(A1.x - Pint.x, A1.y - Pint.y);
    const seg1DistFromPint2 = Math.hypot(B1.x - Pint.x, B1.y - Pint.y);
    const seg1Max = Math.max(seg1DistFromPint1, seg1DistFromPint2);

    const seg2DistFromPint1 = Math.hypot(A2.x - Pint.x, A2.y - Pint.y);
    const seg2DistFromPint2 = Math.hypot(B2.x - Pint.x, B2.y - Pint.y);
    const seg2Max = Math.max(seg2DistFromPint1, seg2DistFromPint2);

    if (tDist > seg1Max + 20 || tDist > seg2Max + 20) {
        return { error: "Fillet radius too large for selected segments." };
    }

    // ── BUILD TRIMMED RESULT GEOMETRY ─────────────────────────────────────
    const genId = (prefix) => `${prefix}_fillet_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Trim line 1: find far endpoint of line 1
    const dA1 = Math.hypot(A1.x - T1.x, A1.y - T1.y);
    const dB1 = Math.hypot(B1.x - T1.x, B1.y - T1.y);
    const farPt1 = dA1 > dB1 ? A1 : B1;

    // Trim line 2: find far endpoint of line 2
    const dA2 = Math.hypot(A2.x - T2.x, A2.y - T2.y);
    const dB2 = Math.hypot(B2.x - T2.x, B2.y - T2.y);
    const farPt2 = dA2 > dB2 ? A2 : B2;

    const filletArc = {
        id: genId('arc'),
        type: 'ARC',
        center: Cfillet,
        radius: R,
        startAngle: arcStart,
        endAngle: arcEnd,
        color: seg1.originalObj.color || '#38bdf8'
    };

    // If filleting two independent LINE objects
    if (seg1.originalObj.type === 'LINE' && seg2.originalObj.type === 'LINE') {
        const trimmedLine1 = {
            ...seg1.originalObj,
            id: seg1.originalObj.id,
            start: { ...farPt1 },
            end: { ...T1 }
        };

        const trimmedLine2 = {
            ...seg2.originalObj,
            id: seg2.originalObj.id,
            start: { ...farPt2 },
            end: { ...T2 }
        };

        return {
            resultObjects: [trimmedLine1, trimmedLine2, filletArc],
            previewArc: filletArc,
            previewTrimmed: [
                { type: 'LINE', start: farPt1, end: T1 },
                { type: 'LINE', start: farPt2, end: T2 }
            ]
        };
    }

    // If filleting RECTANGLE or POLYLINE
    if (seg1.originalObj.id === seg2.originalObj.id && seg1.originalObj.type === 'RECTANGLE') {
        const { x, y, width: w, height: h } = seg1.originalObj;
        const trimmedPoly = {
            id: seg1.originalObj.id,
            type: 'POLYLINE',
            points: [farPt1, T1, T2, farPt2],
            color: seg1.originalObj.color || '#38bdf8'
        };

        return {
            resultObjects: [trimmedPoly, filletArc],
            previewArc: filletArc,
            previewTrimmed: [{ type: 'LINE', start: farPt1, end: T1 }, { type: 'LINE', start: farPt2, end: T2 }]
        };
    }

    const trimmedLine1 = {
        ...seg1.originalObj,
        id: seg1.originalObj.id,
        type: 'LINE',
        start: { ...farPt1 },
        end: { ...T1 }
    };

    const trimmedLine2 = {
        ...seg2.originalObj,
        id: seg2.originalObj.id,
        type: 'LINE',
        start: { ...farPt2 },
        end: { ...T2 }
    };

    return {
        resultObjects: [trimmedLine1, trimmedLine2, filletArc],
        previewArc: filletArc,
        previewTrimmed: [
            { type: 'LINE', start: farPt1, end: T1 },
            { type: 'LINE', start: farPt2, end: T2 }
        ]
    };
}

// ── CHAMFER CALCULATION ENGINE ──────────────────────────────────────────

export function chamferObjects(obj1, click1, obj2, click2, d1, d2) {
    if (d1 <= 0 || d2 <= 0 || isNaN(d1) || isNaN(d2)) {
        return { error: "Chamfer distances must be greater than zero." };
    }

    if (obj1.type === 'CIRCLE' || obj2.type === 'CIRCLE') {
        return { error: "Chamfer between full circles is not supported." };
    }

    // Helper to get line segment representation
    const getLines = (obj) => {
        if (obj.type === 'LINE') {
            return [{ objId: obj.id, start: obj.start, end: obj.end, originalObj: obj }];
        } else if (obj.type === 'RECTANGLE') {
            const x = obj.x;
            const y = obj.y;
            const w = obj.width;
            const h = obj.height;
            return [
                { objId: obj.id, start: { x: x, y: y }, end: { x: x + w, y: y }, originalObj: obj, segIndex: 0 },
                { objId: obj.id, start: { x: x + w, y: y }, end: { x: x + w, y: y + h }, originalObj: obj, segIndex: 1 },
                { objId: obj.id, start: { x: x + w, y: y + h }, end: { x: x, y: y + h }, originalObj: obj, segIndex: 2 },
                { objId: obj.id, start: { x: x, y: y + h }, end: { x: x, y: y }, originalObj: obj, segIndex: 3 }
            ];
        } else if (obj.type === 'POLYLINE') {
            const pts = obj.points || [];
            const segs = [];
            for (let i = 0; i < pts.length - 1; i++) {
                segs.push({ objId: obj.id, start: pts[i], end: pts[i + 1], originalObj: obj, segIndex: i });
            }
            return segs;
        }
        return [];
    };

    const lines1 = getLines(obj1);
    const lines2 = getLines(obj2);

    if (lines1.length === 0 || lines2.length === 0) {
        return { error: "Unsupported geometry type for chamfer." };
    }

    // Find closest segment in obj1 to click1 and obj2 to click2
    const getClosestSeg = (segs, clickP) => {
        let minD = Infinity;
        let bestSeg = segs[0];
        segs.forEach(s => {
            const d = distToSegment(clickP, s.start, s.end);
            if (d < minD) {
                minD = d;
                bestSeg = s;
            }
        });
        return bestSeg;
    };

    const seg1 = getClosestSeg(lines1, click1);
    const seg2 = getClosestSeg(lines2, click2);

    if (seg1.objId === seg2.objId && seg1.segIndex === seg2.segIndex) {
        return { error: "Select two different intersecting lines or segments." };
    }

    // ── LINE ↔ LINE CHAMFER MATH ──────────────────────────────────────────
    const A1 = seg1.start;
    const B1 = seg1.end;
    const A2 = seg2.start;
    const B2 = seg2.end;

    const v1 = { x: B1.x - A1.x, y: B1.y - A1.y };
    const v2 = { x: B2.x - A2.x, y: B2.y - A2.y };
    const L1 = Math.hypot(v1.x, v1.y);
    const L2 = Math.hypot(v2.x, v2.y);
    if (L1 === 0 || L2 === 0) return { error: "Invalid line segment." };

    const denom = v1.x * v2.y - v1.y * v2.x;
    if (Math.abs(denom) < 1e-6) {
        return { error: "Cannot chamfer parallel lines." };
    }

    // Solve infinite line intersection Pint
    const tInt1 = ((A2.x - A1.x) * v2.y - (A2.y - A1.y) * v2.x) / denom;
    const Pint = {
        x: A1.x + tInt1 * v1.x,
        y: A1.y + tInt1 * v1.y
    };

    // Branch vectors pointing from Pint towards click1 and click2
    const w1 = { x: click1.x - Pint.x, y: click1.y - Pint.y };
    const dot1 = w1.x * v1.x + w1.y * v1.y;
    const u1 = dot1 >= 0
        ? { x: v1.x / L1, y: v1.y / L1 }
        : { x: -v1.x / L1, y: -v1.y / L1 };

    const w2 = { x: click2.x - Pint.x, y: click2.y - Pint.y };
    const dot2 = w2.x * v2.x + w2.y * v2.y;
    const u2 = dot2 >= 0
        ? { x: v2.x / L2, y: v2.y / L2 }
        : { x: -v2.x / L2, y: -v2.y / L2 };

    // Chamfer cut points C1 and C2
    const C1 = {
        x: Math.round((Pint.x + d1 * u1.x) * 100) / 100,
        y: Math.round((Pint.y + d1 * u1.y) * 100) / 100
    };
    const C2 = {
        x: Math.round((Pint.x + d2 * u2.x) * 100) / 100,
        y: Math.round((Pint.y + d2 * u2.y) * 100) / 100
    };

    // Verify distance check against segment length bounds
    const seg1DistFromPint1 = Math.hypot(A1.x - Pint.x, A1.y - Pint.y);
    const seg1DistFromPint2 = Math.hypot(B1.x - Pint.x, B1.y - Pint.y);
    const seg1Max = Math.max(seg1DistFromPint1, seg1DistFromPint2);

    const seg2DistFromPint1 = Math.hypot(A2.x - Pint.x, A2.y - Pint.y);
    const seg2DistFromPint2 = Math.hypot(B2.x - Pint.x, B2.y - Pint.y);
    const seg2Max = Math.max(seg2DistFromPint1, seg2DistFromPint2);

    if (d1 > seg1Max + 20 || d2 > seg2Max + 20) {
        return { error: "Chamfer distance exceeds available geometry." };
    }

    // ── BUILD TRIMMED RESULT GEOMETRY ─────────────────────────────────────
    const genId = (prefix) => `${prefix}_chamfer_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Trim line 1: find far endpoint of line 1
    const dA1 = Math.hypot(A1.x - C1.x, A1.y - C1.y);
    const dB1 = Math.hypot(B1.x - C1.x, B1.y - C1.y);
    const farPt1 = dA1 > dB1 ? A1 : B1;

    // Trim line 2: find far endpoint of line 2
    const dA2 = Math.hypot(A2.x - C2.x, A2.y - C2.y);
    const dB2 = Math.hypot(B2.x - C2.x, B2.y - C2.y);
    const farPt2 = dA2 > dB2 ? A2 : B2;

    const chamferLine = {
        id: genId('line'),
        type: 'LINE',
        start: { ...C1 },
        end: { ...C2 },
        color: seg1.originalObj.color || '#38bdf8'
    };

    // If chamfering two independent LINE objects
    if (seg1.originalObj.type === 'LINE' && seg2.originalObj.type === 'LINE') {
        const trimmedLine1 = {
            ...seg1.originalObj,
            id: seg1.originalObj.id,
            start: { ...farPt1 },
            end: { ...C1 }
        };

        const trimmedLine2 = {
            ...seg2.originalObj,
            id: seg2.originalObj.id,
            start: { ...farPt2 },
            end: { ...C2 }
        };

        return {
            resultObjects: [trimmedLine1, trimmedLine2, chamferLine],
            previewLine: chamferLine,
            previewTrimmed: [
                { type: 'LINE', start: farPt1, end: C1 },
                { type: 'LINE', start: farPt2, end: C2 }
            ]
        };
    }

    // If chamfering RECTANGLE or POLYLINE
    if (seg1.originalObj.id === seg2.originalObj.id && seg1.originalObj.type === 'RECTANGLE') {
        const trimmedPoly = {
            id: seg1.originalObj.id,
            type: 'POLYLINE',
            points: [farPt1, C1, C2, farPt2],
            color: seg1.originalObj.color || '#38bdf8'
        };

        return {
            resultObjects: [trimmedPoly, chamferLine],
            previewLine: chamferLine,
            previewTrimmed: [{ type: 'LINE', start: farPt1, end: C1 }, { type: 'LINE', start: farPt2, end: C2 }]
        };
    }

    const trimmedLine1 = {
        ...seg1.originalObj,
        id: seg1.originalObj.id,
        type: 'LINE',
        start: { ...farPt1 },
        end: { ...C1 }
    };

    const trimmedLine2 = {
        ...seg2.originalObj,
        id: seg2.originalObj.id,
        type: 'LINE',
        start: { ...farPt2 },
        end: { ...C2 }
    };

    return {
        resultObjects: [trimmedLine1, trimmedLine2, chamferLine],
        previewLine: chamferLine,
        previewTrimmed: [
            { type: 'LINE', start: farPt1, end: C1 },
            { type: 'LINE', start: farPt2, end: C2 }
        ]
    };
}

// ── CLOSED REGION DETECTION & HATCH BOUNDARY FINDER ──────────────────────

export function isPointInPolygon(p, polygon) {
    if (!polygon || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) &&
            (p.x < (xj - xi) * (p.y - yi) / (yj - yi + 1e-12) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function detectClosedRegion(clickPt, objects = []) {
    const visibleObjects = (objects || []).filter(o => o.type !== 'HATCH' && o.type !== 'TEXT' && !o.type?.includes('DIMENSION'));

    // 1. Check RECTANGLE objects
    for (const obj of visibleObjects) {
        if (obj.type === 'RECTANGLE') {
            const poly = [
                { x: obj.x, y: obj.y },
                { x: obj.x + obj.width, y: obj.y },
                { x: obj.x + obj.width, y: obj.y + obj.height },
                { x: obj.x, y: obj.y + obj.height }
            ];
            if (isPointInPolygon(clickPt, poly)) {
                return { valid: true, boundary: poly, source: obj };
            }
        }
    }

    // 2. Check closed POLYLINE objects
    for (const obj of visibleObjects) {
        if (obj.type === 'POLYLINE') {
            const pts = obj.points || [];
            if (pts.length >= 3) {
                const isClosed = obj.closed || Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.5;
                if (isClosed && isPointInPolygon(clickPt, pts)) {
                    const cleanPts = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.5
                        ? pts.slice(0, -1)
                        : pts;
                    return { valid: true, boundary: cleanPts, source: obj };
                }
            }
        }
    }

    // 3. Planar face traversal for closed LINE loops
    const lineSegments = [];
    visibleObjects.forEach(obj => {
        if (obj.type === 'LINE') {
            lineSegments.push({ p1: obj.start, p2: obj.end });
        } else if (obj.type === 'POLYLINE') {
            const pts = obj.points || [];
            for (let i = 0; i < pts.length - 1; i++) {
                lineSegments.push({ p1: pts[i], p2: pts[i + 1] });
            }
        } else if (obj.type === 'RECTANGLE') {
            const c1 = { x: obj.x, y: obj.y };
            const c2 = { x: obj.x + obj.width, y: obj.y };
            const c3 = { x: obj.x + obj.width, y: obj.y + obj.height };
            const c4 = { x: obj.x, y: obj.y + obj.height };
            lineSegments.push({ p1: c1, p2: c2 }, { p1: c2, p2: c3 }, { p1: c3, p2: c4 }, { p1: c4, p2: c1 });
        }
    });

    if (lineSegments.length < 3) {
        return { valid: false, error: 'Boundary is not closed.' };
    }

    // Build vertices map by merging endpoints within 0.5mm
    const vertices = [];
    const getVertexId = (pt) => {
        for (let i = 0; i < vertices.length; i++) {
            if (Math.hypot(vertices[i].x - pt.x, vertices[i].y - pt.y) < 0.5) {
                return i;
            }
        }
        vertices.push({ x: pt.x, y: pt.y });
        return vertices.length - 1;
    };

    const halfEdges = [];
    lineSegments.forEach(seg => {
        const u = getVertexId(seg.p1);
        const v = getVertexId(seg.p2);
        if (u === v) return;

        const angUV = Math.atan2(vertices[v].y - vertices[u].y, vertices[v].x - vertices[u].x);
        const angVU = Math.atan2(vertices[u].y - vertices[v].y, vertices[u].x - vertices[v].x);

        halfEdges.push({ from: u, to: v, angle: angUV });
        halfEdges.push({ from: v, to: u, angle: angVU });
    });

    const outgoingMap = new Map();
    halfEdges.forEach(e => {
        if (!outgoingMap.has(e.from)) outgoingMap.set(e.from, []);
        outgoingMap.get(e.from).push(e);
    });

    outgoingMap.forEach((edges) => {
        edges.sort((a, b) => a.angle - b.angle);
    });

    const visited = new Set();
    const candidatePolygons = [];

    halfEdges.forEach(startEdge => {
        const edgeKey = `${startEdge.from}->${startEdge.to}`;
        if (visited.has(edgeKey)) return;

        const path = [startEdge.from, startEdge.to];
        let curr = startEdge;
        let closed = false;

        for (let step = 0; step < 50; step++) {
            const key = `${curr.from}->${curr.to}`;
            visited.add(key);

            const v = curr.to;
            const outgoing = outgoingMap.get(v) || [];
            if (outgoing.length === 0) break;

            const revAngle = Math.atan2(vertices[curr.from].y - vertices[v].y, vertices[curr.from].x - vertices[v].x);

            let nextEdge = null;
            let minDiff = Infinity;

            for (const outE of outgoing) {
                let diff = outE.angle - revAngle;
                while (diff <= 1e-6) diff += 2 * Math.PI;
                if (diff < minDiff) {
                    minDiff = diff;
                    nextEdge = outE;
                }
            }

            if (!nextEdge) break;

            if (nextEdge.to === startEdge.from) {
                path.push(nextEdge.to);
                closed = true;
                break;
            }

            if (path.includes(nextEdge.to)) break;

            path.push(nextEdge.to);
            curr = nextEdge;
        }

        if (closed && path.length >= 4) {
            const poly = path.slice(0, -1).map(vId => vertices[vId]);
            let area = 0;
            for (let i = 0; i < poly.length; i++) {
                const p1 = poly[i];
                const p2 = poly[(i + 1) % poly.length];
                area += (p1.x * p2.y - p2.x * p1.y);
            }
            area = area / 2;

            if (area > 0 && isPointInPolygon(clickPt, poly)) {
                candidatePolygons.push({ boundary: poly, area });
            }
        }
    });

    if (candidatePolygons.length > 0) {
        candidatePolygons.sort((a, b) => a.area - b.area);
        return { valid: true, boundary: candidatePolygons[0].boundary };
    }

    return { valid: false, error: 'Boundary is not closed.' };
}

// ── MEASUREMENT MATHEMATICS & FORMATTING UTILITIES ──────────────────────

export function calculatePolygonAreaAndPerimeter(polygon) {
    if (!polygon || polygon.length < 3) return { area: 0, perimeter: 0 };
    let area = 0;
    let perimeter = 0;
    const N = polygon.length;
    for (let i = 0; i < N; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % N];
        area += (p1.x * p2.y - p2.x * p1.y);
        perimeter += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
    area = Math.abs(area) / 2;
    return {
        area: Math.round(area * 100) / 100,
        perimeter: Math.round(perimeter * 100) / 100
    };
}

export function calculateAngle3Points(p1, vertex, p2) {
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let diff = Math.abs((a2 - a1) * (180 / Math.PI));
    if (diff > 180) diff = 360 - diff;
    return Math.round(diff * 100) / 100;
}

export function calculateAngle2Lines(line1, line2) {
    const v1 = { x: line1.end.x - line1.start.x, y: line1.end.y - line1.start.y };
    const v2 = { x: line2.end.x - line2.start.x, y: line2.end.y - line2.start.y };
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 === 0 || mag2 === 0) return 0;
    let dot = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
    dot = Math.max(-1, Math.min(1, dot));
    let deg = Math.acos(dot) * (180 / Math.PI);
    return Math.round(deg * 100) / 100;
}

export function formatMeasurement(val, unit = 'mm') {
    const num = Math.round((val || 0) * 100) / 100;
    const formattedStr = num.toFixed(2);
    if (unit === '°') return `${formattedStr}°`;
    if (unit === 'mm²') return `${formattedStr} mm²`;
    return `${formattedStr} mm`;
}
