/**
 * Centralized CAD Activity Logger
 * Logs ONLY successfully committed CAD actions.
 * NEVER captures cursor movements, mousemove, hover, continuous preview,
 * zoom, pan, grid, snap, tool selection, keyboard typing, or cancelled/failed commands.
 */

export const ACTION_CATEGORIES = {
    DRAWING: ['LINE', 'CIRCLE', 'RECTANGLE', 'POLYLINE', 'ARC'],
    MODIFICATION: ['MOVE', 'COPY', 'ROTATE', 'MIRROR', 'OFFSET', 'TRIM', 'EXTEND', 'FILLET', 'CHAMFER', 'DELETE'],
    ANNOTATION: ['DIMENSION', 'TEXT', 'HATCH'],
    MEASUREMENT: ['DISTANCE', 'ANGLE', 'RADIUS', 'AREA'],
    EDITING: ['UNDO', 'REDO']
};

export function getActionCategory(actionType) {
    const type = (actionType || '').toUpperCase();
    for (const [cat, actions] of Object.entries(ACTION_CATEGORIES)) {
        if (actions.includes(type)) return cat;
    }
    return 'OTHER';
}

/**
 * Format raw parameters into a human-readable result summary for Admin UI display
 */
export function formatResultSummary(actionType, parameters = {}, geometryIds = []) {
    const type = (actionType || '').toUpperCase();
    const p = parameters || {};

    switch (type) {
        case 'LINE':
            if (p.length) return `Start: (${Math.round(p.start?.x || 0)}, ${Math.round(p.start?.y || 0)}) | End: (${Math.round(p.end?.x || 0)}, ${Math.round(p.end?.y || 0)}) | Length: ${Math.round(p.length)} mm`;
            return `Created line (${geometryIds.join(', ') || 'LINE'})`;

        case 'CIRCLE':
            if (p.radius) return `Center: (${Math.round(p.center?.x || 0)}, ${Math.round(p.center?.y || 0)}) | Radius: ${Math.round(p.radius)} mm`;
            return `Created circle`;

        case 'RECTANGLE':
            if (p.width && p.height) return `Width: ${Math.round(p.width)} mm × Height: ${Math.round(p.height)} mm`;
            return `Created rectangle`;

        case 'POLYLINE':
            if (p.vertexCount) return `${p.vertexCount} Vertices${p.totalLength ? ` | Total Length: ${Math.round(p.totalLength)} mm` : ''}`;
            return `Created polyline`;

        case 'ARC':
            if (p.radius) return `Center: (${Math.round(p.center?.x || 0)}, ${Math.round(p.center?.y || 0)}) | Radius: ${Math.round(p.radius)} mm | Angle: ${Math.round((p.startAngle || 0) * (180 / Math.PI))}° to ${Math.round((p.endAngle || 0) * (180 / Math.PI))}°`;
            return `Created arc`;

        case 'MOVE':
            return `Objects: ${geometryIds.length || p.affectedCount || 1} | ΔX: ${Math.round(p.dx || 0)} mm, ΔY: ${Math.round(p.dy || 0)} mm`;

        case 'COPY':
            return `Copied ${geometryIds.length || p.sourceCount || 1} objects | ΔX: ${Math.round(p.dx || 0)} mm, ΔY: ${Math.round(p.dy || 0)} mm`;

        case 'ROTATE':
            return `Objects: ${geometryIds.length || p.affectedCount || 1} | Angle: ${Math.round(p.angleDeg || (p.angle ? p.angle * (180 / Math.PI) : 0))}°`;

        case 'MIRROR':
            return `Objects: ${geometryIds.length || p.affectedCount || 1} | Delete Source: ${p.deleteSource ? 'Yes' : 'No'}`;

        case 'OFFSET':
            return `Object: ${p.sourceId || geometryIds[0] || 'Selected'} | Distance: ${Math.round(p.distance || 0)} mm`;

        case 'TRIM':
            return `Trimmed object ${geometryIds.join(', ') || p.trimmedId || ''}`;

        case 'EXTEND':
            return `Extended object ${geometryIds.join(', ') || p.extendedId || ''}`;

        case 'FILLET':
            return `Fillet Radius: ${Math.round(p.radius || 0)} mm`;

        case 'CHAMFER':
            return `Distance 1: ${Math.round(p.dist1 || 0)} mm | Distance 2: ${Math.round(p.dist2 || 0)} mm`;

        case 'DELETE':
            return `Deleted ${geometryIds.length || p.deletedCount || 1} object(s)${p.types ? ` (${p.types.join(', ')})` : ''}`;

        case 'DIMENSION':
            return `Type: ${p.dimType || 'Linear'} | Value: ${Math.round(p.value || p.length || 0)} mm`;

        case 'TEXT':
            return `Content: "${p.content || p.text || ''}" | Height: ${Math.round(p.height || 25)} mm`;

        case 'HATCH':
            return `Pattern: ${p.pattern || 'CROSS'} | Angle: ${p.angle || 0}° | Scale: ${p.scale || 10}`;

        case 'DISTANCE':
            return `Distance: ${Math.round(p.distance || 0)} mm | ΔX: ${Math.round(p.dx || 0)} mm, ΔY: ${Math.round(p.dy || 0)} mm`;

        case 'ANGLE':
            return `Angle: ${Math.round((p.angle || 0) * 10) / 10}°`;

        case 'RADIUS':
            return `Radius: ${Math.round(p.radius || 0)} mm`;

        case 'AREA':
            return `Area: ${Math.round(p.area || 0)} mm²${p.perimeter ? ` | Perimeter: ${Math.round(p.perimeter)} mm` : ''}`;

        case 'UNDO':
            return p.revertedAction ? `Reverted: ${p.revertedAction}${p.targetSummary ? ` (${p.targetSummary})` : ''}` : `Reverted previous operation`;

        case 'REDO':
            return p.restoredAction ? `Restored: ${p.restoredAction}${p.targetSummary ? ` (${p.targetSummary})` : ''}` : `Restored undone operation`;

        default:
            return `Performed ${type} action`;
    }
}

