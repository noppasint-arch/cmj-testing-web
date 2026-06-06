'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useDrillStore, BALL_ID_CONST, EntityPos } from '@/store/drillStore';

const VW = 400;
const VH = 220;

// ─── Perspective trapezoid ────────────────────────────────────────────────────
const NY = 198, FY = 20;
const NLX = 6,  NRX = 394;
const FLX = 72, FRX = 328;

function cToS(cx: number, cy: number) {
  const t = 1 - Math.max(0, Math.min(1, cy / 200));
  const lx = NLX + (FLX - NLX) * t;
  const rx = NRX + (FRX - NRX) * t;
  return { x: lx + (rx - lx) * Math.max(0, Math.min(1, cx / 400)), y: NY + (FY - NY) * t };
}
function sToC(sx: number, sy: number): EntityPos {
  const t  = Math.max(0, Math.min(1, (sy - NY) / (FY - NY)));
  const lx = NLX + (FLX - NLX) * t;
  const rx = NRX + (FRX - NRX) * t;
  return {
    x: Math.max(0, Math.min(400, ((sx - lx) / Math.max(1, rx - lx)) * 400)),
    y: Math.max(0, Math.min(200, (1 - t) * 200)),
  };
}
function projCircle(cx: number, cy: number, r: number, n = 44) {
  return Array.from({ length: n }, (_, i) => {
    const θ = (i / n) * Math.PI * 2;
    const p = cToS(cx + r * Math.cos(θ), cy + r * Math.sin(θ));
    return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`;
  }).join(' ') + ' Z';
}
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

// ─── Team colours (flat, anime style) ────────────────────────────────────────
const PAL = {
  home:    { jersey: '#1565c0', stripe: '#ffffff', short: '#ffffff', sshort: '#1565c0', sock: '#1565c0' },
  away:    { jersey: '#c62828', stripe: '#ffffff', short: '#ffffff', sshort: '#c62828', sock: '#c62828' },
  home_gk: { jersey: '#00897b', stripe: '#ffffff', short: '#ffffff', sshort: '#00897b', sock: '#00897b' },
  away_gk: { jersey: '#6a1b9a', stripe: '#ffeb3b', short: '#ffeb3b', sshort: '#6a1b9a', sock: '#6a1b9a' },
};
type PalKey = keyof typeof PAL;

const SKIN   = '#f5c07a';
const HAIR   = '#1a0d02';
const INK    = '#111111';   // outline colour

// ─── SVG Defs ─────────────────────────────────────────────────────────────────
function SVGDefs() {
  return (
    <defs>
      {/* Wood parquet court floor */}
      <pattern id="wood" x="0" y="0" width="30" height="9" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="30" height="4.5" fill="#cc924a" />
        <rect x="0" y="4.5" width="30" height="4.5" fill="#c08840" />
        <line x1="7.5"  y1="0"   x2="7.5"  y2="4.5" stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="15"   y1="0"   x2="15"   y2="4.5" stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="22.5" y1="0"   x2="22.5" y2="4.5" stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="5"    y1="4.5" x2="5"    y2="9"   stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="15"   y1="4.5" x2="15"   y2="9"   stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="25"   y1="4.5" x2="25"   y2="9"   stroke="rgba(0,0,0,0.09)" strokeWidth="0.5" />
        <line x1="0"    y1="4.5" x2="30"   y2="4.5" stroke="rgba(0,0,0,0.16)" strokeWidth="0.5" />
      </pattern>
      <linearGradient id="depthGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#000" stopOpacity="0.44" />
        <stop offset="38%"  stopColor="#000" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0.04" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="#fff" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0.00" />
      </radialGradient>
      <linearGradient id="arenaBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#080818" />
        <stop offset="100%" stopColor="#141430" />
      </linearGradient>

      {/* Anime cel-shading: simple highlight on head */}
      <radialGradient id="headShade" cx="35%" cy="25%" r="65%">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.38)" />
        <stop offset="55%"  stopColor="rgba(255,255,255,0)" />
      </radialGradient>

      {/* Ball */}
      <radialGradient id="ballShade" cx="33%" cy="28%" r="68%">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
      </radialGradient>

      {/* Filters */}
      <filter id="fshadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#000" floodOpacity="0.55" />
      </filter>
      <filter id="fglow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#FFD60A" floodOpacity="0.95" />
      </filter>
    </defs>
  );
}

// ─── Isometric court (same as before) ────────────────────────────────────────
function IsoCourt() {
  const corners = [cToS(0,0), cToS(400,0), cToS(400,200), cToS(0,200)];
  const courtPath = corners.map((p,i)=>`${i===0?'M':'L'}${p.x},${p.y}`).join(' ')+' Z';
  const my = (NY + FY) / 2;
  const gl  = cToS(0,100), gr = cToS(400,100);
  const glT = cToS(0,85),  glB = cToS(0,115);
  const grT = cToS(400,85), grB = cToS(400,115);
  const gD = 12;
  const glT2 = cToS(gD,88), glB2 = cToS(gD,112);
  const grT2 = cToS(400-gD,88), grB2 = cToS(400-gD,112);
  const clT = cToS(200,0), clB = cToS(200,200);
  const ls = cToS(55,100), rs = cToS(345,100);
  void gl; void my;
  return (
    <g>
      <rect x={0} y={0} width={VW} height={VH} fill="url(#arenaBg)" rx={6} />
      <rect x={0} y={0} width={VW} height={FY+2} fill="#1e0a42" />
      {[1,3,5,7,9,11,14,17].map(i=>(
        <line key={i} x1={0} y1={i} x2={VW} y2={i} stroke="rgba(130,70,220,0.22)" strokeWidth="1.2" />
      ))}
      <rect x={0} y={NY-1} width={VW} height={VH-NY+4} fill="#1e0a42" />
      {[0,2,4,6,8,10,13,16].map(i=>(
        <line key={i} x1={0} y1={NY+i} x2={VW} y2={NY+i} stroke="rgba(130,70,220,0.18)" strokeWidth="1.2" />
      ))}
      <polygon points={corners.map(p=>`${p.x},${p.y}`).join(' ')} fill="#7a4e1a" />
      <path d={courtPath} fill="url(#wood)" />
      <path d={courtPath} fill="url(#depthGrad)" />
      {(()=>{ const cc=cToS(200,100); return <ellipse cx={cc.x} cy={cc.y} rx={90} ry={35} fill="url(#glow)" />; })()}
      <path d={courtPath} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} />
      <line x1={clT.x} y1={clT.y} x2={clB.x} y2={clB.y} stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} />
      <path d={projCircle(200,100,30)} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.5} />
      {(()=>{ const c=cToS(200,100); return <circle cx={c.x} cy={c.y} r={2.5} fill="rgba(255,255,255,0.92)" />; })()}
      <path d={projArc(0,100,60,-Math.PI/2,Math.PI/2)} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.5} />
      <path d={projArc(400,100,60,Math.PI/2,3*Math.PI/2)} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.5} />
      <circle cx={ls.x} cy={ls.y} r={2.2} fill="rgba(255,255,255,0.92)" />
      <circle cx={rs.x} cy={rs.y} r={2.2} fill="rgba(255,255,255,0.92)" />
      {/* Left goal */}
      <polygon points={`${glT2.x},${glT2.y} ${glB2.x},${glB2.y} ${glB.x},${glB.y} ${glT.x},${glT.y}`}
        fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.4} />
      <line x1={glT.x} y1={glT.y} x2={glT.x-8} y2={glT.y+2} stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
      <line x1={glB.x} y1={glB.y} x2={glB.x-8} y2={glB.y-2} stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
      {[-10,-5,0,5,10].map(dy=>{ const a=cToS(0,100+dy),b=cToS(gD,100+dy); return <line key={dy} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />; })}
      {[0,0.5,1].map(dx=>{ const a=cToS(dx*gD,85),b=cToS(dx*gD,115); return <line key={dx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />; })}
      {/* Right goal */}
      <polygon points={`${grT2.x},${grT2.y} ${grB2.x},${grB2.y} ${grB.x},${grB.y} ${grT.x},${grT.y}`}
        fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.4} />
      <line x1={grT.x} y1={grT.y} x2={grT.x+8} y2={grT.y+2} stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
      <line x1={grB.x} y1={grB.y} x2={grB.x+8} y2={grB.y-2} stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
      {[-10,-5,0,5,10].map(dy=>{ const a=cToS(400,100+dy),b=cToS(400-gD,100+dy); return <line key={dy} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />; })}
      {[0,0.5,1].map(dx=>{ const a=cToS(400-dx*gD,85),b=cToS(400-dx*gD,115); return <line key={dx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />; })}
    </g>
  );
}

// ─── Anime player figure (Captain Tsubasa style) ──────────────────────────────
interface FigureProps {
  pk: PalKey;
  number: number;
  isGK: boolean;
  isRunning: boolean;
  isSelected: boolean;
  flip: boolean;
}

function PlayerFigure({ pk, number, isGK, isRunning, isSelected, flip }: FigureProps) {
  const c = PAL[pk];
  const sw = 1.8; // bold INK outlines

  const legL: React.CSSProperties = isRunning
    ? { transformOrigin: '0px 0px', animation: 'drillLegL 0.44s ease-in-out infinite' } : {};
  const legR: React.CSSProperties = isRunning
    ? { transformOrigin: '0px 0px', animation: 'drillLegR 0.44s ease-in-out infinite' } : {};
  const armL: React.CSSProperties = isRunning
    ? { transformOrigin: '0px 0px', animation: 'drillArmL 0.44s ease-in-out infinite' } : {};
  const armR: React.CSSProperties = isRunning
    ? { transformOrigin: '0px 0px', animation: 'drillArmR 0.44s ease-in-out infinite' } : {};

  return (
    <g transform={flip ? 'scale(-1,1)' : ''} filter="url(#fshadow)">
      {/* Hit area */}
      <circle r={22} fill="transparent" />
      {isSelected && <circle r={23} fill="none" stroke="#FFD60A" strokeWidth={2.5} filter="url(#fglow)" />}

      {/* GK badge */}
      {isGK && <>
        <rect x={-9} y={-47} width={18} height={9} rx={3} fill={c.jersey} stroke={INK} strokeWidth={sw*0.8} />
        <text x={0} y={-41} textAnchor="middle" dominantBaseline="central"
          fontSize={6} fontWeight="900" fill="white" style={{ pointerEvents:'none' }}>GK</text>
      </>}

      {/* Ground shadow */}
      <ellipse cx={1} cy={29} rx={13} ry={3.5} fill="rgba(0,0,0,0.30)" />

      {/* ── Left arm (pivot at L-shoulder) ── */}
      <g transform="translate(-12,-6)">
        <g style={armL}>
          {/* Sleeve — jersey colour with stripe bands */}
          <ellipse cx={-5} cy={0} rx={5.5} ry={4.2} fill={c.jersey} stroke={INK} strokeWidth={sw} />
          <rect x={-10} y={-2} width={10} height={1.8} rx={0.6} fill={c.stripe} opacity={0.55} />
          <rect x={-10} y={0.5} width={10} height={1.8} rx={0.6} fill={c.stripe} opacity={0.40} />
          {/* Forearm */}
          <ellipse cx={-15} cy={0} rx={4.5} ry={3.5} fill={SKIN} stroke={INK} strokeWidth={sw} />
          {/* Fist */}
          <ellipse cx={-20} cy={-0.5} rx={3.8} ry={3.2} fill={SKIN} stroke={INK} strokeWidth={sw*0.9} />
          {/* Knuckle line */}
          <line x1={-22} y1={-0.5} x2={-18} y2={-0.5} stroke={INK} strokeWidth={0.7} strokeLinecap="round" />
        </g>
      </g>

      {/* ── Right arm (pivot at R-shoulder) ── */}
      <g transform="translate(12,-6)">
        <g style={armR}>
          <ellipse cx={5} cy={0} rx={5.5} ry={4.2} fill={c.jersey} stroke={INK} strokeWidth={sw} />
          <rect x={0} y={-2} width={10} height={1.8} rx={0.6} fill={c.stripe} opacity={0.55} />
          <rect x={0} y={0.5} width={10} height={1.8} rx={0.6} fill={c.stripe} opacity={0.40} />
          <ellipse cx={15} cy={0} rx={4.5} ry={3.5} fill={SKIN} stroke={INK} strokeWidth={sw} />
          <ellipse cx={20} cy={-0.5} rx={3.8} ry={3.2} fill={SKIN} stroke={INK} strokeWidth={sw*0.9} />
          <line x1={18} y1={-0.5} x2={22} y2={-0.5} stroke={INK} strokeWidth={0.7} strokeLinecap="round" />
        </g>
      </g>

      {/* ── Jersey body ── */}
      {/* V-neck collar */}
      <path d="M -4.5,-11 L 0,-8 L 4.5,-11 L 4.5,-9 Q 0,-6.5 -4.5,-9 Z"
        fill={c.jersey} stroke={INK} strokeWidth={sw*0.8} />
      {/* Main body */}
      <path d="M -12,-10 C -13,0 -11,11 -11,11 L 11,11 C 11,11 13,0 12,-10 Z"
        fill={c.jersey} stroke={INK} strokeWidth={sw} />
      {/* Horizontal stripe bands */}
      <path d="M -12,-4 C -13,-2 -13,0 -12,2 L 12,2 C 13,0 13,-2 12,-4 Z"
        fill={c.stripe} opacity={0.30} />
      <path d="M -11,4 C -12,6 -12,8 -11,10 L 11,10 C 12,8 12,6 11,4 Z"
        fill={c.stripe} opacity={0.18} />
      {/* Cel-shade left highlight */}
      <path d="M -10,-9 C -11,-3 -9,7 -8,10 L -4,10 C -5,7 -6,-3 -5,-9 Z"
        fill="rgba(255,255,255,0.18)" />
      {/* Jersey number */}
      <text x={1} y={1} textAnchor="middle" dominantBaseline="central"
        fontSize={7.5} fontWeight="900" fill="white"
        stroke={INK} strokeWidth={0.5} style={{ pointerEvents:'none' }}>
        {number}
      </text>

      {/* ── Shorts ── */}
      <rect x={-11} y={10} width={22} height={10} rx={4}
        fill={c.short} stroke={INK} strokeWidth={sw} />
      <rect x={-10} y={11} width={9} height={3.5} rx={2.2} fill="rgba(255,255,255,0.22)" />
      <text x={5} y={16} textAnchor="middle" dominantBaseline="central"
        fontSize={6} fontWeight="700" fill={c.sshort} style={{ pointerEvents:'none' }}>
        {number}
      </text>

      {/* ── Left leg (pivot L-hip -5, 18) ── */}
      <g transform="translate(-5,18)">
        <g style={legL}>
          {/* Thigh (skin) */}
          <ellipse cx={0} cy={5} rx={5.5} ry={6.5}
            fill={SKIN} stroke={INK} strokeWidth={sw} />
          <ellipse cx={-1.5} cy={3} rx={2.5} ry={3} fill="rgba(255,255,255,0.22)" />
          {/* Shin guard (white, prominent) */}
          <rect x={-4} y={10} width={8} height={9} rx={3}
            fill="white" stroke={INK} strokeWidth={sw} />
          <line x1={-3.5} y1={12.5} x2={3.5} y2={12.5} stroke={INK} strokeWidth={0.6} opacity={0.3} />
          <line x1={-3.5} y1={15} x2={3.5} y2={15} stroke={INK} strokeWidth={0.6} opacity={0.3} />
          {/* Rivets */}
          <circle cx={-2.2} cy={11.5} r={1} fill="#bbb" stroke={INK} strokeWidth={0.5} />
          <circle cx={ 2.2} cy={11.5} r={1} fill="#bbb" stroke={INK} strokeWidth={0.5} />
          <circle cx={-2.2} cy={18} r={1} fill="#bbb" stroke={INK} strokeWidth={0.5} />
          <circle cx={ 2.2} cy={18} r={1} fill="#bbb" stroke={INK} strokeWidth={0.5} />
          {/* Sock (white, long) */}
          <rect x={-4.5} y={18} width={9} height={11} rx={4.5}
            fill="white" stroke={INK} strokeWidth={sw} />
          {/* Sock stripe */}
          <rect x={-4.5} y={18} width={9} height={3.5} rx={3.5}
            fill={c.sock} stroke={INK} strokeWidth={sw*0.7} />
          {/* Boot */}
          <ellipse cx={0.5} cy={30.5} rx={6.5} ry={3.5}
            fill={INK} stroke={INK} strokeWidth={sw*0.6} />
          {/* Boot shine */}
          <ellipse cx={-1.5} cy={28.5} rx={2.8} ry={1.3} fill="rgba(255,255,255,0.30)" />
          {/* Studs */}
          {[-4,-2,0,2,4].map(bx=>(
            <circle key={bx} cx={bx} cy={33.5} r={0.9} fill="#444" />
          ))}
        </g>
      </g>

      {/* ── Right leg (pivot R-hip 5, 18) ── */}
      <g transform="translate(5,18)">
        <g style={legR}>
          <ellipse cx={0} cy={5} rx={5.5} ry={6.5}
            fill={SKIN} stroke={INK} strokeWidth={sw} />
          <ellipse cx={-1.5} cy={3} rx={2.5} ry={3} fill="rgba(255,255,255,0.22)" />
          <rect x={-4} y={10} width={8} height={9} rx={3}
            fill="white" stroke={INK} strokeWidth={sw} />
          <line x1={-3.5} y1={12.5} x2={3.5} y2={12.5} stroke={INK} strokeWidth={0.6} opacity={0.3} />
          <line x1={-3.5} y1={15} x2={3.5} y2={15} stroke={INK} strokeWidth={0.6} opacity={0.3} />
          <circle cx={-2.2} cy={11.5} r={1} fill="#bbb" stroke={INK} strokeWidth={0.5} />
          <circle cx={ 2.2} cy={11.5} r={1} fill="#bbb" stroke={INK} strokeWidth={0.5} />
          <circle cx={-2.2} cy={18} r={1} fill="#bbb" stroke={INK} strokeWidth={0.5} />
          <circle cx={ 2.2} cy={18} r={1} fill="#bbb" stroke={INK} strokeWidth={0.5} />
          <rect x={-4.5} y={18} width={9} height={11} rx={4.5}
            fill="white" stroke={INK} strokeWidth={sw} />
          <rect x={-4.5} y={18} width={9} height={3.5} rx={3.5}
            fill={c.sock} stroke={INK} strokeWidth={sw*0.7} />
          <ellipse cx={0.5} cy={30.5} rx={6.5} ry={3.5}
            fill={INK} stroke={INK} strokeWidth={sw*0.6} />
          <ellipse cx={-1.5} cy={28.5} rx={2.8} ry={1.3} fill="rgba(255,255,255,0.30)" />
          {[-4,-2,0,2,4].map(bx=>(
            <circle key={bx} cx={bx} cy={33.5} r={0.9} fill="#444" />
          ))}
        </g>
      </g>

      {/* ── Neck ── */}
      <rect x={-4} y={-18} width={8} height={9} rx={4}
        fill={SKIN} stroke={INK} strokeWidth={sw*0.9} />

      {/* ══ HEAD — big anime head (Captain Tsubasa proportions) ══ */}

      {/* Back hair (wide sweep behind face) */}
      <path d="M -12,-34 Q -5,-50 4,-48 Q 11,-46 12,-34 Q 8,-30 0,-33 Q -8,-30 -12,-34 Z"
        fill={HAIR} stroke={INK} strokeWidth={sw} />
      {/* Side hair tufts */}
      <path d="M -12,-34 Q -16,-29 -14,-22 Q -13,-26 -12,-30 Z"
        fill={HAIR} stroke={INK} strokeWidth={sw*0.9} />
      <path d="M 12,-34 Q 16,-29 14,-22 Q 13,-26 12,-30 Z"
        fill={HAIR} stroke={INK} strokeWidth={sw*0.9} />

      {/* Face (big oval, anime proportions) */}
      <ellipse cx={0} cy={-25} rx={11} ry={12.5}
        fill={SKIN} stroke={INK} strokeWidth={sw} />

      {/* Ears */}
      <ellipse cx={-11} cy={-25} rx={2.4} ry={3.5}
        fill={SKIN} stroke={INK} strokeWidth={sw*0.8} />
      <ellipse cx={-10.6} cy={-25} rx={1.2} ry={2.2} fill="rgba(200,90,50,0.25)" />
      <ellipse cx={11} cy={-25} rx={2.4} ry={3.5}
        fill={SKIN} stroke={INK} strokeWidth={sw*0.8} />
      <ellipse cx={10.6} cy={-25} rx={1.2} ry={2.2} fill="rgba(200,90,50,0.25)" />

      {/* Front spiky hair (iconic anime spikes — 5 spikes) */}
      <path d="M -12,-34 Q -10,-46 -6,-38" fill={HAIR} stroke={INK} strokeWidth={sw} />
      <path d="M -7,-36 Q -4,-50 -0.5,-40" fill={HAIR} stroke={INK} strokeWidth={sw} />
      <path d="M -1,-38 Q 2,-53 5,-42" fill={HAIR} stroke={INK} strokeWidth={sw} />
      <path d="M 4,-36 Q 8,-49 11,-38" fill={HAIR} stroke={INK} strokeWidth={sw} />
      <path d="M 10,-34 Q 14,-44 12,-35" fill={HAIR} stroke={INK} strokeWidth={sw*0.9} />
      {/* Hairline band covering forehead edge */}
      <path d="M -11,-31 Q -5,-35 0,-34 Q 5,-35 11,-31" fill={HAIR} />

      {/* ── Eyes (large anime eyes — the most important feature) ── */}
      {/* Upper eyelid (thick bold line) */}
      <path d="M -8.5,-27 Q -4,-30 -0.3,-27"
        fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M 0.3,-27 Q 4,-30 8.5,-27"
        fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      {/* Eye white */}
      <ellipse cx={-4} cy={-25.5} rx={4} ry={4.8}
        fill="white" stroke={INK} strokeWidth={sw*0.7} />
      <ellipse cx={4} cy={-25.5} rx={4} ry={4.8}
        fill="white" stroke={INK} strokeWidth={sw*0.7} />
      {/* Iris (deep blue) */}
      <ellipse cx={-3.8} cy={-25} rx={3} ry={3.8} fill="#1a4fa0" />
      <ellipse cx={4.2} cy={-25} rx={3} ry={3.8} fill="#1a4fa0" />
      {/* Pupil */}
      <circle cx={-3.5} cy={-24.5} r={1.9} fill="#050510" />
      <circle cx={4.5} cy={-24.5} r={1.9} fill="#050510" />
      {/* Large sparkle shine (anime signature) */}
      <circle cx={-2.2} cy={-26.5} r={1.3} fill="white" />
      <circle cx={-1.2} cy={-24.2} r={0.65} fill="white" opacity={0.85} />
      <circle cx={5.5} cy={-26.5} r={1.3} fill="white" />
      <circle cx={6.5} cy={-24.2} r={0.65} fill="white" opacity={0.85} />
      {/* Lower lash line */}
      <line x1={-7.5} y1={-22.5} x2={-0.5} y2={-22.8}
        stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
      <line x1={0.5} y1={-22.8} x2={7.5} y2={-22.5}
        stroke={INK} strokeWidth={1.1} strokeLinecap="round" />

      {/* ── Eyebrows (thick, angry-happy expression) ── */}
      <path d="M -9.5,-30.5 Q -5.5,-33 -0.5,-31"
        fill="none" stroke={HAIR} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M 0.5,-31 Q 5.5,-33 9.5,-30.5"
        fill="none" stroke={HAIR} strokeWidth={2.5} strokeLinecap="round" />

      {/* ── Nose (V-shape, simple anime) ── */}
      <path d="M 0.5,-22.5 L -1.2,-20.2 L 1.8,-20.2"
        fill="none" stroke="rgba(180,90,30,0.55)" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />

      {/* ── Mouth (wide open excited mouth — anime style) ── */}
      <path d="M -5,-19 Q 0,-14.5 5,-19"
        fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M -3.8,-18.5 Q 0,-15 3.8,-18.5"
        fill="#c0392b" />
      {/* Teeth */}
      <path d="M -3,-19 Q 0,-16.5 3,-19"
        fill="white" stroke="rgba(0,0,0,0.15)" strokeWidth={0.5} />

      {/* ── Cheek blush (anime signature) ── */}
      <ellipse cx={-8.5} cy={-23} rx={3.5} ry={1.6} fill="rgba(255,140,120,0.40)" />
      <ellipse cx={ 8.5} cy={-23} rx={3.5} ry={1.6} fill="rgba(255,140,120,0.40)" />

      {/* ── Cel-shade highlight on face ── */}
      <ellipse cx={0} cy={-25} rx={11} ry={12.5} fill="url(#headShade)" />

      {/* ── Forehead shine ── */}
      <ellipse cx={-3} cy={-34} rx={3.5} ry={2} fill="rgba(255,255,255,0.48)" />
    </g>
  );
}

// ─── Anime soccer ball ────────────────────────────────────────────────────────
function SoccerBall({ sx, sy, isSelected, onDown }: {
  sx: number; sy: number;
  isSelected: boolean;
  onDown: (e: React.MouseEvent | React.TouchEvent) => void;
}) {
  return (
    <g transform={`translate(${sx},${sy})`}
      onMouseDown={onDown} onTouchStart={onDown}
      style={{ cursor: 'grab' }} filter="url(#fshadow)">
      <ellipse cx={1} cy={9.5} rx={7.5} ry={2.5} fill="rgba(0,0,0,0.28)" />
      {/* Ball */}
      <circle r={8} fill="white" stroke={INK} strokeWidth={1.4} />
      {/* Pentagon patches */}
      <polygon points="0,-6 5,-1.5 3,4.5 -3,4.5 -5,-1.5"
        fill="#111" stroke={INK} strokeWidth={0.6} />
      {/* Surrounding hexagons (simplified) */}
      <polygon points="0,-6 5,-1.5 7.5,-5.5 5,-8 0,-8"
        fill="none" stroke={INK} strokeWidth={0.7} opacity={0.5} />
      <polygon points="5,-1.5 8,2 7.5,-5.5"
        fill="none" stroke={INK} strokeWidth={0.7} opacity={0.5} />
      <polygon points="3,4.5 8,2 5,-1.5"
        fill="none" stroke={INK} strokeWidth={0.7} opacity={0.5} />
      {/* Cel-shade shading overlay */}
      <circle r={8} fill="url(#ballShade)" />
      {/* Specular */}
      <ellipse cx={-3} cy={-4} rx={2.5} ry={1.8} fill="white" opacity={0.75} />
      {isSelected && <circle r={10} fill="none" stroke="#FFD60A" strokeWidth={2} filter="url(#fglow)" />}
    </g>
  );
}

// ─── Movement arrow ────────────────────────────────────────────────────────────
function MovementArrow({ from, to, color }: { from: EntityPos; to: EntityPos; color: string }) {
  const a = cToS(from.x, from.y);
  const b = cToS(to.x, to.y);
  const dx = b.x-a.x, dy = b.y-a.y;
  const len = Math.sqrt(dx*dx+dy*dy);
  if (len < 5) return null;
  const ux = dx/len, uy = dy/len;
  const ex = b.x-ux*12, ey = b.y-uy*12;
  const s = 6;
  return (
    <g opacity={0.9}>
      <line x1={a.x+0.5} y1={a.y+1} x2={ex+0.5} y2={ey+1}
        stroke="rgba(0,0,0,0.30)" strokeWidth={2.5} strokeDasharray="5 3" />
      <line x1={a.x} y1={a.y} x2={ex} y2={ey}
        stroke={color} strokeWidth={2.2} strokeDasharray="5 3"
        style={{ filter:`drop-shadow(0 0 2px ${color})` }} />
      <polygon
        points={`${b.x},${b.y} ${ex-s*ux+s*0.5*uy},${ey-s*uy-s*0.5*ux} ${ex-s*ux-s*0.5*uy},${ey-s*uy+s*0.5*ux}`}
        fill={color} style={{ filter:`drop-shadow(0 0 2px ${color})` }} />
    </g>
  );
}

// ─── Main canvas ──────────────────────────────────────────────────────────────
export default function DrillCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const store  = useDrillStore();
  const { players, steps, activeStep, isPlaying, playbackT, selectedEntity } = store;

  const currentPositions: Record<string, EntityPos> = (() => {
    const cur = steps[activeStep]?.positions ?? {};
    if (!isPlaying || activeStep >= steps.length-1) return cur;
    const next = steps[activeStep+1]?.positions ?? cur;
    const t = easeInOut(Math.max(0, Math.min(1, playbackT)));
    const out: Record<string, EntityPos> = {};
    for (const id of Object.keys(cur)) out[id] = lerpPos(cur[id], next[id] ?? cur[id], t);
    return out;
  })();

  const nextStepPos = !isPlaying && activeStep < steps.length-1 ? steps[activeStep+1].positions : null;
  const playNextPos = isPlaying  && activeStep < steps.length-1 ? steps[activeStep+1].positions : null;
  const playCurPos  = isPlaying  ? steps[activeStep]?.positions ?? {} : {};

  const dragging = useRef<string|null>(null);
  const onDown = useCallback((e: React.MouseEvent|React.TouchEvent, id: string) => {
    if (isPlaying) return;
    e.stopPropagation(); e.preventDefault();
    store.setSelectedEntity(id);
    dragging.current = id;
  }, [isPlaying, store]);

  useEffect(() => {
    const mv = (e: MouseEvent|TouchEvent) => {
      if (!dragging.current || !svgRef.current) return;
      const pt = svgRef.current.createSVGPoint();
      pt.x = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      pt.y = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
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

  const sorted = [...players].sort((a,b) =>
    (currentPositions[a.id]?.y ?? 0) - (currentPositions[b.id]?.y ?? 0)
  );

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`}
      style={{ width:'100%', borderRadius:10, touchAction:'none', display:'block', userSelect:'none' }}
      onClick={() => store.setSelectedEntity(null)}>
      <SVGDefs />
      <IsoCourt />

      {/* Arrows */}
      {nextStepPos && players.map(p => {
        const from = currentPositions[p.id], to = nextStepPos[p.id];
        if (!from || !to) return null;
        return <MovementArrow key={p.id} from={from} to={to} color={p.team==='home'?'#64b5f6':'#ef9a9a'} />;
      })}
      {nextStepPos && currentPositions[BALL_ID_CONST] && nextStepPos[BALL_ID_CONST] && (
        <MovementArrow from={currentPositions[BALL_ID_CONST]} to={nextStepPos[BALL_ID_CONST]} color="#FFD60A" />
      )}

      {/* Players — far to near */}
      {sorted.map(p => {
        const pos = currentPositions[p.id];
        if (!pos) return null;
        const pk = (p.team + (p.isGK ? '_gk' : '')) as PalKey;
        const { x: sx, y: sy } = cToS(pos.x, pos.y);
        const pScale = (0.72 + 0.28 * (pos.y / 200)) * 0.88;

        const flip = (() => {
          if (isPlaying && playNextPos) {
            const dx = (playNextPos[p.id]?.x??pos.x) - (playCurPos[p.id]?.x??pos.x);
            if (Math.abs(dx) > 5) return dx < 0;
          }
          if (!isPlaying && nextStepPos) {
            const dx = (nextStepPos[p.id]?.x??pos.x) - pos.x;
            if (Math.abs(dx) > 5) return dx < 0;
          }
          return p.team !== 'home';
        })();

        const isRunning = isPlaying && (() => {
          const fr = playCurPos[p.id], to2 = playNextPos?.[p.id];
          if (!fr || !to2) return false;
          const dx=to2.x-fr.x, dy=to2.y-fr.y;
          return dx*dx+dy*dy > 16;
        })();

        return (
          <g key={p.id}
            transform={`translate(${sx},${sy}) scale(${pScale})`}
            onMouseDown={e => onDown(e, p.id)}
            onTouchStart={e => onDown(e, p.id)}
            style={{ cursor: isPlaying ? 'default' : 'grab' }}>
            <PlayerFigure pk={pk} number={p.number} isGK={p.isGK}
              isRunning={isRunning} isSelected={selectedEntity===p.id} flip={flip} />
          </g>
        );
      })}

      {/* Ball */}
      {(()=>{
        const pos = currentPositions[BALL_ID_CONST];
        if (!pos) return null;
        const { x: sx, y: sy } = cToS(pos.x, pos.y);
        const pScale = (0.72 + 0.28 * (pos.y / 200)) * 0.88;
        return (
          <g transform={`translate(${sx},${sy}) scale(${pScale})`}
            onMouseDown={e => onDown(e, BALL_ID_CONST)}
            onTouchStart={e => onDown(e, BALL_ID_CONST)}>
            <SoccerBall sx={0} sy={0}
              isSelected={selectedEntity===BALL_ID_CONST}
              onDown={e => onDown(e, BALL_ID_CONST)} />
          </g>
        );
      })()}
    </svg>
  );
}
