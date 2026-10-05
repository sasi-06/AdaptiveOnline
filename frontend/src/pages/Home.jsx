import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, themeAccentColors } from '../context/ThemeContext';
import ThemeSwitcher from '../components/ThemeSwitcher';

export default function Home() {
  const navigate = useNavigate();
  const { theme: t, themeKey } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
  }, []);

  const features = [
    { icon: '', title: 'Adaptive AI Engine', desc: "Questions dynamically adjust to each student's skill level in real time." },
    { icon: '', title: 'Deep Analytics', desc: 'Instant performance insights for both students and administrators.' },
    { icon: '', title: 'Secure & Proctored', desc: 'End-to-end encrypted sessions with role-based access control.' },
    { icon: '', title: 'Precision Scoring', desc: 'Fair, unbiased evaluation powered by intelligent grading algorithms.' },
  ];

  const stats = [
    { value: '10K+', label: 'Students' },
    { value: '500+', label: 'Exams Created' },
    { value: '99.9%', label: 'Uptime' },
    { value: '4.9', label: 'Rating' },
  ];

  // Derive nav background from theme bg with transparency
  const navBg = t.isDark
    ? `${t.bg}b3`
    : `${t.surface}cc`;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .home-root {
      min-height: 100vh;
      background: ${t.bg};
      color: ${t.text};
      font-family: 'Instrument Sans', sans-serif;
      overflow-x: hidden;
      transition: background 0.4s ease, color 0.4s ease;
    }

    /* NAV */
    .home-nav {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 48px;
      background: ${navBg};
      backdrop-filter: blur(16px);
      border-bottom: 1px solid ${t.border};
      transition: background 0.4s ease, border-color 0.4s ease;
    }
    .nav-logo {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 22px; font-weight: 800; letter-spacing: -0.5px;
      color: ${t.text};
    }
    .nav-logo span {
      background: ${t.gradient};
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .nav-cta {
      padding: 9px 22px;
      background: ${t.gradient};
      border: none; border-radius: 8px; color: #fff;
      font-family: 'Instrument Sans', sans-serif;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 20px ${t.accentGlow};
    }
    .nav-cta:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 28px ${t.accentGlow};
      filter: brightness(1.08);
    }

    /* HERO */
    .home-hero {
      min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center;
      padding: 120px 24px 80px;
      position: relative;
    }
    .hero-orb-1 {
      position: absolute; width: 600px; height: 600px; border-radius: 50%;
      background: radial-gradient(circle, ${t.accentGlow} 0%, transparent 70%);
      top: 50%; left: 50%; transform: translate(-50%, -60%);
      pointer-events: none; transition: background 0.4s ease;
    }
    .hero-orb-2 {
      position: absolute; width: 400px; height: 400px; border-radius: 50%;
      background: radial-gradient(circle, ${t.accentGlow} 0%, transparent 70%);
      bottom: 10%; right: 10%;
      pointer-events: none; transition: background 0.4s ease;
    }
    .hero-grid {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(${t.border} 1px, transparent 1px),
        linear-gradient(90deg, ${t.border} 1px, transparent 1px);
      background-size: 60px 60px;
      pointer-events: none; opacity: 0.5;
      mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent);
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 16px;
      background: ${t.tabActiveBg};
      border: 1px solid ${t.border};
      border-radius: 100px;
      font-size: 12.5px; color: ${t.accent};
      font-weight: 500; letter-spacing: 0.4px;
      margin-bottom: 28px;
      opacity: ${mounted ? 1 : 0};
      transform: translateY(${mounted ? '0' : '16px'});
      transition: opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s, background 0.4s ease, color 0.4s ease;
    }
    .badge-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: ${t.accent};
      animation: hpulse 2s infinite;
      transition: background 0.4s ease;
    }
    @keyframes hpulse {
      0%,100% { opacity:1; transform:scale(1); }
      50% { opacity:0.5; transform:scale(0.8); }
    }
    .hero-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: clamp(44px, 7vw, 82px);
      font-weight: 800; line-height: 1.05; letter-spacing: -2px;
      color: ${t.text};
      max-width: 820px; margin-bottom: 24px;
      opacity: ${mounted ? 1 : 0};
      transform: translateY(${mounted ? '0' : '24px'});
      transition: opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s, color 0.4s ease;
    }
    .hero-title .grad {
      background: ${t.gradient};
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .hero-sub {
      font-size: 17px; color: ${t.textMuted};
      max-width: 520px; line-height: 1.7; font-weight: 400; margin-bottom: 44px;
      opacity: ${mounted ? 1 : 0};
      transform: translateY(${mounted ? '0' : '24px'});
      transition: opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s, color 0.4s ease;
    }
    .hero-actions {
      display: flex; gap: 14px; align-items: center; flex-wrap: wrap; justify-content: center;
      opacity: ${mounted ? 1 : 0};
      transform: translateY(${mounted ? '0' : '24px'});
      transition: opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s;
    }
    .btn-primary {
      padding: 14px 32px; background: ${t.gradient};
      border: none; border-radius: 10px; color: #fff;
      font-family: 'Instrument Sans', sans-serif;
      font-size: 15px; font-weight: 600; cursor: pointer;
      transition: all 0.22s ease;
      box-shadow: 0 8px 32px ${t.accentGlow};
      display: flex; align-items: center; gap: 8px;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 40px ${t.accentGlow};
      filter: brightness(1.08);
    }
    .btn-secondary {
      padding: 14px 28px; background: transparent;
      border: 1px solid ${t.border}; border-radius: 10px;
      color: ${t.textMuted};
      font-family: 'Instrument Sans', sans-serif;
      font-size: 15px; font-weight: 500; cursor: pointer;
      transition: all 0.22s ease;
    }
    .btn-secondary:hover {
      border-color: ${t.accent};
      color: ${t.text};
      background: ${t.tabActiveBg};
    }

    /* STATS */
    .stats-strip {
      display: flex; align-items: center; justify-content: center;
      padding: 0 24px 100px;
      opacity: ${mounted ? 1 : 0};
      transition: opacity 0.6s ease 0.55s;
    }
    .stat-item {
      text-align: center; padding: 0 48px;
      border-right: 1px solid ${t.border};
      transition: border-color 0.4s ease;
    }
    .stat-item:last-child { border-right: none; }
    .stat-value {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 32px; font-weight: 800;
      background: ${t.gradient};
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      line-height: 1.1;
    }
    .stat-label {
      font-size: 12.5px; color: ${t.textSub};
      font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 4px;
      transition: color 0.4s ease;
    }

    /* FEATURES */
    .features-section { padding: 80px 48px 120px; max-width: 1100px; margin: 0 auto; }
    .section-label {
      text-align: center; font-size: 12px; font-weight: 600;
      letter-spacing: 2px; text-transform: uppercase;
      color: ${t.accent}; margin-bottom: 16px; transition: color 0.4s ease;
    }
    .section-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: clamp(28px, 4vw, 42px); font-weight: 800;
      text-align: center; letter-spacing: -1px;
      color: ${t.text}; margin-bottom: 60px; line-height: 1.15;
      transition: color 0.4s ease;
    }
    .features-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px;
    }
    .feature-card {
      background: ${t.surfaceAlt}; border: 1px solid ${t.border};
      border-radius: 16px; padding: 28px 24px;
      transition: all 0.25s ease; cursor: default;
    }
    .feature-card:hover {
      background: ${t.tabActiveBg}; border-color: ${t.accent};
      transform: translateY(-4px);
      box-shadow: 0 16px 48px ${t.cardShadow};
    }
    .feature-icon { font-size: 28px; margin-bottom: 16px; display: block; }
    .feature-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 16px; font-weight: 700;
      color: ${t.text}; margin-bottom: 10px; transition: color 0.4s ease;
    }
    .feature-desc {
      font-size: 13.5px; color: ${t.textMuted};
      line-height: 1.65; transition: color 0.4s ease;
    }

    /* CTA */
    .cta-section {
      margin: 0 48px 100px;
      background: ${t.tabActiveBg};
      border: 1px solid ${t.border};
      border-radius: 24px; padding: 72px 48px;
      text-align: center; position: relative; overflow: hidden;
      transition: background 0.4s ease, border-color 0.4s ease;
    }
    .cta-section::before {
      content: ''; position: absolute;
      top: -80px; left: 50%; transform: translateX(-50%);
      width: 400px; height: 200px;
      background: radial-gradient(ellipse, ${t.accentGlow}, transparent 70%);
      pointer-events: none;
    }
    .cta-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: clamp(26px, 4vw, 40px); font-weight: 800; letter-spacing: -1px;
      color: ${t.text}; margin-bottom: 16px; transition: color 0.4s ease;
    }
    .cta-sub {
      font-size: 15px; color: ${t.textMuted}; margin-bottom: 36px;
      max-width: 420px; margin-left: auto; margin-right: auto;
      line-height: 1.6; transition: color 0.4s ease;
    }

    /* FOOTER */
    .home-footer {
      border-top: 1px solid ${t.border};
      padding: 28px 48px;
      display: flex; align-items: center; justify-content: space-between;
      transition: border-color 0.4s ease;
    }
    .footer-logo {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 16px; font-weight: 700; color: ${t.text};
    }
    .footer-logo span {
      background: ${t.gradient};
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .footer-copy { font-size: 12.5px; color: ${t.textSub}; transition: color 0.4s ease; }

    @media (max-width: 640px) {
      .home-nav { padding: 16px 20px; }
      .stats-strip { flex-wrap: wrap; }
      .stat-item { padding: 16px 24px; border-right: none; border-bottom: 1px solid ${t.border}; width: 50%; }
      .features-section { padding: 60px 20px 80px; }
      .cta-section { margin: 0 16px 60px; padding: 48px 24px; }
      .home-footer { flex-direction: column; gap: 8px; text-align: center; padding: 20px; }
    }
  `;

  return (
    <>
      <style>{css}</style>
      <ThemeSwitcher />
      <div className="home-root">

        <nav className="home-nav">
          <div className="nav-logo"><span>Adapt</span>Exam</div>
          <button className="nav-cta" onClick={() => navigate('/login')}>Sign In →</button>
        </nav>

        <section className="home-hero">
          <div className="hero-orb-1" />
          <div className="hero-orb-2" />
          <div className="hero-grid" />
          <div className="hero-badge">
            <span className="badge-dot" />
            AI-Powered Examination Platform
          </div>
          <h1 className="hero-title">
            Exams that adapt to<br />
            <span className="grad">every student's mind</span>
          </h1>
          <p className="hero-sub">
            AdaptExam uses real-time AI to personalise every test, giving students
            fair assessments and educators deeper insights than ever before.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/login')}>
              Get Started <span>→</span>
            </button>
            <button className="btn-secondary" onClick={() =>
              document.getElementById('features').scrollIntoView({ behavior: 'smooth' })
            }>
              Learn More
            </button>
          </div>
        </section>

        <div className="stats-strip">
          {stats.map((s) => (
            <div key={s.label} className="stat-item">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <section className="features-section" id="features">
          <div className="section-label">Why AdaptExam</div>
          <h2 className="section-title">Everything you need for<br />smarter examinations</h2>
          <div className="features-grid">
            {features.map((f) => (
              <div key={f.title} className="feature-card">
                <span className="feature-icon">{f.icon}</span>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-section">
          <h2 className="cta-title">Ready to transform your exams?</h2>
          <p className="cta-sub">Join thousands of educators and students already using AdaptExam.</p>
          <button className="btn-primary" style={{ margin: '0 auto', display: 'inline-flex' }}
            onClick={() => navigate('/login')}>
            Sign In to Your Account →
          </button>
        </section>

        <footer className="home-footer">
          <div className="footer-logo"><span>Adapt</span>Exam</div>
          <div className="footer-copy">© {new Date().getFullYear()} AdaptExam. All rights reserved.</div>
        </footer>

      </div>
    </>
  );
}
