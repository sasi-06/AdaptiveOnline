import React, { useRef, useEffect, useState, useCallback } from 'react';
import { worldToScreen, screenToWorld, calculateFitExtents } from './utils/cadCoordinates';
import { computeSnapAndConstraints } from './utils/cadSnapping';
import { parseCadInput } from './utils/cadParser';
import { hitTestObject, isObjectInsideBox, isObjectCrossingBox, mirrorObject, reflectPoint, offsetObject, trimObject, extendObject, filletObjects, chamferObjects, detectClosedRegion, isPointInPolygon, calculatePolygonAreaAndPerimeter, calculateAngle3Points, calculateAngle2Lines, formatMeasurement } from './utils/cadHitTest';

// Default Civil CAD Layer Set
export const DEFAULT_LAYERS = [
    { id: 'layer_0', name: '0', visible: true, locked: false, color: '#ffffff' },
    { id: 'layer_walls', name: 'Walls', visible: true, locked: false, color: '#38bdf8' },
    { id: 'layer_dimensions', name: 'Dimensions', visible: true, locked: false, color: '#f59e0b' },
    { id: 'layer_text', name: 'Text', visible: true, locked: false, color: '#10b981' },
    { id: 'layer_hatching', name: 'Hatching', visible: true, locked: false, color: '#a855f7' }
];

// Math helpers
function distance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

function angleDeg(p1, p2) {
    let a = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    return a < 0 ? a + 360 : a;
}

function angleRad(p1, p2) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

function rotatePoint(p, center, rad) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
        x: Math.round((center.x + dx * cos - dy * sin) * 100) / 100,
        y: Math.round((center.y + dx * sin + dy * cos) * 100) / 100
    };
}

// 3-point arc solver
function getThreePointArc(p1, p2, p3) {
    const temp = p2.x * p2.x + p2.y * p2.y;
    const bc = (p1.x * p1.x + p1.y * p1.y - temp) / 2;
    const cd = (temp - p3.x * p3.x - p3.y * p3.y) / 2;
    const det = (p1.x - p2.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p2.y);

    if (Math.abs(det) < 1e-5) return null;

    const cx = (bc * (p2.y - p3.y) - cd * (p1.y - p2.y)) / det;
    const cy = (cd * (p1.x - p2.x) - bc * (p2.x - p3.x)) / det;
    const radius = Math.hypot(p1.x - cx, p1.y - cy);

    let a1 = Math.atan2(p1.y - cy, p1.x - cx);
    let a3 = Math.atan2(p3.y - cy, p3.x - cx);

    return { center: { x: cx, y: cy }, radius, startAngle: a1, endAngle: a3 };
}

// Draw CAD Grips helper
function drawGrip(ctx, screenPt, isCenter = false) {
    ctx.fillStyle = isCenter ? '#f59e0b' : '#00f0ff';
    ctx.strokeStyle = '#121216';
    ctx.lineWidth = 1.5;
    const size = 7;
    ctx.fillRect(screenPt.x - size / 2, screenPt.y - size / 2, size, size);
    ctx.strokeRect(screenPt.x - size / 2, screenPt.y - size / 2, size, size);
}

// ── DIMENSION RENDERING & FORMATTING HELPERS ────────────────────────────
function formatDimensionValue(val, unit = 'mm') {
    const rounded = Math.round(val * 100) / 100;
    if (unit === '°') return `${rounded}°`;
    if (unit === 'R') return `R${rounded} mm`;
    if (unit === 'DIA') return `⌀${rounded} mm`;
    return `${rounded} mm`;
}

function drawArrowhead(ctx, pFrom, pTo, size = 8) {
    const angle = Math.atan2(pTo.y - pFrom.y, pTo.x - pFrom.x);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pTo.x, pTo.y);
    ctx.lineTo(
        pTo.x - size * Math.cos(angle - Math.PI / 7),
        pTo.y - size * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
        pTo.x - size * Math.cos(angle + Math.PI / 7),
        pTo.y - size * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.restore();
}

function renderText(ctx, textObj, viewport, width, height, isSelected = false) {
    ctx.save();
    const { position, text = '', height: h = 25, rotation = 0, color } = textObj;
    if (!position || !text) {
        ctx.restore();
        return;
    }

    const sPt = worldToScreen(position.x, position.y, viewport, width, height);
    const fontPx = Math.max(h * viewport.zoom, 4);

    ctx.translate(sPt.x, sPt.y);
    const rotRad = (rotation || 0) * (Math.PI / 180);
    ctx.rotate(-rotRad);

    ctx.font = `600 ${fontPx}px Outfit, sans-serif`;
    ctx.fillStyle = isSelected ? '#00f0ff' : (color || '#38bdf8');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillText(text, 0, 0);

    if (isSelected) {
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        const txtWidth = ctx.measureText(text).width;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(0, -fontPx, txtWidth, fontPx * 1.2);
        ctx.setLineDash([]);

        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-3, -3, 6, 6);
    }
    ctx.restore();
}

function renderHatch(ctx, hatchObj, viewport, width, height, isSelected = false) {
    const { boundary = [], pattern = 'LINE', angle = 45, scale = 10, color = '#a855f7' } = hatchObj;
    if (!boundary || boundary.length < 3) return;

    const screenPts = boundary.map(p => worldToScreen(p.x, p.y, viewport, width, height));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screenPts[0].x, screenPts[0].y);
    for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y);
    }
    ctx.closePath();

    if (pattern === 'SOLID') {
        ctx.fillStyle = isSelected ? 'rgba(0, 240, 255, 0.45)' : (color || '#a855f7');
        ctx.fill();
    } else {
        ctx.clip();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        boundary.forEach(pt => {
            minX = Math.min(minX, pt.x);
            maxX = Math.max(maxX, pt.x);
            minY = Math.min(minY, pt.y);
            maxY = Math.max(maxY, pt.y);
        });

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const diagonal = Math.hypot(maxX - minX, maxY - minY) + 20;
        const R = diagonal / 2;

        const spacingWorld = Math.max(scale || 10, 1);
        const pixelSpacing = spacingWorld * viewport.zoom;
        const stepWorld = pixelSpacing < 2.5 ? (2.5 / viewport.zoom) : spacingWorld;

        ctx.strokeStyle = isSelected ? '#00f0ff' : (color || '#a855f7');
        ctx.lineWidth = isSelected ? 2 : 1.2;

        const drawHatchLinesAtAngle = (angDeg) => {
            const rad = (angDeg * Math.PI) / 180;
            const dirX = Math.cos(rad);
            const dirY = Math.sin(rad);
            const perpX = -Math.sin(rad);
            const perpY = Math.cos(rad);

            const numSteps = Math.ceil(R / stepWorld);

            ctx.beginPath();
            for (let i = -numSteps; i <= numSteps; i++) {
                const offsetDist = i * stepWorld;
                const lineCx = cx + perpX * offsetDist;
                const lineCy = cy + perpY * offsetDist;

                const p1W = { x: lineCx - dirX * R, y: lineCy - dirY * R };
                const p2W = { x: lineCx + dirX * R, y: lineCy + dirY * R };

                const s1 = worldToScreen(p1W.x, p1W.y, viewport, width, height);
                const s2 = worldToScreen(p2W.x, p2W.y, viewport, width, height);

                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
            }
            ctx.stroke();
        };

        if (pattern === 'LINE' || pattern === 'CROSS') {
            drawHatchLinesAtAngle(angle || 0);
        }
        if (pattern === 'CROSS') {
            drawHatchLinesAtAngle((angle || 0) + 90);
        }
    }

    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screenPts[0].x, screenPts[0].y);
    for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y);
    }
    ctx.closePath();

    if (isSelected) {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        screenPts.forEach(pt => drawGrip(ctx, pt));
        const centroidW = {
            x: boundary.reduce((acc, p) => acc + p.x, 0) / boundary.length,
            y: boundary.reduce((acc, p) => acc + p.y, 0) / boundary.length
        };
        drawGrip(ctx, worldToScreen(centroidW.x, centroidW.y, viewport, width, height), true);
    } else {
        ctx.strokeStyle = (color || '#a855f7') + '88';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
}

