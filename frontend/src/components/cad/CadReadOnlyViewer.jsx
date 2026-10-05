import React, { useRef, useEffect, useState, useCallback } from 'react';

export default function CadReadOnlyViewer({
    drawingData = { objects: [], layers: [] },
    highlightedIds = [],
    height = 500,
    showGrid: initialGrid = true
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const objects = drawingData?.objects || (Array.isArray(drawingData) ? drawingData : []);
    const layers = drawingData?.layers || [];

    const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
    const [showGrid, setShowGrid] = useState(initialGrid);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Fit to Extents helper
    const fitExtents = useCallback(() => {
        if (!canvasRef.current || objects.length === 0) {
            setViewport({ zoom: 1, panX: 0, panY: 0 });
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        objects.forEach(obj => {
            if (obj.type === 'LINE') {
                minX = Math.min(minX, obj.start?.x || 0, obj.end?.x || 0);
                minY = Math.min(minY, obj.start?.y || 0, obj.end?.y || 0);
                maxX = Math.max(maxX, obj.start?.x || 0, obj.end?.x || 0);
                maxY = Math.max(maxY, obj.start?.y || 0, obj.end?.y || 0);
            } else if (obj.type === 'CIRCLE') {
                minX = Math.min(minX, (obj.center?.x || 0) - (obj.radius || 0));
                minY = Math.min(minY, (obj.center?.y || 0) - (obj.radius || 0));
                maxX = Math.max(maxX, (obj.center?.x || 0) + (obj.radius || 0));
                maxY = Math.max(maxY, (obj.center?.y || 0) + (obj.radius || 0));
            } else if (obj.type === 'RECTANGLE') {
                minX = Math.min(minX, obj.x || 0);
                minY = Math.min(minY, obj.y || 0);
                maxX = Math.max(maxX, (obj.x || 0) + (obj.width || 0));
                maxY = Math.max(maxY, (obj.y || 0) + (obj.height || 0));
            } else if (obj.type === 'POLYLINE') {
                (obj.points || []).forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
            } else if (obj.type === 'ARC') {
                minX = Math.min(minX, (obj.center?.x || 0) - (obj.radius || 0));
                minY = Math.min(minY, (obj.center?.y || 0) - (obj.radius || 0));
                maxX = Math.max(maxX, (obj.center?.x || 0) + (obj.radius || 0));
                maxY = Math.max(maxY, (obj.center?.y || 0) + (obj.radius || 0));
            }
        });

        if (minX === Infinity) {
            setViewport({ zoom: 1, panX: 0, panY: 0 });
            return;
        }

        const width = maxX - minX || 100;
        const height = maxY - minY || 100;
        const c = canvasRef.current;
        const padding = 60;

        const scaleX = (c.width - padding * 2) / width;
        const scaleY = (c.height - padding * 2) / height;
        const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.1), 5);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const panX = c.width / 2 - centerX * newZoom;
        const panY = c.height / 2 - centerY * newZoom;

        setViewport({ zoom: newZoom, panX, panY });
    }, [objects]);

    useEffect(() => {
        fitExtents();
    }, [drawingData, fitExtents]);

    // Handle Resize & Canvas Render
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const container = containerRef.current;
        if (container) {
            canvas.width = container.clientWidth || 800;
            canvas.height = height || 500;
        }

        const ctx = canvas.getContext('2d');
        const { width, height: cHeight } = canvas;

        ctx.clearRect(0, 0, width, cHeight);

        // Background
        ctx.fillStyle = '#0f0f13';
        ctx.fillRect(0, 0, width, cHeight);

        ctx.save();
        ctx.translate(viewport.panX, viewport.panY);
        ctx.scale(viewport.zoom, viewport.zoom);

        // Render Grid
        if (showGrid) {
            ctx.strokeStyle = '#1e1e28';
            ctx.lineWidth = 1 / viewport.zoom;

            const gridSpacing = 50;
            const startX = Math.floor(-viewport.panX / viewport.zoom / gridSpacing) * gridSpacing - gridSpacing;
            const endX = startX + (width / viewport.zoom) + gridSpacing * 2;
            const startY = Math.floor(-viewport.panY / viewport.zoom / gridSpacing) * gridSpacing - gridSpacing;
            const endY = startY + (cHeight / viewport.zoom) + gridSpacing * 2;

            for (let x = startX; x <= endX; x += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(x, startY);
                ctx.lineTo(x, endY);
                ctx.stroke();
            }
            for (let y = startY; y <= endY; y += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(startX, y);
                ctx.lineTo(endX, y);
                ctx.stroke();
            }
        }

        // Render Objects
        objects.forEach(obj => {
            const isHighlighted = highlightedIds.includes(obj.id);
            ctx.strokeStyle = isHighlighted ? '#38bdf8' : (obj.color || '#e2e8f0');
            ctx.fillStyle = isHighlighted ? 'rgba(56, 189, 248, 0.25)' : (obj.color || '#e2e8f0');
            ctx.lineWidth = (isHighlighted ? 3.5 : 2) / viewport.zoom;

            if (isHighlighted) {
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 12;
            } else {
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }

            if (obj.type === 'LINE') {
                ctx.beginPath();
                ctx.moveTo(obj.start?.x || 0, obj.start?.y || 0);
                ctx.lineTo(obj.end?.x || 0, obj.end?.y || 0);
                ctx.stroke();
            } else if (obj.type === 'CIRCLE') {
                ctx.beginPath();
                ctx.arc(obj.center?.x || 0, obj.center?.y || 0, obj.radius || 10, 0, Math.PI * 2);
                ctx.stroke();
            } else if (obj.type === 'RECTANGLE') {
                ctx.beginPath();
                ctx.rect(obj.x || 0, obj.y || 0, obj.width || 10, obj.height || 10);
                ctx.stroke();
            } else if (obj.type === 'POLYLINE') {
                const pts = obj.points || [];
                if (pts.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) {
                        ctx.lineTo(pts[i].x, pts[i].y);
                    }
                    ctx.stroke();
                }
            } else if (obj.type === 'ARC') {
                ctx.beginPath();
                ctx.arc(obj.center?.x || 0, obj.center?.y || 0, obj.radius || 10, obj.startAngle || 0, obj.endAngle || Math.PI);
                ctx.stroke();
            } else if (obj.type === 'HATCH') {
                const b = obj.boundary || [];
                if (b.length > 2) {
                    ctx.beginPath();
                    ctx.moveTo(b[0].x, b[0].y);
                    for (let i = 1; i < b.length; i++) ctx.lineTo(b[i].x, b[i].y);
                    ctx.closePath();
                    ctx.fillStyle = isHighlighted ? 'rgba(56, 189, 248, 0.4)' : 'rgba(168, 85, 247, 0.25)';
                    ctx.fill();
                    ctx.stroke();
                }
            } else if (obj.type === 'TEXT') {
                ctx.font = `${obj.height || 20}px Outfit, sans-serif`;
                ctx.fillStyle = isHighlighted ? '#38bdf8' : '#f8fafc';
                ctx.fillText(obj.text || '', obj.position?.x || 0, obj.position?.y || 0);
            } else if (obj.type?.includes('DIMENSION')) {
                ctx.strokeStyle = isHighlighted ? '#38bdf8' : '#38bdf8';
                ctx.lineWidth = 1.5 / viewport.zoom;
                if (obj.start && obj.end) {
                    ctx.beginPath();
                    ctx.moveTo(obj.start.x, obj.start.y);
                    ctx.lineTo(obj.end.x, obj.end.y);
                    ctx.stroke();
                    ctx.font = '12px monospace';
                    ctx.fillStyle = '#38bdf8';
                    const midX = (obj.start.x + obj.end.x) / 2;
                    const midY = (obj.start.y + obj.end.y) / 2;
                    const len = Math.round(Math.hypot(obj.end.x - obj.start.x, obj.end.y - obj.start.y));
                    ctx.fillText(`${len} mm`, midX, midY - 6);
                }
            }
        });

        ctx.restore();
    }, [drawingData, objects, layers, viewport, showGrid, highlightedIds, height]);

    // Zoom & Pan Mouse Handlers
    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setViewport(prev => ({
            ...prev,
            panX: e.clientX - dragStart.x,
            panY: e.clientY - dragStart.y
        }));
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleWheel = (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        setViewport(prev => ({
            ...prev,
            zoom: Math.min(Math.max(prev.zoom * factor, 0.05), 20)
        }));
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', height: height, background: '#0f0f13', borderRadius: 10, overflow: 'hidden', border: '1px solid #2e2e38' }}>
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ width: '100%', height: '100%', cursor: isDragging ? 'grabbing' : 'grab', display: 'block' }}
            />

            {/* Floating Controls overlay */}
            <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 6, background: 'rgba(24, 24, 28, 0.85)', backdropFilter: 'blur(6px)', padding: 6, borderRadius: 8, border: '1px solid #333340' }}>
                <button
                    onClick={() => setViewport(v => ({ ...v, zoom: v.zoom * 1.25 }))}
                    title="Zoom In"
                    style={{ background: '#22222a', border: '1px solid #333340', color: '#fff', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', fontWeight: 800 }}
                >
                    +
                </button>
                <button
                    onClick={() => setViewport(v => ({ ...v, zoom: v.zoom * 0.8 }))}
                    title="Zoom Out"
                    style={{ background: '#22222a', border: '1px solid #333340', color: '#fff', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', fontWeight: 800 }}
                >
                    −
                </button>
                <button
                    onClick={fitExtents}
                    title="Fit to Extents"
                    style={{ background: '#22222a', border: '1px solid #333340', color: '#38bdf8', borderRadius: 4, padding: '0 8px', height: 28, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                >
                     Fit Drawing
                </button>
                <button
                    onClick={() => setShowGrid(g => !g)}
                    title="Toggle Grid"
                    style={{ background: showGrid ? 'rgba(56,189,248,0.2)' : '#22222a', border: '1px solid #333340', color: showGrid ? '#38bdf8' : '#94a3b8', borderRadius: 4, padding: '0 8px', height: 28, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                >
                    # Grid
                </button>
            </div>
        </div>
    );
}
