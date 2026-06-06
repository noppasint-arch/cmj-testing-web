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

// ─── Human figure ────────────────────────────────────────────────────────────
// Default pose: facing UP (toward −y). Arms extend sideways, legs downward.
// rotationDeg rotates the whole figure to face direction of travel.

interface FigureProps {
  fill: string;        // jersey + head color
  skinColor: string;   // face/hands
  isGK: boolean;
  number: number;
  isRunning: boolean;
  isSelected: boolean;
  rotationDeg: number;
}

function PlayerFigure({ fill, skinColor, isGK, number, isRunning, isSelected, rotationDeg }: FigureProps) {
  const anim = (name: string): React.CSSProperties =>
    isRunning ? { transformOrigin: '0px 0px', animation: `${name} 0.44s ease-in-out infinite` } : {};

  return (
    <g transform={`rotate(${rotationDeg})`}>
      {/* invisible hit-area so tiny figures are still draggable */}
      <circle r={18} fill="transparent" />

      {isSelected && (
        <circle r={19} fill="none" stroke="#FFD60A" strokeWidth={2} strokeDasharray="3 2" />
      )}

      {/* ── Left arm (pivot: left shoulder at −8, −5) ── */}
      <g transform="translate(-8,-5)">
        <g style={anim('drillArmL')}>
          {/* upper arm */}
          <rect x={-7} y={-2} width={7} height={4} rx={2} fill={fill} />
          {/* forearm + hand */}
          <rect x={-12} y={-1.5} width={6} height={3} rx={1.5} fill={skinColor} />
        </g>
      </g>

      {/* ── Right arm (pivot: right shoulder at 8, −5) ── */}
      <g transform="translate(8,-5)">
        <g style={anim('drillArmR')}>
          <rect x={0} y={-2} width={7} height={4} rx={2} fill={fill} />
          <rect x={6} y={-1.5} width={6} height={3} rx={1.5} fill={skinColor} />
        </g>
      </g>

      {/* ── Jersey body (drawn over arm roots) ── */}
      {/* Collar */}
      <rect x={-3} y={-9} width={6} height={3} rx={1.5} fill="white" opacity={0.25} />
      {/* Torso */}
      <path d="M -8,-8 L 8,-8 L 7,6 L -7,6 Z" fill={fill} />
      {/* Number on chest */}
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central"
        fontSize={6.5} fontWeight="900" fill="white"
        style={{ pointerEvents: 'none', fontFamily: 'monospace' }}>
        {number}
      </text>

      {/* ── Shorts ── */}
      <rect x={-7} y={5} width={14} height={5} rx={2} fill={fill} opacity={0.6} />

      {/* ── Left leg (pivot: left hip at −3, 9) ── */}
      <g transform="translate(-3,9)">
        <g style={anim('drillLegL')}>
          {/* thigh */}
          <rect x={-3.5} y={0} width={7} height={8} rx={3.5} fill={skinColor} opacity={0.9} />
          {/* shin */}
          <rect x={-3} y={7} width={6} height={8} rx={3} fill={skinColor} opacity={0.75} />
          {/* boot */}
          <ellipse cx={0} cy={16} rx={4} ry={2.5} fill="#111" />
        </g>
      </g>

      {/* ── Right leg (pivot: right hip at 3, 9) ── */}
      <g transform="translate(3,9)">
        <g style={anim('drillLegR')}>
          <rect x={-3.5} y={0} width={7} height={8} rx={3.5} fill={skinColor} opacity={0.9} />
          <rect x={-3} y={7} width={6} height={8} rx={3} fill={skinColor} opacity={0.75} />
          <ellipse cx={0} cy={16} rx={4} ry={2.5} fill="#111" />
        </g>
      </g>

      {/* ── Head (drawn on top) ── */}
      <circle cy={-15} r={7} fill={skinColor} />
      {/* Hair / helmet band */}
      <path d={`M -7,-17 Q 0,-24 7,-17`} fill={fill} />
      <rect x={-7} y={-18} width={14} height={4} rx={2} fill={fill} opacity={0.5} />
      {/* Eyes */}
      <circle cx={-2.5} cy={-15.5} r={1.2} fill="rgba(0,0,0,0.6)" />
      <circle cx={2.5} cy={-15.5} r={1.2} fill="rgba(0,0,0,0.6)" />

      {/* Jersey number badge on head (small, for readability) */}
      <text x={0} y={-13} textAnchor="middle" dominantBaseline="central"
        fontSize={5} fontWeight="900" fill={fill}
        style={{ pointerEvents: 'none' }}>
        {number}
      </text>

      {isGK && (
        <rect x={-8} y={-27} width={16} height={7} rx={2} fill={fill} />
      )}
      {isGK && (
        <text x={0} y={-23} textAnchor="middle" dominantBaseline="central"
          fontSize={5} fontWeight="700" fill="white" style={{ pointerEvents: 'none' }}>
          GK
        </text>
      )}
    </g>
  );
}