function renderDimension(ctx, dim, viewport, width, height, isSelected = false) {
    ctx.save();
    ctx.strokeStyle = isSelected ? '#00f0ff' : '#38bdf8';
    ctx.fillStyle = isSelected ? '#00f0ff' : '#38bdf8';
    ctx.lineWidth = isSelected ? 2 : 1.5;

    if (dim.type === 'LINEAR_DIMENSION' || dim.type === 'ALIGNED_DIMENSION') {
        const { start, end, offset = 30, isVertical } = dim;
        if (!start || !end) {
            ctx.restore();
            return;
        }

        let dimStartW, dimEndW;
        if (dim.type === 'LINEAR_DIMENSION' && isVertical) {
            dimStartW = { x: start.x + offset, y: start.y };
            dimEndW = { x: end.x + offset, y: end.y };
        } else if (dim.type === 'LINEAR_DIMENSION' && !isVertical) {
            dimStartW = { x: start.x, y: start.y + offset };
            dimEndW = { x: end.x, y: end.y + offset };
        } else {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const L = Math.hypot(dx, dy) || 1;
            const nx = -dy / L;
            const ny = dx / L;
            dimStartW = { x: start.x + offset * nx, y: start.y + offset * ny };
            dimEndW = { x: end.x + offset * nx, y: end.y + offset * ny };
        }

        const s1 = worldToScreen(start.x, start.y, viewport, width, height);
        const s2 = worldToScreen(end.x, end.y, viewport, width, height);
        const d1 = worldToScreen(dimStartW.x, dimStartW.y, viewport, width, height);
        const d2 = worldToScreen(dimEndW.x, dimEndW.y, viewport, width, height);

        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(d1.x, d1.y);
        ctx.moveTo(s2.x, s2.y);
        ctx.lineTo(d2.x, d2.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(d1.x, d1.y);
        ctx.lineTo(d2.x, d2.y);
        ctx.stroke();

        drawArrowhead(ctx, d2, d1, 9);
        drawArrowhead(ctx, d1, d2, 9);

        let val = 0;
        if (dim.type === 'LINEAR_DIMENSION' && isVertical) {
            val = Math.abs(end.y - start.y);
        } else if (dim.type === 'LINEAR_DIMENSION' && !isVertical) {
            val = Math.abs(end.x - start.x);
        } else {
            val = Math.hypot(end.x - start.x, end.y - start.y);
        }

        const textStr = formatDimensionValue(val, 'mm');
        const midS = { x: (d1.x + d2.x) / 2, y: (d1.y + d2.y) / 2 };

        ctx.font = '700 12px Outfit, sans-serif';
        const txtWidth = ctx.measureText(textStr).width;
        ctx.fillStyle = '#13131c';
        ctx.fillRect(midS.x - txtWidth / 2 - 4, midS.y - 8, txtWidth + 8, 16);
        ctx.strokeStyle = isSelected ? '#00f0ff' : '#38bdf8';
        ctx.strokeRect(midS.x - txtWidth / 2 - 4, midS.y - 8, txtWidth + 8, 16);

        ctx.fillStyle = isSelected ? '#00f0ff' : '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(textStr, midS.x, midS.y);

    } else if (dim.type === 'ANGULAR_DIMENSION') {
        const { center, radius = 40, startAngle = 0, endAngle = Math.PI / 4 } = dim;
        if (!center) {
            ctx.restore();
            return;
        }
        const cS = worldToScreen(center.x, center.y, viewport, width, height);

        ctx.beginPath();
        ctx.arc(cS.x, cS.y, radius * viewport.zoom, -startAngle, -endAngle, true);
        ctx.stroke();

        let deg = Math.abs(endAngle - startAngle) * (180 / Math.PI);
        if (deg > 360) deg %= 360;
        const textStr = formatDimensionValue(deg, '°');

        const midAngle = (startAngle + endAngle) / 2;
        const midWorld = {
            x: center.x + radius * Math.cos(midAngle),
            y: center.y + radius * Math.sin(midAngle)
        };
        const midS = worldToScreen(midWorld.x, midWorld.y, viewport, width, height);

        ctx.font = '700 12px Outfit, sans-serif';
        const txtWidth = ctx.measureText(textStr).width;
        ctx.fillStyle = '#13131c';
        ctx.fillRect(midS.x - txtWidth / 2 - 4, midS.y - 8, txtWidth + 8, 16);
        ctx.strokeRect(midS.x - txtWidth / 2 - 4, midS.y - 8, txtWidth + 8, 16);

        ctx.fillStyle = isSelected ? '#00f0ff' : '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(textStr, midS.x, midS.y);

    } else if (dim.type === 'RADIUS_DIMENSION' || dim.type === 'DIAMETER_DIMENSION') {
        const { center, radius = 30, angle = 0 } = dim;
        if (!center) {
            ctx.restore();
            return;
        }
        const cS = worldToScreen(center.x, center.y, viewport, width, height);
        const rimW = { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
        const rimS = worldToScreen(rimW.x, rimW.y, viewport, width, height);

        if (dim.type === 'DIAMETER_DIMENSION') {
            const oppW = { x: center.x - radius * Math.cos(angle), y: center.y - radius * Math.sin(angle) };
            const oppS = worldToScreen(oppW.x, oppW.y, viewport, width, height);

            ctx.beginPath();
            ctx.moveTo(oppS.x, oppS.y);
            ctx.lineTo(rimS.x, rimS.y);
            ctx.stroke();

            drawArrowhead(ctx, oppS, rimS, 8);
            drawArrowhead(ctx, rimS, oppS, 8);

            const textStr = formatDimensionValue(radius, 'DIA');
            ctx.font = '700 12px Outfit, sans-serif';
            const txtWidth = ctx.measureText(textStr).width;
            ctx.fillStyle = '#13131c';
            ctx.fillRect(cS.x - txtWidth / 2 - 4, cS.y - 8, txtWidth + 8, 16);
            ctx.strokeRect(cS.x - txtWidth / 2 - 4, cS.y - 8, txtWidth + 8, 16);

            ctx.fillStyle = isSelected ? '#00f0ff' : '#38bdf8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(textStr, cS.x, cS.y);
        } else {
            ctx.beginPath();
            ctx.moveTo(cS.x, cS.y);
            ctx.lineTo(rimS.x, rimS.y);
            ctx.stroke();

            drawArrowhead(ctx, cS, rimS, 8);

            const textStr = formatDimensionValue(radius, 'R');
            const midS = { x: (cS.x + rimS.x) / 2, y: (cS.y + rimS.y) / 2 };
            ctx.font = '700 12px Outfit, sans-serif';
            const txtWidth = ctx.measureText(textStr).width;
            ctx.fillStyle = '#13131c';
            ctx.fillRect(midS.x - txtWidth / 2 - 4, midS.y - 8, txtWidth + 8, 16);
            ctx.strokeRect(midS.x - txtWidth / 2 - 4, midS.y - 8, txtWidth + 8, 16);

            ctx.fillStyle = isSelected ? '#00f0ff' : '#38bdf8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(textStr, midS.x, midS.y);
        }
    }
    ctx.restore();
}

export default function CadCanvas({
    objects = [],
    onChangeObjects,
    initialLayers = DEFAULT_LAYERS,
    initialCurrentLayerId = 'layer_walls',
    showLayersPanelProp = undefined,
    onDrawingStateChange,
    activeTool = 'select',
    onSelectTool,
    gridEnabled = true,
    gridSpacing = 10,
    snapEnabled = true,
    orthoEnabled = false,
    osnapEnabled = true,
    angleEnabled = false,
    angleIncrement = 45,
    onCoordsChange,
    onViewportChange,
    onHistoryChange
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Layers State
    const [layers, setLayers] = useState(initialLayers || DEFAULT_LAYERS);
    const [currentLayerId, setCurrentLayerId] = useState(initialCurrentLayerId || 'layer_walls');
    const [showLayersPanelInternal, setShowLayersPanelInternal] = useState(false);
    const showLayersPanel = showLayersPanelProp !== undefined ? showLayersPanelProp : showLayersPanelInternal;
    const setShowLayersPanel = (val) => {
        if (typeof val === 'function') {
            setShowLayersPanelInternal(prev => val(showLayersPanel));
        } else {
            setShowLayersPanelInternal(val);
        }
    };

    const [showNewLayerModal, setShowNewLayerModal] = useState(false);
    const [newLayerNameInput, setNewLayerNameInput] = useState('');
    const [newLayerColorInput, setNewLayerColorInput] = useState('#38bdf8');
    const [editingLayerId, setEditingLayerId] = useState(null);
    const [editLayerNameInput, setEditLayerNameInput] = useState('');
    const [layerErrorMsg, setLayerErrorMsg] = useState('');

    // Sync external initialLayers if updated
    useEffect(() => {
        if (initialLayers && initialLayers.length > 0) {
            setLayers(initialLayers);
        }
    }, [initialLayers]);

    useEffect(() => {
        if (initialCurrentLayerId) {
            setCurrentLayerId(initialCurrentLayerId);
        }
    }, [initialCurrentLayerId]);

    // Viewport state (Zoom & Pan)
    const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });

    // Interaction & Selection state
    const [selectedIds, setSelectedIds] = useState([]);
    const [toolPoints, setToolPoints] = useState([]);
    const [cursorWorld, setCursorWorld] = useState({ x: 0, y: 0 });
    const [cursorScreen, setCursorScreen] = useState({ x: 0, y: 0 });
    const [rawWorld, setRawWorld] = useState({ x: 0, y: 0 });
    const [activeSnap, setActiveSnap] = useState(null);
    const [isSnapped, setIsSnapped] = useState(false);

    // Temporary Ortho via Shift Key
    const [shiftOrtho, setShiftOrtho] = useState(false);

    // Pan & Box Select
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState(null);

    // MIRROR Delete Source Modal state
    const [showDeleteSourceModal, setShowDeleteSourceModal] = useState(false);
    const [pendingMirrorData, setPendingMirrorData] = useState(null);

    // OFFSET state
    const [offsetDistance, setOffsetDistance] = useState(50);
    const [targetOffsetObjId, setTargetOffsetObjId] = useState(null);
    const [offsetErrorMsg, setOffsetErrorMsg] = useState('');
    const [trimErrorMsg, setTrimErrorMsg] = useState('');
    const [extendErrorMsg, setExtendErrorMsg] = useState('');
    const [filletRadius, setFilletRadius] = useState(50);
    const [firstFilletSelection, setFirstFilletSelection] = useState(null);
    const [filletErrorMsg, setFilletErrorMsg] = useState('');
    const [chamferDist1, setChamferDist1] = useState(50);
    const [chamferDist2, setChamferDist2] = useState(50);
    const [firstChamferSelection, setFirstChamferSelection] = useState(null);
    const [chamferErrorMsg, setChamferErrorMsg] = useState('');

    // Dimension Tool States
    const [firstAngularSelection, setFirstAngularSelection] = useState(null);
    const [targetRadiusCircle, setTargetRadiusCircle] = useState(null);
    const [targetDiameterCircle, setTargetDiameterCircle] = useState(null);

    // Text Tool & Editing States
    const [showTextModal, setShowTextModal] = useState(false);
    const [editingTextObj, setEditingTextObj] = useState(null);
    const [textModalPos, setTextModalPos] = useState(null);
    const [textModalContent, setTextModalContent] = useState('');
    const [textModalHeight, setTextModalHeight] = useState(25);
    const [textModalRotation, setTextModalRotation] = useState(0);

    // Hatch Tool States
    const [hatchPattern, setHatchPattern] = useState('LINE');
    const [hatchAngle, setHatchAngle] = useState(45);
    const [hatchScale, setHatchScale] = useState(10);
    const [hatchStatusMsg, setHatchStatusMsg] = useState('');

    // Measurement Tool States
    const [activeMeasurementResult, setActiveMeasurementResult] = useState(null);
    const [firstMeasureAngleLine, setFirstMeasureAngleLine] = useState(null);
    const [measureStatusMsg, setMeasureStatusMsg] = useState('');

    // Reset tool state when activeTool changes
    useEffect(() => {
        if (!activeTool.startsWith('dim_')) {
            setFirstAngularSelection(null);
            setTargetRadiusCircle(null);
            setTargetDiameterCircle(null);
        }
        if (!activeTool.startsWith('measure_')) {
            setFirstMeasureAngleLine(null);
        }
        if (activeTool !== 'text' && !editingTextObj) {
            setShowTextModal(false);
        }
    }, [activeTool, editingTextObj]);

    // Layer Visibility & Lock Helpers
    const isObjectVisible = useCallback((obj) => {
        if (!obj) return false;
        const lId = obj.layerId || 'layer_0';
        const layer = layers.find(l => l.id === lId || l.name === lId || (lId === '0' && l.name === '0'));
        return layer ? layer.visible !== false : true;
    }, [layers]);

    const isObjectEditable = useCallback((obj) => {
        if (!isObjectVisible(obj)) return false;
        const lId = obj.layerId || 'layer_0';
        const layer = layers.find(l => l.id === lId || l.name === lId || (lId === '0' && l.name === '0'));
        return layer ? layer.locked !== true : true;
    }, [layers, isObjectVisible]);

    // Numeric Keyboard Input Buffer & Tooltip
    const [numInput, setNumInput] = useState('');
    const [showNumInput, setShowNumInput] = useState(false);

    // Undo / Redo stacks
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);

    // Guarantee stable unique IDs & layerId normalization for all objects
    useEffect(() => {
        let needsUpdate = false;
        const sanitized = objects.map((obj, index) => {
            let item = obj;
            if (!item.id) {
                needsUpdate = true;
                item = { ...item, id: `geom_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}` };
            }
            if (!item.layerId) {
                needsUpdate = true;
                item = { ...item, layerId: 'layer_0' };
            }
            return item;
        });
        if (needsUpdate) {
            onChangeObjects(sanitized);
        }
    }, [objects, onChangeObjects]);

    // Reset offset target when tool changes
    useEffect(() => {
        if (activeTool !== 'offset') {
            setTargetOffsetObjId(null);
            setOffsetErrorMsg('');
        }
    }, [activeTool]);

    // ── History Commit (Objects + Layers) ───────────────────────────────
    const commitState = useCallback((newObjects = objects, newLayers = layers, newCurrentLayer = currentLayerId) => {
        setUndoStack(prev => [...prev, { objects, layers, currentLayerId }]);
        setRedoStack([]);
        if (newObjects !== objects) onChangeObjects(newObjects);
        if (newLayers !== layers) setLayers(newLayers);
        if (newCurrentLayer !== currentLayerId) setCurrentLayerId(newCurrentLayer);

        if (onDrawingStateChange) {
            onDrawingStateChange({ objects: newObjects, layers: newLayers, currentLayerId: newCurrentLayer });
        }
    }, [objects, layers, currentLayerId, onChangeObjects, onDrawingStateChange]);

    const commitObjects = useCallback((newObjects) => {
        commitState(newObjects, layers, currentLayerId);
    }, [commitState, layers, currentLayerId]);

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const previous = undoStack[undoStack.length - 1];
        setRedoStack(prev => [{ objects, layers, currentLayerId }, ...prev]);
        setUndoStack(prev => prev.slice(0, prev.length - 1));

        const prevObjs = previous.objects || previous;
        const prevLayers = previous.layers || layers;
        const prevCurrent = previous.currentLayerId || currentLayerId;

        onChangeObjects(prevObjs);
        setLayers(prevLayers);
        setCurrentLayerId(prevCurrent);

        if (onDrawingStateChange) {
            onDrawingStateChange({ objects: prevObjs, layers: prevLayers, currentLayerId: prevCurrent });
        }

        setSelectedIds([]);
        setToolPoints([]);
        setShowDeleteSourceModal(false);
        setPendingMirrorData(null);
        setTargetOffsetObjId(null);
    }, [undoStack, objects, layers, currentLayerId, onChangeObjects, onDrawingStateChange]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const next = redoStack[0];
        setUndoStack(prev => [...prev, { objects, layers, currentLayerId }]);
        setRedoStack(prev => prev.slice(1));

        const nextObjs = next.objects || next;
        const nextLayers = next.layers || layers;
        const nextCurrent = next.currentLayerId || currentLayerId;

        onChangeObjects(nextObjs);
        setLayers(nextLayers);
        setCurrentLayerId(nextCurrent);

        if (onDrawingStateChange) {
            onDrawingStateChange({ objects: nextObjs, layers: nextLayers, currentLayerId: nextCurrent });
        }

        setSelectedIds([]);
        setToolPoints([]);
        setShowDeleteSourceModal(false);
        setPendingMirrorData(null);
        setTargetOffsetObjId(null);
    }, [redoStack, objects, layers, currentLayerId, onChangeObjects, onDrawingStateChange]);

    // MIRROR Confirmation Handler
    const handleConfirmMirror = useCallback((deleteSource = false) => {
        if (!pendingMirrorData) return;
        const { p1, p2, targetIds } = pendingMirrorData;
        const targets = objects.filter(o => targetIds.includes(o.id));
        const mirroredObjs = targets.map(obj => mirrorObject(obj, p1, p2));

        let newObjects = [];
        if (deleteSource) {
            newObjects = [...objects.filter(o => !targetIds.includes(o.id)), ...mirroredObjs];
        } else {
            newObjects = [...objects, ...mirroredObjs];
        }

        commitObjects(newObjects);
        setSelectedIds(mirroredObjs.map(m => m.id));
        setToolPoints([]);
        setPendingMirrorData(null);
        setShowDeleteSourceModal(false);
        onSelectTool('select');
    }, [pendingMirrorData, objects, commitObjects, onSelectTool]);

    // ── Layer Management Handlers ─────────────────────────────────────
    const handleCreateLayer = (name, color) => {
        if (!name || !name.trim()) return;
        const trimmed = name.trim();
        if (layers.some(l => l.name.trim().toLowerCase() === trimmed.toLowerCase())) {
            setLayerErrorMsg('A layer with this name already exists.');
            setTimeout(() => setLayerErrorMsg(''), 4000);
            return;
        }
        const newLayer = {
            id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name: trimmed,
            visible: true,
            locked: false,
            color: color || '#38bdf8'
        };
        commitState(objects, [...layers, newLayer], newLayer.id);
        setShowNewLayerModal(false);
        setNewLayerNameInput('');
    };

    const handleRenameLayer = (layerId, newName) => {
        if (!newName || !newName.trim()) return;
        const trimmed = newName.trim();
        if (layers.some(l => l.id !== layerId && l.name.trim().toLowerCase() === trimmed.toLowerCase())) {
            setLayerErrorMsg('A layer with this name already exists.');
            setTimeout(() => setLayerErrorMsg(''), 4000);
            return;
        }
        const updatedLayers = layers.map(l => l.id === layerId ? { ...l, name: trimmed } : l);
        commitState(objects, updatedLayers, currentLayerId);
        setEditingLayerId(null);
        setEditLayerNameInput('');
    };

    const handleDeleteLayer = (layerId) => {
        const target = layers.find(l => l.id === layerId);
        if (!target || target.name === '0' || target.id === 'layer_0') {
            setLayerErrorMsg('Layer 0 cannot be deleted.');
            setTimeout(() => setLayerErrorMsg(''), 4000);
            return;
        }
        const hasObjects = objects.some(o => o.layerId === layerId || o.layerId === target.name);
        if (hasObjects) {
            setLayerErrorMsg('Cannot delete layer containing objects. Move or delete its objects first.');
            setTimeout(() => setLayerErrorMsg(''), 4500);
            return;
        }
        const remaining = layers.filter(l => l.id !== layerId);
        const nextCurrent = currentLayerId === layerId ? (remaining[0]?.id || 'layer_0') : currentLayerId;
        commitState(objects, remaining, nextCurrent);
    };

    const handleToggleLayerVisibility = (layerId) => {
        const updatedLayers = layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l);
        commitState(objects, updatedLayers, currentLayerId);
    };

    const handleToggleLayerLock = (layerId) => {
        const updatedLayers = layers.map(l => l.id === layerId ? { ...l, locked: !l.locked } : l);
        commitState(objects, updatedLayers, currentLayerId);
    };

    const handleReassignSelectedObjectsLayer = useCallback((targetLayerId) => {
        if (selectedIds.length === 0) return;
        const updatedObjs = objects.map(o => selectedIds.includes(o.id) ? { ...o, layerId: targetLayerId } : o);
        commitState(updatedObjs, layers, currentLayerId);
    }, [selectedIds, objects, layers, currentLayerId, commitState]);

    // Notify parent component of current state (for toolbar integration & autosave)
    useEffect(() => {
        if (onDrawingStateChange) {
            onDrawingStateChange({
                objects,
                layers,
                currentLayerId,
                selectedCount: selectedIds.length,
                reassignLayer: handleReassignSelectedObjectsLayer
            });
        }
    }, [objects, layers, currentLayerId, selectedIds.length, handleReassignSelectedObjectsLayer, onDrawingStateChange]);

    // Storing callback props in refs
    const onViewportChangeRef = useRef(onViewportChange);
    const onHistoryChangeRef = useRef(onHistoryChange);
    const onCoordsChangeRef = useRef(onCoordsChange);

    useEffect(() => {
        onViewportChangeRef.current = onViewportChange;
    }, [onViewportChange]);

    useEffect(() => {
        onHistoryChangeRef.current = onHistoryChange;
    }, [onHistoryChange]);

    useEffect(() => {
        onCoordsChangeRef.current = onCoordsChange;
    }, [onCoordsChange]);

    const prevHistoryRef = useRef({ canUndo: false, canRedo: false });
    useEffect(() => {
        const canUndo = undoStack.length > 0;
        const canRedo = redoStack.length > 0;
        if (prevHistoryRef.current.canUndo !== canUndo || prevHistoryRef.current.canRedo !== canRedo) {
            prevHistoryRef.current = { canUndo, canRedo };
            if (onHistoryChangeRef.current) {
                onHistoryChangeRef.current({ canUndo, canRedo });
            }
        }
    }, [undoStack.length, redoStack.length]);

    // Handle instant tool triggers (Undo, Redo)
    useEffect(() => {
        if (activeTool === 'undo') {
            handleUndo();
            onSelectTool('select');
        } else if (activeTool === 'redo') {
            handleRedo();
            onSelectTool('select');
        }
    }, [activeTool, handleUndo, handleRedo, onSelectTool]);

    // Fit Extents Handler
    const fitExtents = useCallback(() => {
        const c = canvasRef.current;
        if (!c) return;
        const newVp = calculateFitExtents(objects, c.width, c.height);
        setViewport(newVp);
    }, [objects]);

    const prevVpRef = useRef(null);
    useEffect(() => {
        const vpChanged = !prevVpRef.current ||
            prevVpRef.current.zoom !== viewport.zoom ||
            prevVpRef.current.panX !== viewport.panX ||
            prevVpRef.current.panY !== viewport.panY;

        if (vpChanged) {
            prevVpRef.current = { zoom: viewport.zoom, panX: viewport.panX, panY: viewport.panY };
            if (onViewportChangeRef.current) {
                onViewportChangeRef.current({ viewport, fitExtents });
            }
        }
    }, [viewport.zoom, viewport.panX, viewport.panY, fitExtents]);

    // ── MAIN RENDER LOOP ──────────────────────────────────────────────────
    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Dark CAD Background
        ctx.fillStyle = '#18181c';
        ctx.fillRect(0, 0, width, height);

        // 1. Draw Grid System in CAD World Space
        if (gridEnabled) {
            const spacing = Math.max(gridSpacing, 1);
            const majorSpacing = spacing * 5;

            const topLeftW = screenToWorld(0, 0, viewport, width, height);
            const bottomRightW = screenToWorld(width, height, viewport, width, height);

            const startX = Math.floor(topLeftW.x / spacing) * spacing;
            const endX = Math.ceil(bottomRightW.x / spacing) * spacing;
            const startY = Math.floor(bottomRightW.y / spacing) * spacing;
            const endY = Math.ceil(topLeftW.y / spacing) * spacing;

            // Minor grid lines
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#242430';
            ctx.beginPath();
            for (let x = startX; x <= endX; x += spacing) {
                if (Math.abs(x % majorSpacing) < 1e-4) continue;
                const s = worldToScreen(x, 0, viewport, width, height);
                ctx.moveTo(s.x, 0);
                ctx.lineTo(s.x, height);
            }
            for (let y = startY; y <= endY; y += spacing) {
                if (Math.abs(y % majorSpacing) < 1e-4) continue;
                const s = worldToScreen(0, y, viewport, width, height);
                ctx.moveTo(0, s.y);
                ctx.lineTo(width, s.y);
            }
            ctx.stroke();

            // Major grid lines
            ctx.strokeStyle = '#323246';
            ctx.beginPath();
            for (let x = startX; x <= endX; x += spacing) {
                if (Math.abs(x % majorSpacing) >= 1e-4) continue;
                const s = worldToScreen(x, 0, viewport, width, height);
                ctx.moveTo(s.x, 0);
                ctx.lineTo(s.x, height);
            }
            for (let y = startY; y <= endY; y += spacing) {
                if (Math.abs(y % majorSpacing) >= 1e-4) continue;
                const s = worldToScreen(0, y, viewport, width, height);
                ctx.moveTo(0, s.y);
                ctx.lineTo(width, s.y);
            }
            ctx.stroke();
        }

        // 2. Draw World Origin Axes (X = Red, Y = Green)
        const originS = worldToScreen(0, 0, viewport, width, height);
        ctx.lineWidth = 1.5;
        // X-Axis (Red)
        ctx.strokeStyle = '#ef444499';
        ctx.beginPath();
        ctx.moveTo(0, originS.y);
        ctx.lineTo(width, originS.y);
        ctx.stroke();

        // Y-Axis (Green)
        ctx.strokeStyle = '#10b98199';
        ctx.beginPath();
        ctx.moveTo(originS.x, 0);
        ctx.lineTo(originS.x, height);
        ctx.stroke();

        // 3. Render Geometry Objects
        objects.forEach(obj => {
            if (!isObjectVisible(obj)) return;
            const isSelected = selectedIds.includes(obj.id) || (activeTool === 'offset' && targetOffsetObjId === obj.id);
            ctx.strokeStyle = isSelected ? '#00f0ff' : obj.color || '#38bdf8';
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.fillStyle = 'transparent';

            if (isSelected) {
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 8;
            } else {
                ctx.shadowBlur = 0;
            }

            if (obj.type === 'LINE') {
                const s1 = worldToScreen(obj.start.x, obj.start.y, viewport, width, height);
                const s2 = worldToScreen(obj.end.x, obj.end.y, viewport, width, height);
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();

                if (isSelected) {
                    const midW = { x: (obj.start.x + obj.end.x) / 2, y: (obj.start.y + obj.end.y) / 2 };
                    drawGrip(ctx, s1);
                    drawGrip(ctx, s2);
                    drawGrip(ctx, worldToScreen(midW.x, midW.y, viewport, width, height), true);
                }
            } else if (obj.type === 'CIRCLE') {
                const c = worldToScreen(obj.center.x, obj.center.y, viewport, width, height);
                const rPx = obj.radius * viewport.zoom;
                ctx.beginPath();
                ctx.arc(c.x, c.y, rPx, 0, 2 * Math.PI);
                ctx.stroke();

                if (isSelected) {
                    drawGrip(ctx, c, true);
                    [
                        { x: obj.center.x + obj.radius, y: obj.center.y },
                        { x: obj.center.x - obj.radius, y: obj.center.y },
                        { x: obj.center.x, y: obj.center.y + obj.radius },
                        { x: obj.center.x, y: obj.center.y - obj.radius }
                    ].forEach(pt => {
                        drawGrip(ctx, worldToScreen(pt.x, pt.y, viewport, width, height));
                    });
                }
            } else if (obj.type === 'RECTANGLE') {
                const c1 = worldToScreen(obj.x, obj.y + obj.height, viewport, width, height);
                const wPx = obj.width * viewport.zoom;
                const hPx = obj.height * viewport.zoom;
                ctx.strokeRect(c1.x, c1.y, wPx, hPx);

                if (isSelected) {
                    const corners = [
                        { x: obj.x, y: obj.y },
                        { x: obj.x + obj.width, y: obj.y },
                        { x: obj.x + obj.width, y: obj.y + obj.height },
                        { x: obj.x, y: obj.y + obj.height }
                    ];
                    const midEdges = [
                        { x: obj.x + obj.width / 2, y: obj.y },
                        { x: obj.x + obj.width, y: obj.y + obj.height / 2 },
                        { x: obj.x + obj.width / 2, y: obj.y + obj.height },
                        { x: obj.x, y: obj.y + obj.height / 2 }
                    ];
                    corners.forEach(p => drawGrip(ctx, worldToScreen(p.x, p.y, viewport, width, height)));
                    midEdges.forEach(p => drawGrip(ctx, worldToScreen(p.x, p.y, viewport, width, height), true));
                }
            } else if (obj.type === 'POLYLINE') {
                const pts = obj.points || [];
                if (pts.length > 0) {
                    ctx.beginPath();
                    const startS = worldToScreen(pts[0].x, pts[0].y, viewport, width, height);
                    ctx.moveTo(startS.x, startS.y);
                    for (let i = 1; i < pts.length; i++) {
                        const s = worldToScreen(pts[i].x, pts[i].y, viewport, width, height);
                        ctx.lineTo(s.x, s.y);
                    }
                    ctx.stroke();

                    if (isSelected) {
                        pts.forEach(p => drawGrip(ctx, worldToScreen(p.x, p.y, viewport, width, height)));
                    }
                }
            } else if (obj.type === 'ARC') {
                const c = worldToScreen(obj.center.x, obj.center.y, viewport, width, height);
                const rPx = obj.radius * viewport.zoom;
                ctx.beginPath();
                ctx.arc(c.x, c.y, rPx, -obj.startAngle, -obj.endAngle, true);
                ctx.stroke();

                if (isSelected) {
                    drawGrip(ctx, c, true);
                    const pStart = { x: obj.center.x + obj.radius * Math.cos(obj.startAngle), y: obj.center.y + obj.radius * Math.sin(obj.startAngle) };
                    const pEnd = { x: obj.center.x + obj.radius * Math.cos(obj.endAngle), y: obj.center.y + obj.radius * Math.sin(obj.endAngle) };
                    drawGrip(ctx, worldToScreen(pStart.x, pStart.y, viewport, width, height));
                    drawGrip(ctx, worldToScreen(pEnd.x, pEnd.y, viewport, width, height));
                }
            } else if (obj.type === 'LINEAR_DIMENSION' || obj.type === 'ALIGNED_DIMENSION' || obj.type === 'ANGULAR_DIMENSION' || obj.type === 'RADIUS_DIMENSION' || obj.type === 'DIAMETER_DIMENSION') {
                renderDimension(ctx, obj, viewport, width, height, isSelected);
                if (isSelected) {
                    if (obj.start) drawGrip(ctx, worldToScreen(obj.start.x, obj.start.y, viewport, width, height));
                    if (obj.end) drawGrip(ctx, worldToScreen(obj.end.x, obj.end.y, viewport, width, height));
                    if (obj.center) drawGrip(ctx, worldToScreen(obj.center.x, obj.center.y, viewport, width, height), true);
                }
            } else if (obj.type === 'TEXT') {
                renderText(ctx, obj, viewport, width, height, isSelected);
                if (isSelected) {
                    drawGrip(ctx, worldToScreen(obj.position.x, obj.position.y, viewport, width, height), true);
                }
            } else if (obj.type === 'HATCH') {
                renderHatch(ctx, obj, viewport, width, height, isSelected);
            }
        });
        ctx.shadowBlur = 0;

        // 4. Draw Active Rubber-Band & Object Manipulation Live Preview
        if (toolPoints.length > 0) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);

            if (activeTool === 'line') {
                const p0 = worldToScreen(toolPoints[0].x, toolPoints[0].y, viewport, width, height);
                const p1 = worldToScreen(cursorWorld.x, cursorWorld.y, viewport, width, height);
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
            } else if (activeTool === 'circle') {
                const c = worldToScreen(toolPoints[0].x, toolPoints[0].y, viewport, width, height);
                const rW = distance(toolPoints[0], cursorWorld);
                const rPx = rW * viewport.zoom;
                ctx.beginPath();
                ctx.arc(c.x, c.y, rPx, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (activeTool === 'rectangle') {
                const c1 = worldToScreen(Math.min(toolPoints[0].x, cursorWorld.x), Math.max(toolPoints[0].y, cursorWorld.y), viewport, width, height);
                const wW = Math.abs(cursorWorld.x - toolPoints[0].x);
                const hW = Math.abs(cursorWorld.y - toolPoints[0].y);
                ctx.strokeRect(c1.x, c1.y, wW * viewport.zoom, hW * viewport.zoom);
            } else if (activeTool === 'polyline') {
                ctx.beginPath();
                const startS = worldToScreen(toolPoints[0].x, toolPoints[0].y, viewport, width, height);
                ctx.moveTo(startS.x, startS.y);
                for (let i = 1; i < toolPoints.length; i++) {
                    const s = worldToScreen(toolPoints[i].x, toolPoints[i].y, viewport, width, height);
                    ctx.lineTo(s.x, s.y);
                }
                const currS = worldToScreen(cursorWorld.x, cursorWorld.y, viewport, width, height);
                ctx.lineTo(currS.x, currS.y);
                ctx.stroke();
            } else if (activeTool === 'arc' && toolPoints.length === 2) {
                const arcGeom = getThreePointArc(toolPoints[0], toolPoints[1], cursorWorld);
                if (arcGeom) {
                    const c = worldToScreen(arcGeom.center.x, arcGeom.center.y, viewport, width, height);
                    const rPx = arcGeom.radius * viewport.zoom;
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, rPx, -arcGeom.startAngle, -arcGeom.endAngle, true);
                    ctx.stroke();
                }
            } else if ((activeTool === 'move' || activeTool === 'copy') && toolPoints.length === 1) {
                const baseP = toolPoints[0];
                const dx = cursorWorld.x - baseP.x;
                const dy = cursorWorld.y - baseP.y;

                const targets = selectedIds.length > 0 ? objects.filter(o => selectedIds.includes(o.id)) : objects;
                targets.forEach(obj => {
                    if (obj.type === 'LINE') {
                        const s1 = worldToScreen(obj.start.x + dx, obj.start.y + dy, viewport, width, height);
                        const s2 = worldToScreen(obj.end.x + dx, obj.end.y + dy, viewport, width, height);
                        ctx.beginPath();
                        ctx.moveTo(s1.x, s1.y);
                        ctx.lineTo(s2.x, s2.y);
                        ctx.stroke();
                    } else if (obj.type === 'CIRCLE') {
                        const c = worldToScreen(obj.center.x + dx, obj.center.y + dy, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, obj.radius * viewport.zoom, 0, 2 * Math.PI);
                        ctx.stroke();
                    } else if (obj.type === 'RECTANGLE') {
                        const c1 = worldToScreen(obj.x + dx, obj.y + dy + obj.height, viewport, width, height);
                        ctx.strokeRect(c1.x, c1.y, obj.width * viewport.zoom, obj.height * viewport.zoom);
                    } else if (obj.type === 'POLYLINE') {
                        const pts = (obj.points || []).map(p => ({ x: p.x + dx, y: p.y + dy }));
                        if (pts.length > 0) {
                            ctx.beginPath();
                            const startS = worldToScreen(pts[0].x, pts[0].y, viewport, width, height);
                            ctx.moveTo(startS.x, startS.y);
                            for (let i = 1; i < pts.length; i++) {
                                const s = worldToScreen(pts[i].x, pts[i].y, viewport, width, height);
                                ctx.lineTo(s.x, s.y);
                            }
                            ctx.stroke();
                        }
                    } else if (obj.type === 'ARC') {
                        const c = worldToScreen(obj.center.x + dx, obj.center.y + dy, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, obj.radius * viewport.zoom, -obj.startAngle, -obj.endAngle, true);
                        ctx.stroke();
                    } else if (obj.type === 'TEXT') {
                        renderText(ctx, { ...obj, position: { x: obj.position.x + dx, y: obj.position.y + dy } }, viewport, width, height, false);
                    } else if (obj.type === 'HATCH') {
                        renderHatch(ctx, { ...obj, boundary: (obj.boundary || []).map(p => ({ x: p.x + dx, y: p.y + dy })) }, viewport, width, height, false);
                    }
                });
            } else if (activeTool === 'rotate' && toolPoints.length === 1) {
                const baseP = toolPoints[0];
                const rad = angleRad(baseP, cursorWorld);

                const targets = selectedIds.length > 0 ? objects.filter(o => selectedIds.includes(o.id)) : objects;
                targets.forEach(obj => {
                    if (obj.type === 'LINE') {
                        const r1 = rotatePoint(obj.start, baseP, rad);
                        const r2 = rotatePoint(obj.end, baseP, rad);
                        const s1 = worldToScreen(r1.x, r1.y, viewport, width, height);
                        const s2 = worldToScreen(r2.x, r2.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.moveTo(s1.x, s1.y);
                        ctx.lineTo(s2.x, s2.y);
                        ctx.stroke();
                    } else if (obj.type === 'CIRCLE') {
                        const rc = rotatePoint(obj.center, baseP, rad);
                        const c = worldToScreen(rc.x, rc.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, obj.radius * viewport.zoom, 0, 2 * Math.PI);
                        ctx.stroke();
                    } else if (obj.type === 'RECTANGLE') {
                        const c1 = rotatePoint({ x: obj.x, y: obj.y }, baseP, rad);
                        const c2 = rotatePoint({ x: obj.x + obj.width, y: obj.y }, baseP, rad);
                        const c3 = rotatePoint({ x: obj.x + obj.width, y: obj.y + obj.height }, baseP, rad);
                        const c4 = rotatePoint({ x: obj.x, y: obj.y + obj.height }, baseP, rad);
                        const s1 = worldToScreen(c1.x, c1.y, viewport, width, height);
                        const s2 = worldToScreen(c2.x, c2.y, viewport, width, height);
                        const s3 = worldToScreen(c3.x, c3.y, viewport, width, height);
                        const s4 = worldToScreen(c4.x, c4.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.moveTo(s1.x, s1.y);
                        ctx.lineTo(s2.x, s2.y);
                        ctx.lineTo(s3.x, s3.y);
                        ctx.lineTo(s4.x, s4.y);
                        ctx.closePath();
                        ctx.stroke();
                    } else if (obj.type === 'POLYLINE') {
                        const pts = (obj.points || []).map(p => rotatePoint(p, baseP, rad));
                        if (pts.length > 0) {
                            ctx.beginPath();
                            const startS = worldToScreen(pts[0].x, pts[0].y, viewport, width, height);
                            ctx.moveTo(startS.x, startS.y);
                            for (let i = 1; i < pts.length; i++) {
                                const s = worldToScreen(pts[i].x, pts[i].y, viewport, width, height);
                                ctx.lineTo(s.x, s.y);
                            }
                            ctx.stroke();
                        }
                    } else if (obj.type === 'ARC') {
                        const rc = rotatePoint(obj.center, baseP, rad);
                        const c = worldToScreen(rc.x, rc.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, obj.radius * viewport.zoom, -(obj.startAngle + rad), -(obj.endAngle + rad), true);
                        ctx.stroke();
                    } else if (obj.type === 'TEXT') {
                        const newPos = rotatePoint(obj.position, baseP, rad);
                        const newRot = (obj.rotation || 0) + rad * (180 / Math.PI);
                        renderText(ctx, { ...obj, position: newPos, rotation: newRot }, viewport, width, height, false);
                    } else if (obj.type === 'HATCH') {
                        const newBoundary = (obj.boundary || []).map(p => rotatePoint(p, baseP, rad));
                        const newAngle = ((obj.angle || 0) + rad * (180 / Math.PI)) % 360;
                        renderHatch(ctx, { ...obj, boundary: newBoundary, angle: newAngle }, viewport, width, height, false);
                    }
                });
            } else if (activeTool === 'mirror' && toolPoints.length === 1) {
                const p1 = toolPoints[0];
                const p2 = cursorWorld;

                const s1 = worldToScreen(p1.x, p1.y, viewport, width, height);
                const s2 = worldToScreen(p2.x, p2.y, viewport, width, height);
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();

                ctx.strokeStyle = '#f59e0b';
                const targets = selectedIds.length > 0 ? objects.filter(o => selectedIds.includes(o.id)) : objects;
                targets.forEach(obj => {
                    const mObj = mirrorObject(obj, p1, p2);
                    if (mObj.type === 'LINE') {
                        const ms1 = worldToScreen(mObj.start.x, mObj.start.y, viewport, width, height);
                        const ms2 = worldToScreen(mObj.end.x, mObj.end.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.moveTo(ms1.x, ms1.y);
                        ctx.lineTo(ms2.x, ms2.y);
                        ctx.stroke();
                    } else if (mObj.type === 'CIRCLE') {
                        const mc = worldToScreen(mObj.center.x, mObj.center.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(mc.x, mc.y, mObj.radius * viewport.zoom, 0, 2 * Math.PI);
                        ctx.stroke();
                    } else if (mObj.type === 'RECTANGLE') {
                        const mc1 = worldToScreen(mObj.x, mObj.y + mObj.height, viewport, width, height);
                        ctx.strokeRect(mc1.x, mc1.y, mObj.width * viewport.zoom, mObj.height * viewport.zoom);
                    } else if (mObj.type === 'POLYLINE') {
                        const pts = mObj.points || [];
                        if (pts.length > 0) {
                            ctx.beginPath();
                            const startS = worldToScreen(pts[0].x, pts[0].y, viewport, width, height);
                            ctx.moveTo(startS.x, startS.y);
                            for (let i = 1; i < pts.length; i++) {
                                const s = worldToScreen(pts[i].x, pts[i].y, viewport, width, height);
                                ctx.lineTo(s.x, s.y);
                            }
                            ctx.stroke();
                        }
                    } else if (mObj.type === 'ARC') {
                        const mc = worldToScreen(mObj.center.x, mObj.center.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(mc.x, mc.y, mObj.radius * viewport.zoom, -mObj.startAngle, -mObj.endAngle, true);
                        ctx.stroke();
                    } else if (mObj.type === 'HATCH') {
                        renderHatch(ctx, mObj, viewport, width, height, false);
                    }
                });
            }

            ctx.setLineDash([]);
        }

        // Live HATCH Preview when activeTool === 'hatch'
        if (activeTool === 'hatch') {
            const candRes = detectClosedRegion(cursorWorld, objects.filter(isObjectVisible));
            if (candRes.valid) {
                renderHatch(ctx, {
                    type: 'HATCH',
                    boundary: candRes.boundary,
                    pattern: hatchPattern,
                    angle: Number(hatchAngle) || 0,
                    scale: Number(hatchScale) || 10,
                    color: '#f59e0b'
                }, viewport, width, height, false);
            }
        }

        // Live OFFSET Preview
        if (activeTool === 'offset') {
            const targetObj = targetOffsetObjId
                ? objects.find(o => o.id === targetOffsetObjId)
                : (selectedIds.length > 0 ? objects.find(o => o.id === selectedIds[0]) : null);

            if (targetObj && offsetDistance > 0) {
                const offRes = offsetObject(targetObj, offsetDistance, cursorWorld);
                if (offRes.result) {
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 4]);

                    const oObj = offRes.result;
                    if (oObj.type === 'LINE') {
                        const s1 = worldToScreen(oObj.start.x, oObj.start.y, viewport, width, height);
                        const s2 = worldToScreen(oObj.end.x, oObj.end.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.moveTo(s1.x, s1.y);
                        ctx.lineTo(s2.x, s2.y);
                        ctx.stroke();
                    } else if (oObj.type === 'CIRCLE') {
                        const c = worldToScreen(oObj.center.x, oObj.center.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, oObj.radius * viewport.zoom, 0, 2 * Math.PI);
                        ctx.stroke();
                    } else if (oObj.type === 'RECTANGLE') {
                        const c1 = worldToScreen(oObj.x, oObj.y + oObj.height, viewport, width, height);
                        ctx.strokeRect(c1.x, c1.y, oObj.width * viewport.zoom, oObj.height * viewport.zoom);
                    } else if (oObj.type === 'POLYLINE') {
                        const pts = oObj.points || [];
                        if (pts.length > 0) {
                            ctx.beginPath();
                            const startS = worldToScreen(pts[0].x, pts[0].y, viewport, width, height);
                            ctx.moveTo(startS.x, startS.y);
                            for (let i = 1; i < pts.length; i++) {
                                const s = worldToScreen(pts[i].x, pts[i].y, viewport, width, height);
                                ctx.lineTo(s.x, s.y);
                            }
                            ctx.stroke();
                        }
                    } else if (oObj.type === 'ARC') {
                        const c = worldToScreen(oObj.center.x, oObj.center.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, oObj.radius * viewport.zoom, -oObj.startAngle, -oObj.endAngle, true);
                        ctx.stroke();
                    }
                    ctx.setLineDash([]);
                }
            }
        }

        // Live TRIM Preview
        if (activeTool === 'trim') {
            const cuttingEdges = selectedIds.length > 0
                ? objects.filter(o => selectedIds.includes(o.id))
                : objects;

            const worldTol = 10 / viewport.zoom;
            const hovered = objects.find(o => hitTestObject(o, cursorWorld, worldTol).hit);

            if (hovered) {
                const trimRes = trimObject(hovered, cursorWorld, cuttingEdges);
                if (trimRes.removedSegment) {
                    const rem = trimRes.removedSegment;
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([6, 4]);

                    if (rem.type === 'LINE') {
                        const s1 = worldToScreen(rem.start.x, rem.start.y, viewport, width, height);
                        const s2 = worldToScreen(rem.end.x, rem.end.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.moveTo(s1.x, s1.y);
                        ctx.lineTo(s2.x, s2.y);
                        ctx.stroke();
                    } else if (rem.type === 'ARC') {
                        const c = worldToScreen(rem.center.x, rem.center.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, rem.radius * viewport.zoom, -rem.startAngle, -rem.endAngle, true);
                        ctx.stroke();
                    }
                    ctx.setLineDash([]);
                }
            }
        }

        // Live EXTEND Preview
        if (activeTool === 'extend') {
            const boundaryObjects = selectedIds.length > 0
                ? objects.filter(o => selectedIds.includes(o.id))
                : objects;

            const worldTol = 10 / viewport.zoom;
            const hovered = objects.find(o => hitTestObject(o, cursorWorld, worldTol).hit);

            if (hovered) {
                const extRes = extendObject(hovered, cursorWorld, boundaryObjects);
                if (extRes.extendedSegment) {
                    const ext = extRes.extendedSegment;
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([5, 4]);

                    if (ext.type === 'LINE') {
                        const s1 = worldToScreen(ext.start.x, ext.start.y, viewport, width, height);
                        const s2 = worldToScreen(ext.end.x, ext.end.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.moveTo(s1.x, s1.y);
                        ctx.lineTo(s2.x, s2.y);
                        ctx.stroke();
                    } else if (ext.type === 'ARC') {
                        const c = worldToScreen(ext.center.x, ext.center.y, viewport, width, height);
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, ext.radius * viewport.zoom, -ext.startAngle, -ext.endAngle, true);
                        ctx.stroke();
                    }
                    ctx.setLineDash([]);
                }
            }
        }

        // Live FILLET Preview
        if (activeTool === 'fillet') {
            const worldTol = 10 / viewport.zoom;
            const hovered = objects.find(o => hitTestObject(o, cursorWorld, worldTol).hit);

            if (firstFilletSelection && hovered) {
                const fRes = filletObjects(firstFilletSelection.obj, firstFilletSelection.clickWorld, hovered, cursorWorld, filletRadius);
                if (fRes.previewArc) {
                    const arc = fRes.previewArc;
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([5, 4]);

                    const c = worldToScreen(arc.center.x, arc.center.y, viewport, width, height);
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, arc.radius * viewport.zoom, -arc.startAngle, -arc.endAngle, true);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            } else if (firstFilletSelection) {
                const fObj = firstFilletSelection.obj;
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3;
                if (fObj.type === 'LINE') {
                    const s1 = worldToScreen(fObj.start.x, fObj.start.y, viewport, width, height);
                    const s2 = worldToScreen(fObj.end.x, fObj.end.y, viewport, width, height);
                    ctx.beginPath();
                    ctx.moveTo(s1.x, s1.y);
                    ctx.lineTo(s2.x, s2.y);
                    ctx.stroke();
                }
            }
        }

        // Live CHAMFER Preview
        if (activeTool === 'chamfer') {
            const worldTol = 10 / viewport.zoom;
            const hovered = objects.find(o => hitTestObject(o, cursorWorld, worldTol).hit);

            if (firstChamferSelection && hovered) {
                const cRes = chamferObjects(firstChamferSelection.obj, firstChamferSelection.clickWorld, hovered, cursorWorld, chamferDist1, chamferDist2);
                if (cRes.previewLine) {
                    const line = cRes.previewLine;
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([5, 4]);

                    const s1 = worldToScreen(line.start.x, line.start.y, viewport, width, height);
                    const s2 = worldToScreen(line.end.x, line.end.y, viewport, width, height);
                    ctx.beginPath();
                    ctx.moveTo(s1.x, s1.y);
                    ctx.lineTo(s2.x, s2.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            } else if (firstChamferSelection) {
                const cObj = firstChamferSelection.obj;
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3;
                if (cObj.type === 'LINE') {
                    const s1 = worldToScreen(cObj.start.x, cObj.start.y, viewport, width, height);
                    const s2 = worldToScreen(cObj.end.x, cObj.end.y, viewport, width, height);
                    ctx.beginPath();
                    ctx.moveTo(s1.x, s1.y);
                    ctx.lineTo(s2.x, s2.y);
                    ctx.stroke();
                }
            }
        }

        // Live DIMENSION Preview
        if (activeTool === 'dim_linear') {
            if (toolPoints.length === 1) {
                const p0 = worldToScreen(toolPoints[0].x, toolPoints[0].y, viewport, width, height);
                const p1 = worldToScreen(cursorWorld.x, cursorWorld.y, viewport, width, height);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (toolPoints.length === 2) {
                const p1 = toolPoints[0];
                const p2 = toolPoints[1];
                const isVertical = Math.abs(p2.y - p1.y) > Math.abs(p2.x - p1.x);
                const offset = isVertical
                    ? cursorWorld.x - (p1.x + p2.x) / 2
                    : cursorWorld.y - (p1.y + p2.y) / 2;
                renderDimension(ctx, { type: 'LINEAR_DIMENSION', start: p1, end: p2, offset, isVertical }, viewport, width, height, false);
            }
        } else if (activeTool === 'dim_aligned') {
            if (toolPoints.length === 1) {
                const p0 = worldToScreen(toolPoints[0].x, toolPoints[0].y, viewport, width, height);
                const p1 = worldToScreen(cursorWorld.x, cursorWorld.y, viewport, width, height);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (toolPoints.length === 2) {
                const p1 = toolPoints[0];
                const p2 = toolPoints[1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const L = Math.hypot(dx, dy) || 1;
                const nx = -dy / L;
                const ny = dx / L;
                const vx = cursorWorld.x - p1.x;
                const vy = cursorWorld.y - p1.y;
                const offset = vx * nx + vy * ny;
                renderDimension(ctx, { type: 'ALIGNED_DIMENSION', start: p1, end: p2, offset }, viewport, width, height, false);
            }
        } else if (activeTool === 'dim_angular') {
            if (firstAngularSelection) {
                const fObj = firstAngularSelection;
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3;
                if (fObj.type === 'LINE') {
                    const s1 = worldToScreen(fObj.start.x, fObj.start.y, viewport, width, height);
                    const s2 = worldToScreen(fObj.end.x, fObj.end.y, viewport, width, height);
                    ctx.beginPath();
                    ctx.moveTo(s1.x, s1.y);
                    ctx.lineTo(s2.x, s2.y);
                    ctx.stroke();
                }
            }
            if (toolPoints.length === 2) {
                const center = toolPoints[0];
                const { startAngle, endAngle } = toolPoints[1];
                const radius = Math.hypot(cursorWorld.x - center.x, cursorWorld.y - center.y) || 40;
                renderDimension(ctx, { type: 'ANGULAR_DIMENSION', center, radius, startAngle, endAngle }, viewport, width, height, false);
            }
        } else if (activeTool === 'dim_radius') {
            const circle = targetRadiusCircle || (objects.find(obj => (obj.type === 'CIRCLE' || obj.type === 'ARC') && hitTestObject(obj, cursorWorld, 10 / viewport.zoom).hit));
            if (circle) {
                const angle = Math.atan2(cursorWorld.y - circle.center.y, cursorWorld.x - circle.center.x);
                renderDimension(ctx, { type: 'RADIUS_DIMENSION', geometryId: circle.id, center: circle.center, radius: circle.radius, angle }, viewport, width, height, false);
            }
        } else if (activeTool === 'dim_diameter') {
            const circle = targetDiameterCircle || (objects.find(obj => obj.type === 'CIRCLE' && hitTestObject(obj, cursorWorld, 10 / viewport.zoom).hit));
            if (circle) {
                const angle = Math.atan2(cursorWorld.y - circle.center.y, cursorWorld.x - circle.center.x);
                renderDimension(ctx, { type: 'DIAMETER_DIMENSION', geometryId: circle.id, center: circle.center, radius: circle.radius, angle }, viewport, width, height, false);
            }
        } else if (showTextModal && textModalPos && textModalContent.trim()) {
            renderText(ctx, {
                type: 'TEXT',
                text: textModalContent,
                position: textModalPos,
                height: Number(textModalHeight) || 25,
                rotation: Number(textModalRotation) || 0,
                color: '#f59e0b'
            }, viewport, width, height, false);
        } else if (activeTool === 'text' && !showTextModal) {
            const sPt = worldToScreen(cursorWorld.x, cursorWorld.y, viewport, width, height);
            ctx.font = '600 12px Outfit, sans-serif';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText('Click insertion point for text', sPt.x + 12, sPt.y - 12);
        }

        // ── MEASUREMENT LIVE PREVIEWS & RESULT GRAPHICS ──────────────────────
        if (activeTool === 'measure_distance') {
            if (toolPoints.length === 1) {
                const p1 = toolPoints[0];
                const p2 = cursorWorld;
                const s1 = worldToScreen(p1.x, p1.y, viewport, width, height);
                const s2 = worldToScreen(p2.x, p2.y, viewport, width, height);

                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 4]);

                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();

                const sProj = worldToScreen(p2.x, p1.y, viewport, width, height);
                ctx.strokeStyle = '#38bdf888';
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(sProj.x, sProj.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();

                ctx.setLineDash([]);
                drawGrip(ctx, s1);
                drawGrip(ctx, s2);

                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const dx = Math.abs(p2.x - p1.x);
                const dy = Math.abs(p2.y - p1.y);

                ctx.font = '600 12px Outfit, monospace, sans-serif';
                ctx.fillStyle = '#00f0ff';
                ctx.fillText(`Dist: ${formatMeasurement(dist)} (ΔX: ${formatMeasurement(dx)}, ΔY: ${formatMeasurement(dy)})`, s2.x + 14, s2.y - 14);
            }
        } else if (activeTool === 'measure_angle') {
            if (firstMeasureAngleLine) {
                const line = firstMeasureAngleLine;
                const s1 = worldToScreen(line.start.x, line.start.y, viewport, width, height);
                const s2 = worldToScreen(line.end.x, line.end.y, viewport, width, height);
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();

                const worldTol = 10 / viewport.zoom;
                const hoveredLine = objects.find(o => o.type === 'LINE' && o.id !== line.id && hitTestObject(o, cursorWorld, worldTol).hit);
                if (hoveredLine) {
                    const hs1 = worldToScreen(hoveredLine.start.x, hoveredLine.start.y, viewport, width, height);
                    const hs2 = worldToScreen(hoveredLine.end.x, hoveredLine.end.y, viewport, width, height);
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(hs1.x, hs1.y);
                    ctx.lineTo(hs2.x, hs2.y);
                    ctx.stroke();

                    const deg = calculateAngle2Lines(line, hoveredLine);
                    const sCursor = worldToScreen(cursorWorld.x, cursorWorld.y, viewport, width, height);
                    ctx.font = '700 12px Outfit, sans-serif';
                    ctx.fillStyle = '#00f0ff';
                    ctx.fillText(`Angle: ${formatMeasurement(deg, '°')}`, sCursor.x + 14, sCursor.y - 14);
                }
            } else if (toolPoints.length === 1) {
                const s1 = worldToScreen(toolPoints[0].x, toolPoints[0].y, viewport, width, height);
                const s2 = worldToScreen(cursorWorld.x, cursorWorld.y, viewport, width, height);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (toolPoints.length === 2) {
                const p1 = toolPoints[0];
                const vertex = toolPoints[1];
                const p2 = cursorWorld;

                const sv = worldToScreen(vertex.x, vertex.y, viewport, width, height);
                const s1 = worldToScreen(p1.x, p1.y, viewport, width, height);
                const s2 = worldToScreen(p2.x, p2.y, viewport, width, height);

                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(sv.x, sv.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();

                const deg = calculateAngle3Points(p1, vertex, p2);
                ctx.font = '700 12px Outfit, sans-serif';
                ctx.fillStyle = '#00f0ff';
                ctx.fillText(`Angle: ${formatMeasurement(deg, '°')}`, sv.x + 14, sv.y - 14);
            }
        } else if (activeTool === 'measure_radius') {
            const worldTol = 10 / viewport.zoom;
            const hitGeom = objects.find(o => (o.type === 'CIRCLE' || o.type === 'ARC') && hitTestObject(o, cursorWorld, worldTol).hit);
            if (hitGeom) {
                const cS = worldToScreen(hitGeom.center.x, hitGeom.center.y, viewport, width, height);
                const rPx = hitGeom.radius * viewport.zoom;

                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                if (hitGeom.type === 'CIRCLE') {
                    ctx.arc(cS.x, cS.y, rPx, 0, 2 * Math.PI);
                } else {
                    ctx.arc(cS.x, cS.y, rPx, -hitGeom.startAngle, -hitGeom.endAngle, true);
                }
                ctx.stroke();

                const sCursor = worldToScreen(cursorWorld.x, cursorWorld.y, viewport, width, height);
                ctx.font = '700 12px Outfit, sans-serif';
                ctx.fillStyle = '#00f0ff';
                ctx.fillText(`Radius: ${formatMeasurement(hitGeom.radius, 'mm')}`, sCursor.x + 14, sCursor.y - 14);
            }
        } else if (activeTool === 'measure_area') {
            const candArea = detectClosedRegion(cursorWorld, objects.filter(isObjectVisible));
            if (candArea.valid) {
                const screenPts = candArea.boundary.map(p => worldToScreen(p.x, p.y, viewport, width, height));
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(screenPts[0].x, screenPts[0].y);
                for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i].x, screenPts[i].y);
                ctx.closePath();

                ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
                ctx.fill();
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();

                const calc = calculatePolygonAreaAndPerimeter(candArea.boundary);
                const sCursor = worldToScreen(cursorWorld.x, cursorWorld.y, viewport, width, height);
                ctx.font = '700 12px Outfit, sans-serif';
                ctx.fillStyle = '#00f0ff';
                ctx.fillText(`Area: ${formatMeasurement(calc.area, 'mm²')} | Perim: ${formatMeasurement(calc.perimeter, 'mm')}`, sCursor.x + 14, sCursor.y - 14);
            }
        }

        // Render Persistent Result Overlay Graphics (if activeMeasurementResult set)
        if (activeMeasurementResult) {
            const res = activeMeasurementResult;
            if (res.type === 'DISTANCE' && res.p1 && res.p2) {
                const s1 = worldToScreen(res.p1.x, res.p1.y, viewport, width, height);
                const s2 = worldToScreen(res.p2.x, res.p2.y, viewport, width, height);
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();
                drawGrip(ctx, s1);
                drawGrip(ctx, s2);
            } else if (res.type === 'AREA' && res.boundary) {
                const screenPts = res.boundary.map(p => worldToScreen(p.x, p.y, viewport, width, height));
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(screenPts[0].x, screenPts[0].y);
                for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i].x, screenPts[i].y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
                ctx.fill();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.restore();
            } else if (res.type === 'RADIUS' && res.center) {
                const cS = worldToScreen(res.center.x, res.center.y, viewport, width, height);
                const rPx = res.radius * viewport.zoom;
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(cS.x, cS.y, rPx, 0, 2 * Math.PI);
                ctx.stroke();
                drawGrip(ctx, cS, true);
            } else if (res.type === 'ANGLE' && res.p1 && res.vertex && res.p2) {
                const sv = worldToScreen(res.vertex.x, res.vertex.y, viewport, width, height);
                const s1 = worldToScreen(res.p1.x, res.p1.y, viewport, width, height);
                const s2 = worldToScreen(res.p2.x, res.p2.y, viewport, width, height);
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(sv.x, sv.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();
                drawGrip(ctx, sv, true);
            }
        }

        // 5. Draw Window (Left->Right) vs Crossing (Right->Left) Selection Box
        if (selectionBox) {
            const { startScreen, currentScreen } = selectionBox;
            const left = Math.min(startScreen.x, currentScreen.x);
            const top = Math.min(startScreen.y, currentScreen.y);
            const w = Math.abs(currentScreen.x - startScreen.x);
            const h = Math.abs(currentScreen.y - startScreen.y);

            const isCrossing = currentScreen.x < startScreen.x;
            ctx.fillStyle = isCrossing ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)';
            ctx.strokeStyle = isCrossing ? '#10b981' : '#3b82f6';
            ctx.lineWidth = 1;
            if (isCrossing) ctx.setLineDash([5, 4]);

            ctx.fillRect(left, top, w, h);
            ctx.strokeRect(left, top, w, h);
            ctx.setLineDash([]);
        }

        // 6. Draw Fullscreen CAD Crosshair Cursor
        const cs = cursorScreen;
        if (cs.x >= 0 && cs.x <= width && cs.y >= 0 && cs.y <= height) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';

            // Fullscreen crosshair lines
            ctx.beginPath();
            ctx.moveTo(0, cs.y);
            ctx.lineTo(width, cs.y);
            ctx.moveTo(cs.x, 0);
            ctx.lineTo(cs.x, height);
            ctx.stroke();

            // Pickbox center square
            ctx.strokeStyle = '#38bdf8';
            ctx.strokeRect(cs.x - 4, cs.y - 4, 8, 8);
        }

        // 7. Draw OSnap Visual Indicators & Labels
        if (activeSnap && activeSnap.point) {
            const s = worldToScreen(activeSnap.point.x, activeSnap.point.y, viewport, width, height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#10b981';
            ctx.fillStyle = 'transparent';

            if (activeSnap.type === 'endpoint') {
                ctx.strokeRect(s.x - 6, s.y - 6, 12, 12);
            } else if (activeSnap.type === 'midpoint') {
                ctx.beginPath();
                ctx.moveTo(s.x, s.y - 7);
                ctx.lineTo(s.x - 7, s.y + 7);
                ctx.lineTo(s.x + 7, s.y + 7);
                ctx.closePath();
                ctx.stroke();
            } else if (activeSnap.type === 'center') {
                ctx.beginPath();
                ctx.arc(s.x, s.y, 7, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (activeSnap.type === 'intersection') {
                ctx.beginPath();
                ctx.moveTo(s.x - 6, s.y - 6);
                ctx.lineTo(s.x + 6, s.y + 6);
                ctx.moveTo(s.x + 6, s.y - 6);
                ctx.lineTo(s.x - 6, s.y + 6);
                ctx.stroke();
            } else if (activeSnap.type === 'perpendicular') {
                ctx.beginPath();
                ctx.moveTo(s.x - 6, s.y);
                ctx.lineTo(s.x, s.y);
                ctx.lineTo(s.x, s.y + 6);
                ctx.stroke();
            }

            // Snap Transient Label
            const snapLabelText = activeSnap.type.toUpperCase();
            ctx.font = 'bold 10px Outfit, monospace';
            ctx.fillStyle = '#10b981';
            ctx.fillText(snapLabelText, s.x + 10, s.y - 10);
        }
    }, [canvasRef, objects, selectedIds, viewport, gridEnabled, gridSpacing, toolPoints, cursorWorld, cursorScreen, activeTool, selectionBox, activeSnap, targetOffsetObjId, offsetDistance]);

    useEffect(() => {
        renderCanvas();
    }, [renderCanvas]);

    // Handle Resize
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current && canvasRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
                renderCanvas();
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [renderCanvas]);

    // ── MOUSE EVENT HANDLERS ──────────────────────────────────────────────
    const handleMouseMove = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const sX = e.clientX - rect.left;
        const sY = e.clientY - rect.top;

        setCursorScreen({ x: sX, y: sY });

        // Handle Pan
        if (isPanning) {
            const dx = sX - panStart.x;
            const dy = sY - panStart.y;
            setViewport(prev => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
            setPanStart({ x: sX, y: sY });
            return;
        }

        // Handle Selection Box
        if (selectionBox) {
            setSelectionBox(prev => ({ ...prev, currentScreen: { x: sX, y: sY } }));
            return;
        }

        // Compute World Position with Snap, Ortho, Angle Snap
        const c = canvasRef.current;
        const rawW = screenToWorld(sX, sY, viewport, c.width, c.height);
        const basePt = toolPoints.length > 0 ? toolPoints[toolPoints.length - 1] : null;

        const effectiveOrtho = orthoEnabled || shiftOrtho;

        const computed = computeSnapAndConstraints({
            rawWorld: rawW,
            screenPt: { x: sX, y: sY },
            viewport,
            canvasWidth: c.width,
            canvasHeight: c.height,
            objects: objects.filter(isObjectVisible),
            osnapEnabled,
            orthoEnabled: effectiveOrtho,
            angleEnabled,
            angleIncrement,
            snapEnabled,
            gridSpacing,
            basePoint: basePt
        });

        setCursorWorld({ x: computed.x, y: computed.y });
        setRawWorld(rawW);
        setActiveSnap(computed.activeSnap);
        setIsSnapped(computed.isSnapped);

        if (onCoordsChangeRef.current) {
            onCoordsChangeRef.current({
                x: computed.x,
                y: computed.y,
                activeSnap: computed.activeSnap,
                isSnapped: computed.isSnapped
            });
        }
    };

    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const sX = e.clientX - rect.left;
        const sY = e.clientY - rect.top;

        // Middle Mouse or Pan tool -> Start Pan
        if (e.button === 1 || activeTool === 'pan') {
            setIsPanning(true);
            setPanStart({ x: sX, y: sY });
            return;
        }

        if (e.button !== 0) return; // Left Click only

        const targetW = { x: cursorWorld.x, y: cursorWorld.y };

        // ── TOOL INTERACTIONS ──
        if (activeTool === 'select') {
            const worldTolerance = 8 / viewport.zoom;
            const candidates = [];

            objects.forEach(obj => {
                if (!isObjectVisible(obj)) return;
                const res = hitTestObject(obj, targetW, worldTolerance);
                if (res.hit) {
                    if (!isObjectEditable(obj)) {
                        setLayerErrorMsg('Layer is locked. Objects on locked layers cannot be selected or modified.');
                        setTimeout(() => setLayerErrorMsg(''), 4000);
                        return;
                    }
                    candidates.push({ id: obj.id, distance: res.distance });
                }
            });

            if (candidates.length > 0) {
                candidates.sort((a, b) => a.distance - b.distance);
                const closestId = candidates[0].id;

                if (e.shiftKey || e.ctrlKey) {
                    setSelectedIds(prev => prev.includes(closestId) ? prev.filter(i => i !== closestId) : [...prev, closestId]);
                } else {
                    setSelectedIds([closestId]);
                }
            } else {
                if (!e.shiftKey && !e.ctrlKey) {
                    setSelectedIds([]);
                }
                setSelectionBox({ startScreen: { x: sX, y: sY }, currentScreen: { x: sX, y: sY } });
            }
        } else if (activeTool === 'line') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else {
                const p0 = toolPoints[0];
                const newLine = {
                    id: 'line_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'LINE',
                    layerId: currentLayerId || 'layer_walls',
                    start: { x: p0.x, y: p0.y },
                    end: { x: targetW.x, y: targetW.y },
                    color: '#38bdf8'
                };
                commitObjects([...objects, newLine]);
                setToolPoints([targetW]);
            }
        } else if (activeTool === 'circle') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else {
                const center = toolPoints[0];
                const radius = distance(center, targetW);
                if (radius > 0) {
                    const newCircle = {
                        id: 'circle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        type: 'CIRCLE',
                        layerId: currentLayerId || 'layer_walls',
                        center: { x: center.x, y: center.y },
                        radius: Math.round(radius * 100) / 100,
                        color: '#38bdf8'
                    };
                    commitObjects([...objects, newCircle]);
                }
                setToolPoints([]);
            }
        } else if (activeTool === 'rectangle') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else {
                const c1 = toolPoints[0];
                const minX = Math.min(c1.x, targetW.x);
                const minY = Math.min(c1.y, targetW.y);
                const w = Math.abs(targetW.x - c1.x);
                const h = Math.abs(targetW.y - c1.y);
                if (w > 0 && h > 0) {
                    const newRect = {
                        id: 'rect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        type: 'RECTANGLE',
                        layerId: currentLayerId || 'layer_walls',
                        x: minX,
                        y: minY,
                        width: Math.round(w * 100) / 100,
                        height: Math.round(h * 100) / 100,
                        color: '#38bdf8'
                    };
                    commitObjects([...objects, newRect]);
                }
                setToolPoints([]);
            }
        } else if (activeTool === 'polyline') {
            setToolPoints(prev => [...prev, targetW]);
        } else if (activeTool === 'arc') {
            if (toolPoints.length < 2) {
                setToolPoints(prev => [...prev, targetW]);
            } else {
                const arcGeom = getThreePointArc(toolPoints[0], toolPoints[1], targetW);
                if (arcGeom) {
                    const newArc = {
                        id: 'arc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        type: 'ARC',
                        layerId: currentLayerId || 'layer_walls',
                        center: arcGeom.center,
                        radius: arcGeom.radius,
                        startAngle: arcGeom.startAngle,
                        endAngle: arcGeom.endAngle,
                        color: '#38bdf8'
                    };
                    commitObjects([...objects, newArc]);
                }
                setToolPoints([]);
            }
        } else if (activeTool === 'hatch') {
            const res = detectClosedRegion(targetW, objects.filter(isObjectVisible));
            if (res.valid) {
                const defaultHatchLayer = layers.find(l => l.id === 'layer_hatching' || l.name === 'Hatching')?.id || currentLayerId;
                const targetLayer = layers.find(l => l.id === defaultHatchLayer) || layers.find(l => l.id === currentLayerId);
                const layerColor = targetLayer?.color || '#a855f7';

                const newHatch = {
                    id: 'hatch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'HATCH',
                    boundary: res.boundary,
                    pattern: hatchPattern,
                    angle: Number(hatchAngle) || 0,
                    scale: Number(hatchScale) || 10,
                    layerId: defaultHatchLayer,
                    color: layerColor
                };
                commitObjects([...objects, newHatch]);
                setHatchStatusMsg('');
            } else {
                const msg = res.error || 'Boundary is not closed.';
                setHatchStatusMsg(msg);
                setTimeout(() => setHatchStatusMsg(''), 4000);
            }
        } else if (activeTool === 'move') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else {
                const baseP = toolPoints[0];
                const dx = targetW.x - baseP.x;
                const dy = targetW.y - baseP.y;

                const targets = selectedIds.length > 0 ? selectedIds : objects.map(o => o.id);
                const updated = objects.map(obj => {
                    if (!targets.includes(obj.id)) return obj;
                    if (obj.type === 'LINE') {
                        return { ...obj, start: { x: obj.start.x + dx, y: obj.start.y + dy }, end: { x: obj.end.x + dx, y: obj.end.y + dy } };
                    } else if (obj.type === 'CIRCLE') {
                        return { ...obj, center: { x: obj.center.x + dx, y: obj.center.y + dy } };
                    } else if (obj.type === 'RECTANGLE') {
                        return { ...obj, x: obj.x + dx, y: obj.y + dy };
                    } else if (obj.type === 'POLYLINE') {
                        return { ...obj, points: (obj.points || []).map(p => ({ x: p.x + dx, y: p.y + dy })) };
                    } else if (obj.type === 'ARC') {
                        return { ...obj, center: { x: obj.center.x + dx, y: obj.center.y + dy } };
                    } else if (obj.type === 'HATCH') {
                        return { ...obj, boundary: (obj.boundary || []).map(p => ({ x: Math.round((p.x + dx) * 100) / 100, y: Math.round((p.y + dy) * 100) / 100 })) };
                    }
                    return obj;
                });

                commitObjects(updated);
                setToolPoints([]);
                onSelectTool('select');
            }
        } else if (activeTool === 'copy') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else {
                const baseP = toolPoints[0];
                const dx = targetW.x - baseP.x;
                const dy = targetW.y - baseP.y;

                const targets = selectedIds.length > 0 ? objects.filter(o => selectedIds.includes(o.id)) : objects;
                const copies = targets.map(obj => {
                    const newId = obj.type.toLowerCase() + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
                    if (obj.type === 'LINE') {
                        return { ...obj, id: newId, start: { x: obj.start.x + dx, y: obj.start.y + dy }, end: { x: obj.end.x + dx, y: obj.end.y + dy } };
                    } else if (obj.type === 'CIRCLE') {
                        return { ...obj, id: newId, center: { x: obj.center.x + dx, y: obj.center.y + dy } };
                    } else if (obj.type === 'RECTANGLE') {
                        return { ...obj, id: newId, x: obj.x + dx, y: obj.y + dy };
                    } else if (obj.type === 'POLYLINE') {
                        return { ...obj, id: newId, points: (obj.points || []).map(p => ({ x: p.x + dx, y: p.y + dy })) };
                    } else if (obj.type === 'ARC') {
                        return { ...obj, id: newId, center: { x: obj.center.x + dx, y: obj.center.y + dy } };
                    } else if (obj.type === 'HATCH') {
                        return { ...obj, id: newId, boundary: (obj.boundary || []).map(p => ({ x: Math.round((p.x + dx) * 100) / 100, y: Math.round((p.y + dy) * 100) / 100 })) };
                    }
                    return { ...obj, id: newId };
                });

                commitObjects([...objects, ...copies]);
            }
        } else if (activeTool === 'rotate') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else {
                const baseP = toolPoints[0];
                const rad = angleRad(baseP, targetW);

                const targets = selectedIds.length > 0 ? selectedIds : objects.map(o => o.id);
                const updated = objects.map(obj => {
                    if (!targets.includes(obj.id)) return obj;
                    if (obj.type === 'LINE') {
                        return { ...obj, start: rotatePoint(obj.start, baseP, rad), end: rotatePoint(obj.end, baseP, rad) };
                    } else if (obj.type === 'CIRCLE') {
                        return { ...obj, center: rotatePoint(obj.center, baseP, rad) };
                    } else if (obj.type === 'RECTANGLE') {
                        const p1 = rotatePoint({ x: obj.x, y: obj.y }, baseP, rad);
                        const p2 = rotatePoint({ x: obj.x + obj.width, y: obj.y + obj.height }, baseP, rad);
                        return { ...obj, x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y) };
                    } else if (obj.type === 'POLYLINE') {
                        return { ...obj, points: (obj.points || []).map(p => rotatePoint(p, baseP, rad)) };
                    } else if (obj.type === 'ARC') {
                        return { ...obj, center: rotatePoint(obj.center, baseP, rad), startAngle: obj.startAngle + rad, endAngle: obj.endAngle + rad };
                    } else if (obj.type === 'HATCH') {
                        const newBoundary = (obj.boundary || []).map(p => rotatePoint(p, baseP, rad));
                        const newAngle = Math.round(((obj.angle || 0) + rad * (180 / Math.PI)) % 360);
                        return { ...obj, boundary: newBoundary, angle: newAngle < 0 ? newAngle + 360 : newAngle };
                    }
                    return obj;
                });

                commitObjects(updated);
                setToolPoints([]);
                onSelectTool('select');
            }
        } else if (activeTool === 'mirror') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else {
                const p1 = toolPoints[0];
                const p2 = targetW;
                const targetIds = selectedIds.length > 0 ? selectedIds : objects.map(o => o.id);
                if (targetIds.length > 0) {
                    setPendingMirrorData({ p1, p2, targetIds });
                    setShowDeleteSourceModal(true);
                } else {
                    setToolPoints([]);
                    onSelectTool('select');
                }
            }
        } else if (activeTool === 'offset') {
            const targetObj = targetOffsetObjId
                ? objects.find(o => o.id === targetOffsetObjId)
                : (selectedIds.length > 0 ? objects.find(o => o.id === selectedIds[0]) : null);

            if (!targetObj) {
                const worldTolerance = 8 / viewport.zoom;
                const hit = objects.find(obj => hitTestObject(obj, targetW, worldTolerance).hit);
                if (hit) {
                    setTargetOffsetObjId(hit.id);
                    setSelectedIds([hit.id]);
                }
            } else {
                const offRes = offsetObject(targetObj, offsetDistance, targetW);
                if (offRes.error) {
                    setOffsetErrorMsg(offRes.error);
                    setTimeout(() => setOffsetErrorMsg(''), 3500);
                } else if (offRes.result) {
                    commitObjects([...objects, offRes.result]);
                    // Remain in offset mode so user can click to place more offset copies!
                }
            }
        } else if (activeTool === 'trim') {
            const cuttingEdges = selectedIds.length > 0
                ? objects.filter(o => selectedIds.includes(o.id))
                : objects;

            const worldTol = 10 / viewport.zoom;
            const hit = objects.find(obj => hitTestObject(obj, targetW, worldTol).hit);
            if (hit) {
                const trimRes = trimObject(hit, targetW, cuttingEdges);
                if (trimRes.error) {
                    setTrimErrorMsg(trimRes.error);
                    setTimeout(() => setTrimErrorMsg(''), 3500);
                } else if (trimRes.resultObjects) {
                    const remainingOthers = objects.filter(o => o.id !== hit.id);
                    commitObjects([...remainingOthers, ...trimRes.resultObjects]);
                }
            }
        } else if (activeTool === 'extend') {
            const boundaryObjects = selectedIds.length > 0
                ? objects.filter(o => selectedIds.includes(o.id))
                : objects;

            const worldTol = 10 / viewport.zoom;
            const hit = objects.find(obj => hitTestObject(obj, targetW, worldTol).hit);
            if (hit) {
                const extRes = extendObject(hit, targetW, boundaryObjects);
                if (extRes.error) {
                    setExtendErrorMsg(extRes.error);
                    setTimeout(() => setExtendErrorMsg(''), 3500);
                } else if (extRes.result) {
                    const updated = objects.map(o => o.id === hit.id ? extRes.result : o);
                    commitObjects(updated);
                }
            }
        } else if (activeTool === 'fillet') {
            const worldTol = 10 / viewport.zoom;
            const hit = objects.find(obj => hitTestObject(obj, targetW, worldTol).hit);
            if (hit) {
                if (!firstFilletSelection) {
                    setFirstFilletSelection({ obj: hit, clickWorld: targetW });
                } else {
                    const fRes = filletObjects(firstFilletSelection.obj, firstFilletSelection.clickWorld, hit, targetW, filletRadius);
                    if (fRes.error) {
                        setFilletErrorMsg(fRes.error);
                        setTimeout(() => setFilletErrorMsg(''), 3500);
                        setFirstFilletSelection(null);
                    } else if (fRes.resultObjects) {
                        const idsToRemove = [firstFilletSelection.obj.id, hit.id];
                        const remaining = objects.filter(o => !idsToRemove.includes(o.id));
                        commitObjects([...remaining, ...fRes.resultObjects]);
                        setFirstFilletSelection(null);
                    }
                }
            }
        } else if (activeTool === 'chamfer') {
            const worldTol = 10 / viewport.zoom;
            const hit = objects.find(obj => hitTestObject(obj, targetW, worldTol).hit);
            if (hit) {
                if (!firstChamferSelection) {
                    setFirstChamferSelection({ obj: hit, clickWorld: targetW });
                } else {
                    const cRes = chamferObjects(firstChamferSelection.obj, firstChamferSelection.clickWorld, hit, targetW, chamferDist1, chamferDist2);
                    if (cRes.error) {
                        setChamferErrorMsg(cRes.error);
                        setTimeout(() => setChamferErrorMsg(''), 3500);
                        setFirstChamferSelection(null);
                    } else if (cRes.resultObjects) {
                        const idsToRemove = [firstChamferSelection.obj.id, hit.id];
                        const remaining = objects.filter(o => !idsToRemove.includes(o.id));
                        commitObjects([...remaining, ...cRes.resultObjects]);
                        setFirstChamferSelection(null);
                    }
                }
            }
        } else if (activeTool === 'delete') {
            if (selectedIds.length > 0) {
                commitObjects(objects.filter(o => !selectedIds.includes(o.id)));
                setSelectedIds([]);
                onSelectTool('select');
            } else {
                const worldTolerance = 8 / viewport.zoom;
                const hit = objects.find(obj => hitTestObject(obj, targetW, worldTolerance).hit);
                if (hit) {
                    commitObjects(objects.filter(o => o.id !== hit.id));
                    onSelectTool('select');
                }
            }
        } else if (activeTool === 'dim_linear') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else if (toolPoints.length === 1) {
                setToolPoints([toolPoints[0], targetW]);
            } else {
                const p1 = toolPoints[0];
                const p2 = toolPoints[1];
                const isVertical = Math.abs(p2.y - p1.y) > Math.abs(p2.x - p1.x);
                const offset = isVertical
                    ? Math.round((targetW.x - (p1.x + p2.x) / 2) * 100) / 100
                    : Math.round((targetW.y - (p1.y + p2.y) / 2) * 100) / 100;

                const newDim = {
                    id: 'dim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'LINEAR_DIMENSION',
                    layerId: currentLayerId || 'layer_dimensions',
                    start: { x: p1.x, y: p1.y },
                    end: { x: p2.x, y: p2.y },
                    isVertical,
                    offset,
                    color: '#38bdf8'
                };
                commitObjects([...objects, newDim]);
                setToolPoints([]);
                onSelectTool('select');
            }
        } else if (activeTool === 'dim_aligned') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else if (toolPoints.length === 1) {
                setToolPoints([toolPoints[0], targetW]);
            } else {
                const p1 = toolPoints[0];
                const p2 = toolPoints[1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const L = Math.hypot(dx, dy) || 1;
                const nx = -dy / L;
                const ny = dx / L;
                const vx = targetW.x - p1.x;
                const vy = targetW.y - p1.y;
                const offset = Math.round((vx * nx + vy * ny) * 100) / 100;

                const newDim = {
                    id: 'dim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'ALIGNED_DIMENSION',
                    layerId: currentLayerId || 'layer_dimensions',
                    start: { x: p1.x, y: p1.y },
                    end: { x: p2.x, y: p2.y },
                    offset,
                    color: '#38bdf8'
                };
                commitObjects([...objects, newDim]);
                setToolPoints([]);
                onSelectTool('select');
            }
        } else if (activeTool === 'dim_angular') {
            const worldTol = 10 / viewport.zoom;
            if (!firstAngularSelection) {
                const hit = objects.find(obj => (obj.type === 'LINE' || obj.type === 'POLYLINE') && hitTestObject(obj, targetW, worldTol).hit);
                if (hit) {
                    setFirstAngularSelection(hit);
                }
            } else if (toolPoints.length < 2) {
                const hit = objects.find(obj => (obj.type === 'LINE' || obj.type === 'POLYLINE') && obj.id !== firstAngularSelection.id && hitTestObject(obj, targetW, worldTol).hit);
                if (hit) {
                    const p1Start = firstAngularSelection.start || (firstAngularSelection.points && firstAngularSelection.points[0]);
                    const p1End = firstAngularSelection.end || (firstAngularSelection.points && firstAngularSelection.points[1]);
                    const p2Start = hit.start || (hit.points && hit.points[0]);
                    const p2End = hit.end || (hit.points && hit.points[1]);

                    if (p1Start && p1End && p2Start && p2End) {
                        const d12x = p1End.x - p1Start.x;
                        const d12y = p1End.y - p1Start.y;
                        const d34x = p2End.x - p2Start.x;
                        const d34y = p2End.y - p2Start.y;
                        const denom = d12x * d34y - d12y * d34x;

                        let inter = { x: p1Start.x, y: p1Start.y };
                        if (Math.abs(denom) >= 1e-6) {
                            const t1 = ((p2Start.x - p1Start.x) * d34y - (p2Start.y - p1Start.y) * d34x) / denom;
                            inter = {
                                x: Math.round((p1Start.x + t1 * d12x) * 100) / 100,
                                y: Math.round((p1Start.y + t1 * d12y) * 100) / 100
                            };
                        }

                        const a1 = Math.atan2(p1End.y - inter.y, p1End.x - inter.x);
                        const a2 = Math.atan2(p2End.y - inter.y, p2End.x - inter.x);
                        setToolPoints([inter, { startAngle: a1, endAngle: a2 }]);
                    }
                }
            } else {
                const center = toolPoints[0];
                const { startAngle, endAngle } = toolPoints[1];
                const r = Math.hypot(targetW.x - center.x, targetW.y - center.y) || 40;
                const newDim = {
                    id: 'dim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'ANGULAR_DIMENSION',
                    layerId: currentLayerId || 'layer_dimensions',
                    center: { x: center.x, y: center.y },
                    radius: Math.round(r * 100) / 100,
                    startAngle,
                    endAngle,
                    color: '#38bdf8'
                };
                commitObjects([...objects, newDim]);
                setFirstAngularSelection(null);
                setToolPoints([]);
                onSelectTool('select');
            }
        } else if (activeTool === 'dim_radius') {
            const worldTol = 10 / viewport.zoom;
            if (!targetRadiusCircle) {
                const hit = objects.find(obj => (obj.type === 'CIRCLE' || obj.type === 'ARC') && hitTestObject(obj, targetW, worldTol).hit);
                if (hit) {
                    setTargetRadiusCircle(hit);
                }
            } else {
                const angle = Math.atan2(targetW.y - targetRadiusCircle.center.y, targetW.x - targetRadiusCircle.center.x);
                const newDim = {
                    id: 'dim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'RADIUS_DIMENSION',
                    layerId: currentLayerId || 'layer_dimensions',
                    geometryId: targetRadiusCircle.id,
                    center: { ...targetRadiusCircle.center },
                    radius: targetRadiusCircle.radius,
                    angle: Math.round(angle * 1000) / 1000,
                    color: '#38bdf8'
                };
                commitObjects([...objects, newDim]);
                setTargetRadiusCircle(null);
                onSelectTool('select');
            }
        } else if (activeTool === 'dim_diameter') {
            const worldTol = 10 / viewport.zoom;
            if (!targetDiameterCircle) {
                const hit = objects.find(obj => obj.type === 'CIRCLE' && hitTestObject(obj, targetW, worldTol).hit);
                if (hit) {
                    setTargetDiameterCircle(hit);
                }
            } else {
                const angle = Math.atan2(targetW.y - targetDiameterCircle.center.y, targetW.x - targetDiameterCircle.center.x);
                const newDim = {
                    id: 'dim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'DIAMETER_DIMENSION',
                    layerId: currentLayerId || 'layer_dimensions',
                    geometryId: targetDiameterCircle.id,
                    center: { ...targetDiameterCircle.center },
                    radius: targetDiameterCircle.radius,
                    angle: Math.round(angle * 1000) / 1000,
                    color: '#38bdf8'
                };
                commitObjects([...objects, newDim]);
                setTargetDiameterCircle(null);
                onSelectTool('select');
            }
        } else if (activeTool === 'text') {
            const pos = { ...targetW };
            setTextModalPos(pos);
            setEditingTextObj(null);
            setTextModalContent('');
            setTextModalHeight(25);
            setTextModalRotation(0);
            setShowTextModal(true);
        } else if (activeTool === 'measure_distance') {
            if (toolPoints.length === 0) {
                setToolPoints([targetW]);
            } else {
                const p1 = toolPoints[0];
                const p2 = targetW;
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const dx = Math.abs(p2.x - p1.x);
                const dy = Math.abs(p2.y - p1.y);

                setActiveMeasurementResult({
                    type: 'DISTANCE',
                    p1,
                    p2,
                    distance: dist,
                    dx,
                    dy
                });
                setToolPoints([]);
            }
        } else if (activeTool === 'measure_angle') {
            const worldTol = 10 / viewport.zoom;
            const clickedLine = objects.find(o => o.type === 'LINE' && isObjectVisible(o) && hitTestObject(o, targetW, worldTol).hit);

            if (clickedLine) {
                if (!firstMeasureAngleLine) {
                    setFirstMeasureAngleLine(clickedLine);
                } else if (firstMeasureAngleLine.id !== clickedLine.id) {
                    const deg = calculateAngle2Lines(firstMeasureAngleLine, clickedLine);
                    setActiveMeasurementResult({
                        type: 'ANGLE',
                        angle: deg,
                        p1: firstMeasureAngleLine.start,
                        vertex: firstMeasureAngleLine.end,
                        p2: clickedLine.start
                    });
                    setFirstMeasureAngleLine(null);
                }
            } else {
                if (toolPoints.length === 0) {
                    setToolPoints([targetW]);
                } else if (toolPoints.length === 1) {
                    setToolPoints([toolPoints[0], targetW]);
                } else {
                    const deg = calculateAngle3Points(toolPoints[0], toolPoints[1], targetW);
                    setActiveMeasurementResult({
                        type: 'ANGLE',
                        angle: deg,
                        p1: toolPoints[0],
                        vertex: toolPoints[1],
                        p2: targetW
                    });
                    setToolPoints([]);
                }
            }
        } else if (activeTool === 'measure_radius') {
            const worldTol = 10 / viewport.zoom;
            const hitGeom = objects.find(o => (o.type === 'CIRCLE' || o.type === 'ARC') && isObjectVisible(o) && hitTestObject(o, targetW, worldTol).hit);
            if (hitGeom) {
                setActiveMeasurementResult({
                    type: 'RADIUS',
                    radius: hitGeom.radius,
                    center: hitGeom.center,
                    geomType: hitGeom.type,
                    geometryId: hitGeom.id
                });
                setMeasureStatusMsg('');
            } else {
                setMeasureStatusMsg('Please select a circle or arc.');
                setTimeout(() => setMeasureStatusMsg(''), 3500);
            }
        } else if (activeTool === 'measure_area') {
            const res = detectClosedRegion(targetW, objects.filter(isObjectVisible));
            if (res.valid) {
                const calc = calculatePolygonAreaAndPerimeter(res.boundary);
                setActiveMeasurementResult({
                    type: 'AREA',
                    area: calc.area,
                    perimeter: calc.perimeter,
                    boundary: res.boundary
                });
                setMeasureStatusMsg('');
            } else {
                const msg = res.error ? `Cannot measure area: ${res.error.toLowerCase()}` : 'Cannot measure area: boundary is not closed.';
                setMeasureStatusMsg(msg);
                setTimeout(() => setMeasureStatusMsg(''), 4000);
            }
        }
    };

    const handleMouseUp = (e) => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        if (selectionBox) {
            const c = canvasRef.current;
            const { startScreen, currentScreen } = selectionBox;
            const wStart = screenToWorld(startScreen.x, startScreen.y, viewport, c.width, c.height);
            const wCurr = screenToWorld(currentScreen.x, currentScreen.y, viewport, c.width, c.height);

            const box = {
                minX: Math.min(wStart.x, wCurr.x),
                maxX: Math.max(wStart.x, wCurr.x),
                minY: Math.min(wStart.y, wCurr.y),
                maxY: Math.max(wStart.y, wCurr.y)
            };

            const isCrossing = currentScreen.x < startScreen.x;
            const newlySelected = objects.filter(obj => {
                if (!isObjectEditable(obj)) return false;
                return isCrossing ? isObjectCrossingBox(obj, box) : isObjectInsideBox(obj, box);
            }).map(o => o.id);

            setSelectedIds(prev => {
                if (e.shiftKey || e.ctrlKey) {
                    const set = new Set([...prev, ...newlySelected]);
                    return Array.from(set);
                }
                return newlySelected;
            });
            setSelectionBox(null);
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        if (activeTool === 'polyline' && toolPoints.length > 1) {
            const newPoly = {
                id: 'poly_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                type: 'POLYLINE',
                layerId: currentLayerId || 'layer_walls',
                points: toolPoints,
                color: '#38bdf8'
            };
            commitObjects([...objects, newPoly]);
            setToolPoints([]);
        } else if ((activeTool === 'copy' || activeTool === 'mirror') && toolPoints.length > 0) {
            setToolPoints([]);
            setShowDeleteSourceModal(false);
            setPendingMirrorData(null);
            onSelectTool('select');
        } else if (activeTool === 'offset') {
            setTargetOffsetObjId(null);
            onSelectTool('select');
        } else {
            setToolPoints([]);
            setSelectedIds([]);
            setShowDeleteSourceModal(false);
            setPendingMirrorData(null);
            setTargetOffsetObjId(null);
            onSelectTool('select');
        }
    };

    const handleDoubleClick = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const sX = e.clientX - rect.left;
        const sY = e.clientY - rect.top;
        const c = canvasRef.current;
        const targetW = screenToWorld(sX, sY, viewport, c.width, c.height);
        const worldTolerance = 12 / viewport.zoom;

        const clickedText = objects.find(obj => obj.type === 'TEXT' && hitTestObject(obj, targetW, worldTolerance).hit);
        if (clickedText) {
            setEditingTextObj(clickedText);
            setTextModalPos(clickedText.position);
            setTextModalContent(clickedText.text || '');
            setTextModalHeight(clickedText.height || 25);
            setTextModalRotation(clickedText.rotation || 0);
            setShowTextModal(true);
        }
    };

    const handleConfirmTextModal = (e) => {
        if (e) e.preventDefault();
        if (!textModalContent.trim()) return;

        const textVal = textModalContent.trim();
        const hVal = Number(textModalHeight) || 25;
        const rVal = Number(textModalRotation) || 0;

        if (editingTextObj) {
            const updated = objects.map(o => o.id === editingTextObj.id ? {
                ...o,
                text: textVal,
                height: hVal,
                rotation: rVal
            } : o);
            commitObjects(updated);
        } else if (textModalPos) {
            const newTextObj = {
                id: 'text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                type: 'TEXT',
                layerId: currentLayerId || 'layer_text',
                text: textVal,
                position: { x: textModalPos.x, y: textModalPos.y },
                height: hVal,
                rotation: rVal,
                color: '#38bdf8'
            };
            commitObjects([...objects, newTextObj]);
        }

        setShowTextModal(false);
        setEditingTextObj(null);
        setTextModalPos(null);
        onSelectTool('select');
    };

    // Zoom Centered at Cursor Location
    const handleWheel = (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setViewport(prev => {
            const newZoom = Math.min(Math.max(prev.zoom * zoomFactor, 0.05), 30);
            const panX = mouseX - (mouseX - prev.panX) * (newZoom / prev.zoom);
            const panY = mouseY - (mouseY - prev.panY) * (newZoom / prev.zoom);
            return { zoom: newZoom, panX, panY };
        });
    };

    // Keyboard Shortcuts: Ctrl+A (Select All), ESC, Delete, Shift Ortho
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Shift') {
                setShiftOrtho(true);
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                setSelectedIds(objects.map(o => o.id));
            } else if (e.key === 'Escape') {
                setToolPoints([]);
                setSelectionBox(null);
                setShowNumInput(false);
                setNumInput('');
                setShowDeleteSourceModal(false);
                setPendingMirrorData(null);
                setTargetOffsetObjId(null);
                setFirstMeasureAngleLine(null);
                setActiveMeasurementResult(null);
                setMeasureStatusMsg('');
                if (activeTool !== 'select') {
                    onSelectTool('select');
                } else {
                    setSelectedIds([]);
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (!showNumInput && !showDeleteSourceModal && selectedIds.length > 0) {
                    commitObjects(objects.filter(o => !selectedIds.includes(o.id)));
                    setSelectedIds([]);
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
            } else if (e.key === 'Enter') {
                if (showDeleteSourceModal) {
                    e.preventDefault();
                    handleConfirmMirror(false); // Default is NO!
                } else if (showNumInput) {
                    handleNumInputSubmitForm();
                } else if (activeTool === 'polyline' && toolPoints.length > 1) {
                    const newPoly = {
                        id: 'poly_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        type: 'POLYLINE',
                        layerId: currentLayerId || 'layer_walls',
                        points: toolPoints,
                        color: '#38bdf8'
                    };
                    commitObjects([...objects, newPoly]);
                    setToolPoints([]);
                } else if ((activeTool === 'copy' || activeTool === 'offset') && (toolPoints.length > 0 || targetOffsetObjId)) {
                    setToolPoints([]);
                    setTargetOffsetObjId(null);
                    onSelectTool('select');
                }
            } else if (toolPoints.length > 0 || activeTool === 'line' || activeTool === 'circle' || activeTool === 'rectangle' || activeTool === 'move' || activeTool === 'copy' || activeTool === 'rotate' || activeTool === 'mirror' || activeTool === 'offset' || activeTool === 'fillet' || activeTool === 'chamfer') {
                if (/^[0-9<.,\-]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    setShowNumInput(true);
                    setNumInput(prev => prev + e.key);
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'Shift') {
                setShiftOrtho(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [activeTool, toolPoints, selectedIds, objects, showNumInput, showDeleteSourceModal, targetOffsetObjId, handleConfirmMirror, commitObjects, onSelectTool, handleUndo, handleRedo]);

    // Handle Precision Numeric Input Submission
    const handleNumInputSubmitForm = (e) => {
        if (e) e.preventDefault();
        const parsed = parseCadInput(numInput);
        setShowNumInput(false);
        setNumInput('');

        if (!parsed) return;

        if (activeTool === 'offset') {
            let distVal = 0;
            if (parsed.type === 'distance') distVal = parsed.value;
            if (parsed.type === 'polar') distVal = parsed.length;
            if (parsed.type === 'cartesian') distVal = Math.abs(parsed.x || parsed.y);

            if (distVal > 0) {
                setOffsetDistance(distVal);
            }
            return;
        }

        if (activeTool === 'fillet') {
            let rVal = 0;
            if (parsed.type === 'distance') rVal = parsed.value;
            if (parsed.type === 'polar') rVal = parsed.length;
            if (parsed.type === 'cartesian') rVal = Math.abs(parsed.x || parsed.y);

            if (rVal > 0) {
                setFilletRadius(rVal);
            }
            return;
        }

        if (activeTool === 'chamfer') {
            let dVal = 0;
            if (parsed.type === 'distance') dVal = parsed.value;
            if (parsed.type === 'polar') dVal = parsed.length;
            if (parsed.type === 'cartesian') dVal = Math.abs(parsed.x || parsed.y);

            if (dVal > 0) {
                setChamferDist1(dVal);
                setChamferDist2(dVal);
            }
            return;
        }

        if (activeTool === 'line' && toolPoints.length === 1) {
            const p0 = toolPoints[0];
            let endPt = null;

            if (parsed.type === 'polar') {
                const rad = parsed.angleDeg * (Math.PI / 180);
                endPt = { x: p0.x + parsed.length * Math.cos(rad), y: p0.y + parsed.length * Math.sin(rad) };
            } else if (parsed.type === 'cartesian') {
                endPt = { x: parsed.x, y: parsed.y };
            } else if (parsed.type === 'distance') {
                const angle = angleRad(p0, cursorWorld);
                endPt = { x: p0.x + parsed.value * Math.cos(angle), y: p0.y + parsed.value * Math.sin(angle) };
            }

            if (endPt) {
                const newLine = {
                    id: 'line_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'LINE',
                    layerId: currentLayerId || 'layer_walls',
                    start: { x: p0.x, y: p0.y },
                    end: { x: Math.round(endPt.x * 100) / 100, y: Math.round(endPt.y * 100) / 100 },
                    color: '#38bdf8'
                };
                commitObjects([...objects, newLine]);
                setToolPoints([endPt]);
            }
        } else if (activeTool === 'circle' && toolPoints.length === 1) {
            const center = toolPoints[0];
            let r = 0;
            if (parsed.type === 'distance') r = parsed.value;
            if (parsed.type === 'polar') r = parsed.length;

            if (r > 0) {
                const newCircle = {
                    id: 'circle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'CIRCLE',
                    layerId: currentLayerId || 'layer_walls',
                    center: { x: center.x, y: center.y },
                    radius: r,
                    color: '#38bdf8'
                };
                commitObjects([...objects, newCircle]);
                setToolPoints([]);
            }
        } else if (activeTool === 'rectangle' && toolPoints.length === 1) {
            const c1 = toolPoints[0];
            let w = 0, h = 0;
            if (parsed.type === 'cartesian') {
                w = Math.abs(parsed.x);
                h = Math.abs(parsed.y);
            } else if (parsed.type === 'distance') {
                w = parsed.value;
                h = parsed.value;
            }

            if (w > 0 && h > 0) {
                const newRect = {
                    id: 'rect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    type: 'RECTANGLE',
                    layerId: currentLayerId || 'layer_walls',
                    x: c1.x,
                    y: c1.y,
                    width: w,
                    height: h,
                    color: '#38bdf8'
                };
                commitObjects([...objects, newRect]);
                setToolPoints([]);
            }
        } else if ((activeTool === 'move' || activeTool === 'copy') && toolPoints.length === 1) {
            const baseP = toolPoints[0];
            let dx = 0, dy = 0;
            if (parsed.type === 'cartesian') {
                dx = parsed.x;
                dy = parsed.y;
            } else if (parsed.type === 'polar') {
                const rad = parsed.angleDeg * (Math.PI / 180);
                dx = parsed.length * Math.cos(rad);
                dy = parsed.length * Math.sin(rad);
            } else if (parsed.type === 'distance') {
                const angle = angleRad(baseP, cursorWorld);
                dx = parsed.value * Math.cos(angle);
                dy = parsed.value * Math.sin(angle);
            }

            const targets = selectedIds.length > 0 ? objects.filter(o => selectedIds.includes(o.id)) : objects;

            if (activeTool === 'move') {
                const updated = objects.map(obj => {
                    if (!targets.some(t => t.id === obj.id)) return obj;
                    if (obj.type === 'LINE') {
                        return { ...obj, start: { x: obj.start.x + dx, y: obj.start.y + dy }, end: { x: obj.end.x + dx, y: obj.end.y + dy } };
                    } else if (obj.type === 'CIRCLE') {
                        return { ...obj, center: { x: obj.center.x + dx, y: obj.center.y + dy } };
                    } else if (obj.type === 'RECTANGLE') {
                        return { ...obj, x: obj.x + dx, y: obj.y + dy };
                    } else if (obj.type === 'POLYLINE') {
                        return { ...obj, points: (obj.points || []).map(p => ({ x: p.x + dx, y: p.y + dy })) };
                    } else if (obj.type === 'ARC') {
                        return { ...obj, center: { x: obj.center.x + dx, y: obj.center.y + dy } };
                    }
                    return obj;
                });
                commitObjects(updated);
                setToolPoints([]);
                onSelectTool('select');
            } else {
                const copies = targets.map(obj => {
                    const newId = obj.type.toLowerCase() + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
                    if (obj.type === 'LINE') {
                        return { ...obj, id: newId, start: { x: obj.start.x + dx, y: obj.start.y + dy }, end: { x: obj.end.x + dx, y: obj.end.y + dy } };
                    } else if (obj.type === 'CIRCLE') {
                        return { ...obj, id: newId, center: { x: obj.center.x + dx, y: obj.center.y + dy } };
                    } else if (obj.type === 'RECTANGLE') {
                        return { ...obj, id: newId, x: obj.x + dx, y: obj.y + dy };
                    } else if (obj.type === 'POLYLINE') {
                        return { ...obj, id: newId, points: (obj.points || []).map(p => ({ x: p.x + dx, y: p.y + dy })) };
                    } else if (obj.type === 'ARC') {
                        return { ...obj, id: newId, center: { x: obj.center.x + dx, y: obj.center.y + dy } };
                    }
                    return { ...obj, id: newId };
                });
                commitObjects([...objects, ...copies]);
            }
        } else if (activeTool === 'rotate' && toolPoints.length === 1) {
            const baseP = toolPoints[0];
            let rad = 0;
            if (parsed.type === 'distance') rad = parsed.value * (Math.PI / 180);
            if (parsed.type === 'polar') rad = parsed.angleDeg * (Math.PI / 180);

            const targets = selectedIds.length > 0 ? selectedIds : objects.map(o => o.id);
            const updated = objects.map(obj => {
                if (!targets.includes(obj.id)) return obj;
                if (obj.type === 'LINE') {
                    return { ...obj, start: rotatePoint(obj.start, baseP, rad), end: rotatePoint(obj.end, baseP, rad) };
                } else if (obj.type === 'CIRCLE') {
                    return { ...obj, center: rotatePoint(obj.center, baseP, rad) };
                } else if (obj.type === 'RECTANGLE') {
                    const p1 = rotatePoint({ x: obj.x, y: obj.y }, baseP, rad);
                    const p2 = rotatePoint({ x: obj.x + obj.width, y: obj.y + obj.height }, baseP, rad);
                    return { ...obj, x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y) };
                } else if (obj.type === 'POLYLINE') {
                    return { ...obj, points: (obj.points || []).map(p => rotatePoint(p, baseP, rad)) };
                } else if (obj.type === 'ARC') {
                    return { ...obj, center: rotatePoint(obj.center, baseP, rad), startAngle: obj.startAngle + rad, endAngle: obj.endAngle + rad };
                }
                return obj;
            });

            commitObjects(updated);
            setToolPoints([]);
            onSelectTool('select');
        } else if (activeTool === 'mirror' && toolPoints.length === 1) {
            let p2 = cursorWorld;
            if (parsed.type === 'cartesian') {
                p2 = { x: parsed.x, y: parsed.y };
            } else if (parsed.type === 'polar') {
                const rad = parsed.angleDeg * (Math.PI / 180);
                p2 = { x: toolPoints[0].x + parsed.length * Math.cos(rad), y: toolPoints[0].y + parsed.length * Math.sin(rad) };
            }
            const p1 = toolPoints[0];
            const targetIds = selectedIds.length > 0 ? selectedIds : objects.map(o => o.id);
            if (targetIds.length > 0) {
                setPendingMirrorData({ p1, p2, targetIds });
                setShowDeleteSourceModal(true);
            }
        }
    };

    // Calculate Live Dynamic Overlay Tooltip Text
    let overlayText = '';
    if (toolPoints.length > 0) {
        if (activeTool === 'line' || activeTool === 'polyline') {
            const baseP = toolPoints[toolPoints.length - 1];
            const len = distance(baseP, cursorWorld).toFixed(2);
            const deg = angleDeg(baseP, cursorWorld).toFixed(1);
            overlayText = `Length: ${len} mm  |  Angle: ${deg}°`;
        } else if (activeTool === 'circle') {
            const r = distance(toolPoints[0], cursorWorld).toFixed(2);
            const d = (r * 2).toFixed(2);
            overlayText = `Radius: ${r} mm  |  Dia: ${d} mm`;
        } else if (activeTool === 'rectangle') {
            const w = Math.abs(cursorWorld.x - toolPoints[0].x).toFixed(2);
            const h = Math.abs(cursorWorld.y - toolPoints[0].y).toFixed(2);
            overlayText = `Width: ${w} mm  |  Height: ${h} mm`;
        } else if (activeTool === 'move' || activeTool === 'copy') {
            const baseP = toolPoints[0];
            const dx = (cursorWorld.x - baseP.x).toFixed(2);
            const dy = (cursorWorld.y - baseP.y).toFixed(2);
            const dist = distance(baseP, cursorWorld).toFixed(2);
            overlayText = `ΔX: ${dx} mm, ΔY: ${dy} mm  |  Dist: ${dist} mm`;
        } else if (activeTool === 'rotate') {
            const baseP = toolPoints[0];
            const deg = angleDeg(baseP, cursorWorld).toFixed(1);
            overlayText = `Rotation Angle: ${deg}°`;
        } else if (activeTool === 'mirror') {
            if (toolPoints.length === 0) {
                overlayText = `MIRROR: Specify first point of mirror line`;
            } else {
                const baseP = toolPoints[0];
                const len = distance(baseP, cursorWorld).toFixed(2);
                const deg = angleDeg(baseP, cursorWorld).toFixed(1);
                overlayText = `MIRROR Line: Length ${len} mm  |  Angle: ${deg}°`;
            }
        }
    } else if (activeTool === 'mirror') {
        overlayText = `MIRROR: Specify first point of mirror line`;
    } else if (activeTool === 'offset') {
        const targetObj = targetOffsetObjId
            ? objects.find(o => o.id === targetOffsetObjId)
            : (selectedIds.length > 0 ? objects.find(o => o.id === selectedIds[0]) : null);

        if (!targetObj) {
            overlayText = `OFFSET: Select object to offset`;
        } else {
            overlayText = `OFFSET: ${offsetDistance} mm — Click side to place (Type distance to change)`;
        }
    } else if (activeTool === 'text') {
        overlayText = showTextModal ? 'TEXT: Enter text & properties' : 'TEXT: Click insertion point on drawing';
    } else if (activeTool === 'select' && selectedIds.length > 0) {
        overlayText = `${selectedIds.length} object(s) selected`;
    }

    const cWidth = canvasRef.current?.width || 800;

    return (
        <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'none', background: '#18181c' }}>
            <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                onWheel={handleWheel}
                style={{ display: 'block', width: '100%', height: '100%' }}
            />

            {/* Dynamic Cursor Dimension & Prompt Overlay */}
            {overlayText && (
                <div style={{
                    position: 'absolute',
                    left: Math.min(cursorScreen.x + 18, cWidth - 320),
                    top: Math.max(cursorScreen.y - 36, 12),
                    background: 'rgba(20, 20, 28, 0.92)',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'Outfit, monospace, sans-serif',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                    whiteSpace: 'nowrap',
                    zIndex: 20
                }}>
                    {overlayText}
                </div>
            )}

            {/* Error Message Toast Overlay */}
            {offsetErrorMsg && (
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(239, 68, 68, 0.95)',
                    border: '1px solid #ef4444',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
                    zIndex: 40,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <span>⚠️</span>
                    <span>{offsetErrorMsg}</span>
                </div>
            )}

            {trimErrorMsg && (
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(239, 68, 68, 0.95)',
                    border: '1px solid #ef4444',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
                    zIndex: 40,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <span>⚠️</span>
                    <span>{trimErrorMsg}</span>
                </div>
            )}

            {extendErrorMsg && (
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(239, 68, 68, 0.95)',
                    border: '1px solid #ef4444',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
                    zIndex: 40,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <span>⚠️</span>
                    <span>{extendErrorMsg}</span>
                </div>
            )}

            {chamferErrorMsg && (
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(239, 68, 68, 0.95)',
                    border: '1px solid #ef4444',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
                    zIndex: 40,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <span>⚠️</span>
                    <span>{chamferErrorMsg}</span>
                </div>
            )}

            {/* Precision Floating Direct Numeric Typing Box */}
            {showNumInput && (
                <form
                    onSubmit={handleNumInputSubmitForm}
                    style={{
                        position: 'absolute',
                        left: Math.min(cursorScreen.x + 18, cWidth - 210),
                        top: cursorScreen.y + 12,
                        zIndex: 30
                    }}
                >
                    <input
                        type="text"
                        placeholder={activeTool === 'offset' ? "Specify distance..." : "e.g. 100, 100<45..."}
                        value={numInput}
                        onChange={e => setNumInput(e.target.value)}
                        autoFocus
                        style={{
                            background: '#13131c',
                            border: '2px solid #38bdf8',
                            borderRadius: 6,
                            color: '#00f0ff',
                            padding: '4px 10px',
                            fontSize: 13,
                            fontWeight: 800,
                            fontFamily: 'Outfit, monospace, sans-serif',
                            width: 160,
                            outline: 'none',
                            boxShadow: '0 4px 20px rgba(0,240,255,0.3)'
                        }}
                    />
                </form>
            )}

            {/* MIRROR Delete Source Objects Prompt Dialog */}
            {showDeleteSourceModal && (
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#13131c',
                    border: '2px solid #38bdf8',
                    borderRadius: 10,
                    padding: '16px 24px',
                    color: '#fff',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    alignItems: 'center',
                    fontFamily: 'Outfit, sans-serif'
                }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#00f0ff' }}>
                        🪞 Delete source objects? [Yes / No]
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        Default is <strong style={{ color: '#10b981' }}>No</strong> (Keep original objects and create mirrored copies)
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button
                            type="button"
                            onClick={() => handleConfirmMirror(false)}
                            autoFocus
                            style={{
                                padding: '8px 20px',
                                background: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                            }}
                        >
                            No (Default — Keep Original) [ENTER]
                        </button>
                        <button
                            type="button"
                            onClick={() => handleConfirmMirror(true)}
                            style={{
                                padding: '8px 20px',
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Yes (Delete Original)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowDeleteSourceModal(false);
                                setPendingMirrorData(null);
                                setToolPoints([]);
                                onSelectTool('select');
                            }}
                            style={{
                                padding: '8px 16px',
                                background: '#22222a',
                                color: '#94a3b8',
                                border: '1px solid #333340',
                                borderRadius: 6,
                                fontSize: 12,
                                cursor: 'pointer'
                            }}
                        >
                            Cancel [ESC]
                        </button>
                    </div>
                </div>
            )}

            {/* CAD Text / Label Creation & Editing Modal Dialog */}
            {showTextModal && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#13131c',
                    border: '2px solid #38bdf8',
                    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.85)',
                    borderRadius: 12,
                    padding: '20px 24px',
                    zIndex: 60,
                    color: '#f8fafc',
                    width: 380,
                    fontFamily: 'Outfit, sans-serif'
                }}>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: 16, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>📝</span> {editingTextObj ? 'Edit CAD Text / Label' : 'Create CAD Text / Label'}
                    </h4>

                    <form onSubmit={handleConfirmTextModal}>
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                            Text Content:
                        </label>
                        <input
                            type="text"
                            autoFocus
                            value={textModalContent}
                            onChange={e => setTextModalContent(e.target.value)}
                            placeholder="e.g. BEDROOM, KITCHEN, SECTION A-A"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid #334155',
                                background: '#0f172a',
                                color: '#f8fafc',
                                fontSize: 14,
                                outline: 'none',
                                marginBottom: 12
                            }}
                        />

                        {/* Common Label Quick Presets */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                            {["BEDROOM", "KITCHEN", "LIVING ROOM", "BATHROOM", "DOOR", "WINDOW", "COLUMN", "SECTION A-A", "WALL", "ENTRANCE"].map(label => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => setTextModalContent(label)}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        border: '1px solid #334155',
                                        background: '#1e293b',
                                        color: '#cbd5e1',
                                        fontSize: 11,
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                                    Height (mm):
                                </label>
                                <input
                                    type="number"
                                    value={textModalHeight}
                                    onChange={e => setTextModalHeight(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        border: '1px solid #334155',
                                        background: '#0f172a',
                                        color: '#f8fafc',
                                        fontSize: 14,
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                                    Rotation (°):
                                </label>
                                <input
                                    type="number"
                                    value={textModalRotation}
                                    onChange={e => setTextModalRotation(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        border: '1px solid #334155',
                                        background: '#0f172a',
                                        color: '#f8fafc',
                                        fontSize: 14,
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowTextModal(false);
                                    setEditingTextObj(null);
                                    setTextModalPos(null);
                                    onSelectTool('select');
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 6,
                                    border: '1px solid #334155',
                                    background: '#22222a',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: 13
                                }}
                            >
                                Cancel (Esc)
                            </button>
                            <button
                                type="submit"
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: '#38bdf8',
                                    color: '#0f172a',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: 13,
                                    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)'
                                }}
                            >
                                {editingTextObj ? 'Save Changes (Enter)' : 'Place Text (Enter)'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Layer Error Toast Overlay */}
            {layerErrorMsg && (
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(239, 68, 68, 0.95)',
                    border: '1px solid #ef4444',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
                    zIndex: 70,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <span>⚠️</span>
                    <span>{layerErrorMsg}</span>
                </div>
            )}

            {/* Layers Manager Drawer */}
            {showLayersPanel && (
                <div style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 320,
                    maxHeight: 'calc(100% - 20px)',
                    background: '#13131c',
                    border: '2px solid #38bdf8',
                    borderRadius: 12,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                    zIndex: 55,
                    display: 'flex',
                    flexDirection: 'column',
                    fontFamily: 'Outfit, sans-serif',
                    color: '#f8fafc',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '12px 16px',
                        background: '#1e1e28',
                        borderBottom: '1px solid #333345',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: '#38bdf8' }}>
                            <span>🥞</span> Layers Manager
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                onClick={() => setShowNewLayerModal(true)}
                                style={{
                                    padding: '4px 10px',
                                    background: '#38bdf8',
                                    color: '#0f172a',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                + New Layer
                            </button>
                            <button
                                onClick={() => setShowLayersPanel(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    fontSize: 16,
                                    cursor: 'pointer'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {layers.map(layer => {
                            const isCurrent = currentLayerId === layer.id;
                            const isLayer0 = layer.id === 'layer_0' || layer.name === '0';
                            const isEditing = editingLayerId === layer.id;

                            return (
                                <div
                                    key={layer.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 10px',
                                        background: isCurrent ? 'rgba(56, 189, 248, 0.12)' : '#1a1a24',
                                        border: '1px solid',
                                        borderColor: isCurrent ? '#38bdf8' : '#2e2e3d',
                                        borderRadius: 8
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                        <input
                                            type="radio"
                                            name="activeLayerRadio"
                                            checked={isCurrent}
                                            onChange={() => setCurrentLayerId(layer.id)}
                                            title="Set as Active Drawing Layer"
                                            style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
                                        />
                                        
                                        <div style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: 3,
                                            background: layer.color || '#38bdf8',
                                            border: '1px solid rgba(255,255,255,0.3)',
                                            flexShrink: 0
                                        }} />

                                        {isEditing ? (
                                            <input
                                                type="text"
                                                autoFocus
                                                value={editLayerNameInput}
                                                onChange={e => setEditLayerNameInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleRenameLayer(layer.id, editLayerNameInput);
                                                    if (e.key === 'Escape') setEditingLayerId(null);
                                                }}
                                                onBlur={() => handleRenameLayer(layer.id, editLayerNameInput)}
                                                style={{
                                                    background: '#0f172a',
                                                    border: '1px solid #38bdf8',
                                                    color: '#fff',
                                                    borderRadius: 4,
                                                    padding: '2px 6px',
                                                    fontSize: 12,
                                                    width: '100%'
                                                }}
                                            />
                                        ) : (
                                            <span style={{
                                                fontSize: 13,
                                                fontWeight: isCurrent ? 700 : 500,
                                                color: layer.visible !== false ? '#f8fafc' : '#64748b',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {layer.name} {isCurrent && <span style={{ fontSize: 10, color: '#38bdf8', marginLeft: 4 }}>(Active)</span>}
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                        <button
                                            onClick={() => handleToggleLayerVisibility(layer.id)}
                                            title={layer.visible !== false ? "Hide Layer" : "Show Layer"}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: 14,
                                                padding: 2
                                            }}
                                        >
                                            {layer.visible !== false ? '👁' : '🙈'}
                                        </button>

                                        <button
                                            onClick={() => handleToggleLayerLock(layer.id)}
                                            title={layer.locked ? "Unlock Layer" : "Lock Layer"}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: 14,
                                                padding: 2
                                            }}
                                        >
                                            {layer.locked ? '🔒' : '🔓'}
                                        </button>

                                        {!isEditing && (
                                            <button
                                                onClick={() => {
                                                    setEditingLayerId(layer.id);
                                                    setEditLayerNameInput(layer.name);
                                                }}
                                                title="Rename Layer"
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: 12,
                                                    padding: 2,
                                                    color: '#94a3b8'
                                                }}
                                            >
                                                ✏️
                                            </button>
                                        )}

                                        {!isLayer0 && (
                                            <button
                                                onClick={() => handleDeleteLayer(layer.id)}
                                                title="Delete Layer"
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: 12,
                                                    padding: 2,
                                                    color: '#ef4444'
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* New Layer Modal Dialog */}
            {showNewLayerModal && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#13131c',
                    border: '2px solid #38bdf8',
                    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.85)',
                    borderRadius: 12,
                    padding: '20px 24px',
                    zIndex: 65,
                    color: '#f8fafc',
                    width: 360,
                    fontFamily: 'Outfit, sans-serif'
                }}>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: 16, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>➕</span> Create New Layer
                    </h4>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleCreateLayer(newLayerNameInput, newLayerColorInput);
                    }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                            Layer Name:
                        </label>
                        <input
                            type="text"
                            autoFocus
                            placeholder="e.g. Columns, GridLines, Plumbing"
                            value={newLayerNameInput}
                            onChange={e => setNewLayerNameInput(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid #334155',
                                background: '#0f172a',
                                color: '#f8fafc',
                                fontSize: 14,
                                outline: 'none',
                                marginBottom: 14
                            }}
                        />

                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                            Layer Color:
                        </label>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            {['#ffffff', '#38bdf8', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#3b82f6', '#ec4899'].map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setNewLayerColorInput(c)}
                                    style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: '50%',
                                        background: c,
                                        border: newLayerColorInput === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                                        boxShadow: newLayerColorInput === c ? '0 0 8px ' + c : 'none',
                                        cursor: 'pointer'
                                    }}
                                />
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNewLayerModal(false);
                                    setNewLayerNameInput('');
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 6,
                                    border: '1px solid #334155',
                                    background: '#22222a',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: 13
                                }}
                            >
                                Cancel (Esc)
                            </button>
                            <button
                                type="submit"
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: '#38bdf8',
                                    color: '#0f172a',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: 13,
                                    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)'
                                }}
                            >
                                Create Layer (Enter)
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {activeTool === 'hatch' && (
                <div style={{
                    position: 'absolute',
                    top: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#13131c',
                    border: '1.5px solid #a855f7',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.75)',
                    borderRadius: 8,
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    zIndex: 40,
                    color: '#f8fafc',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: 13,
                    userSelect: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#a855f7' }}>
                        <span style={{ fontSize: 16 }}>▒</span> HATCH:
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>Pattern:</span>
                        <select
                            value={hatchPattern}
                            onChange={e => setHatchPattern(e.target.value)}
                            style={{
                                background: '#1e1e2d',
                                color: '#a855f7',
                                border: '1px solid #334155',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 12,
                                fontWeight: 700,
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="LINE">LINE (///////)</option>
                            <option value="SOLID">SOLID (Filled)</option>
                            <option value="CROSS">CROSS (\\\\\\/)</option>
                        </select>
                    </label>

                    {hatchPattern !== 'SOLID' && (
                        <>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>Angle:</span>
                                <select
                                    value={hatchAngle}
                                    onChange={e => setHatchAngle(Number(e.target.value))}
                                    style={{
                                        background: '#1e1e2d',
                                        color: '#38bdf8',
                                        border: '1px solid #334155',
                                        borderRadius: 6,
                                        padding: '4px 8px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value={0}>0°</option>
                                    <option value={45}>45°</option>
                                    <option value={90}>90°</option>
                                    <option value={135}>135°</option>
                                </select>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>Scale:</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="500"
                                    value={hatchScale}
                                    onChange={e => setHatchScale(Math.max(1, Number(e.target.value)))}
                                    style={{
                                        width: 54,
                                        background: '#1e1e2d',
                                        color: '#38bdf8',
                                        border: '1px solid #334155',
                                        borderRadius: 6,
                                        padding: '4px 6px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        outline: 'none',
                                        textAlign: 'center'
                                    }}
                                />
                                <span style={{ fontSize: 11, color: '#64748b' }}>mm</span>
                            </label>
                        </>
                    )}

                    <div style={{ height: 16, width: 1, background: '#334155', margin: '0 2px' }} />

                    <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 500 }}>
                        Click inside closed region to fill (Esc to cancel)
                    </span>
                </div>
            )}

            {/* Hatch Error Toast / Status Notification */}
            {hatchStatusMsg && (
                <div style={{
                    position: 'absolute',
                    bottom: 50,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#7f1d1d',
                    color: '#fecaca',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    zIndex: 80,
                    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <span>⚠️</span> {hatchStatusMsg}
                </div>
            )}

            {/* Floating Temporary Measurement Result HUD Panel */}
            {activeMeasurementResult && (
                <div style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    background: '#13131c',
                    border: '1.5px solid #00f0ff',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.85)',
                    borderRadius: 8,
                    padding: '12px 18px',
                    color: '#f8fafc',
                    fontFamily: 'Outfit, monospace, sans-serif',
                    fontSize: 13,
                    zIndex: 45,
                    minWidth: 220,
                    userSelect: 'none',
                    backdropFilter: 'blur(8px)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderBottom: '1px solid #2e2e38', paddingBottom: 6 }}>
                        <span style={{ fontWeight: 800, color: '#00f0ff', fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                            📏 {activeMeasurementResult.type} RESULT
                        </span>
                        <button
                            onClick={() => setActiveMeasurementResult(null)}
                            title="Close Overlay (Esc)"
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: 2 }}
                        >
                            ✕
                        </button>
                    </div>

                    {activeMeasurementResult.type === 'DISTANCE' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Distance:</span> <strong style={{ color: '#00f0ff', fontSize: 14, marginLeft: 4 }}>{formatMeasurement(activeMeasurementResult.distance, 'mm')}</strong></div>
                            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>ΔX:</span> <strong style={{ color: '#e2e8f0', marginLeft: 4 }}>{formatMeasurement(activeMeasurementResult.dx, 'mm')}</strong></div>
                            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>ΔY:</span> <strong style={{ color: '#e2e8f0', marginLeft: 4 }}>{formatMeasurement(activeMeasurementResult.dy, 'mm')}</strong></div>
                        </div>
                    )}

                    {activeMeasurementResult.type === 'ANGLE' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Angle:</span> <strong style={{ color: '#00f0ff', fontSize: 14, marginLeft: 4 }}>{formatMeasurement(activeMeasurementResult.angle, '°')}</strong></div>
                        </div>
                    )}

                    {activeMeasurementResult.type === 'RADIUS' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Radius:</span> <strong style={{ color: '#00f0ff', fontSize: 14, marginLeft: 4 }}>{formatMeasurement(activeMeasurementResult.radius, 'mm')}</strong></div>
                            {activeMeasurementResult.geomType === 'CIRCLE' && (
                                <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Diameter:</span> <strong style={{ color: '#e2e8f0', marginLeft: 4 }}>{formatMeasurement(activeMeasurementResult.radius * 2, 'mm')}</strong></div>
                            )}
                        </div>
                    )}

                    {activeMeasurementResult.type === 'AREA' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Area:</span> <strong style={{ color: '#00f0ff', fontSize: 14, marginLeft: 4 }}>{formatMeasurement(activeMeasurementResult.area, 'mm²')}</strong></div>
                            <div><span style={{ color: '#94a3b8', fontSize: 12 }}>Perimeter:</span> <strong style={{ color: '#e2e8f0', marginLeft: 4 }}>{formatMeasurement(activeMeasurementResult.perimeter, 'mm')}</strong></div>
                        </div>
                    )}
                </div>
            )}

            {/* Measurement Error / Status Toast Notification */}
            {measureStatusMsg && (
                <div style={{
                    position: 'absolute',
                    bottom: 50,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#7f1d1d',
                    color: '#fecaca',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    zIndex: 80,
                    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <span>⚠️</span> {measureStatusMsg}
                </div>
            )}
        </div>
    );
}
