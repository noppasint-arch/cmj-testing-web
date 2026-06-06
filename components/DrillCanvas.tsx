'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useDrillStore, BALL_ID_CONST, EntityPos } from '@/store/drillStore';

const VW = 400;
const VH = 200;

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

// ─── Color palette ────────────────────────────────────────────────────────────

const PALETTE = {
  home:    { base: '#2563eb', hi: '#93c5fd', lo: '#1e3a8a', short: '#1e3a8a' },
  away:    { base: '#dc2626', hi: '#fca5a5', lo: '#7f1d1d', short: '#7f1d1d' },
  home_gk: { base: '#0d9488', hi: '#5eead4', lo: '#134e4a', short: '#134e4a' },
  away_gk: { base: '#7c3aed', hi: '#c4b5fd', lo: '#4c1d95', short: '#4c1d95' },
};
const SKIN   = { base: '#f5c99a', hi: '#fef3e2', lo: '#c2752a' };
const BOOT   = { base: '#222',    hi: '#555',    lo: '#000'     };
const BALL_C = { base: '#f0f0e8', hi: '#ffffff', lo: '#aaaaaa'  };

// ─── SVG gradient defs (defined once, shared) ────────────────────────────────

function SVGDefs() {
  return (
    <defs>
      {/* Drop-shadow filter */}
      <filter id="dropshadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0.5" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.45" />
      </filter>

      {/* Sphere gradient for heads / balls — light from upper-left */}
      {Object.entries({ ...PALETTE, skin: SKIN as typeof PALETTE.home, boot: BOOT as typeof PALETTE.home, ball: BALL_C as typeof PALETTE.home }).map(([k, c]) => (
        <radialGradient key={k} id={`sphere-${k}`} cx="32%" cy="28%" r="70%">
          <stop offset="0%"   stopColor={c.hi} />
          <stop offset="45%"  stopColor={c.base} />
          <stop offset="100%" stopColor={c.lo} />
        </radialGradient>
      ))}

      {/* Cylinder gradient for torso / limbs — lit from left */}
      {Object.entries({ ...PALETTE, skin: SKIN as typeof PALETTE.home, boot: BOOT as typeof PALETTE.home }).map(([k, c]) => (
        <linearGradient key={k} id={`cyl-${k}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={c.lo} />
          <stop offset="22%"  stopColor={c.hi} />
          <stop offset="55%"  stopColor={c.base} />
          <stop offset="100%" stopColor={c.lo} />
        </linearGradient>
      ))}

      {/* Cylinder rotated 90° — used for horizontal arm rects */}
      {Object.entries({ ...PALETTE, skin: SKIN as typeof PALETTE.home }).map(([k, c]) => (
        <linearGradient key={k} id={`cylV-${k}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={c.hi} />
          <stop offset="40%"  stopColor={c.base} />
          <stop offset="100%" stopColor={c.lo} />
        </linearGradient>
      ))}
    </defs>
  );
}

// ─── 3-D player figure ────────────────────────────────────────────────────────

interface FigureProps {
  colorKey: keyof typeof PALETTE;
  number: number;
  isGK: boolean;
  isRunning: boolean;
  isSelected: boolean;
  rotationDeg: number;
}

function PlayerFigure({ colorKey, number, isGK, isRunning, isSelected, rotationDeg }: FigureProps) {
  const pal = PALETTE[colorKey];

  const anim = (name: string): React.CSSProperties =>
    isRunning ? { transformOrigin: '0px 0px', animation: `${name} 0.44s ease-in-out infinite` } : {};

  const jerseyFill   = `url(#cyl-${colorKey})`;
  const jerseyFillV  = `url(#cylV-${colorKey})`;
  const skinFill     = `url(#sphere-skin)`;
  const skinFillCyl  = `url(#cyl-skin)`;
  const bootFill     = `url(#sphere-boot)`;
  const headFill     = `url(#sphere-skin)`;

  return (
    <g transform={`rotate(${rotationDeg})`} filter="url(#dropshadow)">
      {/* Hit-area */}
      <circle r={19} fill="transparent" />

      {isSelected && (
        <circle r={20} fill="none" stroke="#FFD60A" strokeWidth={2}
          strokeDasharray="3 2" style={{ filter: 'drop-shadow(0 0 3px #FFD60A)' }} />
      )}

      {/* GK badge */}
      {isGK && (
        <g>
          <rect x={-9} y={-30} width={18} height={8} rx={3} fill={pal.base} />
          <text x={0} y={-24} textAnchor="middle" dominantBaseline="central"
            fontSize={5} fontWeight="800" fill="white" style={{ pointerEvents: 'none' }}>GK</text>
        </g>
      )}

      {/* ── Left arm (pivot: left shoulder −9, −5) ── */}
      <g transform="translate(-9,-5)">
        <g style={anim('drillArmL')}>
          {/* upper arm */}
          <rect x={-8} y={-2.5} width={8} height={5} rx={2.5} fill={jerseyFill} />
          {/* forearm */}
          <rect x={-15} y={-2} width={8} height={4} rx={2} fill={skinFillCyl} />
        </g>
      </g>

      {/* ── Right arm (pivot: right shoulder 9, −5) ── */}
      <g transform="translate(9,-5)">
        <g style={anim('drillArmR')}>
          <rect x={0} y={-2.5} width={8} height={5} rx={2.5} fill={jerseyFill} />
          <rect x={7} y={-2} width={8} height={4} rx={2} fill={skinFillCyl} />
        </g>
      </g>

      {/* ── Jersey torso ── */}
      {/* Collar */}
      <ellipse cx={0} cy={-9.5} rx={3.5} ry={2} fill={`url(#cylV-${colorKey})`} />
      {/* Body — slightly wider at shoulders, tapers to waist */}
      <path d="M -9,-8 Q -10,-2 -8,6 L 8,6 Q 10,-2 9,-8 Z"
        fill={jerseyFill} stroke={pal.lo} strokeWidth={0.3} />
      {/* Chest highlight stripe */}
      <rect x={-1} y={-7} width={2} height={12} rx={1} fill="rgba(255,255,255,0.12)" />
      {/* Number */}
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central"
        fontSize={6} fontWeight="900" fill="white"
        style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
        {number}
      </text>

      {/* ── Shorts ── */}
      <rect x={-8} y={5} width={16} height={6} rx={2}
        fill={`url(#cyl-${colorKey})`} opacity={0.7} />

      {/* ── Left leg (pivot: left hip −3.5, 10) ── */}
      <g transform="translate(-3.5,10)">
        <g style={anim('drillLegL')}>
          {/* thigh */}
          <rect x={-3.5} y={0} width={7} height={8} rx={3.5} fill={skinFillCyl} />
          {/* shin */}
          <rect x={-3} y={7} width={6} height={8} rx={3} fill={`url(#cyl-skin)`} opacity={0.85} />
          {/* boot */}
          <ellipse cx={0} cy={16} rx={4.5} ry={2} fill={bootFill} />
          <ellipse cx={1} cy={15.5} rx={2} ry={1} fill="rgba(255,255,255,0.15)" />
        </g>
      </g>

      {/* ── Right leg (pivot: right hip 3.5, 10) ── */}
      <g transform="translate(3.5,10)">
        <g style={anim('drillLegR')}>
          <rect x={-3.5} y={0} width={7} height={8} rx={3.5} fill={skinFillCyl} />
          <rect x={-3} y={7} width={6} height={8} rx={3} fill={`url(#cyl-skin)`} opacity={0.85} />
          <ellipse cx={0} cy={16} rx={4.5} ry={2} fill={bootFill} />
          <ellipse cx={1} cy={15.5} rx={2} ry={1} fill="rgba(255,255,255,0.15)" />
        </g>
      </g>

      {/* ── Neck ── */}
      <rect x={-2.5} y={-13} width={5} height={5} rx={2.5} fill={skinFillCyl} />

      {/* ── Head (sphere) ── */}
      <circle cy={-20} r={8} fill={headFill} stroke={pal.lo} strokeWidth={0.4} />

      {/* Hair cap */}
      <clipPath id={`hairClip-${colorKey}`}>
        <rect x={-8} y={-30} width={16} height={12} />
      </clipPath>
      <circle cy={-20} r={8} fill={`url(#sphere-${colorKey})`}
        clipPath={`url(#hairClip-${colorKey})`} />

      {/* Ear left */}
      <ellipse cx={-8} cy={-20} rx={1.5} ry={2.5} fill={skinFill} />
      {/* Ear right */}
      <ellipse cx={8} cy={-20} rx={1.5} ry={2.5} fill={skinFill} />

      {/* Eyes */}
      <ellipse cx={-2.8} cy={-20.5} rx={1.8} ry={1.5} fill="white" />
      <ellipse cx={2.8} cy={-20.5} rx={1.8} ry={1.5} fill="white" />
      <circle cx={-2.5} cy={-20.2} r={1.1} fill="#2a2a2a" />
      <circle cx={2.5} cy={-20.2} r={1.1} fill="#2a2a2a" />
      {/* Eye shine */}
      <circle cx={-2} cy={-20.6} r={0.4} fill="white" opacity={0.9} />
      <circle cx={3} cy={-20.6} r={0.4} fill="white" opacity={0.9} />

      {/* Specular highlight on head */}
      <circle cx={-4} cy={-25} r={2} fill="white" opacity={0.25} />

      {/* Number label below figure for readability */}
      <rect x={-5} y={29} width={10} height={7} rx={2} fill={pal.base} opacity={0.9} />
      <text x={0} y={33} textAnchor="middle" dominantBaseline="central"
        fontSize={5} fontWeight="800" fill="white" style={{ pointerEvents: 'none' }}>
        {number}
      </text>
    </g>
  );
}

// ─── Futsal court ─────────────────────────────────────────────────────────────

function FutsalCourt() {
  return (
    <g>
      {/* Base */}
      <rect x={0} y={0} width={VW} height={VH} fill="#1b4d1b" rx={4} />
      {/* Grass stripes */}
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * 40} y={0} width={40} height={VH}
          fill={i % 2 === 0 ? '#1e5420' : '#1a4d1c'} />
      ))}
      {/* Subtle grass texture overlay */}
      <rect x={0} y={0} width={VW} height={VH}
        fill="url(#grassOverlay)" opacity={0.06} rx={4} />
      {/* Lines */}
      <rect x={4} y={4} width={VW - 8} height={VH - 8}
        fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      <line x1={VW / 2} y1={4} x2={VW / 2} y2={VH - 4}
        stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      <circle cx={VW / 2} cy={VH / 2} r={25}
        fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      <circle cx={VW / 2} cy={VH / 2} r={2.5} fill="rgba(255,255,255,0.9)" />
      {/* Left box */}
      <rect x={4} y={VH / 2 - 44} width={52} height={88}
        fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      {/* Left goal (3D effect — top/side lines) */}
      <rect x={0} y={VH / 2 - 16} width={6} height={32}
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      <line x1={0} y1={VH/2-16} x2={4} y2={VH/2-14} stroke="rgba(255,255,255,0.4)" strokeWidth={0.8} />
      <line x1={0} y1={VH/2+16} x2={4} y2={VH/2+14} stroke="rgba(255,255,255,0.4)" strokeWidth={0.8} />
      <circle cx={48} cy={VH / 2} r={2.5} fill="rgba(255,255,255,0.9)" />
      {/* Right box */}
      <rect x={VW - 56} y={VH / 2 - 44} width={52} height={88}
        fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      {/* Right goal */}
      <rect x={VW - 6} y={VH / 2 - 16} width={6} height={32}
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      <line x1={VW} y1={VH/2-16} x2={VW-4} y2={VH/2-14} stroke="rgba(255,255,255,0.4)" strokeWidth={0.8} />
      <line x1={VW} y1={VH/2+16} x2={VW-4} y2={VH/2+14} stroke="rgba(255,255,255,0.4)" strokeWidth={0.8} />
      <circle cx={VW - 48} cy={VH / 2} r={2.5} fill="rgba(255,255,255,0.9)" />
    </g>
  );
}

