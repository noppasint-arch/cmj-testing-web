'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useDrillStore, BALL_ID_CONST, EntityPos } from '@/store/drillStore';

const VW = 400;
const VH = 210;

// Court boundaries (inner playing surface)
const CX1 = 14, CX2 = 386, CY1 = 10, CY2 = 200;
const CW = CX2 - CX1, CH = CY2 - CY1;

function lerpPos(a: EntityPos, b: EntityPos, t: number): EntityPos {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
function facingAngle(from: EntityPos, to: EntityPos): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.sqrt(dx * dx + dy * dy) < 4) return null;
  return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const PALETTE = {
  home:    { base: '#1d6fe8', hi: '#6db3ff', lo: '#0d3580', short: '#0d2560' },
  away:    { base: '#e03030', hi: '#ff8080', lo: '#7a1010', short: '#5a0808' },
  home_gk: { base: '#17a589', hi: '#5efcd9', lo: '#0c5c4e', short: '#0c4c40' },
  away_gk: { base: '#8b30e8', hi: '#cc88ff', lo: '#4a0c90', short: '#380870' },
};
const SKIN = { base: '#f5c478', hi: '#fff0d0', lo: '#b06020' };
const BOOT = { base: '#1a1a1a', hi: '#666', lo: '#000' };

// ─── SVG Defs ─────────────────────────────────────────────────────────────────

