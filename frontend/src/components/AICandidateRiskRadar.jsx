import React from 'react';

/**
 * AICandidateRiskRadar
 * Renders an interactive 360° SVG Radar / Pentagon Chart and a Circular Trust Gauge Meter
 * with zero text clipping and glassmorphic styling.
 */
export default function AICandidateRiskRadar({ 
  authenticityScore = 85, 
  codeQualityScore = 80, 
  testCasesPassed = 2, 
  totalTestCases = 2,
  tabSwitches = 0,
  pasteCount = 0,
  classification = 'Genuine'
}) {
  const testScore = totalTestCases > 0 ? Math.round((testCasesPassed / totalTestCases) * 100) : 75;
  const focusScore = Math.max(0, 100 - (tabSwitches * 25));
  const cadenceScore = Math.max(0, 100 - (pasteCount * 20));
  const codeScore = Math.min(100, Math.max(0, codeQualityScore));
  const authScore = Math.min(100, Math.max(0, authenticityScore));

  const metrics = [
    { label: 'Authenticity', value: authScore, color: '#818cf8' },
    { label: 'Code Quality', value: codeScore, color: '#38bdf8' },
    { label: 'Test Logic',   value: testScore, color: '#10b981' },
    { label: 'Typing Cadence', value: cadenceScore, color: '#f59e0b' },
    { label: 'Focus & Gaze',   value: focusScore, color: '#ec4899' },
  ];

  // SVG dimensions for Pentagon (wider canvas to prevent text clipping)
  const width = 340;
  const height = 240;
  const cx = width / 2;
  const cy = height / 2 + 5;
  const maxR = 85;
  const numSides = 5;

  const getCoordinates = (index, value, radiusOffset = 0) => {
    const angle = (Math.PI * 2 / numSides) * index - Math.PI / 2;
    const r = (value / 100) * maxR + radiusOffset;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y };
  };

  const pointsString = metrics
    .map((m, i) => {
      const { x, y } = getCoordinates(i, m.value);
      return `${x},${y}`;
    })
    .join(' ');

  // Radial Arc Gauge Mathematics
  const gaugeR = 48;
  const gaugeCirc = 2 * Math.PI * gaugeR;
  const gaugePct = authScore / 100;
  const strokeDashoffset = gaugeCirc * (1 - gaugePct * 0.75); // 270 deg arc

  const getStatusBadgeColor = (cls) => {
    if (!cls) return '#10b981';
    const c = cls.toLowerCase();
    if (c === 'genuine' || c === 'low') return '#10b981';
    if (c === 'review needed' || c === 'medium') return '#f59e0b';
    return '#ef4444';
  };

  const statusColor = getStatusBadgeColor(classification);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a, #0b1120)',
      border: '1px solid #1e293b',
      borderRadius: '20px',
      padding: '22px 24px',
      color: '#f8fafc',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      boxShadow: '0 12px 36px rgba(0,0,0,0.5)'
    }}>
      {/* Component Title & Classification Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, boxShadow: `0 0 12px ${statusColor}` }} />
          <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8' }}>
            AI 360° MODEL RESULT RADAR
          </span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 99,
          background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}40`,
          boxShadow: `0 2px 8px ${statusColor}20`
        }}>
          {classification}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'center' }}>
        {/* Left Side: Circular Arc Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <svg width="140" height="140" viewBox="0 0 130 130">
            {/* Background Track Arc */}
            <circle
              cx="65" cy="65" r={gaugeR}
              fill="none" stroke="#1e293b" strokeWidth="11"
              strokeDasharray={gaugeCirc} strokeDashoffset={gaugeCirc * 0.25}
              strokeLinecap="round" transform="rotate(135 65 65)"
            />
            {/* Progress Arc */}
            <circle
              cx="65" cy="65" r={gaugeR}
              fill="none" stroke={statusColor} strokeWidth="11"
              strokeDasharray={gaugeCirc} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round" transform="rotate(135 65 65)"
              style={{ transition: 'stroke-dashoffset 1s ease-in-out', filter: `drop-shadow(0 0 6px ${statusColor}60)` }}
            />
          </svg>
          <div style={{
            position: 'absolute', top: 40, textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: '#f8fafc', lineHeight: 1 }}>{authScore}</span>
            <span style={{ fontSize: 10, textTransform: 'uppercase', color: statusColor, fontWeight: 800, marginTop: 4, letterSpacing: 0.5 }}>AI TRUST %</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center', fontWeight: 500 }}>
            Overall Model Confidence
          </div>
        </div>

        {/* Right Side: Pentagon SVG Radar Chart with Zero Text Clipping */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            {/* Background Pentagon Web Grid (3 levels) */}
            {[0.33, 0.66, 1].map((level) => {
              const gridPoints = Array.from({ length: numSides }).map((_, i) => {
                const { x, y } = getCoordinates(i, 100 * level);
                return `${x},${y}`;
              }).join(' ');
              return (
                <polygon
                  key={level} points={gridPoints}
                  fill="none" stroke="#1e293b" strokeWidth="1.5"
                  strokeDasharray={level < 1 ? '3 3' : 'none'}
                />
              );
            })}

            {/* Radar Spoke Lines */}
            {Array.from({ length: numSides }).map((_, i) => {
              const { x, y } = getCoordinates(i, 100);
              return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#1e293b" strokeWidth="1" />;
            })}

            {/* Filled Polygon */}
            <polygon
              points={pointsString}
              fill={`${statusColor}25`}
              stroke={statusColor}
              strokeWidth="2.5"
              style={{ transition: 'all 0.8s ease', filter: `drop-shadow(0 0 8px ${statusColor}40)` }}
            />

            {/* Vertex Dots */}
            {metrics.map((m, i) => {
              const { x, y } = getCoordinates(i, m.value);
              return (
                <circle
                  key={i} cx={x} cy={y} r="4.5"
                  fill="#0f172a" stroke={m.color} strokeWidth="2.5"
                />
              );
            })}

            {/* Labels nicely spaced around pentagon with text anchors */}
            {metrics.map((m, i) => {
              const { x, y } = getCoordinates(i, 100, 22);
              const anchor = i === 0 ? 'middle' : i === 1 ? 'start' : i === 2 ? 'start' : i === 3 ? 'end' : 'end';
              return (
                <text
                  key={i} x={x} y={y}
                  textAnchor={anchor} dominantBaseline="middle"
                  fill={m.color} fontSize="10.5" fontWeight="700"
                >
                  {m.label} ({m.value}%)
                </text>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Metric Score Pills at Bottom */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
        marginTop: 18, paddingTop: 16, borderTop: '1px solid #1e293b'
      }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            background: '#161e2e', border: `1px solid ${m.color}25`, borderRadius: 10,
            padding: '8px 10px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: m.color, marginTop: 2 }}>{m.value}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
