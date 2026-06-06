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

// ---- Stick figure --------------------------------------------------------

interface FigureProps {
  fill: string;
  outline: string;
  number: number;
  isGK: boolean;
  isRunning: boolean;
  isSelected: boolean;
  rotationDeg: number;
}

function PlayerFigure({ fill, outline, number, isGK, isRunning, isSelected, rotationDeg }: FigureProps) {
  const legL: React.CSSProperties = isRunning
    ? { transformOrigin: '0px 0px', animation: 'drillLegL 0.44s ease-in-out infinite' }
    : {};
  const legR: React.CSSProperties = isRunning
    ? { transformOrigin: '0px 0px', animation: 'drillLegR 0.44s ease-in-out infinite' }
    : {};
  const armL: React.CSSProperties = isRunning
    ? { transformOrigin: '0px 0px', animation: 'drillArmL 0.44s ease-in-out infinite' }
    : {};
  const armR: React.CSSProperties = isRunning
    ? { transformOrigin: '0px 0px', animation: 'drillArmR 0.44s ease-in-out infinite' }
    : {};

  return (
    <g transform={`rotate(${rotationDeg})`}>
      {/* Invisible hit area for easy dragging */}
      <circle r={14} fill="transparent" />

      {isSelected && (
        <circle r={15} fill="none" stroke="#FFD60A" strokeWidth={1.5} strokeDasharray="3 2" />
      )}

      {/* Head */}
      <circle cy={-11} r={5} fill={fill} stroke={outline} strokeWidth={1.2} />
      <text x={0} y={-9} textAnchor="middle" dominantBaseline="central"
        fontSize={5.5} fontWeight="800" fill="white" style={{ pointerEvents: 'none' }}>
        {number}
      </text>
      {isGK && (
        <text x={0} y={-20} textAnchor="middle" fontSize={4}
          fill="rgba(255,255,255,0.9)" fontWeight="700" style={{ pointerEvents: 'none' }}>
          GK
        </text>
      )}

      {/* Torso */}
      <line x1={0} y1={-6} x2={0} y2={3}
        stroke={fill} strokeWidth={2.5} strokeLinecap="round" />

      {/* Arms – pivot at shoulder (0, -3) */}
      <g transform="translate(0,-3)">
        <line x1={0} y1={0} x2={-7} y2={6} stroke={fill} strokeWidth={2} strokeLinecap="round" style={armL} />
      </g>
      <g transform="translate(0,-3)">
        <line x1={0} y1={0} x2={7} y2={6} stroke={fill} strokeWidth={2} strokeLinecap="round" style={armR} />
      </g>

      {/* Legs – pivot at hip (0, 3) */}
      <g transform="translate(0,3)">
        <line x1={0} y1={0} x2={-5} y2={10} stroke={fill} strokeWidth={2.2} strokeLinecap="round" style={legL} />
      </g>
      <g transform="translate(0,3)">
        <line x1={0} y1={0} x2={5} y2={10} stroke={fill} strokeWidth={2.2} strokeLinecap="round" style={legR} />
      </g>
    </g>
  );
}

// ---- Court ---------------------------------------------------------------

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

// ---- Arrow ---------------------------------------------------------------

function MovementArrow({ from, to, color }: { from: EntityPos; to: EntityPos; color: string }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 6) return null;
  const ux = dx / len;
  const uy = dy / len;
  const endX = to.x - ux * 10;
  const endY = to.y - uy * 10;
  const s = 5;
  return (
    <g opacity={0.6}>
      <line x1={from.x} y1={from.y} x2={endX} y2={endY}
        stroke={color} strokeWidth={1.5} strokeDasharray="5 3" />
      <polygon
        points={`${to.x},${to.y} ${endX - s * ux + s * 0.5 * uy},${endY - s * uy - s * 0.5 * ux} ${endX - s * ux - s * 0.5 * uy},${endY - s * uy + s * 0.5 * ux}`}
        fill={color}
      />
    </g>
  );
}

// ---- Main canvas ---------------------------------------------------------