function SVGDefs() {
  return (
    <defs>
      {/* ── Wood parquet floor pattern ── */}
      <pattern id="woodPlanks" x="0" y="0" width="32" height="10" patternUnits="userSpaceOnUse">
        {/* Plank row A */}
        <rect x="0" y="0" width="32" height="5" fill="#c8904a" />
        {/* Plank row B — offset */}
        <rect x="0" y="5" width="32" height="5" fill="#be8640" />
        {/* Grain lines in A */}
        <line x1="8"  y1="0" x2="8"  y2="5" stroke="rgba(0,0,0,0.10)" strokeWidth="0.6" />
        <line x1="16" y1="0" x2="16" y2="5" stroke="rgba(0,0,0,0.10)" strokeWidth="0.6" />
        <line x1="24" y1="0" x2="24" y2="5" stroke="rgba(0,0,0,0.10)" strokeWidth="0.6" />
        {/* Grain lines in B */}
        <line x1="4"  y1="5" x2="4"  y2="10" stroke="rgba(0,0,0,0.10)" strokeWidth="0.6" />
        <line x1="12" y1="5" x2="12" y2="10" stroke="rgba(0,0,0,0.10)" strokeWidth="0.6" />
        <line x1="20" y1="5" x2="20" y2="10" stroke="rgba(0,0,0,0.10)" strokeWidth="0.6" />
        <line x1="28" y1="5" x2="28" y2="10" stroke="rgba(0,0,0,0.10)" strokeWidth="0.6" />
        {/* Row separator */}
        <line x1="0" y1="5" x2="32" y2="5" stroke="rgba(0,0,0,0.20)" strokeWidth="0.5" />
      </pattern>

      {/* ── Depth gradient (far end darker) ── */}
      <linearGradient id="depthFog" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#000" stopOpacity="0.42" />
        <stop offset="35%"  stopColor="#000" stopOpacity="0.10" />
        <stop offset="65%"  stopColor="#000" stopOpacity="0.00" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0.04" />
      </linearGradient>

      {/* ── Centre-court overhead light reflection ── */}
      <radialGradient id="lightGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="#fff" stopOpacity="0.09" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0.00" />
      </radialGradient>

      {/* ── Arena wall gradient ── */}
      <linearGradient id="arenaWall" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#0e0e22" />
        <stop offset="100%" stopColor="#1a1a38" />
      </linearGradient>

      {/* ── Stands gradient (purple like Nonthaburi) ── */}
      <linearGradient id="standsTop" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%"   stopColor="#2a1a5e" />
        <stop offset="100%" stopColor="#1a0e3a" />
      </linearGradient>
      <linearGradient id="standsBot" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#2a1a5e" />
        <stop offset="100%" stopColor="#1a0e3a" />
      </linearGradient>

      {/* ── Drop-shadow filter ── */}
      <filter id="figShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0.5" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.55" />
      </filter>
      <filter id="glowYellow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#FFD60A" floodOpacity="0.9" />
      </filter>

      {/* ── Sphere gradients for player parts ── */}
      {([...Object.entries(PALETTE), ['skin', SKIN], ['boot', BOOT]] as [string, typeof SKIN][]).map(([k, c]) => (
        <radialGradient key={k} id={`sph-${k}`} cx="33%" cy="27%" r="70%">
          <stop offset="0%"   stopColor={c.hi} />
          <stop offset="50%"  stopColor={c.base} />
          <stop offset="100%" stopColor={c.lo} />
        </radialGradient>
      ))}

      {/* ── Cylinder (horizontal) ── */}
      {([...Object.entries(PALETTE), ['skin', SKIN]] as [string, typeof SKIN][]).map(([k, c]) => (
        <linearGradient key={k} id={`cylH-${k}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={c.lo} />
          <stop offset="20%"  stopColor={c.hi} />
          <stop offset="55%"  stopColor={c.base} />
          <stop offset="100%" stopColor={c.lo} />
        </linearGradient>
      ))}

      {/* ── Cylinder (vertical) ── */}
      {([...Object.entries(PALETTE), ['skin', SKIN]] as [string, typeof SKIN][]).map(([k, c]) => (
        <linearGradient key={k} id={`cylV-${k}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={c.hi} />
          <stop offset="45%"  stopColor={c.base} />
          <stop offset="100%" stopColor={c.lo} />
        </linearGradient>
      ))}

      {/* Hair clip masks per team */}
      {Object.keys(PALETTE).map(k => (
        <clipPath key={k} id={`hairClip-${k}`}>
          <rect x="-9" y="-30" width="18" height="14" />
        </clipPath>
      ))}
    </defs>
  );
}

// ─── Futsal court (wood + arena) ──────────────────────────────────────────────

function FutsalCourt() {
  const mx = (CX1 + CX2) / 2;
  const my = (CY1 + CY2) / 2;

  return (
    <g>
      {/* ── Arena outer shell ── */}
      <rect x={0} y={0} width={VW} height={VH} fill="url(#arenaWall)" rx={6} />

      {/* ── Stands top (purple seats) ── */}
      <rect x={0} y={0} width={VW} height={CY1 + 2} fill="url(#standsTop)" />
      {/* Seat row hints */}
      {[0, 2, 4, 6].map(i => (
        <line key={i} x1={0} y1={i + 1} x2={VW} y2={i + 1}
          stroke="rgba(120,80,200,0.25)" strokeWidth="1" />
      ))}

      {/* ── Stands bottom ── */}
      <rect x={0} y={CY2 - 2} width={VW} height={VH - CY2 + 6} fill="url(#standsBot)" />
      {[0, 2, 4, 6].map(i => (
        <line key={i} x1={0} y1={CY2 + i} x2={VW} y2={CY2 + i}
          stroke="rgba(120,80,200,0.20)" strokeWidth="1" />
      ))}

      {/* ── Court border strip (dark wood edge) ── */}
      <rect x={CX1 - 3} y={CY1 - 3} width={CW + 6} height={CH + 6}
        fill="#7a4e1a" rx={2} />

      {/* ── Wood parquet surface ── */}
      <rect x={CX1} y={CY1} width={CW} height={CH} fill="url(#woodPlanks)" />

      {/* ── Depth fog overlay (far end darker = 3D illusion) ── */}
      <rect x={CX1} y={CY1} width={CW} height={CH} fill="url(#depthFog)" />

      {/* ── Overhead light reflection (centre glow) ── */}
      <ellipse cx={mx} cy={my} rx={100} ry={50} fill="url(#lightGlow)" />

      {/* ── Varnish sheen – diagonal highlight strip ── */}
      <rect x={CX1} y={CY1} width={CW} height={CH}
        fill="rgba(255,255,255,0.03)"
        style={{ maskImage: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)' }} />

      {/* ══ COURT MARKINGS ══ */}
      {/* Boundary */}
      <rect x={CX1 + 3} y={CY1 + 3} width={CW - 6} height={CH - 6}
        fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} />

      {/* Centre line */}
      <line x1={mx} y1={CY1 + 3} x2={mx} y2={CY2 - 3}
        stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} />

      {/* Centre circle (3m radius → 30px) */}
      <circle cx={mx} cy={my} r={30}
        fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} />
      <circle cx={mx} cy={my} r={2.5} fill="rgba(255,255,255,0.92)" />

      {/* ── Left penalty D (6m radius from centre of goal) ── */}
      {/* Goal centre at (CX1+3, my). D = semicircle r=60px, right half only */}
      <path d={`M ${CX1+3},${my - 60} A 60,60 0 0,1 ${CX1+3},${my + 60}`}
        fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} />
      {/* Penalty spot (6m) */}
      <circle cx={CX1 + 63} cy={my} r={2.5} fill="rgba(255,255,255,0.92)" />
      {/* 2nd penalty spot (10m) */}
      <circle cx={CX1 + 103} cy={my} r={2} fill="rgba(255,255,255,0.5)" />

      {/* ── Right penalty D ── */}
      <path d={`M ${CX2-3},${my - 60} A 60,60 0 0,0 ${CX2-3},${my + 60}`}
        fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={1.6} />
      <circle cx={CX2 - 63} cy={my} r={2.5} fill="rgba(255,255,255,0.92)" />
      <circle cx={CX2 - 103} cy={my} r={2} fill="rgba(255,255,255,0.5)" />

      {/* ── Left goal (3m wide = 30px, with 3D depth) ── */}
      <rect x={CX1 - 8} y={my - 15} width={8} height={30}
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.88)" strokeWidth={1.4} />
      {/* Goal net lines (suggest 3D grid) */}
      {[-10, -5, 0, 5, 10].map(dy => (
        <line key={dy}
          x1={CX1 - 8} y1={my + dy} x2={CX1} y2={my + dy}
          stroke="rgba(255,255,255,0.18)" strokeWidth={0.5} />
      ))}
      {[-8, -4].map(dx => (
        <line key={dx}
          x1={CX1 + dx} y1={my - 15} x2={CX1 + dx} y2={my + 15}
          stroke="rgba(255,255,255,0.18)" strokeWidth={0.5} />
      ))}
      {/* Goal post 3D top/bottom edge */}
      <line x1={CX1 - 8} y1={my - 15} x2={CX1} y2={my - 13}
        stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />
      <line x1={CX1 - 8} y1={my + 15} x2={CX1} y2={my + 13}
        stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />

      {/* ── Right goal ── */}
      <rect x={CX2} y={my - 15} width={8} height={30}
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.88)" strokeWidth={1.4} />
      {[-10, -5, 0, 5, 10].map(dy => (
        <line key={dy}
          x1={CX2} y1={my + dy} x2={CX2 + 8} y2={my + dy}
          stroke="rgba(255,255,255,0.18)" strokeWidth={0.5} />
      ))}
      {[4, 8].map(dx => (
        <line key={dx}
          x1={CX2 + dx} y1={my - 15} x2={CX2 + dx} y2={my + 15}
          stroke="rgba(255,255,255,0.18)" strokeWidth={0.5} />
      ))}
      <line x1={CX2 + 8} y1={my - 15} x2={CX2} y2={my - 13}
        stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />
      <line x1={CX2 + 8} y1={my + 15} x2={CX2} y2={my + 13}
        stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />
    </g>
  );
}

