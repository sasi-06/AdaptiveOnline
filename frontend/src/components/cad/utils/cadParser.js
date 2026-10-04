/**
 * CAD Numeric & Command Input Parser
 * Supports:
 *  - Distance: "100" -> { type: 'distance', value: 100 }
 *  - Polar: "100<45" -> { type: 'polar', length: 100, angleDeg: 45 }
 *  - Cartesian: "100,200" -> { type: 'cartesian', x: 100, y: 200 }
 */

export function parseCadInput(inputStr) {
    if (!inputStr || typeof inputStr !== 'string') return null;
    const str = inputStr.trim();
    if (!str) return null;

    // 1. Polar format: e.g. "100<45" or "250.5<-30"
    if (str.includes('<')) {
        const parts = str.split('<');
        if (parts.length === 2) {
            const length = parseFloat(parts[0]);
            const angleDeg = parseFloat(parts[1]);
            if (!isNaN(length) && !isNaN(angleDeg)) {
                return { type: 'polar', length: Math.abs(length), angleDeg };
            }
        }
    }

    // 2. Cartesian format: e.g. "100,200" or "-50.5, 120"
    if (str.includes(',')) {
        const parts = str.split(',');
        if (parts.length === 2) {
            const x = parseFloat(parts[0]);
            const y = parseFloat(parts[1]);
            if (!isNaN(x) && !isNaN(y)) {
                return { type: 'cartesian', x, y };
            }
        }
    }

    // 3. Simple distance/number format: e.g. "100" or "50.25"
    const val = parseFloat(str);
    if (!isNaN(val)) {
        return { type: 'distance', value: val };
    }

    return null;
}