// ─── Movement arrow ───────────────────────────────────────────────────────────

function MovementArrow({ from, to, color }: { from: EntityPos; to: EntityPos; color: string }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 6) return null;
  const ux = dx / len;
  const uy = dy / len;
  const ex = to.x - ux * 12;
  const ey = to.y - uy * 12;
  const s = 5;
  return (
    <g opacity={0.7}>
      <line x1={from.x} y1={from.y} x2={ex} y2={ey}
        stroke={color} strokeWidth={1.8} strokeDasharray="5 3"
        style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
      <polygon
        points={`${to.x},${to.y} ${ex - s * ux + s * 0.5 * uy},${ey - s * uy - s * 0.5 * ux} ${ex - s * ux - s * 0.5 * uy},${ey - s * uy + s * 0.5 * ux}`}
        fill={color}
      />
    </g>
  );
}

// ─── 3-D soccer ball ─────────────────────────────────────────────────────────

function SoccerBall({ pos, isSelected, onDown }: {
  pos: EntityPos;
  isSelected: boolean;
  onDown: (e: React.MouseEvent | React.TouchEvent) => void;
}) {
  return (
    <g transform={`translate(${pos.x},${pos.y})`}
      onMouseDown={onDown} onTouchStart={onDown}
      style={{ cursor: 'grab' }} filter="url(#dropshadow)">
      {/* Shadow on ground */}
      <ellipse cx={1} cy={8} rx={6} ry={2} fill="rgba(0,0,0,0.3)" />
      {/* Ball sphere */}
      <circle r={7} fill="url(#sphere-ball)" />
      {/* Pentagon patches */}
      <polygon points="0,-5 4,-2 2.5,3 -2.5,3 -4,-2"
        fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
      <circle r={2} fill="rgba(0,0,0,0.2)" />
      {/* Specular */}
      <circle cx={-2.5} cy={-3.5} r={1.8} fill="white" opacity={0.55} />
      {isSelected && <circle r={9} fill="none" stroke="#FFD60A" strokeWidth={2} />}
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
    for (const id of Object.keys(cur)) {
      out[id] = lerpPos(cur[id], next[id] ?? cur[id], t);
    }
    return out;
  })();

  const nextStepPos  = !isPlaying && activeStep < steps.length - 1 ? steps[activeStep + 1].positions : null;
  const playNextPos  = isPlaying  && activeStep < steps.length - 1 ? steps[activeStep + 1].positions : null;
  const playCurPos   = isPlaying  ? steps[activeStep]?.positions ?? {} : {};

  const dragging = useRef<string | null>(null);

  const onDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (isPlaying) return;
    e.stopPropagation(); e.preventDefault();
    store.setSelectedEntity(id);
    dragging.current = id;
  }, [isPlaying, store]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || !svgRef.current) return;
      const pt = svgRef.current.createSVGPoint();
      pt.x = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      pt.y = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const p = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
      store.moveEntity(dragging.current, Math.max(10, Math.min(VW - 10, p.x)), Math.max(10, Math.min(VH - 10, p.y)));
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [store]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: '100%', borderRadius: 8, touchAction: 'none', display: 'block', userSelect: 'none' }}
      onClick={() => store.setSelectedEntity(null)}
    >
      <SVGDefs />
      <FutsalCourt />

      {/* Movement arrows */}
      {nextStepPos && players.map(p => {
        const from = currentPositions[p.id];
        const to   = nextStepPos[p.id];
        if (!from || !to) return null;
        const color = p.team === 'home' ? '#93c5fd' : '#fca5a5';
        return <MovementArrow key={p.id} from={from} to={to} color={color} />;
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
          const from = playCurPos[p.id];
          const to   = playNextPos?.[p.id];
          if (!from || !to) return false;
          const dx = to.x - from.x, dy = to.y - from.y;
          return dx * dx + dy * dy > 16;
        })();

        return (
          <g key={p.id}
            transform={`translate(${pos.x},${pos.y})`}
            onMouseDown={e => onDown(e, p.id)}
            onTouchStart={e => onDown(e, p.id)}
            style={{ cursor: isPlaying ? 'default' : 'grab' }}
          >
            <PlayerFigure
              colorKey={colorKey}
              number={p.number}
              isGK={p.isGK}
              isRunning={isRunning}
              isSelected={selectedEntity === p.id}
              rotationDeg={rotDeg}
            />
          </g>
        );
      })}

      {/* Ball */}
      {(() => {
        const pos = currentPositions[BALL_ID_CONST];
        if (!pos) return null;
        return (
          <SoccerBall
            pos={pos}
            isSelected={selectedEntity === BALL_ID_CONST}
            onDown={e => onDown(e, BALL_ID_CONST)}
          />
        );
      })()}
    </svg>
  );
}
