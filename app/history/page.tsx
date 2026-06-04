'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTestStore } from '@/store/testStore';
import { useAthleteStore } from '@/store/athleteStore';
import NavBar from '@/components/NavBar';
import { computeMetrics } from '@/lib/calculations';
import { format } from 'date-fns';

export default function HistoryPage() {
  const router = useRouter();
  const { tests, load: loadTests, remove } = useTestStore();
  const { athletes, load: loadAthletes } = useAthleteStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    (async () => {
      await Promise.all([loadTests(), loadAthletes()]);
      setLoading(false);
    })();
  }, []);

  const getName = (athleteId: string) =>
    athletes.find(a => a.id === athleteId)?.name ?? 'Unknown';

  const filtered = tests.filter(t =>
    getName(t.athleteId).toLowerCase().includes(search.toLowerCase()) ||
    (t.notes ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleCompare = (id: string) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const exportCSV = () => {
    const header = 'Athlete,Date,Jump Height (cm),Flight Time (ms),RSImod,Time to Takeoff (ms),FPS,Notes';
    const rows = tests.map(t => {
      const m = computeMetrics(t.takeoffFrame, t.landingFrame, t.videoFPS, t.movementStartFrame);
      return [
        getName(t.athleteId),
        format(new Date(t.createdAt), 'dd/MM/yyyy HH:mm'),
        m.jumpHeight_cm.toFixed(2),
        m.flightTime_ms.toFixed(0),
        m.RSImod?.toFixed(3) ?? '',
        m.timeToTakeoff_s != null ? (m.timeToTakeoff_s * 1000).toFixed(0) : '',
        t.videoFPS,
        t.notes ?? '',
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cmj-export-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 70 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#5A5A7A', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 2 }}>CMJ TESTING</div>
          <div style={{ color: '#F0F0FF', fontSize: 24, fontWeight: 800 }}>History</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setCompareMode(v => !v); setCompareIds([]); }} style={{
            background: compareMode ? '#6C63FF' : '#1A1A26', border: '1px solid #2A2A3E',
            color: '#F0F0FF', borderRadius: 10, padding: '8px 12px', fontSize: 12, cursor: 'pointer',
          }}>⚖ Compare</button>
          <button onClick={exportCSV} style={{
            background: '#1A1A26', border: '1px solid #2A2A3E', color: '#F0F0FF',
            borderRadius: 10, padding: '8px 12px', fontSize: 12, cursor: 'pointer',
          }}>📥 CSV</button>
        </div>
      </div>

      {/* Compare banner */}
      {compareMode && (
        <div style={{ margin: '0 16px 10px', background: '#1A1A26', border: '1px solid #6C63FF',
          borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#9090B0', fontSize: 13 }}>
            {compareIds.length === 0 ? 'Select 2 tests to compare'
              : compareIds.length === 1 ? 'Select 1 more test'
              : '2 tests selected'}
          </span>
          {compareIds.length === 2 && (
            <button onClick={() => router.push(`/compare?a=${compareIds[0]}&b=${compareIds[1]}`)} style={{
              background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 8,
              padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>Compare →</button>
          )}
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '0 16px 10px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by athlete or notes..."
          style={{ width: '100%', background: '#1A1A26', border: '1px solid #2A2A3E',
            borderRadius: 12, padding: '10px 14px', color: '#F0F0FF', fontSize: 14, outline: 'none' }} />
      </div>

      {/* Stats bar */}
      {tests.length > 0 && (
        <div style={{ margin: '0 16px 12px', display: 'flex', gap: 8 }}>
          {[
            { label: 'Tests', value: tests.length.toString() },
            { label: 'Best Jump', value: `${Math.max(...tests.map(t => t.jumpHeight_cm)).toFixed(1)} cm` },
            { label: 'Athletes', value: new Set(tests.map(t => t.athleteId)).size.toString() },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: '#12121A', border: '1px solid #2A2A3E',
              borderRadius: 12, padding: '8px', textAlign: 'center' }}>
              <div style={{ color: '#6C63FF', fontSize: 16, fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: '#5A5A7A', fontSize: 10, marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div style={{ color: '#5A5A7A', textAlign: 'center', marginTop: 40 }}>Loading...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ color: '#5A5A7A', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
            No tests yet
          </div>
        )}
        {filtered.map(test => {
          const metrics = computeMetrics(test.takeoffFrame, test.landingFrame, test.videoFPS, test.movementStartFrame);
          const isSelected = compareIds.includes(test.id);
          return (
            <div key={test.id} onClick={() => compareMode ? toggleCompare(test.id) : router.push(`/results?testId=${test.id}&athleteId=${test.athleteId}`)}
              style={{
                background: '#12121A', borderRadius: 14,
                border: `1px solid ${isSelected ? '#6C63FF' : '#2A2A3E'}`,
                padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
              }}>
              {compareMode && (
                <div style={{
                  width: 20, height: 20, borderRadius: 10, border: `2px solid ${isSelected ? '#6C63FF' : '#2A2A3E'}`,
                  background: isSelected ? '#6C63FF' : 'transparent', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 14 }}>{getName(test.athleteId)}</div>
                <div style={{ color: '#5A5A7A', fontSize: 11, marginTop: 1 }}>
                  {format(new Date(test.createdAt), 'dd MMM yyyy · HH:mm')}
                </div>
                {test.notes && <div style={{ color: '#5A5A7A', fontSize: 11 }}>{test.notes}</div>}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#FFD60A', fontSize: 18, fontWeight: 800 }}>{metrics.jumpHeight_cm.toFixed(1)} cm</div>
                <div style={{ color: '#00D4FF', fontSize: 11 }}>{metrics.flightTime_ms.toFixed(0)} ms</div>
                {metrics.RSImod != null && <div style={{ color: '#FF6B6B', fontSize: 11 }}>RSI {metrics.RSImod.toFixed(2)}</div>}
              </div>

              {!compareMode && (
                <button onClick={e => { e.stopPropagation(); if (confirm('Delete this test?')) remove(test.id); }}
                  style={{ background: 'none', border: 'none', color: '#5A5A7A', fontSize: 16, cursor: 'pointer', padding: '4px' }}>
                  🗑
                </button>
              )}
            </div>
          );
        })}
      </div>

      <NavBar />
    </div>
  );
}