// ─── 3-D Player figure ────────────────────────────────────────────────────────

interface FigureProps {
  colorKey: keyof typeof PALETTE;
  number: number;
  isGK: boolean;
  isRunning: boolean;
  isSelected: boolean;
  rotationDeg: number;
}

function PlayerFigure({ colorKey, number, isGK, isRunning, isSelected, rotationDeg }: FigureProps) {
  const anim = (name: string): React.CSSProperties =>
    isRunning ? { transformOrigin: '0px 0px', animation: `${name} 0.44s ease-in-out infinite` } : {};

  const jH = `url(#cylH-${colorKey})`;   // jersey horizontal cylinder
  const jV = `url(#cylV-${colorKey})`;   // jersey vertical
  const sk = `url(#cylH-skin)`;
  const skV = `url(#cylV-skin)`;
  const bt = `url(#sph-boot)`;
  const pal = PALETTE[colorKey];

  return (
    <g transform={`rotate(${rotationDeg})`} filter="url(#figShadow)">
      <circle r={20} fill="transparent" />

      {isSelected && (
        <circle r={21} fill="none" stroke="#FFD60A" strokeWidth={2.2}
          filter="url(#glowYellow)" />
      )}

      {/* ── GK badge ── */}
      {isGK && (
        <g>
          <rect x={-10} y={-33} width={20} height={8} rx={3} fill={pal.base} />
          <text x={0} y={-27} textAnchor="middle" dominantBaseline="central"
            fontSize={5.5} fontWeight="900" fill="white" style={{ pointerEvents: 'none' }}>GK</text>
        </g>
      )}

      {/* ── Ground shadow ellipse ── */}
      <ellipse cx={1} cy={20} rx={11} ry={3} fill="rgba(0,0,0,0.35)" />

      {/* ── Left arm (pivot: L shoulder −10, −5) ── */}
      <g transform="translate(-10,-5)">
        <g style={anim('drillArmL')}>
          <rect x={-9} y={-3} width={9} height={6} rx={3} fill={jH} />
          {/* sleeve stripe */}
          <rect x={-9} y={-1} width={9} height={2} rx={1} fill="rgba(255,255,255,0.18)" />
          <rect x={-17} y={-2.5} width={8} height={5} rx={2.5} fill={sk} />
        </g>
      </g>

      {/* ── Right arm (pivot: R shoulder 10, −5) ── */}
      <g transform="translate(10,-5)">
        <g style={anim('drillArmR')}>
          <rect x={0} y={-3} width={9} height={6} rx={3} fill={jH} />
          <rect x={0} y={-1} width={9} height={2} rx={1} fill="rgba(255,255,255,0.18)" />
          <rect x={9} y={-2.5} width={8} height={5} rx={2.5} fill={sk} />
        </g>
      </g>

      {/* ── Jersey torso ── */}
      {/* Collar */}
      <ellipse cx={0} cy={-9.5} rx={4} ry={2.2} fill={jV} />
      {/* Body */}
      <path d="M -10,-9 Q -11,-2 -9,7 L 9,7 Q 11,-2 10,-9 Z" fill={jV} />
      {/* Horizontal jersey stripe */}
      <path d="M -10,-2 Q -11,0 -9,2 L 9,2 Q 11,0 10,-2 Z"
        fill="rgba(255,255,255,0.13)" />
      {/* Number */}
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central"
        fontSize={6.5} fontWeight="900" fill="white"
        style={{ pointerEvents: 'none' }}>
        {number}
      </text>

      {/* ── Shorts ── */}
      <rect x={-9} y={6} width={18} height={7} rx={2.5}
        fill={pal.lo} opacity={0.9} />
      {/* Shorts center seam */}
      <line x1={0} y1={6} x2={0} y2={13} stroke="rgba(0,0,0,0.3)" strokeWidth={0.7} />

      {/* ── Left leg (pivot: L hip −4, 12) ── */}
      <g transform="translate(-4,12)">
        <g style={anim('drillLegL')}>
          <rect x={-4} y={0} width={8} height={8} rx={4} fill={sk} />
          <rect x={-3.5} y={7} width={7} height={8} rx={3.5} fill={skV} opacity={0.85} />
          {/* Sock white top */}
          <rect x={-3.5} y={13} width={7} height={2} rx={1} fill="rgba(255,255,255,0.6)" />
          {/* Boot */}
          <ellipse cx={0} cy={17} rx={5} ry={2.5} fill={bt} />
          <ellipse cx={1} cy={16.2} rx={2.2} ry={1} fill="rgba(255,255,255,0.2)" />
        </g>
      </g>

      {/* ── Right leg (pivot: R hip 4, 12) ── */}
      <g transform="translate(4,12)">
        <g style={anim('drillLegR')}>
          <rect x={-4} y={0} width={8} height={8} rx={4} fill={sk} />
          <rect x={-3.5} y={7} width={7} height={8} rx={3.5} fill={skV} opacity={0.85} />
          <rect x={-3.5} y={13} width={7} height={2} rx={1} fill="rgba(255,255,255,0.6)" />
          <ellipse cx={0} cy={17} rx={5} ry={2.5} fill={bt} />
          <ellipse cx={1} cy={16.2} rx={2.2} ry={1} fill="rgba(255,255,255,0.2)" />
        </g>
      </g>

      {/* ── Neck ── */}
      <rect x={-3} y={-14} width={6} height={6} rx={3} fill={skV} />

      {/* ── Head sphere ── */}
      <circle cy={-22} r={9} fill={`url(#sph-skin)`} />
      {/* Hair cap */}
      <circle cy={-22} r={9} fill={`url(#sph-${colorKey})`}
        clipPath={`url(#hairClip-${colorKey})`} />
      {/* Ears */}
      <ellipse cx={-9} cy={-22} rx={2}   ry={3}   fill={`url(#sph-skin)`} />
      <ellipse cx={ 9} cy={-22} rx={2}   ry={3}   fill={`url(#sph-skin)`} />
      {/* Eyebrows */}
      <path d="M -4.5,-24.5 Q -2.5,-26 -0.5,-24.5" fill="none" stroke={pal.base} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M 0.5,-24.5 Q 2.5,-26 4.5,-24.5"   fill="none" stroke={pal.base} strokeWidth={1.2} strokeLinecap="round" />
      {/* Eyes */}
      <ellipse cx={-3} cy={-22.5} rx={2.2} ry={1.8} fill="white" />
      <ellipse cx={ 3} cy={-22.5} rx={2.2} ry={1.8} fill="white" />
      <circle  cx={-2.6} cy={-22.2} r={1.3} fill="#2a1a08" />
      <circle  cx={ 3.4} cy={-22.2} r={1.3} fill="#2a1a08" />
      <circle  cx={-2.1} cy={-22.7} r={0.5} fill="white" opacity={0.9} />
      <circle  cx={ 3.9} cy={-22.7} r={0.5} fill="white" opacity={0.9} />
      {/* Mouth */}
      <path d="M -2,-20 Q 0,-18.5 2,-20" fill="none" stroke="rgba(160,80,30,0.7)" strokeWidth={0.8} strokeLinecap="round" />
      {/* Head specular */}
      <circle cx={-4} cy={-27} r={2.5} fill="white" opacity={0.22} />
    </g>
  );
}

