import React, { useState, useCallback, useEffect, useRef } from 'react';

/**
 * ScientificCalculator
 * A floating, draggable scientific calculator for ECE/EEE exam students.
 * Supports: basic arithmetic, trig, log, sqrt, exp, π, e, power, memory.
 */
export default function ScientificCalculator({ onClose, t }) {
    const [display, setDisplay] = useState('0');
    const [expression, setExpression] = useState('');
    const [memory, setMemory] = useState(0);
    const [isShift, setIsShift] = useState(false);
    const [isDeg, setIsDeg] = useState(true);
    const [justEval, setJustEval] = useState(false);
    const [pos, setPos] = useState({ x: 40, y: 80 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
    const calcRef = useRef(null);

    // ── Dragging ─────────────────────────────────────────────────
    const onMouseDown = useCallback((e) => {
        if (e.target.closest('button')) return;
        setDragging(true);
        dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y };
    }, [pos]);

    useEffect(() => {
        if (!dragging) return;
        const mv = (e) => {
            const nx = dragStart.current.ox + e.clientX - dragStart.current.mx;
            const ny = dragStart.current.oy + e.clientY - dragStart.current.my;
            setPos({ x: Math.max(0, nx), y: Math.max(0, ny) });
        };
        const up = () => setDragging(false);
        window.addEventListener('mousemove', mv);
        window.addEventListener('mouseup', up);
        return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    }, [dragging]);

    // ── Core logic ───────────────────────────────────────────────
    const toRad = (v) => isDeg ? (v * Math.PI) / 180 : v;
    const toDeg = (v) => isDeg ? (v * 180) / Math.PI : v;

    const appendToDisplay = useCallback((val) => {
        setDisplay(prev => {
            if (justEval) { setJustEval(false); return val; }
            if (prev === '0' && val !== '.') return val;
            return prev + val;
        });
        setExpression(prev => {
            if (justEval) return val;
            return prev + val;
        });
    }, [justEval]);

    const applyFn = useCallback((fn) => {
        const v = parseFloat(display);
        let result;
        switch (fn) {
            case 'sin': result = isDeg ? Math.sin(toRad(v)) : Math.sin(v); break;
            case 'cos': result = isDeg ? Math.cos(toRad(v)) : Math.cos(v); break;
            case 'tan': result = isDeg ? Math.tan(toRad(v)) : Math.tan(v); break;
            case 'asin': result = toDeg(Math.asin(v)); break;
            case 'acos': result = toDeg(Math.acos(v)); break;
            case 'atan': result = toDeg(Math.atan(v)); break;
            case 'log': result = Math.log10(v); break;
            case 'ln': result = Math.log(v); break;
            case 'sqrt': result = Math.sqrt(v); break;
            case 'cbrt': result = Math.cbrt(v); break;
            case 'inv': result = 1 / v; break;
            case 'sq': result = v * v; break;
            case 'exp': result = Math.exp(v); break;
            case 'abs': result = Math.abs(v); break;
            case 'neg': result = -v; break;
            default: result = v;
        }
        const r = +result.toPrecision(10);
        setExpression(`${fn}(${v}) =`);
        setDisplay(String(r));
        setJustEval(true);
    }, [display, isDeg]);

    const evaluate = useCallback(() => {
        try {
            // eslint-disable-next-line no-new-func
            const r = Function('"use strict"; return (' + expression.replace(/π/g, 'Math.PI').replace(/e(?![0-9a-f])/g, 'Math.E') + ')')();
            const rounded = +parseFloat(r).toPrecision(12);
            setExpression(expression + ' =');
            setDisplay(String(rounded));
            setJustEval(true);
        } catch {
            setDisplay('Error');
            setExpression('');
            setJustEval(true);
        }
    }, [expression]);

    const clear = () => { setDisplay('0'); setExpression(''); setJustEval(false); };
    const backsp = () => { setDisplay(prev => prev.length <= 1 ? '0' : prev.slice(0, -1)); };
    const inputOp = (op) => {
        setExpression(prev => (justEval ? display : prev) + op);
        setDisplay(prev => justEval ? display : prev);
        setJustEval(false);
    };

    // ── Button definitions ────────────────────────────────────────
    const AC = t?.accent || '#6366f1';
    const SB = t?.surface || '#1e293b';
    const TX = t?.text || '#f1f5f9';
    const MU = t?.textMuted || '#94a3b8';

    const btn = (label, onClick, color = '#334155', textColor = TX, title = '') => ({
        label, onClick, color, textColor, title
    });

    const sciButtons = [
        // Row 1 – mode + memory
        btn(isDeg ? 'DEG' : 'RAD', () => setIsDeg(d => !d), '#1e40af', '#93c5fd', 'Toggle Degrees/Radians'),
        btn('SHIFT', () => setIsShift(s => !s), isShift ? '#7c3aed' : '#334155', isShift ? '#c4b5fd' : MU, 'Shift for inverse functions'),
        btn('MC', () => setMemory(0), '#374151', MU, 'Memory Clear'),
        btn('MR', () => { setDisplay(String(memory)); setJustEval(true); }, '#374151', MU, 'Memory Recall'),
        btn('M+', () => setMemory(m => m + parseFloat(display)), '#374151', MU, 'Memory Add'),
        btn('M−', () => setMemory(m => m - parseFloat(display)), '#374151', MU, 'Memory Subtract'),

        // Row 2 – trig
        btn(isShift ? 'sin⁻¹' : 'sin', () => applyFn(isShift ? 'asin' : 'sin'), '#1e3a5f', '#7dd3fc'),
        btn(isShift ? 'cos⁻¹' : 'cos', () => applyFn(isShift ? 'acos' : 'cos'), '#1e3a5f', '#7dd3fc'),
        btn(isShift ? 'tan⁻¹' : 'tan', () => applyFn(isShift ? 'atan' : 'tan'), '#1e3a5f', '#7dd3fc'),
        btn(isShift ? 'log₁₀' : 'log', () => applyFn('log'), '#1e3a5f', '#7dd3fc'),
        btn(isShift ? 'eˣ' : 'ln', () => applyFn(isShift ? 'exp' : 'ln'), '#1e3a5f', '#7dd3fc'),
        btn('π', () => { setDisplay(String(Math.PI.toPrecision(10))); setJustEval(true); }, '#1e3a5f', '#7dd3fc', 'π = 3.14159...'),

        // Row 3 – power, sqrt, etc.
        btn('x²', () => applyFn('sq'), '#1e3a5f', '#86efac'),
        btn('√x', () => applyFn('sqrt'), '#1e3a5f', '#86efac'),
        btn('∛x', () => applyFn('cbrt'), '#1e3a5f', '#86efac'),
        btn('1/x', () => applyFn('inv'), '#1e3a5f', '#86efac'),
        btn('|x|', () => applyFn('abs'), '#1e3a5f', '#86efac'),
        btn('±', () => applyFn('neg'), '#1e3a5f', '#86efac'),

        // Row 4 – xⁿ, e, (, )
        btn('xⁿ', () => inputOp('**'), '#1e3a5f', '#fca5a5'),
        btn('e', () => { setDisplay(String(Math.E.toPrecision(10))); setJustEval(true); }, '#1e3a5f', '#fca5a5', 'e = 2.71828...'),
        btn('(', () => appendToDisplay('('), '#1e3a5f', MU),
        btn(')', () => appendToDisplay(')'), '#1e3a5f', MU),
        btn('AC', clear, '#7f1d1d', '#fca5a5', 'All Clear'),
        btn('⌫', backsp, '#374151', '#fbbf24', 'Backspace'),
    ];

    const numButtons = [
        btn('7', () => appendToDisplay('7')),
        btn('8', () => appendToDisplay('8')),
        btn('9', () => appendToDisplay('9')),
        btn('÷', () => inputOp('/'), '#1e3a5f', '#fde68a'),

        btn('4', () => appendToDisplay('4')),
        btn('5', () => appendToDisplay('5')),
        btn('6', () => appendToDisplay('6')),
        btn('×', () => inputOp('*'), '#1e3a5f', '#fde68a'),

        btn('1', () => appendToDisplay('1')),
        btn('2', () => appendToDisplay('2')),
        btn('3', () => appendToDisplay('3')),
        btn('−', () => inputOp('-'), '#1e3a5f', '#fde68a'),

        btn('0', () => appendToDisplay('0')),
        btn('.', () => appendToDisplay('.')),
        btn('=', evaluate, AC, '#fff', 'Calculate'),
        btn('+', () => inputOp('+'), '#1e3a5f', '#fde68a'),
    ];

    // ── Quick formula shortcuts ────────────────────────────────
    const shortcuts = [
        { label: '1/(2πRC)', fn: () => {
            const r = prompt('Enter R (Ω):'); const c = prompt('Enter C (F):');
            if (r && c) { const v = 1/(2*Math.PI*parseFloat(r)*parseFloat(c)); setDisplay(v.toPrecision(6)); setJustEval(true); }
        }},
        { label: '1/√(LC)', fn: () => {
            const l = prompt('Enter L (H):'); const c = prompt('Enter C (F):');
            if (l && c) { const v = 1/(2*Math.PI*Math.sqrt(parseFloat(l)*parseFloat(c))); setDisplay(v.toPrecision(6)); setJustEval(true); }
        }},
        { label: '√3×V', fn: () => {
            const v = prompt('Enter Vph (V):');
            if (v) { setDisplay((Math.sqrt(3)*parseFloat(v)).toPrecision(6)); setJustEval(true); }
        }},
        { label: 'Vout=D×Vin', fn: () => {
            const d = prompt('Enter Duty Cycle D (0-1):'); const vin = prompt('Enter Vin (V):');
            if (d && vin) { setDisplay((parseFloat(d)*parseFloat(vin)).toPrecision(6)); setJustEval(true); }
        }},
    ];

    const css = `
        .sc-wrap {
            position: fixed; z-index: 9998;
            top: ${pos.y}px; left: ${pos.x}px;
            width: 340px;
            background: ${SB};
            border: 1px solid ${t?.border || '#334155'};
            border-radius: 18px;
            box-shadow: 0 25px 60px rgba(0,0,0,0.6);
            font-family: 'Outfit', 'monospace', sans-serif;
            user-select: none;
            overflow: hidden;
        }
        .sc-header {
            background: linear-gradient(135deg, #312e81, #1e1b4b);
            padding: 10px 16px;
            display: flex; align-items: center; justify-content: space-between;
            cursor: grab;
        }
        .sc-header:active { cursor: grabbing; }
        .sc-title { color: #c4b5fd; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; }
        .sc-close {
            background: #7f1d1d; border: none; color: #fca5a5;
            width: 24px; height: 24px; border-radius: 50%;
            cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;
            transition: background 0.2s;
        }
        .sc-close:hover { background: #ef4444; color: #fff; }
        .sc-display-wrap {
            background: #090d18;
            padding: 12px 16px;
            border-bottom: 1px solid #1e293b;
        }
        .sc-expr {
            font-size: 10px; color: #475569; text-align: right;
            min-height: 14px; font-family: monospace; letter-spacing: 0.5px;
        }
        .sc-display {
            font-family: 'Outfit', monospace; font-size: 28px; font-weight: 800;
            color: #e2e8f0; text-align: right;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            min-height: 36px;
        }
        .sc-mem { font-size: 9px; color: #6366f1; text-align: left; margin-top: 2px; }
        .sc-shortcuts {
            display: flex; gap: 4px; padding: 6px 10px;
            background: #0f172a; border-bottom: 1px solid #1e293b;
            flex-wrap: wrap;
        }
        .sc-shortcut-btn {
            background: #1e293b; border: 1px solid #334155; color: #7dd3fc;
            font-size: 9px; padding: 3px 7px; border-radius: 6px; cursor: pointer;
            font-family: monospace; transition: all 0.15s;
        }
        .sc-shortcut-btn:hover { background: #1e40af; border-color: #3b82f6; color: #fff; }
        .sc-grid-sci {
            display: grid; grid-template-columns: repeat(6, 1fr);
            gap: 3px; padding: 8px 10px 4px;
        }
        .sc-grid-num {
            display: grid; grid-template-columns: repeat(4, 1fr);
            gap: 3px; padding: 4px 10px 10px;
        }
        .sc-btn {
            padding: 9px 4px; border-radius: 8px; border: none;
            cursor: pointer; font-size: 11px; font-weight: 600;
            transition: all 0.12s; font-family: 'Outfit', monospace;
            min-height: 34px;
        }
        .sc-btn:hover { filter: brightness(1.3); transform: translateY(-1px); }
        .sc-btn:active { transform: scale(0.95); filter: brightness(0.9); }
    `;

    return (
        <>
            <style>{css}</style>
            <div className="sc-wrap" ref={calcRef}>
                {/* Header (draggable) */}
                <div className="sc-header" onMouseDown={onMouseDown}>
                    <span className="sc-title"> Scientific Calculator</span>
                    <button className="sc-close" onClick={onClose}></button>
                </div>

                {/* Display */}
                <div className="sc-display-wrap">
                    <div className="sc-expr">{expression || '\u00a0'}</div>
                    <div className="sc-display">{display}</div>
                    <div className="sc-mem">{memory !== 0 ? `M: ${memory}` : ''}</div>
                </div>

                {/* ECE/EEE Quick Formula Shortcuts */}
                <div className="sc-shortcuts">
                    <span style={{ fontSize: 9, color: '#475569', alignSelf: 'center', marginRight: 2 }}> Quick:</span>
                    {shortcuts.map((s, i) => (
                        <button key={i} className="sc-shortcut-btn" onClick={s.fn} title={s.label}>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Scientific Buttons */}
                <div className="sc-grid-sci">
                    {sciButtons.map((b, i) => (
                        <button
                            key={i}
                            className="sc-btn"
                            style={{ background: b.color, color: b.textColor }}
                            onClick={b.onClick}
                            title={b.title}
                        >
                            {b.label}
                        </button>
                    ))}
                </div>

                {/* Numeric Buttons */}
                <div className="sc-grid-num">
                    {numButtons.map((b, i) => (
                        <button
                            key={i}
                            className="sc-btn"
                            style={{ background: b.color, color: b.textColor, fontSize: b.label === '=' ? 16 : 13 }}
                            onClick={b.onClick}
                            title={b.title}
                        >
                            {b.label}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}
