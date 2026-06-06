'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useDrillStore, BALL_ID_CONST, EntityPos } from '@/store/drillStore';

// ─── SVG viewport ────────────────────────────────────────────────────────────
const VW = 400;
const VH = 220;

// ─── Perspective trapezoid ───────────────────────────────────────────────────
// Court coords: (0–400 x, 0–200 y)  y=0 = far end, y=200 = near (viewer side)
const NY = 198, FY = 20;          // near/far screen Y
const NLX = 6,  NRX = 394;       // near left/right X (wide)
const FLX = 72, FRX = 328;       // far  left/right X (narrow)

function cToS(cx: number, cy: number) {
  const t = 1 - Math.max(0, Math.min(1, cy / 200)); // 0=near, 1=far
  const lx = NLX + (FLX - NLX) * t;
  const rx = NRX + (FRX - NRX) * t;
  return {
    x: lx + (rx - lx) * Math.max(0, Math.min(1, cx / 400)),
    y: NY  + (FY  - NY)  * t,
  };
}

function sToC(sx: number, sy: number): EntityPos {
  const t  = Math.max(0, Math.min(1, (sy - NY) / (FY - NY)));
  const lx = NLX + (FLX - NLX) * t;
  const rx = NRX + (FRX - NRX) * t;
  const denom = Math.max(1, rx - lx);
  return {
    x: Math.max(0, Math.min(400, ((sx - lx) / denom) * 400)),
    y: Math.max(0, Math.min(200, (1 - t) * 200)),
  };
}

// Project a circle → perspective polygon path
function projCircle(cx: number, cy: number, r: number, n = 44) {
  return Array.from({ length: n }, (_, i) => {
    const θ = (i / n) * Math.PI * 2;
    const p = cToS(cx + r * Math.cos(θ), cy + r * Math.sin(θ));
    return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`;
  }).join(' ') + ' Z';
}

// Project arc
function projArc(cx: number, cy: number, r: number, a0: number, a1: number, n = 32) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const θ = a0 + (a1 - a0) * (i / n);
    const p = cToS(cx + r * Math.cos(θ), cy + r * Math.sin(θ));
    return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`;
  }).join(' ');
}

