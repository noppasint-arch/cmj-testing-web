'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useAthleteStore } from '@/store/athleteStore';
import { useTestStore } from '@/store/testStore';
import { computeMetrics } from '@/lib/calculations';
import MetricCard from '@/components/MetricCard';
import { format } from 'date-fns';

function ResultsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const testId = params.get('testId') ?? '';
  const athleteId = params.get('athleteId') ?? '';

  const { athletes, load: loadAthletes } = useAthleteStore();
  const { tests, load: loadTests } = useTestStore();
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      await Promise.all([loadAthletes(), loadTests()]);
      setLoading(false);
    })();
  }, []);

  const athlete = athletes.find(a => a.id === athleteId);
  const test = tests.find(t => t.id === testId);

  if (loading) return <div style={{ color: '#5A5A7A', padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (!test) return <div style={{ color: '#5A5A7A', padding: 40, textAlign: 'center' }}>Test not found</div>;

  const metrics = computeMetrics(test.takeoffFrame, test.landingFrame, test.videoFPS, test.movementStartFrame);

  const shareText = () => {
    const text = [
      `CMJ Test — ${athlete?.name ?? 'Athlete'}`,
      `Date: ${format(new Date(test.createdAt), 'dd MMM yyyy HH:mm')}`,
      `Jump Height: ${metrics.jumpHeight_cm.toFixed(1)} cm`,
      `Flight Time: ${metrics.flightTime_ms.toFixed(0)} ms`,
      metrics.RSImod != null ? `RSImod: ${metrics.RSImod.toFixed(3)}` : null,
      test.notes ? `Notes: ${test.notes}` : null,
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      navigator.share({ title: 'CMJ Test Result', text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Result copied to clipboard!');
    }
  };

  const downloadCard = async () => {
    // Share as text instead (no extra dependency needed)
    shareText();
  };

  // Performance rating
  const rating = metrics.jumpHeight_cm >= 60 ? { label: 'Elite', color: '#FFD60A' }
    : metrics.jumpHeight_cm >= 45 ? { label: 'Advanced', color: '#4CAF50' }
    : metrics.jumpHeight_cm >= 30 ? { label: 'Intermediate', color: '#00D4FF' }
    : { label: 'Beginner', color: '#9090B0' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A3E',
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push(`/athletes/${athleteId}`)} style={{
          background: 'none', border: 'none', color: '#6C63FF', fontSize: 16, cursor: 'pointer',
        }}>‹ Back</button>
        <span style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 17 }}>Test Result</span>
      </div>

      {/* Card (for screenshot) */}
      <div ref={cardRef} style={{ margin: '20px 16px 0', background: '#12121A',
        borderRadius: 20, border: '1px solid #2A2A3E', overflow: 'hidden' }}>

        {/* Card header */}
        <div style={{ padding: '20px', background: '#1A1A26', borderBottom: '1px solid #2A2A3E' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#5A5A7A', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>CMJ TESTING</div>
              <div style={{ color: '#F0F0FF', fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                {athlete?.name ?? 'Athlete'}
              </div>
              <div style={{ color: '#9090B0', fontSize: 12, marginTop: 2 }}>
                {format(new Date(test.createdAt), 'dd MMM yyyy · HH:mm')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: rating.color, fontSize: 12, fontWeight: 700 }}>{rating.label}</div>
              <div style={{ color: rating.color, fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
                {metrics.jumpHeight_cm.toFixed(1)}
              </div>
              <div style={{ color: '#9090B0', fontSize: 12 }}>cm</div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ padding: '0 16px 16px' }}>
          <MetricCard metrics={metrics} fps={test.videoFPS} bodyWeight={athlete?.bodyWeight} />
        </div>

        {test.notes && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ background: '#1A1A26', borderRadius: 10, padding: '10px 12px',
              color: '#9090B0', fontSize: 13, borderLeft: '3px solid #6C63FF' }}>
              {test.notes}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={shareText} style={{
          background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 14,
          padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}>
          🔗 Share Result
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push(`/test/${athleteId}`)} style={{
            flex: 1, background: '#1A1A26', border: '1px solid #2A2A3E', color: '#F0F0FF',
            borderRadius: 14, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>⚡ Test Again</button>
          <button onClick={() => router.push(`/athletes/${athleteId}`)} style={{
            flex: 1, background: '#1A1A26', border: '1px solid #2A2A3E', color: '#F0F0FF',
            borderRadius: 14, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>👤 Profile</button>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{ color: '#5A5A7A', padding: 40, textAlign: 'center' }}>Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
