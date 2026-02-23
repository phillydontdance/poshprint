import { useState, useEffect } from 'react';

export default function SplashScreen({ onFinish }) {
  const [phase, setPhase] = useState('enter'); // enter → show → exit → done

  useEffect(() => {
    // Phase 1: entrance animation plays (CSS handles it)
    const showTimer = setTimeout(() => setPhase('show'), 800);
    // Phase 2: hold for a moment
    const exitTimer = setTimeout(() => setPhase('exit'), 2800);
    // Phase 3: fade out and unmount
    const doneTimer = setTimeout(() => onFinish(), 3600);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div className={`splash-screen ${phase}`}>
      <div className="splash-content">
        <div className="splash-logo-ring">
          <div className="splash-ring"></div>
          <div className="splash-icon">N</div>
        </div>
        <div className="splash-text">
          <span className="splash-made">Made by</span>
          <span className="splash-company">Nastech</span>
          <span className="splash-suffix">Company</span>
        </div>
        <div className="splash-line"></div>
      </div>
    </div>
  );
}
