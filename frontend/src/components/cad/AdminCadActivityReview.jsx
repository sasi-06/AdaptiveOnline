import React, { useState, useMemo } from 'react';
import CadReadOnlyViewer from './CadReadOnlyViewer';
import { summarizeActivityEvents, ACTION_CATEGORIES } from './utils/cadActivityLogger';

export default function AdminCadActivityReview({
    studentData = {},
    assessmentData = {},
    drawings = [],
    onClose,
    theme: t = {}
}) {
    const [selectedQIndex, setSelectedQIndex] = useState(0);
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEventId, setSelectedEventId] = useState(null);

    const currentDrawing = drawings[selectedQIndex] || drawings[0] || {};
    const questionObj = currentDrawing.question || {};
    const drawingData = currentDrawing.drawing_data || { objects: [], layers: [] };
    const activityEvents = currentDrawing.activity_events || [];

    // Summary calculations
    const activitySummary = useMemo(() => {
        return summarizeActivityEvents(activityEvents);
    }, [activityEvents]);

    // Geometry & Layer counts for final drawing summary
    const drawingGeometrySummary = useMemo(() => {
        const objs = drawingData.objects || [];
        const counts = {
            lines: 0,
            circles: 0,
            rectangles: 0,
            polylines: 0,
            arcs: 0,
            dimensions: 0,
            text: 0,
            hatches: 0
        };

        const layersSet = new Set();

        objs.forEach(o => {
            if (o.type === 'LINE') counts.lines++;
            else if (o.type === 'CIRCLE') counts.circles++;
            else if (o.type === 'RECTANGLE') counts.rectangles++;
            else if (o.type === 'POLYLINE') counts.polylines++;
            else if (o.type === 'ARC') counts.arcs++;
            else if (o.type?.includes('DIMENSION')) counts.dimensions++;
            else if (o.type === 'TEXT') counts.text++;
            else if (o.type === 'HATCH') counts.hatches++;

            if (o.layerId) layersSet.add(o.layerId);
        });

        return { counts, layersUsed: Array.from(layersSet) };
    }, [drawingData]);

    // Filter events
    const filteredEvents = useMemo(() => {
        return activityEvents.filter(evt => {
            const type = (evt.actionType || '').toUpperCase();
            let matchesCategory = true;

            if (activeCategoryFilter !== 'ALL') {
                const categoryActions = ACTION_CATEGORIES[activeCategoryFilter] || [];
                matchesCategory = categoryActions.includes(type);
            }

            const qStr = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                type.includes(qStr) ||
                (evt.resultSummary || '').toLowerCase().includes(qStr) ||
                (evt.geometryIds || []).some(id => String(id).toLowerCase().includes(qStr));

            return matchesCategory && matchesSearch;
        });
    }, [activityEvents, activeCategoryFilter, searchQuery]);

    // Find highlighted geometry IDs when an event is clicked
    const highlightedIds = useMemo(() => {
        if (!selectedEventId) return [];
        const evt = activityEvents.find(e => e.eventId === selectedEventId);
        return evt ? (evt.geometryIds || []) : [];
    }, [selectedEventId, activityEvents]);

    // Formatter for time display (HH:MM:SS)
    const formatTime = (isoString) => {
        if (!isoString) return '--:--:--';
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (e) {
            return String(isoString).substr(11, 8);
        }
    };

    const getActionBadgeStyle = (actionType) => {
        const type = (actionType || '').toUpperCase();
        if (['LINE', 'CIRCLE', 'RECTANGLE', 'POLYLINE', 'ARC'].includes(type)) {
            return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' };
        } else if (['MOVE', 'COPY', 'ROTATE', 'MIRROR', 'OFFSET', 'TRIM', 'EXTEND', 'FILLET', 'CHAMFER', 'DELETE'].includes(type)) {
            return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' };
        } else if (['DIMENSION', 'TEXT', 'HATCH'].includes(type)) {
            return { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' };
        } else if (['DISTANCE', 'ANGLE', 'RADIUS', 'AREA'].includes(type)) {
            return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
        } else if (['UNDO', 'REDO'].includes(type)) {
            return { background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' };
        }
        return { background: '#22222a', color: '#cbd5e1', border: '1px solid #333340' };
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 10, 14, 0.92)', backdropFilter: 'blur(10px)', zIndex: 30000, display: 'flex', flexDirection: 'column', fontFamily: 'Outfit, sans-serif', color: '#e2e8f0', userSelect: 'none' }}>
            
            {/* ── TOP NAV / HEADER BAR ─────────────────────────────────────────── */}
            <div style={{ height: 60, background: '#18181c', borderBottom: '1px solid #2e2e38', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#38bdf8' }}>
                        📐
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                            {studentData.name || 'Student Attempt'}
                            <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>({studentData.rollno || studentData.email || 'CAD Attempt'})</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            Assessment: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{assessmentData.title || 'AutoCAD Assessment'}</span>
                        </div>
                    </div>
                </div>

                {/* Question Selector Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#121216', padding: 4, borderRadius: 8, border: '1px solid #2e2e38' }}>
                    {drawings.map((dw, idx) => (
                        <button
                            key={dw._id || idx}
                            onClick={() => { setSelectedQIndex(idx); setSelectedEventId(null); }}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 6,
                                border: 'none',
                                background: idx === selectedQIndex ? '#38bdf8' : 'transparent',
                                color: idx === selectedQIndex ? '#000' : '#94a3b8',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer'
                            }}
                        >
                            Question {idx + 1}
                        </button>
                    ))}
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{ background: '#22222a', border: '1px solid #333340', color: '#94a3b8', padding: '6px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                    ✕ Close Review
                </button>
            </div>

            {/* ── MAIN CONTENT AREA (SPLIT VIEW) ─────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

                {/* LEFT COLUMN: FINAL CAD DRAWING VIEWER & SUMMARY */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, overflowY: 'auto', gap: 16, borderRight: '1px solid #2e2e38' }}>
                    {/* Question Banner */}
                    <div style={{ background: '#18181c', border: '1px solid #2e2e38', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Question {selectedQIndex + 1} of {drawings.length}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                                {questionObj.question_text || `AutoCAD Drawing Task #${selectedQIndex + 1}`}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ padding: '4px 10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                Final Drawing State
                            </span>
                        </div>
                    </div>

                    {/* Interactive CAD Read-Only Viewer */}
                    <CadReadOnlyViewer
                        drawingData={drawingData}
                        highlightedIds={highlightedIds}
                        height={460}
                        showGrid={true}
                    />

                    {/* Final Drawing Summary Info Card */}
                    <div style={{ background: '#18181c', border: '1px solid #2e2e38', borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>📊</span> Final Drawing Geometry Summary
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                            <div style={{ background: '#22222a', border: '1px solid #333340', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>Lines</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8' }}>{drawingGeometrySummary.counts.lines}</div>
                            </div>
                            <div style={{ background: '#22222a', border: '1px solid #333340', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>Circles / Arcs</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{drawingGeometrySummary.counts.circles + drawingGeometrySummary.counts.arcs}</div>
                            </div>
                            <div style={{ background: '#22222a', border: '1px solid #333340', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>Rectangles</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#c084fc' }}>{drawingGeometrySummary.counts.rectangles}</div>
                            </div>
                            <div style={{ background: '#22222a', border: '1px solid #333340', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>Dimensions / Text</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{drawingGeometrySummary.counts.dimensions + drawingGeometrySummary.counts.text}</div>
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            Layers Used: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{drawingGeometrySummary.layersUsed.length > 0 ? drawingGeometrySummary.layersUsed.join(', ') : '0 (Default Layer)'}</span>
                        </div>
                    </div>
                </div>


                {/* RIGHT COLUMN: CAD ACTIVITY HISTORY & SUMMARY PANEL */}
                <div style={{ width: 440, flexShrink: 0, background: '#141418', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    
                    {/* Activity Stats Summary Header */}
                    <div style={{ padding: 18, borderBottom: '1px solid #2e2e38', background: '#18181c' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                                📜 CAD Activity History
                            </span>
                            <span style={{ padding: '3px 10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                                {activityEvents.length} Actions Committed
                            </span>
                        </div>

                        {/* Breakdown Pills */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                            <span style={{ padding: '2px 8px', background: '#22222a', borderRadius: 4, color: '#10b981' }}>
                                Drawing: <strong>{activitySummary.categories.DRAWING}</strong>
                            </span>
                            <span style={{ padding: '2px 8px', background: '#22222a', borderRadius: 4, color: '#38bdf8' }}>
                                Modif: <strong>{activitySummary.categories.MODIFICATION}</strong>
                            </span>
                            <span style={{ padding: '2px 8px', background: '#22222a', borderRadius: 4, color: '#c084fc' }}>
                                Annot: <strong>{activitySummary.categories.ANNOTATION}</strong>
                            </span>
                            <span style={{ padding: '2px 8px', background: '#22222a', borderRadius: 4, color: '#f59e0b' }}>
                                Meas: <strong>{activitySummary.categories.MEASUREMENT}</strong>
                            </span>
                            <span style={{ padding: '2px 8px', background: '#22222a', borderRadius: 4, color: '#f472b6' }}>
                                Undo/Redo: <strong>{activitySummary.categories.EDITING}</strong>
                            </span>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #2e2e38', background: '#121216', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Search Input */}
                        <input
                            type="text"
                            placeholder="Filter actions or objects…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px 12px',
                                background: '#18181c',
                                border: '1px solid #333340',
                                borderRadius: 6,
                                color: '#fff',
                                fontSize: 12,
                                outline: 'none'
                            }}
                        />

                        {/* Category Filter Pills */}
                        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
                            {['ALL', 'DRAWING', 'MODIFICATION', 'ANNOTATION', 'MEASUREMENT', 'EDITING'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategoryFilter(cat)}
                                    style={{
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        border: 'none',
                                        background: activeCategoryFilter === cat ? '#38bdf8' : '#22222a',
                                        color: activeCategoryFilter === cat ? '#000' : '#94a3b8',
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {cat === 'EDITING' ? 'Undo/Redo' : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Events Chronological Stream List */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filteredEvents.length > 0 ? (
                            filteredEvents.map((evt, idx) => {
                                const isSelected = evt.eventId === selectedEventId;
                                const badgeStyle = getActionBadgeStyle(evt.actionType);

                                return (
                                    <div
                                        key={evt.eventId || idx}
                                        onClick={() => setSelectedEventId(isSelected ? null : evt.eventId)}
                                        style={{
                                            padding: 12,
                                            borderRadius: 8,
                                            background: isSelected ? 'rgba(56, 189, 248, 0.12)' : '#18181c',
                                            border: `1px solid ${isSelected ? '#38bdf8' : '#2e2e38'}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {/* Event Top Row: Time, Action Badge, Seq */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#777788', fontFamily: 'monospace' }}>
                                                    #{evt.sequenceNumber || idx + 1}
                                                </span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>
                                                    {formatTime(evt.timestamp)}
                                                </span>
                                            </div>
                                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 800, ...badgeStyle }}>
                                                {evt.actionType}
                                            </span>
                                        </div>

                                        {/* Result Summary */}
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4 }}>
                                            {evt.resultSummary || 'Action committed'}
                                        </div>

                                        {/* Referenced Objects IDs */}
                                        {evt.geometryIds && evt.geometryIds.length > 0 && (
                                            <div style={{ fontSize: 10.5, color: '#777788', marginTop: 4, fontFamily: 'monospace' }}>
                                                IDs: {evt.geometryIds.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ padding: 40, textAlign: 'center', color: '#777788', fontSize: 13 }}>
                                {activityEvents.length === 0 ? 'No activity events logged for this drawing attempt.' : 'No events match the selected filter.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