function lerpPos(a: EntityPos, b: EntityPos, t: number): EntityPos {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const PAL = {
  home:    { j: '#1d6fe8', jhi: '#6db3ff', jlo: '#0d3070', sh: '#0d2560', stripe: '#ffffff' },
  away:    { j: '#e03030', jhi: '#ff8888', jlo: '#6a0c0c', sh: '#5a0808', stripe: '#ffffff' },
  home_gk: { j: '#17a589', jhi: '#5efcd9', jlo: '#0c5040', sh: '#0c4c40', stripe: '#ffd700' },
  away_gk: { j: '#8b30e8', jhi: '#cc88ff', jlo: '#420888', sh: '#380870', stripe: '#ffffff' },
};
const SKIN = '#f5c478';
const SKIN_HI = '#fff0d0';
const SKIN_SH = '#c07828';

// ─── SVG Defs ─────────────────────────────────────────────────────────────────
function SVGDefs() {
  return (
    <defs>
      {/* Wood parquet */}
      <pattern id="wood" x="0" y="0" width="30" height="9" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="30" height="4.5" fill="#cc924a" />
        <rect x="0" y="4.5" width="30" height="4.5" fill="#c08840" />
        <line x1="7.5"  y1="0" x2="7.5"  y2="4.5" stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="15"   y1="0" x2="15"   y2="4.5" stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="22.5" y1="0" x2="22.5" y2="4.5" stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="5"    y1="4.5" x2="5"  y2="9" stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="15"   y1="4.5" x2="15" y2="9" stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="25"   y1="4.5" x2="25" y2="9" stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="0" y1="4.5" x2="30" y2="4.5" stroke="rgba(0,0,0,0.16)" strokeWidth="0.5" />
      </pattern>

      {/* Court depth gradient */}
      <linearGradient id="depthGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#000" stopOpacity="0.46" />
        <stop offset="40%"  stopColor="#000" stopOpacity="0.10" />
        <stop offset="70%"  stopColor="#000" stopOpacity="0.00" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0.05" />
      </linearGradient>

      {/* Centre light reflection */}
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="#fff" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0.00" />
      </radialGradient>

      {/* Arena dark bg */}
      <linearGradient id="arenaBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#080818" />
        <stop offset="100%" stopColor="#141430" />
      </linearGradient>

      {/* Sphere gradients for head/ball */}
      {(Object.keys(PAL) as Array<keyof typeof PAL>).map(k => (
        <radialGradient key={k} id={`sph-${k}`} cx="33%" cy="28%" r="70%">
          <stop offset="0%"   stopColor={PAL[k].jhi} />
          <stop offset="55%"  stopColor={PAL[k].j} />
          <stop offset="100%" stopColor={PAL[k].jlo} />
        </radialGradient>
      ))}
      <radialGradient id="sph-skin" cx="33%" cy="28%" r="70%">
        <stop offset="0%"   stopColor={SKIN_HI} />
        <stop offset="55%"  stopColor={SKIN} />
        <stop offset="100%" stopColor={SKIN_SH} />
      </radialGradient>
      <radialGradient id="sph-ball" cx="33%" cy="28%" r="70%">
        <stop offset="0%"   stopColor="#ffffff" />
        <stop offset="55%"  stopColor="#f0f0e8" />
        <stop offset="100%" stopColor="#aaaaaa" />
      </radialGradient>
      <radialGradient id="sph-boot" cx="33%" cy="28%" r="70%">
        <stop offset="0%"   stopColor="#555" />
        <stop offset="55%"  stopColor="#1a1a1a" />
        <stop offset="100%" stopColor="#000" />
      </radialGradient>

      {/* Cylinder H gradient per team */}
      {(Object.keys(PAL) as Array<keyof typeof PAL>).map(k => (
        <linearGradient key={k} id={`cH-${k}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={PAL[k].jlo} />
          <stop offset="22%"  stopColor={PAL[k].jhi} />
          <stop offset="60%"  stopColor={PAL[k].j} />
          <stop offset="100%" stopColor={PAL[k].jlo} />
        </linearGradient>
      ))}
      <linearGradient id="cH-skin" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stopColor={SKIN_SH} />
        <stop offset="25%"  stopColor={SKIN_HI} />
        <stop offset="65%"  stopColor={SKIN} />
        <stop offset="100%" stopColor={SKIN_SH} />
      </linearGradient>

      {/* Cylinder V gradient per team */}
      {(Object.keys(PAL) as Array<keyof typeof PAL>).map(k => (
        <linearGradient key={k} id={`cV-${k}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={PAL[k].jhi} />
          <stop offset="45%"  stopColor={PAL[k].j} />
          <stop offset="100%" stopColor={PAL[k].jlo} />
        </linearGradient>
      ))}
      <linearGradient id="cV-skin" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor={SKIN_HI} />
        <stop offset="45%"  stopColor={SKIN} />
        <stop offset="100%" stopColor={SKIN_SH} />
      </linearGradient>

      {/* Drop shadow */}
      <filter id="fshadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.6" />
      </filter>
      <filter id="fglow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#FFD60A" floodOpacity="0.9" />
      </filter>

      {/* Hair clips per team */}
      {(Object.keys(PAL) as Array<keyof typeof PAL>).map(k => (
        <clipPath key={k} id={`hc-${k}`}>
          <rect x="-9" y="-28" width="18" height="13" />
        </clipPath>
      ))}
    </defs>
  );
}

// ─── Isometric court ──────────────────────────────────────────────────────────
function IsoCourt() {
  const corners = [cToS(0,0), cToS(400,0), cToS(400,200), cToS(0,200)];
  const courtPath = corners.map((p,i)=>`${i===0?'M':'L'}${p.x},${p.y}`).join(' ')+' Z';

  const gl = cToS(0, 100);   // left goal  (cx=0, half-width)
  const gr = cToS(400, 100); // right goal

  // Goal width = 15 court units each side of centre
  const glT = cToS(0, 85), glB = cToS(0, 115);
  const grT = cToS(400, 85), grB = cToS(400, 115);

  // Goal depth offset (into court)
  const gDepth = 12; // court units into court
  const glT2 = cToS(gDepth, 88), glB2 = cToS(gDepth, 112);
  const grT2 = cToS(400-gDepth, 88), grB2 = cToS(400-gDepth, 112);

  // Centre line
  const clTop = cToS(200, 0), clBot = cToS(200, 200);

  // Penalty spots
  const lspot = cToS(55, 100);
  const rspot = cToS(345, 100);

  return (
    <g>
      {/* Arena background */}
      <rect x={0} y={0} width={VW} height={VH} fill="url(#arenaBg)" rx={6} />

      {/* Purple stands - top */}
      <rect x={0} y={0} width={VW} height={FY + 2} fill="#1e0a42" />
      {[1,3,5,7,9,11,14,17].map(i => (
        <line key={i} x1={0} y1={i} x2={VW} y2={i} stroke="rgba(130,70,220,0.22)" strokeWidth="1.2" />
      ))}

      {/* Purple stands - bottom */}
      <rect x={0} y={NY - 1} width={VW} height={VH - NY + 4} fill="#1e0a42" />
      {[0,2,4,6,8,10,13,16].map(i => (
        <line key={i} x1={0} y1={NY + i} x2={VW} y2={NY + i} stroke="rgba(130,70,220,0.18)" strokeWidth="1.2" />
      ))}

      {/* Court dark border strip */}
      <polygon
        points={corners.map(p=>`${p.x},${p.y}`).join(' ')}
        fill="#7a4e1a" />

      {/* Wood surface */}
      <path d={courtPath} fill="url(#wood)" />

      {/* Depth gradient */}
      <path d={courtPath} fill="url(#depthGrad)" />

      {/* Centre light reflection */}
      {(() => {
        const cc = cToS(200, 100);
        return <ellipse cx={cc.x} cy={cc.y} rx={90} ry={35} fill="url(#glow)" />;
      })()}

      {/* ═══ Court markings ═══ */}
      {/* Boundary */}
      <path d={courtPath} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} />

      {/* Centre line */}
      <line x1={clTop.x} y1={clTop.y} x2={clBot.x} y2={clBot.y}
        stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} />

      {/* Centre circle */}
      <path d={projCircle(200, 100, 30)} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.5} />
      {(() => { const c = cToS(200,100); return <circle cx={c.x} cy={c.y} r={2.5} fill="rgba(255,255,255,0.92)" />; })()}

      {/* Left penalty D (6m = 60 units, right half arc) */}
      <path d={projArc(0, 100, 60, -Math.PI/2, Math.PI/2)}
        fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.5} />
      {/* Right penalty D */}
      <path d={projArc(400, 100, 60, Math.PI/2, 3*Math.PI/2)}
        fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.5} />

      {/* Penalty spots */}
      <circle cx={lspot.x} cy={lspot.y} r={2.2} fill="rgba(255,255,255,0.92)" />
      <circle cx={rspot.x} cy={rspot.y} r={2.2} fill="rgba(255,255,255,0.92)" />

      {/* ── Left goal (3D box) ── */}
      {/* Back face */}
      <polygon points={`${glT2.x},${glT2.y} ${glB2.x},${glB2.y} ${glB.x},${glB.y} ${glT.x},${glT.y}`}
        fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.4} />
      {/* Front post lines */}
      <line x1={glT.x} y1={glT.y} x2={glT.x-8} y2={glT.y+2} stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
      <line x1={glB.x} y1={glB.y} x2={glB.x-8} y2={glB.y-2} stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
      {/* Net grid */}
      {[-10,-5,0,5,10].map(dy => {
        const a = cToS(0, 100+dy), b = cToS(gDepth, 100+dy);
        return <line key={dy} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />;
      })}
      {[0,0.5,1].map(dx => {
        const a = cToS(dx*gDepth, 85), b = cToS(dx*gDepth, 115);
        return <line key={dx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />;
      })}

      {/* ── Right goal (3D box) ── */}
      <polygon points={`${grT2.x},${grT2.y} ${grB2.x},${grB2.y} ${grB.x},${grB.y} ${grT.x},${grT.y}`}
        fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.4} />
      <line x1={grT.x} y1={grT.y} x2={grT.x+8} y2={grT.y+2} stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
      <line x1={grB.x} y1={grB.y} x2={grB.x+8} y2={grB.y-2} stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
      {[-10,-5,0,5,10].map(dy => {
        const a = cToS(400, 100+dy), b = cToS(400-gDepth, 100+dy);
        return <line key={dy} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />;
      })}
      {[0,0.5,1].map(dx => {
        const a = cToS(400-dx*gDepth, 85), b = cToS(400-dx*gDepth, 115);
        return <line key={dx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />;
      })}
    </g>
  );
}

