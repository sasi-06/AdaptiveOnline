import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { AlertTriangle, Coffee, Eye, Copy, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_ICONS = {
  large_paste: Copy,
  excessive_idle: Coffee,
  tab_switch: Eye,
  focus_loss: Eye,
  instant_solution: AlertTriangle,
  suspicious_pattern: AlertTriangle,
  rapid_compile: Clock,
  off_screen_gaze: Eye,
};

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { theme: t } = useTheme();

  const SEVERITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: t.textMuted };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts/all');
      setAlerts(res.data);
    } catch (err) {
      toast.error('Failed to load security alerts');
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter);

  if (loading) {
    return <div style={{ color: t.textMuted, padding: 20 }}>Loading security alerts...</div>;
  }

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 600, color: t.text, marginBottom: '4px' }}>Security & Behavioral Alerts</h2>
          <p style={{ color: t.textMuted, fontSize: '14px' }}>Real-time telemetry and proctoring anomalies detected during coding sessions</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', background: t.surface, padding: '4px', borderRadius: '10px', border: `1px solid ${t.border}` }}>
          {['all', 'high', 'medium', 'low'].map((f) => (
            <button 
              key={f} 
              onClick={() => setFilter(f)} 
              style={{ 
                background: filter === f ? t.tabActiveBg : 'transparent',
                color: filter === f ? t.accent : t.textMuted,
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'High Severity', count: alerts.filter(a => a.severity === 'high').length, color: '#ef4444' },
          { label: 'Medium Severity', count: alerts.filter(a => a.severity === 'medium').length, color: '#f59e0b' },
          { label: 'Total Alerts', count: alerts.length, color: t.accent },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ background: t.surface, border: `1px solid ${color}30`, borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, color }}>{count}</div>
            <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: t.textMuted, background: t.surface, borderRadius: '14px', border: `1px dashed ${t.border}` }}>
          <AlertTriangle size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ fontSize: '14px' }}>No alerts found for the selected filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((a) => {
            const Icon = TYPE_ICONS[a.type] || AlertTriangle;
            const color = SEVERITY_COLORS[a.severity] || t.textMuted;
            return (
              <div key={a._id} style={{ 
                background: t.surface, 
                border: `1px solid ${color}30`, 
                borderLeft: `4px solid ${color}`, 
                borderRadius: '12px', 
                padding: '16px 20px', 
                display: 'flex', 
                gap: '16px', 
                alignItems: 'flex-start',
                transition: 'all 0.2s',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: t.text }}>{a.message}</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '100px', background: `${color}15`, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{a.severity}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '12.5px', color: t.textMuted, flexWrap: 'wrap' }}>
                    <span>Candidate: <b style={{ color: t.text }}>{a.candidate?.name || 'N/A'}</b></span>
                    <span>Type: <b style={{ color: t.text, textTransform: 'capitalize' }}>{a.type?.replace(/_/g, ' ')}</b></span>
                    <span>Date: <b style={{ color: t.text }}>{new Date(a.createdAt).toLocaleString()}</b></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
