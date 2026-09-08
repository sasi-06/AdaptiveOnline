import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

const StudentCodingResults = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const t = useTheme();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await api.get('/coding/sessions/my');
      setSessions(res.data);
    } catch (err) {
      toast.error('Failed to fetch your coding sessions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: t.textMuted, padding: 20 }}>Loading your coding results...</div>;
  }

  if (sessions.length === 0) {
    return <div style={{ color: t.textMuted, padding: 20 }}>You haven't completed any coding assessments yet.</div>;
  }

  return (
    <div style={{ padding: '20px 0' }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, color: t.text, marginBottom: 20 }}>
        My Coding Assessments
      </h2>

      <div style={{ overflowX: 'auto', background: t.surface, borderRadius: 12, border: `1px solid ${t.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: t.text }}>
          <thead>
            <tr style={{ background: t.border, color: t.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Question</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Language</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Tests Passed</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Final Score</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Date Taken</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s._id} style={{ borderTop: `1px solid ${t.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 500 }}>{s.question?.title || 'Unknown'}</div>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  {s.language}
                </td>
                <td style={{ padding: '16px 20px', color: s.testCasesPassed === s.totalTestCases ? t.success : t.warning }}>
                  {s.testCasesPassed || 0} / {s.totalTestCases || 0}
                </td>
                <td style={{ padding: '16px 20px', fontWeight: 600, color: t.primary }}>
                  {s.finalScore || s.codeQualityScore || 0}/100
                </td>
                <td style={{ padding: '16px 20px', color: t.textMuted, fontSize: 13 }}>
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentCodingResults;