// ─── 3-D front-facing player sprite ──────────────────────────────────────────
type PalKey = keyof typeof PAL;

interface FigureProps {
  pk: PalKey;
  number: number;
  isGK: boolean;
  isRunning: boolean;
  isSelected: boolean;
  flip: boolean;   // mirror left/right based on direction
}

function PlayerFigure({ pk, number, isGK, isRunning, isSelected, flip }: FigureProps) {
  const p = PAL[pk];
  const anim = (n: string): React.CSSProperties =>
    isRunning ? { transformOrigin: '0px 0px', animation: `${n} 0.44s ease-in-out infinite` } : {};

  const cH = `url(#cH-${pk})`;
  const cV = `url(#cV-${pk})`;
  const sk  = 'url(#cH-skin)';
  const skV = 'url(#cV-skin)';

  return (
    <g transform={flip ? 'scale(-1,1)' : ''} filter="url(#fshadow)">
      <circle r={18} fill="transparent" />

      {isSelected && <circle r={20} fill="none" stroke="#FFD60A" strokeWidth={2} filter="url(#fglow)" />}

      {/* GK badge */}
      {isGK && <>
        <rect x={-9} y={-32} width={18} height={8} rx={3} fill={p.j} />
        <text x={0} y={-26} textAnchor="middle" dominantBaseline="central"
          fontSize={5.5} fontWeight="900" fill="white" style={{ pointerEvents:'none' }}>GK</text>
      </>}

      {/* Ground shadow */}
      <ellipse cx={flip ? -1 : 1} cy={21} rx={10} ry={3} fill="rgba(0,0,0,0.30)" />

      {/* ── LEFT arm (pivot L shoulder -10,-5) ── */}
      <g transform="translate(-10,-5)">
        <g style={anim('drillArmL')}>
          <rect x={-9} y={-3} width={9} height={6} rx={3} fill={cH} />
          <rect x={-17} y={-2.5} width={8} height={5} rx={2.5} fill={sk} />
        </g>
      </g>

      {/* ── RIGHT arm (pivot R shoulder 10,-5) ── */}
      <g transform="translate(10,-5)">
        <g style={anim('drillArmR')}>
          <rect x={0} y={-3} width={9} height={6} rx={3} fill={cH} />
          <rect x={9} y={-2.5} width={8} height={5} rx={2.5} fill={sk} />
        </g>
      </g>

      {/* ── Jersey torso ── */}
      {/* Collar */}
      <ellipse cx={0} cy={-9} rx={3.5} ry={2} fill={cV} />
      {/* Body */}
      <path d="M -10,-8 Q -11,-1 -9,7 L 9,7 Q 11,-1 10,-8 Z" fill={cV} />
      {/* Jersey stripes */}
      <path d="M -10,-5 Q -11,-3 -9,-1 L 9,-1 Q 11,-3 10,-5 Z" fill={p.stripe} opacity={0.18} />
      <path d="M -10,-1 Q -11,1 -9,3 L 9,3 Q 11,1 10,-1 Z" fill={p.stripe} opacity={0.10} />
      {/* Number */}
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central"
        fontSize={6} fontWeight="900" fill="white" style={{ pointerEvents:'none' }}>
        {number}
      </text>

      {/* ── Shorts ── */}
      <rect x={-9} y={6} width={18} height={7} rx={2} fill={p.sh} />
      <line x1={0} y1={6} x2={0} y2={13} stroke="rgba(0,0,0,0.25)" strokeWidth={0.8} />

      {/* ── LEFT leg (pivot L hip -4, 12) ── */}
      <g transform="translate(-4,12)">
        <g style={anim('drillLegL')}>
          <rect x={-4} y={0} width={8} height={8}  rx={4}   fill={sk} />
          <rect x={-3.5} y={7} width={7} height={9} rx={3.5} fill={skV} opacity={0.85} />
          {/* Sock white */}
          <rect x={-3.5} y={14} width={7} height={2} rx={1} fill="rgba(255,255,255,0.7)" />
          {/* Boot */}
          <ellipse cx={0} cy={18} rx={5} ry={2.5} fill="url(#sph-boot)" />
          <ellipse cx={1.5} cy={17} rx={2} ry={1}   fill="rgba(255,255,255,0.2)" />
        </g>
      </g>

      {/* ── RIGHT leg (pivot R hip 4, 12) ── */}
      <g transform="translate(4,12)">
        <g style={anim('drillLegR')}>
          <rect x={-4} y={0} width={8} height={8}  rx={4}   fill={sk} />
          <rect x={-3.5} y={7} width={7} height={9} rx={3.5} fill={skV} opacity={0.85} />
          <rect x={-3.5} y={14} width={7} height={2} rx={1} fill="rgba(255,255,255,0.7)" />
          <ellipse cx={0} cy={18} rx={5} ry={2.5} fill="url(#sph-boot)" />
          <ellipse cx={1.5} cy={17} rx={2} ry={1}   fill="rgba(255,255,255,0.2)" />
        </g>
      </g>

      {/* ── Neck ── */}
      <rect x={-3} y={-14} width={6} height={6} rx={3} fill={skV} />

      {/* ── Head sphere ── */}
      <circle cy={-21} r={9}   fill="url(#sph-skin)" />
      {/* Hair cap */}
      <circle cy={-21} r={9}   fill={`url(#sph-${pk})`} clipPath={`url(#hc-${pk})`} />
      {/* Ears */}
      <ellipse cx={-9.2} cy={-21} rx={2}   ry={3}   fill="url(#sph-skin)" />
      <ellipse cx={ 9.2} cy={-21} rx={2}   ry={3}   fill="url(#sph-skin)" />
      {/* Eyebrows */}
      <path d="M -4.5,-24 Q -2.5,-25.8 -0.5,-24" fill="none" stroke={p.jlo} strokeWidth={1.3} strokeLinecap="round" />
      <path d="M 0.5,-24 Q 2.5,-25.8 4.5,-24"   fill="none" stroke={p.jlo} strokeWidth={1.3} strokeLinecap="round" />
      {/* Eyes */}
      <ellipse cx={-3}  cy={-21.5} rx={2.3} ry={1.8} fill="white" />
      <ellipse cx={ 3}  cy={-21.5} rx={2.3} ry={1.8} fill="white" />
      <circle  cx={-2.6} cy={-21.2} r={1.3} fill="#2a1a08" />
      <circle  cx={ 3.4} cy={-21.2} r={1.3} fill="#2a1a08" />
      <circle  cx={-2}   cy={-21.7} r={0.5} fill="white" opacity={0.9} />
      <circle  cx={ 4}   cy={-21.7} r={0.5} fill="white" opacity={0.9} />
      {/* Mouth */}
      <path d="M -2,-19 Q 0,-17.5 2,-19" fill="none" stroke="rgba(150,70,20,0.7)" strokeWidth={0.8} strokeLinecap="round" />
      {/* Specular */}
      <circle cx={-4} cy={-26} r={2.5} fill="white" opacity={0.22} />
    </g>
  );
}