// ─── Movement arrow ───────────────────────────────────────────────────────────

function MovementArrow({ from, to, color }: { from: EntityPos; to: EntityPos; color: string }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 6) return null;
  const ux = dx / len, uy = dy / len;
  const ex = to.x - ux * 13;
  const ey = to.y - uy * 13;
  const s = 6;
  return (
    <g opacity={0.85}>
      {/* Shadow line */}
      <line x1={from.x + 0.5} y1={from.y + 1} x2={ex + 0.5} y2={ey + 1}
        stroke="rgba(0,0,0,0.3)" strokeWidth={2.5} strokeDasharray="5 3" />
      {/* Coloured line */}
      <line x1={from.x} y1={from.y} x2={ex} y2={ey}
        stroke={color} strokeWidth={2} strokeDasharray="5 3"
        style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
      <polygon
        points={`${to.x},${to.y} ${ex - s * ux + s * 0.5 * uy},${ey - s * uy - s * 0.5 * ux} ${ex - s * ux - s * 0.5 * uy},${ey - s * uy + s * 0.5 * ux}`}
        fill={color}
        style={{ filter: `drop-shadow(0 0 2px ${color})` }}
      />
    </g>
  );
}

// ─── 3-D Soccer ball ─────────────────────────────────────────────────────────