// ─── Futsal court ────────────────────────────────────────────────────────────

function FutsalCourt() {
  return (
    <g>
      <rect x={0} y={0} width={VW} height={VH} fill="#1e4a1e" rx={4} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
        <rect key={i} x={i * 40} y={0} width={40} height={VH}
          fill={i % 2 === 0 ? '#1e4a1e' : '#1a4419'} />
      ))}
      <rect x={4} y={4} width={VW - 8} height={VH - 8}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      <line x1={VW / 2} y1={4} x2={VW / 2} y2={VH - 4}
        stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      <circle cx={VW / 2} cy={VH / 2} r={25}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      <circle cx={VW / 2} cy={VH / 2} r={2} fill="rgba(255,255,255,0.85)" />
      <rect x={4} y={VH / 2 - 44} width={52} height={88}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      <rect x={0} y={VH / 2 - 16} width={6} height={32}
        fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      <circle cx={48} cy={VH / 2} r={2} fill="rgba(255,255,255,0.85)" />
      <rect x={VW - 56} y={VH / 2 - 44} width={52} height={88}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      <rect x={VW - 6} y={VH / 2 - 16} width={6} height={32}
        fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      <circle cx={VW - 48} cy={VH / 2} r={2} fill="rgba(255,255,255,0.85)" />
    </g>
  );
}

// ─── Movement arrow ──────────────────────────────────────────────────────────

function MovementArrow({ from, to, color }: { from: EntityPos; to: EntityPos; color: string }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 6) return null;
  const ux = dx / len;
  const uy = dy / len;
  const ex = to.x - ux * 10;
  const ey = to.y - uy * 10;
  const s = 5;
  return (
    <g opacity={0.6}>
      <line x1={from.x} y1={from.y} x2={ex} y2={ey}
        stroke={color} strokeWidth={1.5} strokeDasharray="5 3" />
      <polygon
        points={`${to.x},${to.y} ${ex - s * ux + s * 0.5 * uy},${ey - s * uy - s * 0.5 * ux} ${ex - s * ux - s * 0.5 * uy},${ey - s * uy + s * 0.5 * ux}`}
        fill={color}
      />
    </g>
  );
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

const TEAM_COLORS: Record<string, { fill: string; skin: string }> = {
  home:     { fill: '#2563eb', skin: '#fcd9a0' },
  away:     { fill: '#dc2626', skin: '#fcd9a0' },
  home_gk:  { fill: '#0f766e', skin: '#fcd9a0' },
  away_gk:  { fill: '#7c3aed', skin: '#fcd9a0' },
};

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

  const nextStepPos    = !isPlaying && activeStep < steps.length - 1 ? steps[activeStep + 1].positions : null;
  const playNextPos    = isPlaying  && activeStep < steps.length - 1 ? steps[activeStep + 1].positions : null;
  const playCurPos     = isPlaying  ? steps[activeStep]?.positions ?? {} : {};

  const dragging = useRef<string | null>(null);

  const onDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (isPlaying) return;
    e.stopPropagation();
    e.preventDefault();
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
      store.moveEntity(dragging.current, Math.max(8, Math.min(VW - 8, p.x)), Math.max(8, Math.min(VH - 8, p.y)));
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
      <FutsalCourt />

      {/* Movement arrows in edit mode */}
      {nextStepPos && players.map(p => {
        const from = currentPositions[p.id];
        const to   = nextStepPos[p.id];
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

        const colorKey = `${p.team}${p.isGK ? '_gk' : ''}`;
        const { fill, skin } = TEAM_COLORS[colorKey] ?? TEAM_COLORS.home;

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
          const dx = to.x - from.x;
          const dy = to.y - from.y;
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
              fill={fill}
              skinColor={skin}
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
        const sel = selectedEntity === BALL_ID_CONST;
        return (
          <g transform={`translate(${pos.x},${pos.y})`}
            onMouseDown={e => onDown(e, BALL_ID_CONST)}
            onTouchStart={e => onDown(e, BALL_ID_CONST)}
            style={{ cursor: isPlaying ? 'default' : 'grab' }}>
            {sel && <circle r={9} fill="none" stroke="#FFD60A" strokeWidth={2} />}
            <circle r={7} fill="#f5f5f0" />
            {/* pentagon patches */}
            <polygon points="0,-5 4.5,-2 2.8,3.5 -2.8,3.5 -4.5,-2" fill="none" stroke="#222" strokeWidth={0.8} />
            <circle r={2} fill="#222" opacity={0.15} />
          </g>
        );
      })()}
    </svg>
  );
}