/**
 * Creates a single formatted CAD activity event
 */
export function createCadActivityEvent(actionType, geometryIds = [], parameters = {}, customSummary = '', context = {}) {
    const geomIdsArray = Array.isArray(geometryIds)
        ? geometryIds.filter(Boolean)
        : (geometryIds ? [String(geometryIds)] : []);

    const resultSummary = customSummary || formatResultSummary(actionType, parameters, geomIdsArray);

    return {
        eventId: `cad_event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        studentId: context.studentId || '',
        assessmentId: context.assessmentId || '',
        questionId: context.questionId || '',
        attemptId: context.attemptId || context.assessmentId || '',
        actionType: String(actionType).toUpperCase(),
        timestamp: new Date().toISOString(),
        sequenceNumber: Number(context.sequenceNumber) || 1,
        geometryIds: geomIdsArray,
        parameters: parameters || {},
        resultSummary
    };
}

/**
 * Summarize activity events into counts per category and action type for Admin UI
 */
export function summarizeActivityEvents(events = []) {
    const summary = {
        totalActions: events.length,
        categories: {
            DRAWING: 0,
            MODIFICATION: 0,
            ANNOTATION: 0,
            MEASUREMENT: 0,
            EDITING: 0,
            OTHER: 0
        },
        actionCounts: {}
    };

    events.forEach(evt => {
        const type = (evt.actionType || 'UNKNOWN').toUpperCase();
        const cat = getActionCategory(type);
        summary.categories[cat] = (summary.categories[cat] || 0) + 1;
        summary.actionCounts[type] = (summary.actionCounts[type] || 0) + 1;
    });

    return summary;
}
