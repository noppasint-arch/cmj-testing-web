'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useDrillStore, BALL_ID_CONST, EntityPos } from '@/store/drillStore';

// SVG viewBox: 400 x 200 (2:1 ratio for 40m×20m futsal court)
const VW = 400;
const VH = 200;

function lerpPos(a: EntityPos, b: EntityPos, t: number): EntityPos {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function FutsalCourt() {
  return (
    <g>
      {/* Pitch background */}
      <rect x={0} y={0} width={VW} height={VH} fill="#1e4a1e" rx={4} />
      {/* Grass stripes */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
        <rect key={i} x={i * 40} y={0} width={40} height={VH}
          fill={i % 2 === 0 ? '#1e4a1e' : '#1a4419'} />
      ))}
      {/* Boundary */}
      <rect x={4} y={4} width={VW - 8} height={VH - 8}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      {/* Centre line */}
      <line x1={VW / 2} y1={4} x2={VW / 2} y2={VH - 4}
        stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      {/* Centre circle */}
      <circle cx={VW / 2} cy={VH / 2} r={25}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      <circle cx={VW / 2} cy={VH / 2} r={2} fill="rgba(255,255,255,0.85)" />
      {/* Left penalty area */}
      <rect x={4} y={VH / 2 - 44} width={52} height={88}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      {/* Left goal */}
      <rect x={0} y={VH / 2 - 16} width={6} height={32}
        fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      {/* Left penalty spot */}
      <circle cx={48} cy={VH / 2} r={2} fill="rgba(255,255,255,0.85)" />
      {/* Right penalty area */}
      <rect x={VW - 56} y={VH / 2 - 44} width={52} height={88}
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      {/* Right goal */}
      <rect x={VW - 6} y={VH / 2 - 16} width={6} height={32}
        fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      {/* Right penalty spot */}
      <circle cx={VW - 48} cy={VH / 2} r={2} fill="rgba(255,255,255,0.85)" />
    </g>
  );
}

interface ArrowProps {
  from: EntityPos;
  to: EntityPos;
  color: string;
}

function MovementArrow({ from, to, color }: ArrowProps) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return null;
  const ux = dx / len;
  const uy = dy / len;
  const endX = to.x - ux * 8;
  const endY = to.y - uy * 8;
  const aSize = 5;
  const ax1 = endX - aSize * ux + aSize * 0.5 * uy;
  const ay1 = endY - aSize * uy - aSize * 0.5 * ux;
  const ax2 = endX - aSize * ux - aSize * 0.5 * uy;
  const ay2 = endY - aSize * uy + aSize * 0.5 * ux;

  return (
    <g opacity={0.65}>
      <line x1={from.x} y1={from.y} x2={endX} y2={endY}
        stroke={color} strokeWidth={1.5} strokeDasharray="5 3" />
      <polygon points={`${to.x},${to.y} ${ax1},${ay1} ${ax2},${ay2}`} fill={color} />
    </g>
  );
}

export default function DrillCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const store = useDrillStore();
  const { players, steps, activeStep, isPlaying, playbackT, selectedEntity } = store;

  // Compute displayed positions (interpolated during playback)
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

  // Show movement arrows (from current step to next)
  const nextPositions = !isPlaying && activeStep < steps.length - 1
    ? steps[activeStep + 1].positions
    : null;

  // Drag logic
  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const svgPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.max(0, Math.min(VW, svgP.x)), y: Math.max(0, Math.min(VH, svgP.y)) };
  }, []);

  const onEntityPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (isPlaying) return;
    e.stopPropagation();
    e.preventDefault();
    store.setSelectedEntity(id);
    dragging.current = { id, ox: 0, oy: 0 };
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
      const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      const x = Math.max(8, Math.min(VW - 8, svgP.x));
      const y = Math.max(8, Math.min(VH - 8, svgP.y));
      store.moveEntity(dragging.current.id, x, y);
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

  const allEntityIds = [...players.map(p => p.id), BALL_ID_CONST];

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: '100%', borderRadius: 8, touchAction: 'none', display: 'block', userSelect: 'none' }}
      onClick={() => store.setSelectedEntity(null)}
    >
      <FutsalCourt />

      {/* Movement arrows */}
      {nextPositions && players.map(p => {
        const from = currentPositions[p.id];
        const to = nextPositions[p.id];
        if (!from || !to) return null;
        const color = p.team === 'home' ? '#60a5fa' : '#f87171';
        return <MovementArrow key={p.id} from={from} to={to} color={color} />;
      })}
      {nextPositions && currentPositions[BALL_ID_CONST] && nextPositions[BALL_ID_CONST] && (
        <MovementArrow
          from={currentPositions[BALL_ID_CONST]}
          to={nextPositions[BALL_ID_CONST]}
          color="#FFD60A"
        />
      )}

      {/* Players */}
      {players.map(p => {
        const pos = currentPositions[p.id];
        if (!pos) return null;
        const isHome = p.team === 'home';
        const isSelected = selectedEntity === p.id;
        const fill = isHome
          ? (p.isGK ? '#1d4ed8' : '#3b82f6')
          : (p.isGK ? '#b91c1c' : '#ef4444');
        const stroke = isSelected ? '#FFD60A' : (isHome ? '#93c5fd' : '#fca5a5');

        return (
          <g
            key={p.id}
            transform={`translate(${pos.x},${pos.y})`}
            onMouseDown={e => onEntityPointerDown(e, p.id)}
            onTouchStart={e => onEntityPointerDown(e, p.id)}
            style={{ cursor: isPlaying ? 'default' : 'grab' }}
          >
            <circle r={10} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={8}
              fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>
              {p.number}
            </text>
            {p.isGK && (
              <text textAnchor="middle" dominantBaseline="auto" fontSize={5}
                fill="rgba(255,255,255,0.8)" y={-12} style={{ pointerEvents: 'none' }}>
                GK
              </text>
            )}
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
            <circle r={7} fill="#FFD60A" stroke={isSelected ? '#ffffff' : '#b45309'} strokeWidth={isSelected ? 2 : 1.5} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={6}
              style={{ pointerEvents: 'none' }}>
              ⚽
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
