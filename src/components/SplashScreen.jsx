import { useState, useEffect } from 'react';

export default function SplashScreen({ onFinish }) {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('logo'), 400),
      setTimeout(() => setPhase('brand'), 1200),
      setTimeout(() => setPhase('tagline'), 2000),
      setTimeout(() => setPhase('exit'), 3400),
      setTimeout(() => onFinish(), 4200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onFinish]);

  return (
    <div className={`splash-screen ${phase}`}>
      {/* Animated background particles */}
      <div className="splash-particles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="splash-particle" style={{
            '--x': `${Math.random() * 100}%`,
            '--y': `${Math.random() * 100}%`,
            '--size': `${Math.random() * 4 + 2}px`,
            '--delay': `${Math.random() * 2}s`,
            '--duration': `${Math.random() * 3 + 2}s`,
          }} />
        ))}
      </div>

      {/* Orbiting rings */}
      <div className="splash-orbit-container">
        <div className="splash-orbit splash-orbit-1"></div>
        <div className="splash-orbit splash-orbit-2"></div>
        <div className="splash-orbit splash-orbit-3"></div>
      </div>

      <div className="splash-content">
        {/* Logo */}
        <div className="splash-logo-container">
          <div className="splash-logo-glow"></div>
          <div className="splash-logo-hexagon">
            <span>PP</span>
          </div>
        </div>

        {/* Brand name */}
        <div className="splash-brand">
          <h1 className="splash-title">
            {'Posh Print'.split('').map((char, i) => (
              <span key={i} className="splash-char" style={{ '--i': i }}>
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </h1>
          <div className="splash-line"></div>
        </div>

        {/* Tagline */}
        <div className="splash-tagline">
          <span className="splash-made">Made by</span>
          <span className="splash-company">Nastech Company</span>
        </div>
      </div>
    </div>
  );
}
