// src/demo/DemoLayout.tsx
//
// Route element for `/demo/*`. Wraps the rendered page in <DemoProvider>
// (auth + adapter activation) and mounts the <TourPlayer> overlay.
//
// Presentation mode: the app sits inside a cinematic stage —
// aurora backdrop, glass chrome bar, scanline sweep, and a live REC indicator
// for a premium screen-recording aesthetic.

import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import DemoProvider from "./DemoContext";
import TourPlayer from "./TourPlayer";

const STAGE_SCALE = 0.72;
const INVERSE = 1 / STAGE_SCALE;

// ─── Root layout ────────────────────────────────────────────────────────────

export function DemoLayout() {
  return (
    <DemoProvider>
      <style>{CSS}</style>

      {/* ── Cinematic backdrop ── */}
      <div className="demo-root">

        {/* Aurora blobs */}
        <div className="demo-aurora" aria-hidden>
          <div className="demo-aurora__blob demo-aurora__blob--violet" />
          <div className="demo-aurora__blob demo-aurora__blob--teal" />
          <div className="demo-aurora__blob demo-aurora__blob--rose" />
        </div>

        {/* Dot-grid texture */}
        <div className="demo-dotgrid" aria-hidden />

        {/* Outer presentation frame */}
        <div className="demo-frame">
          <ChromeBar />

          {/* Scaled stage */}
          <div className="demo-stage">
            <div
              style={{
                width: `${INVERSE * 100}%`,
                minHeight: `${INVERSE * 100}%`,
                transform: `scale(${STAGE_SCALE})`,
                transformOrigin: "0 0",
              }}
            >
              <Outlet />
            </div>
          </div>
        </div>

        {/* Scanline sweep */}
        <div className="demo-scanline" aria-hidden />

        {/* Corner glows */}
        <div className="demo-glow demo-glow--tl" aria-hidden />
        <div className="demo-glow demo-glow--br" aria-hidden />

        {/* Step pill */}
        <StepPill />
      </div>

      <TourPlayer />
    </DemoProvider>
  );
}

// ─── Chrome bar ─────────────────────────────────────────────────────────────

function ChromeBar() {
  return (
    <header className="demo-chrome">
      <div className="demo-chrome__lights" aria-hidden>
        <span className="demo-chrome__dot demo-chrome__dot--red" />
        <span className="demo-chrome__dot demo-chrome__dot--yellow" />
        <span className="demo-chrome__dot demo-chrome__dot--green" />
      </div>

      <div className="demo-chrome__url">
        <div>
          <span className="demo-chrome__favicon" aria-hidden />
          <span className="demo-chrome__urltext">app.demo / guided-tour</span>
        </div>
      </div>

      <div className="demo-chrome__actions">
        <RecIndicator />
        <button className="demo-chrome__btn" aria-label="Minimiser">
          <span className="demo-chrome__btn-icon demo-chrome__btn-icon--minus" />
        </button>
        <button className="demo-chrome__btn demo-chrome__btn--accent" aria-label="Agrandir">
          <span className="demo-chrome__btn-icon demo-chrome__btn-icon--square" />
        </button>
      </div>
    </header>
  );
}

// ─── REC indicator ───────────────────────────────────────────────────────────

function RecIndicator() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="demo-rec" aria-label={`Enregistrement en cours : ${mm}:${ss}`}>
      <span className="demo-rec__dot" aria-hidden />
      <span className="demo-rec__label">REC</span>
      <span className="demo-rec__timer">{mm}:{ss}</span>
    </div>
  );
}

// ─── Step pill ───────────────────────────────────────────────────────────────

