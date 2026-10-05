import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, studentLogin } from '../services/api';
import { useTheme, themeAccentColors } from '../context/ThemeContext';

export default function Login() {
  const navigate = useNavigate();
  const { themeKey, setThemeKey, theme: t, themes } = useTheme(); // ← global context
  const [tab, setTab] = useState('student');
  const [form, setForm] = useState({ username: '', email: '', password: '', identifier: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      setError('Your session has expired. Please sign in again.');
    }
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    localStorage.clear(); // Clean slate for new session
    try {
      let res;
      if (tab === 'admin') {
        res = await adminLogin({ username: form.username, password: form.password });
      } else {
        res = await studentLogin({ email: form.email, password: form.password });
      }
      const { token, role, name, id } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('role', role);
      localStorage.setItem('name', name);
      if (role === 'student' && id) {
        localStorage.setItem('studentId', id);
      }
      navigate(role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const iconMap = { obsidian: '◈', arctic: '◇', ember: '◉', jade: '◆' };
  const isDark = t.isDark;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .login-root {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: ${t.bg};
      font-family: 'Outfit', sans-serif;
      padding: 24px;
      position: relative;
      overflow: hidden;
      transition: background 0.4s ease;
    }
    .login-bg-orb-1 {
      position: absolute; width: 500px; height: 500px; border-radius: 50%;
      background: ${t.accentGlow}; filter: blur(100px);
      top: -120px; left: -100px; pointer-events: none; transition: background 0.4s ease;
    }
    .login-bg-orb-2 {
      position: absolute; width: 350px; height: 350px; border-radius: 50%;
      background: ${t.accentGlow}; filter: blur(80px);
      bottom: -80px; right: -60px; pointer-events: none; transition: background 0.4s ease;
    }
    .login-bg-grid {
      position: absolute; inset: 0;
      background-image: linear-gradient(${t.border}22 1px, transparent 1px),
        linear-gradient(90deg, ${t.border}22 1px, transparent 1px);
      background-size: 48px 48px; pointer-events: none; opacity: 0.6;
    }
    .login-wrapper {
      position: relative; z-index: 2; width: 100%; max-width: 420px;
      opacity: ${mounted ? 1 : 0};
      transform: translateY(${mounted ? '0' : '24px'});
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .login-brand { text-align: center; margin-bottom: 32px; }
    .login-brand-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 52px; height: 52px; border-radius: 14px;
      background: ${t.gradient}; font-size: 22px; color: #fff;
      margin-bottom: 16px; box-shadow: 0 8px 32px ${t.accentGlow};
    }
    .login-brand h1 {
      font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800;
      color: ${t.text}; letter-spacing: -0.5px; line-height: 1; transition: color 0.4s ease;
    }
    .login-brand h1 span {
      background: ${t.gradient}; -webkit-background-clip: text;
      -webkit-text-fill-color: transparent; background-clip: text;
    }
    .login-brand p {
      margin-top: 8px; font-size: 13px; color: ${t.textMuted};
      font-weight: 300; letter-spacing: 0.4px; transition: color 0.4s ease;
    }
    .login-card {
      background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 20px;
      padding: 32px;
      box-shadow: 0 24px 64px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}, 0 0 0 1px ${t.border};
      transition: background 0.4s ease, border-color 0.4s ease;
    }
    .form-group { margin-bottom: 18px; }
    .form-label {
      display: block; font-size: 12.5px; font-weight: 500; color: ${t.textMuted};
      margin-bottom: 8px; letter-spacing: 0.5px; text-transform: uppercase;
      transition: color 0.4s ease;
    }
    .input-wrap { position: relative; }
    .input-icon {
      position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
      color: ${t.textSub}; font-size: 15px; pointer-events: none; transition: color 0.2s;
    }
    .form-input {
      width: 100%; padding: 12px 14px 12px 40px;
      background: ${t.inputBg}; border: 1.5px solid ${t.border}; border-radius: 10px;
      color: ${t.text}; font-family: 'Outfit', sans-serif;
      font-size: 14.5px; font-weight: 400; outline: none; transition: all 0.22s ease;
    }
    .form-input::placeholder { color: ${t.textSub}; }
    .form-input:focus {
      border-color: ${t.accent}; background: ${t.surfaceAlt};
      box-shadow: 0 0 0 3px ${t.accentGlow};
    }
    .input-wrap:focus-within .input-icon { color: ${t.accent}; }
    .input-icon-right {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      cursor: pointer; color: ${t.textSub}; font-size: 14px;
      background: none; border: none; padding: 0; transition: color 0.2s;
    }
    .input-icon-right:hover { color: ${t.accent}; }
    .error-box {
      display: flex; align-items: center; gap: 10px;
      background: ${t.errorBg}; border: 1px solid ${t.errorBorder}55;
      border-radius: 10px; padding: 12px 14px; margin-bottom: 20px;
      color: ${t.errorText}; font-size: 13.5px; line-height: 1.4;
    }
    .submit-btn {
      width: 100%; padding: 13px; background: ${t.gradient}; border: none;
      border-radius: 10px; color: #fff; font-family: 'Outfit', sans-serif;
      font-size: 15px; font-weight: 600; cursor: pointer; letter-spacing: 0.3px;
      box-shadow: 0 4px 20px ${t.accentGlow}; transition: all 0.22s ease; margin-top: 4px;
    }
    .submit-btn:not(:disabled):hover {
      transform: translateY(-1px); box-shadow: 0 8px 28px ${t.accentGlow}; filter: brightness(1.08);
    }
    .submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }
    .submit-btn-inner { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .secure-badge {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 20px; font-size: 11.5px; color: ${t.textSub}; letter-spacing: 0.3px;
    }

    /* ── Theme Switcher ── */
    .theme-switcher { position: fixed; top: 20px; right: 20px; z-index: 100; }
    .theme-toggle-btn {
      width: 40px; height: 40px; border-radius: 10px;
      background: ${t.surface}; border: 1px solid ${t.border}; cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 16px;
      box-shadow: 0 4px 16px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'};
      transition: all 0.22s ease; color: ${t.text};
    }
    .theme-toggle-btn:hover { transform: scale(1.05); box-shadow: 0 6px 20px ${t.accentGlow}; border-color: ${t.accent}; }
    .theme-panel {
      position: absolute; top: 48px; right: 0;
      background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px;
      padding: 10px; display: flex; flex-direction: column; gap: 4px;
      box-shadow: 0 16px 48px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)'};
      min-width: 140px; animation: popIn 0.18s ease;
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.92) translateY(-6px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .theme-opt {
      display: flex; align-items: center; gap: 10px; padding: 9px 12px;
      border-radius: 8px; cursor: pointer; border: none; background: transparent;
      font-family: 'Outfit', sans-serif; font-size: 13.5px; font-weight: 500;
      color: ${t.textMuted}; width: 100%; text-align: left; transition: all 0.15s ease;
    }
    .theme-opt:hover { background: ${t.surfaceAlt}; color: ${t.text}; }
    .theme-opt.ts-active { background: ${t.tabActiveBg}; color: ${t.accent}; }
    .theme-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  `;

  return (
    <>
      <style>{css}</style>
      <div className="login-root">
        <div className="login-bg-orb-1" />
        <div className="login-bg-orb-2" />
        <div className="login-bg-grid" />

        {/* Global Theme Switcher */}
        <div className="theme-switcher">
          <button className="theme-toggle-btn" onClick={() => setShowThemes(!showThemes)} title="Change theme">
            
          </button>
          {showThemes && (
            <div className="theme-panel">
              {Object.entries(themes).map(([key, th]) => (
                <button
                  key={key}
                  className={`theme-opt ${themeKey === key ? 'ts-active' : ''}`}
                  onClick={() => { setThemeKey(key); setShowThemes(false); }}
                >
                  <span className="theme-dot" style={{ background: themeAccentColors[key] }} />
                  {th.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="login-wrapper">
          <div className="login-brand">
            <div className="login-brand-icon">{iconMap[themeKey]}</div>
            <h1><span>Adapt</span>Exam</h1>
            <p>AI-Powered Adaptive Online Examination</p>
          </div>

          <div className="login-card">
            {error && (
              <div className="error-box">
                <span></span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email or Username</label>
                <div className="input-wrap">
                  <span className="input-icon"></span>
                  <input
                    className="form-input"
                    name="identifier"
                    type="text"
                    placeholder="Email or username"
                    value={form.identifier}
                    onChange={(e) => {
                      const val = e.target.value;
                      const isEmail = val.includes('@');
                      setForm({ ...form, identifier: val, email: isEmail ? val : form.email, username: !isEmail ? val : form.username });
                      setTab(isEmail ? 'student' : 'admin');
                    }}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-wrap">
                  <span className="input-icon"></span>
                  <input
                    className="form-input"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    required
                    style={{ paddingRight: '42px' }}
                  />
                  <button type="button" className="input-icon-right"
                    onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? '' : ''}
                  </button>
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                <span className="submit-btn-inner">
                  {loading ? <><span className="spinner" /> Signing in…</> : <>Sign In →</>}
                </span>
              </button>
            </form>
          </div>

          <div className="secure-badge"> &nbsp;256-bit encrypted · Secure session</div>
        </div>
      </div>
    </>
  );
}
