'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTestStore } from '@/store/testStore';
import { useAthleteStore } from '@/store/athleteStore';
import { computeMetrics } from '@/lib/calculations';
import { format } from 'date-fns';

function CompareContent() {
  const params = useSearchParams();
  const router = useRouter();
  const idA = params.get('a') ?? '';
  const idB = params.get('b') ?? '';
  const { tests, load: loadTests } = useTestStore();
  const { athletes, load: loadAthletes } = useAthleteStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { await Promise.all([loadTests(), loadAthletes()]); setLoading(false); })();
  }, []);

  const testA = tests.find(t => t.id === idA);
  const testB = tests.find(t => t.id === idB);
  const getName = (id: string) => athletes.find(a => a.id === id)?.name ?? 'Unknown';

  if (loading) return <div style={{ color: '#5A5A7A', padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (!testA || !testB) return <div style={{ color: '#5A5A7A', padding: 40, textAlign: 'center' }}>Tests not found</div>;

  const mA = computeMetrics(testA.takeoffFrame, testA.landingFrame, testA.videoFPS, testA.movementStartFrame);
  const mB = computeMetrics(testB.takeoffFrame, testB.landingFrame, testB.videoFPS, testB.movementStartFrame);

  const metrics: { label: string; a: number; b: number; unit: string; higherIsBetter: boolean }[] = [
    { label: 'Jump Height', a: mA.jumpHeight_cm, b: mB.jumpHeight_cm, unit: 'cm', higherIsBetter: true },
    { label: 'Flight Time', a: mA.flightTime_ms, b: mB.flightTime_ms, unit: 'ms', higherIsBetter: true },
    ...(mA.RSImod != null && mB.RSImod != null
      ? [{ label: 'RSImod', a: mA.RSImod, b: mB.RSImod, unit: '', higherIsBetter: true }] : []),
    ...(mA.timeToTakeoff_s != null && mB.timeToTakeoff_s != null
      ? [{ label: 'Time to Takeoff', a: mA.timeToTakeoff_s * 1000, b: mB.timeToTakeoff_s * 1000, unit: 'ms', higherIsBetter: false }] : []),
  ];

  const aWins = metrics.filter(m => m.higherIsBetter ? m.a > m.b : m.a < m.b).length;
  const bWins = metrics.filter(m => m.higherIsBetter ? m.b > m.a : m.b < m.a).length;
  const winner: 'A' | 'B' | 'TIE' = aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'TIE';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A3E', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 16, cursor: 'pointer' }}>
          ‹ Back
        </button>
        <span style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 17 }}>Comparison</span>
      </div>

      {/* Athletes header */}
      <div style={{ display: 'flex', padding: '16px', gap: 10 }}>
        {[{ test: testA, label: 'A', wins: aWins }, { test: testB, label: 'B', wins: bWins }].map(({ test, label, wins }) => {
          const isWinner = (label === 'A' && winner === 'A') || (label === 'B' && winner === 'B');
          return (
            <div key={label} style={{ flex: 1, background: '#12121A', borderRadius: 14,
              border: `1px solid ${isWinner ? '#FFD60A' : '#2A2A3E'}`, padding: '12px', textAlign: 'center' }}>
              {isWinner && (winner === 'A' || winner === 'B') && (
                <div style={{ color: '#FFD60A', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>🏆 WINNER</div>
              )}
              <div style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 14 }}>{getName(test.athleteId)}</div>
              <div style={{ color: '#5A5A7A', fontSize: 11, marginTop: 2 }}>
                {format(new Date(test.createdAt), 'dd MMM yy')}
              </div>
              <div style={{ color: '#6C63FF', fontSize: 12, marginTop: 4 }}>{wins} win{wins !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      {/* Metric rows */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {metrics.map(m => {
          const aWins = m.higherIsBetter ? m.a >= m.b : m.a <= m.b;
          const maxVal = Math.max(m.a, m.b);
          const fmt = (v: number) => m.unit === '' ? v.toFixed(3) : m.label === 'RSImod' ? v.toFixed(3) : Math.round(v).toString();
          return (
            <div key={m.label} style={{ background: '#12121A', borderRadius: 14, border: '1px solid #2A2A3E', padding: 14 }}>
              <div style={{ color: '#9090B0', fontSize: 12, fontWeight: 600, marginBottom: 10, textAlign: 'center' }}>{m.label}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {/* A bar */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: aWins ? '#FFD60A' : '#5A5A7A', fontSize: 16, fontWeight: 800, textAlign: 'right', marginBottom: 4 }}>
                    {fmt(m.a)} <span style={{ fontSize: 11 }}>{m.unit}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: '#1A1A26', overflow: 'hidden', direction: 'rtl' }}>
                    <div style={{ height: '100%', width: `${(m.a / maxVal) * 100}%`, background: aWins ? '#FFD60A' : '#2A2A3E', borderRadius: 4 }} />
                  </div>
                </div>

                <div style={{ width: 20, textAlign: 'center', color: '#5A5A7A', fontSize: 12 }}>vs</div>

                {/* B bar */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: !aWins ? '#FFD60A' : '#5A5A7A', fontSize: 16, fontWeight: 800, textAlign: 'left', marginBottom: 4 }}>
                    {fmt(m.b)} <span style={{ fontSize: 11 }}>{m.unit}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: '#1A1A26', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(m.b / maxVal) * 100}%`, background: !aWins ? '#FFD60A' : '#2A2A3E', borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div style={{ color: '#5A5A7A', padding: 40, textAlign: 'center' }}>Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