function SoccerBall({ pos, isSelected, onDown }: {
  pos: EntityPos;
  isSelected: boolean;
  onDown: (e: React.MouseEvent | React.TouchEvent) => void;
}) {
  return (
    <g transform={`translate(${pos.x},${pos.y})`}
      onMouseDown={onDown} onTouchStart={onDown}
      style={{ cursor: 'grab' }}>
      {/* Ground shadow */}
      <ellipse cx={1} cy={9} rx={7} ry={2.5} fill="rgba(0,0,0,0.35)" />
      {/* Ball */}
      <circle r={8} fill="url(#sph-boot)" />
      <circle r={8} fill="rgba(240,240,230,0.92)" />
      {/* Patches */}
      <circle r={8} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={7}
        strokeDasharray="4 28" />
      <polygon points="0,-6 5,-2 3,4 -3,4 -5,-2"
        fill="#111" opacity={0.18} />
      <polygon points="0,-6 5,-2 3,4 -3,4 -5,-2"
        fill="none" stroke="#333" strokeWidth={0.7} />
      {/* Sphere shading */}
      <circle r={8} fill="url(#sph-skin)" opacity={0.2} />
      {/* Specular */}
      <circle cx={-3} cy={-4} r={2.2} fill="white" opacity={0.65} />
      {/* Selection */}
      {isSelected && <circle r={10} fill="none" stroke="#FFD60A" strokeWidth={2} filter="url(#glowYellow)" />}
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
      const p = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
      store.moveEntity(dragging.current,
        Math.max(CX1 + 6, Math.min(CX2 - 6, p.x)),
        Math.max(CY1 + 10, Math.min(CY2 - 10, p.y)));
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

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: '100%', borderRadius: 10, touchAction: 'none', display: 'block', userSelect: 'none' }}
      onClick={() => store.setSelectedEntity(null)}
    >
      <SVGDefs />
      <FutsalCourt />

      {/* Movement arrows */}
      {nextStepPos && players.map(p => {
        const from = currentPositions[p.id], to = nextStepPos[p.id];
        if (!from || !to) return null;
        return <MovementArrow key={p.id} from={from} to={to} color={p.team === 'home' ? '#93c5fd' : '#fca5a5'} />;
      })}
      {nextStepPos && currentPositions[BALL_ID_CONST] && nextStepPos[BALL_ID_CONST] && (
        <MovementArrow from={currentPositions[BALL_ID_CONST]} to={nextStepPos[BALL_ID_CONST]} color="#FFD60A" />
      )}

      {/* Players */}
      {players.map(p => {
        const pos = currentPositions[p.id];
        if (!pos) return null;
        const colorKey = (p.team + (p.isGK ? '_gk' : '')) as keyof typeof PALETTE;

        const rotDeg = (() => {
          if (isPlaying && playNextPos) {
            const a = facingAngle(playCurPos[p.id], playNextPos[p.id]);
            if (a !== null) return a;
          }
          if (!isPlaying && nextStepPos) {
            const a = facingAngle(currentPositions[p.id], nextStepPos[p.id]);
            if (a !== null) return a;
          }
          return 0;
        })();

        const isRunning = isPlaying && (() => {
          const fr = playCurPos[p.id], to = playNextPos?.[p.id];
          if (!fr || !to) return false;
          const dx = to.x - fr.x, dy = to.y - fr.y;
          return dx * dx + dy * dy > 16;
        })();

        return (
          <g key={p.id}
            transform={`translate(${pos.x},${pos.y})`}
            onMouseDown={e => onDown(e, p.id)}
            onTouchStart={e => onDown(e, p.id)}
            style={{ cursor: isPlaying ? 'default' : 'grab' }}>
            <PlayerFigure
              colorKey={colorKey} number={p.number} isGK={p.isGK}
              isRunning={isRunning} isSelected={selectedEntity === p.id} rotationDeg={rotDeg}
            />
          </g>
        );
      })}

      {(() => {
        const pos = currentPositions[BALL_ID_CONST];
        if (!pos) return null;
        return (
          <SoccerBall pos={pos} isSelected={selectedEntity === BALL_ID_CONST}
            onDown={e => onDown(e, BALL_ID_CONST)} />
        );
      })()}
    </svg>
  );
}