// ─── 3-D Soccer ball ─────────────────────────────────────────────────────────
function SoccerBall({ sx, sy, isSelected, onDown }: {
  sx: number; sy: number;
  isSelected: boolean;
  onDown: (e: React.MouseEvent | React.TouchEvent) => void;
}) {
  return (
    <g transform={`translate(${sx},${sy})`}
      onMouseDown={onDown} onTouchStart={onDown}
      style={{ cursor: 'grab' }} filter="url(#fshadow)">
      <ellipse cx={1} cy={9} rx={7} ry={2.5} fill="rgba(0,0,0,0.32)" />
      <circle r={8} fill="url(#sph-ball)" />
      <polygon points="0,-6 5,-2 3,4 -3,4 -5,-2"
        fill="#111" opacity={0.16} />
      <polygon points="0,-6 5,-2 3,4 -3,4 -5,-2"
        fill="none" stroke="#555" strokeWidth={0.7} />
      <circle cx={-3} cy={-4} r={2.5} fill="white" opacity={0.6} />
      {isSelected && <circle r={10} fill="none" stroke="#FFD60A" strokeWidth={2} filter="url(#fglow)" />}
    </g>
  );
}

// ─── Movement arrow (in perspective coords) ───────────────────────────────────
function MovementArrow({ from, to, color }: { from: EntityPos; to: EntityPos; color: string }) {
  const a = cToS(from.x, from.y);
  const b = cToS(to.x, to.y);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx*dx + dy*dy);
  if (len < 5) return null;
  const ux = dx/len, uy = dy/len;
  const ex = b.x - ux*12, ey = b.y - uy*12;
  const s = 6;
  return (
    <g opacity={0.88}>
      <line x1={a.x+0.5} y1={a.y+1} x2={ex+0.5} y2={ey+1}
        stroke="rgba(0,0,0,0.28)" strokeWidth={2.5} strokeDasharray="5 3" />
      <line x1={a.x} y1={a.y} x2={ex} y2={ey}
        stroke={color} strokeWidth={2.2} strokeDasharray="5 3"
        style={{ filter:`drop-shadow(0 0 2px ${color})` }} />
      <polygon
        points={`${b.x},${b.y} ${ex - s*ux + s*0.5*uy},${ey - s*uy - s*0.5*ux} ${ex - s*ux - s*0.5*uy},${ey - s*uy + s*0.5*ux}`}
        fill={color} style={{ filter:`drop-shadow(0 0 2px ${color})` }} />
    </g>
  );
}