function StepPill() {
  return (
    <div className="demo-pill" role="status" aria-live="polite">
      <span className="demo-pill__dot" aria-hidden />
      <span className="demo-pill__text">DEMO MODE</span>
      <span className="demo-pill__sep" aria-hidden />
      <span className="demo-pill__hint">ESC pour quitter</span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CSS = `
  .demo-root {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #050608;
  }

  /* ── Aurora ── */
  .demo-aurora {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .demo-aurora__blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    will-change: transform;
  }
  .demo-aurora__blob--violet {
    width: 520px; height: 380px;
    top: -80px; left: -100px;
    background: radial-gradient(ellipse, rgba(99,60,220,.40) 0%, transparent 70%);
    animation: demoAuroraA 14s ease-in-out infinite;
  }
  .demo-aurora__blob--teal {
    width: 420px; height: 340px;
    top: 120px; right: -80px;
    background: radial-gradient(ellipse, rgba(16,185,180,.28) 0%, transparent 70%);
    animation: demoAuroraB 18s ease-in-out infinite;
  }
  .demo-aurora__blob--rose {
    width: 360px; height: 260px;
    bottom: -60px; left: 35%;
    background: radial-gradient(ellipse, rgba(220,80,120,.22) 0%, transparent 70%);
    animation: demoAuroraC 22s ease-in-out infinite;
  }
  @keyframes demoAuroraA {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(50px,-40px) scale(1.12); }
    66%      { transform: translate(-25px,30px) scale(0.94); }
  }
  @keyframes demoAuroraB {
    0%,100% { transform: translate(0,0) scale(1); }
    40%      { transform: translate(-60px,35px) scale(1.09); }
    70%      { transform: translate(35px,-30px) scale(1.05); }
  }
  @keyframes demoAuroraC {
    0%,100% { transform: translate(0,0) scale(1); }
    50%      { transform: translate(30px,50px) scale(1.15); }
  }

  /* ── Dot grid ── */
  .demo-dotgrid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(circle, rgba(255,255,255,.13) 1px, transparent 1px);
    background-size: 28px 28px;
    mask-image: radial-gradient(ellipse 72% 72% at 50% 50%, black 10%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse 72% 72% at 50% 50%, black 10%, transparent 80%);
  }

  /* ── Frame ── */
  .demo-frame {
    position: absolute;
    inset: 18px 48px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,.10);
    box-shadow:
      0 0 0 1px rgba(0,0,0,.85),
      0 40px 120px rgba(0,0,0,.92),
      0 0 80px rgba(99,60,220,.16),
      inset 0 1px 0 rgba(255,255,255,.07);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: rgba(8,9,14,.94);
  }

  /* ── Chrome ── */
  .demo-chrome {
    flex-shrink: 0;
    height: 44px;
    background: linear-gradient(180deg, rgba(255,255,255,.058) 0%, rgba(255,255,255,.018) 100%);
    border-bottom: 1px solid rgba(255,255,255,.07);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 10px;
  }
  .demo-chrome__lights { display: flex; gap: 7px; align-items: center; }
  .demo-chrome__dot {
    display: block;
    width: 12px; height: 12px;
    border-radius: 50%;
  }
  .demo-chrome__dot--red    { background: #ff5f57; box-shadow: 0 0 7px #ff5f5760; }
  .demo-chrome__dot--yellow { background: #ffbd2e; box-shadow: 0 0 7px #ffbd2e60; }
  .demo-chrome__dot--green  { background: #28c840; box-shadow: 0 0 7px #28c84060; }

  .demo-chrome__url {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .demo-chrome__url > div {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 26px;
    padding: 0 14px;
    border-radius: 8px;
    background: rgba(255,255,255,.055);
    border: 1px solid rgba(255,255,255,.07);
  }
  .demo-chrome__favicon {
    display: block;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: linear-gradient(135deg, #a78bfa, #38bdf8);
    flex-shrink: 0;
  }
  .demo-chrome__urltext {
    font-size: 11px;
    color: rgba(255,255,255,.38);
    font-family: ui-monospace, 'SF Mono', monospace;
    letter-spacing: .03em;
    user-select: none;
  }
  .demo-chrome__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
  .demo-chrome__btn {
    width: 28px; height: 28px;
    border-radius: 7px;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.08);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background .15s;
  }
  .demo-chrome__btn:hover { background: rgba(255,255,255,.09); }
  .demo-chrome__btn--accent {
    background: rgba(99,60,220,.22);
    border-color: rgba(167,139,250,.28);
  }
  .demo-chrome__btn--accent:hover { background: rgba(99,60,220,.35); }
  .demo-chrome__btn-icon--minus {
    display: block;
    width: 9px; height: 1.5px;
    background: rgba(255,255,255,.45);
    border-radius: 1px;
  }
  .demo-chrome__btn-icon--square {
    display: block;
    width: 9px; height: 9px;
    border: 1.5px solid rgba(167,139,250,.85);
    border-radius: 2.5px;
  }

  /* ── Stage ── */
  .demo-stage {
    flex: 1;
    position: relative;
    overflow-y: auto;          /* ← scroll vertical activé */
    overflow-x: hidden;
    background: hsl(var(--background));
  }

  /* ── REC ── */
  .demo-rec {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(239,68,68,.10);
    border: 1px solid rgba(239,68,68,.22);
    padding: 4px 11px;
    border-radius: 7px;
  }
  .demo-rec__dot {
    position: relative;
    display: block;
    width: 8px; height: 8px;
    flex-shrink: 0;
  }
  .demo-rec__dot::before,
  .demo-rec__dot::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: #ef4444;
  }
  .demo-rec__dot::after {
    background: transparent;
    border: 1.5px solid #ef4444;
    animation: demoRecRing 1.4s ease-out infinite;
  }
  @keyframes demoRecRing {
    0%   { opacity: .7; transform: scale(1); }
    100% { opacity: 0;  transform: scale(2.4); }
  }
  .demo-rec__label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .14em;
    color: rgba(239,68,68,.9);
    font-family: ui-monospace, 'SF Mono', monospace;
  }
  .demo-rec__timer {
    font-size: 10px;
    color: rgba(239,68,68,.5);
    font-family: ui-monospace, 'SF Mono', monospace;
    min-width: 30px;
  }

  /* ── Scanline ── */
  .demo-scanline {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    border-radius: 18px;
    z-index: 20;
  }
  .demo-scanline::after {
    content: '';
    position: absolute;
    left: 0; right: 0;
    height: 140px;
    background: linear-gradient(180deg, transparent, rgba(255,255,255,.016), transparent);
    animation: demoScanline 10s linear infinite;
  }
  @keyframes demoScanline {
    0%   { transform: translateY(-140px); }
    100% { transform: translateY(100vh); }
  }

  /* ── Corner glows ── */
  .demo-glow {
    position: absolute;
    width: 260px; height: 260px;
    border-radius: 50%;
    pointer-events: none;
  }
  .demo-glow--tl {
    top: 18px; left: 18px;
    background: radial-gradient(circle, rgba(99,60,220,.13), transparent 70%);
  }
  .demo-glow--br {
    bottom: 18px; right: 18px;
    background: radial-gradient(circle, rgba(16,185,180,.09), transparent 70%);
  }

  /* ── Step pill ── */
  .demo-pill {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 18px;
    border-radius: 999px;
    background: rgba(5,6,8,.72);
    backdrop-filter: blur(18px) saturate(180%);
    -webkit-backdrop-filter: blur(18px) saturate(180%);
    border: 1px solid rgba(255,255,255,.09);
    box-shadow: 0 8px 32px rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.6);
    white-space: nowrap;
  }
  .demo-pill__dot {
    display: block;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #a78bfa;
    box-shadow: 0 0 9px #a78bfaaa;
    flex-shrink: 0;
  }
  .demo-pill__text {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .1em;
    color: rgba(255,255,255,.45);
    font-family: ui-monospace, 'SF Mono', monospace;
  }
  .demo-pill__sep {
    display: block;
    width: 1px; height: 11px;
    background: rgba(255,255,255,.10);
  }
  .demo-pill__hint {
    font-size: 10px;
    color: rgba(167,139,250,.55);
    font-family: ui-monospace, 'SF Mono', monospace;
    letter-spacing: .04em;
  }
`;

export default DemoLayout;