export default function DrillCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const store = useDrillStore();
  const { players, steps, activeStep, isPlaying, playbackT, selectedEntity } = store;

  const currentPositions: Record<string, EntityPos> = (() => {
    const cur = steps[activeStep]?.positions ?? {};
    if (!isPlaying || activeStep >= steps.length - 1) return cur;
    const next = steps[activeStep + 1]?.positions ?? cur;
    const t = easeInOut(Math.max(0, Math.min(1, playbackT)));
    const result: Record<string, EntityPos> = {};
    for (const id of Object.keys(cur)) {
      result[id] = lerpPos(cur[id], next[id] ?? cur[id], t);
    }
    return result;
  })();

  const nextStepPositions = !isPlaying && activeStep < steps.length - 1
    ? steps[activeStep + 1].positions
    : null;

  // For facing direction during playback (from→to of the animating step pair)
  const playbackNextPositions = isPlaying && activeStep < steps.length - 1
    ? steps[activeStep + 1].positions
    : null;
  const playbackCurPositions = isPlaying
    ? steps[activeStep]?.positions ?? {}
    : {};

  const dragging = useRef<string | null>(null);

  const onEntityPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (isPlaying) return;
    e.stopPropagation();
    e.preventDefault();
    store.setSelectedEntity(id);
    dragging.current = id;
  }, [isPlaying, store]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || !svgRef.current) return;
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      pt.x = clientX;
      pt.y = clientY;
      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
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

      {/* Movement arrows (edit mode) */}
      {nextStepPositions && players.map(p => {
        const from = currentPositions[p.id];
        const to = nextStepPositions[p.id];
        if (!from || !to) return null;
        return <MovementArrow key={p.id} from={from} to={to} color={p.team === 'home' ? '#60a5fa' : '#f87171'} />;
      })}
      {nextStepPositions && currentPositions[BALL_ID_CONST] && nextStepPositions[BALL_ID_CONST] && (
        <MovementArrow from={currentPositions[BALL_ID_CONST]} to={nextStepPositions[BALL_ID_CONST]} color="#FFD60A" />
      )}

      {/* Player stick figures */}
      {players.map(p => {
        const pos = currentPositions[p.id];
        if (!pos) return null;

        const isHome = p.team === 'home';
        const fill = isHome ? (p.isGK ? '#1d4ed8' : '#3b82f6') : (p.isGK ? '#b91c1c' : '#ef4444');
        const outline = selectedEntity === p.id ? '#FFD60A' : (isHome ? '#93c5fd' : '#fca5a5');

        // Compute facing rotation
        const rotDeg = (() => {
          if (isPlaying && playbackNextPositions) {
            const from = playbackCurPositions[p.id];
            const to = playbackNextPositions[p.id];
            if (from && to) return facingAngle(from, to) ?? 0;
          }
          if (!isPlaying && nextStepPositions) {
            const from = currentPositions[p.id];
            const to = nextStepPositions[p.id];
            if (from && to) return facingAngle(from, to) ?? 0;
          }
          return 0;
        })();

        // Is this player actually moving during playback?
        const isRunning = isPlaying && (() => {
          const from = playbackCurPositions[p.id];
          const to = playbackNextPositions?.[p.id];
          if (!from || !to) return false;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          return Math.sqrt(dx * dx + dy * dy) > 4;
        })();

        return (
          <g
            key={p.id}
            transform={`translate(${pos.x},${pos.y})`}
            onMouseDown={e => onEntityPointerDown(e, p.id)}
            onTouchStart={e => onEntityPointerDown(e, p.id)}
            style={{ cursor: isPlaying ? 'default' : 'grab' }}
          >
            <PlayerFigure
              fill={fill}
              outline={outline}
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
        const isSelected = selectedEntity === BALL_ID_CONST;
        return (
          <g
            transform={`translate(${pos.x},${pos.y})`}
            onMouseDown={e => onEntityPointerDown(e, BALL_ID_CONST)}
            onTouchStart={e => onEntityPointerDown(e, BALL_ID_CONST)}
            style={{ cursor: isPlaying ? 'default' : 'grab' }}
          >
            <circle r={6} fill="#f5c518" stroke={isSelected ? '#fff' : '#92400e'} strokeWidth={isSelected ? 2 : 1.5} />
            {/* Ball seam lines */}
            <line x1={-4} y1={0} x2={4} y2={0} stroke="#92400e" strokeWidth={0.8} opacity={0.5} />
            <line x1={0} y1={-4} x2={0} y2={4} stroke="#92400e" strokeWidth={0.8} opacity={0.5} />
            <ellipse rx={4} ry={2} stroke="#92400e" strokeWidth={0.8} fill="none" opacity={0.5} />
          </g>
        );
      })()}
    </svg>
  );
}