// ─── Main canvas ──────────────────────────────────────────────────────────────
export default function DrillCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const store = useDrillStore();
  const { players, steps, activeStep, isPlaying, playbackT, selectedEntity } = store;

  const currentPositions: Record<string, EntityPos> = (() => {
    const cur = steps[activeStep]?.positions ?? {};
    if (!isPlaying || activeStep >= steps.length - 1) return cur;
    const next = steps[activeStep + 1]?.positions ?? cur;
    const t = easeInOut(Math.max(0, Math.min(1, playbackT)));
    const out: Record<string, EntityPos> = {};
    for (const id of Object.keys(cur)) out[id] = lerpPos(cur[id], next[id] ?? cur[id], t);
    return out;
  })();

  const nextStepPos = !isPlaying && activeStep < steps.length - 1 ? steps[activeStep + 1].positions : null;
  const playNextPos = isPlaying  && activeStep < steps.length - 1 ? steps[activeStep + 1].positions : null;
  const playCurPos  = isPlaying  ? steps[activeStep]?.positions ?? {} : {};

  const dragging = useRef<string | null>(null);

  const onDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (isPlaying) return;
    e.stopPropagation(); e.preventDefault();
    store.setSelectedEntity(id);
    dragging.current = id;
  }, [isPlaying, store]);

  useEffect(() => {
    const mv = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || !svgRef.current) return;
      const pt = svgRef.current.createSVGPoint();
      pt.x = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      pt.y = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
      // Convert SVG screen point → court coordinates via perspective inverse
      const court = sToC(svgP.x, svgP.y);
      store.moveEntity(dragging.current, court.x, court.y);
    };
    const up = () => { dragging.current = null; };
    window.addEventListener('mousemove', mv);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [store]);

  // Sort players by y so closer (larger y) players render on top
  const sortedPlayers = [...players].sort((a, b) => {
    const pa = currentPositions[a.id]?.y ?? 0;
    const pb = currentPositions[b.id]?.y ?? 0;
    return pa - pb;
  });

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width:'100%', borderRadius:10, touchAction:'none', display:'block', userSelect:'none' }}
      onClick={() => store.setSelectedEntity(null)}
    >
      <SVGDefs />
      <IsoCourt />

      {/* Movement arrows in perspective */}
      {nextStepPos && players.map(p => {
        const from = currentPositions[p.id], to = nextStepPos[p.id];
        if (!from || !to) return null;
        return <MovementArrow key={p.id} from={from} to={to} color={p.team==='home'?'#93c5fd':'#fca5a5'} />;
      })}
      {nextStepPos && currentPositions[BALL_ID_CONST] && nextStepPos[BALL_ID_CONST] && (
        <MovementArrow from={currentPositions[BALL_ID_CONST]} to={nextStepPos[BALL_ID_CONST]} color="#FFD60A" />
      )}

      {/* Players — sorted far-to-near so near players render on top */}
      {sortedPlayers.map(p => {
        const pos = currentPositions[p.id];
        if (!pos) return null;
        const pk = (p.team + (p.isGK ? '_gk' : '')) as PalKey;
        const { x: sx, y: sy } = cToS(pos.x, pos.y);

        // Perspective scale: near=1.0, far=0.72
        const pScale = 0.72 + 0.28 * (pos.y / 200);

        // Flip based on x-movement direction
        const flip = (() => {
          if (isPlaying && playNextPos) {
            const dx = (playNextPos[p.id]?.x ?? pos.x) - (playCurPos[p.id]?.x ?? pos.x);
            if (Math.abs(dx) > 5) return dx < 0;
          }
          if (!isPlaying && nextStepPos) {
            const dx = (nextStepPos[p.id]?.x ?? pos.x) - pos.x;
            if (Math.abs(dx) > 5) return dx < 0;
          }
          return p.team !== 'home';
        })();

        const isRunning = isPlaying && (() => {
          const fr = playCurPos[p.id], to2 = playNextPos?.[p.id];
          if (!fr || !to2) return false;
          const dx = to2.x - fr.x, dy = to2.y - fr.y;
          return dx*dx + dy*dy > 16;
        })();

        return (
          <g key={p.id}
            transform={`translate(${sx},${sy}) scale(${pScale})`}
            onMouseDown={e => onDown(e, p.id)}
            onTouchStart={e => onDown(e, p.id)}
            style={{ cursor: isPlaying ? 'default' : 'grab' }}>
            <PlayerFigure
              pk={pk} number={p.number} isGK={p.isGK}
              isRunning={isRunning} isSelected={selectedEntity === p.id} flip={flip}
            />
          </g>
        );
      })}

      {/* Ball */}
      {(() => {
        const pos = currentPositions[BALL_ID_CONST];
        if (!pos) return null;
        const { x: sx, y: sy } = cToS(pos.x, pos.y);
        const pScale = 0.72 + 0.28 * (pos.y / 200);
        return (
          <g transform={`scale(${pScale})`} style={{ transformOrigin: `${sx}px ${sy}px` }}>
            <SoccerBall sx={sx} sy={sy}
              isSelected={selectedEntity === BALL_ID_CONST}
              onDown={e => onDown(e, BALL_ID_CONST)} />
          </g>
        );
      })()}
    </svg>
  );
}
