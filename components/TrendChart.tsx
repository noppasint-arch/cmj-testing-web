'use client';
import { CMJTest } from '@/lib/db';
import { format } from 'date-fns';

type Metric = 'jumpHeight_cm' | 'RSImod' | 'flightTime_ms';

const COLORS: Record<Metric, string> = {
  jumpHeight_cm: '#FFD60A',
  RSImod: '#FF6B6B',
  flightTime_ms: '#00D4FF',
};

export default function TrendChart({ tests, metric, height = 140 }: { tests: CMJTest[]; metric: Metric; height?: number }) {
  const sorted = [...tests].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const values = sorted.map(t => (t[metric] ?? 0) as number);
  if (values.length < 2) return null;

  const W = 320, H = height, PAD = { top: 16, bottom: 24, left: 40, right: 16 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const px = (i: number) => PAD.left + (i / (values.length - 1)) * innerW;
  const py = (v: number) => PAD.top + (1 - (v - minV) / range) * innerH;

  const points = values.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  const color = COLORS[metric];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      {/* Y gridlines */}
      {[0, 0.5, 1].map(t => {
        const y = PAD.top + (1 - t) * innerH;
        const v = minV + t * range;
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#2A2A3E" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 4} fill="#5A5A7A" fontSize={9} textAnchor="end">
              {metric === 'RSImod' ? v.toFixed(2) : Math.round(v)}
            </text>
          </g>
        );
      })}

      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />

      {/* Dots */}
      {values.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={4} fill={color} />
      ))}

      {/* Last value label */}
      <text x={px(values.length - 1)} y={py(values[values.length - 1]) - 8}
        fill={color} fontSize={10} textAnchor="middle" fontWeight="bold">
        {metric === 'RSImod' ? values[values.length - 1].toFixed(2) : Math.round(values[values.length - 1])}
      </text>

      {/* Date labels */}
      <text x={px(0)} y={H - 4} fill="#5A5A7A" fontSize={9} textAnchor="start">
        {format(new Date(sorted[0].createdAt), 'dd MMM')}
      </text>
      <text x={px(values.length - 1)} y={H - 4} fill="#5A5A7A" fontSize={9} textAnchor="end">
        {format(new Date(sorted[sorted.length - 1].createdAt), 'dd MMM')}
      </text>
    </svg>
  );
}
