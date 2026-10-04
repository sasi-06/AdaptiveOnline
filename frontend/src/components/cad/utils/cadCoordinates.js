/**
 * Centralized CAD World <-> Screen Coordinate Transformations
 * Units: Millimeters (mm)
 */

export function worldToScreen(wX, wY, viewport, canvasWidth, canvasHeight) {
    const zoom = viewport.zoom || 1;
    const panX = viewport.panX || 0;
    const panY = viewport.panY || 0;

    const sX = (wX * zoom) + panX + (canvasWidth / 2);
    const sY = (canvasHeight / 2) - (wY * zoom) + panY;
    return { x: sX, y: sY };
}

export function screenToWorld(sX, sY, viewport, canvasWidth, canvasHeight) {
    const zoom = viewport.zoom || 1;
    const panX = viewport.panX || 0;
    const panY = viewport.panY || 0;

    const wX = (sX - (canvasWidth / 2) - panX) / zoom;
    const wY = ((canvasHeight / 2) - sY + panY) / zoom;
    return { x: wX, y: wY };
}

export function calculateFitExtents(objects, canvasWidth, canvasHeight) {
    if (!objects || objects.length === 0) {
        return { zoom: 1, panX: 0, panY: 0 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    objects.forEach(obj => {
        if (obj.type === 'LINE') {
            minX = Math.min(minX, obj.start.x, obj.end.x);
            maxX = Math.max(maxX, obj.start.x, obj.end.x);
            minY = Math.min(minY, obj.start.y, obj.end.y);
            maxY = Math.max(maxY, obj.start.y, obj.end.y);
        } else if (obj.type === 'CIRCLE') {
            minX = Math.min(minX, obj.center.x - obj.radius);
            maxX = Math.max(maxX, obj.center.x + obj.radius);
            minY = Math.min(minY, obj.center.y - obj.radius);
            maxY = Math.max(maxY, obj.center.y + obj.radius);
        } else if (obj.type === 'RECTANGLE') {
            minX = Math.min(minX, obj.x);
            maxX = Math.max(maxX, obj.x + obj.width);
            minY = Math.min(minY, obj.y);
            maxY = Math.max(maxY, obj.y + obj.height);
        } else if (obj.type === 'POLYLINE') {
            (obj.points || []).forEach(pt => {
                minX = Math.min(minX, pt.x);
                maxX = Math.max(maxX, pt.x);
                minY = Math.min(minY, pt.y);
                maxY = Math.max(maxY, pt.y);
            });
        } else if (obj.type === 'ARC') {
            minX = Math.min(minX, obj.center.x - obj.radius);
            maxX = Math.max(maxX, obj.center.x + obj.radius);
            minY = Math.min(minY, obj.center.y - obj.radius);
            maxY = Math.max(maxY, obj.center.y + obj.radius);
        } else if (obj.type === 'HATCH') {
            (obj.boundary || []).forEach(pt => {
                minX = Math.min(minX, pt.x);
                maxX = Math.max(maxX, pt.x);
                minY = Math.min(minY, pt.y);
                maxY = Math.max(maxY, pt.y);
            });
        }
    });

    if (minX === Infinity) {
        return { zoom: 1, panX: 0, panY: 0 };
    }

    const wWidth = Math.max(maxX - minX, 40);
    const wHeight = Math.max(maxY - minY, 40);

    const zoomX = (canvasWidth * 0.7) / wWidth;
    const zoomY = (canvasHeight * 0.7) / wHeight;
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.1), 15);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const panX = -centerX * newZoom;
    const panY = centerY * newZoom;

    return { zoom: newZoom, panX, panY };
}
