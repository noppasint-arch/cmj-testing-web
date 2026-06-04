'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAthleteStore } from '@/store/athleteStore';
import { useTestStore } from '@/store/testStore';
import { Athlete } from '@/lib/db';
import MetricCard from '@/components/MetricCard';
import TrendChart from '@/components/TrendChart';
import { computeMetrics } from '@/lib/calculations';
import { format, differenceInYears } from 'date-fns';

type TrendMetric = 'jumpHeight_cm' | 'RSImod' | 'flightTime_ms';
const TABS: { key: TrendMetric; label: string }[] = [
  { key: 'jumpHeight_cm', label: 'Height' },
  { key: 'RSImod', label: 'RSImod' },
  { key: 'flightTime_ms', label: 'Flight' },
];

export default function AthleteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { athletes, load: loadAthletes, upsert, remove } = useAthleteStore();
  const { load: loadTests, getAthleteTests } = useTestStore();
  const [loading, setLoading] = useState(true);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('jumpHeight_cm');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', sport: '', team: '', dob: '', bodyWeight: '' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadAthletes(), loadTests()]);
      setLoading(false);
    })();
  }, []);

  const athlete = athletes.find(a => a.id === id);
  const tests = getAthleteTests(id);

  useEffect(() => {
    if (athlete) setForm({
      name: athlete.name,
      sport: athlete.sport ?? '',
      team: athlete.team ?? '',
      dob: athlete.dob ?? '',
      bodyWeight: athlete.bodyWeight?.toString() ?? '',
    });
  }, [athlete]);

  if (loading) return <div style={{ color: '#5A5A7A', padding: 32, textAlign: 'center' }}>Loading...</div>;
  if (!athlete) return <div style={{ color: '#5A5A7A', padding: 32, textAlign: 'center' }}>Athlete not found</div>;

  const age = athlete.dob ? differenceInYears(new Date(), new Date(athlete.dob)) : null;
  const best = tests.length > 0 ? tests.reduce((a, b) => a.jumpHeight_cm > b.jumpHeight_cm ? a : b) : null;
  const bestRSI = tests.filter(t => t.RSImod != null).reduce<typeof tests[0] | null>((a, b) =>
    a == null ? b : (a.RSImod ?? 0) >= (b.RSImod ?? 0) ? a : b, null);

  const saveEdit = async () => {
    if (!form.name.trim()) return;
    const updated: Athlete = {
      ...athlete,
      name: form.name.trim(),
      sport: form.sport.trim() || undefined,
      team: form.team.trim() || undefined,
      dob: form.dob || undefined,
      bodyWeight: form.bodyWeight ? parseFloat(form.bodyWeight) : undefined,
    };
    await upsert(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${athlete.name}? All tests will be lost.`)) return;
    await remove(id);
    router.push('/');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
      {/* Back */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A3E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 16, cursor: 'pointer' }}>
          ‹ Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditing(!editing)} style={{
            background: '#1A1A26', border: '1px solid #2A2A3E', color: '#F0F0FF',
            borderRadius: 10, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
          }}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button onClick={handleDelete} style={{
            background: 'none', border: '1px solid #FF5252', color: '#FF5252',
            borderRadius: 10, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
          }}>Delete</button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ padding: 16, background: '#12121A', borderBottom: '1px solid #2A2A3E', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { k: 'name', label: 'Name *', type: 'text' },
            { k: 'sport', label: 'Sport', type: 'text' },
            { k: 'team', label: 'Team', type: 'text' },
            { k: 'dob', label: 'Date of Birth', type: 'date' },
            { k: 'bodyWeight', label: 'Body Weight (kg)', type: 'number' },
          ].map(({ k, label, type }) => (
            <div key={k}>
              <div style={{ color: '#9090B0', fontSize: 11, marginBottom: 4 }}>{label}</div>
              <input type={type} value={form[k as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                style={{ width: '100%', background: '#1A1A26', border: '1px solid #2A2A3E', borderRadius: 10, padding: '8px 12px', color: '#F0F0FF', fontSize: 14, outline: 'none' }} />
            </div>
          ))}
          <button onClick={saveEdit} style={{
            background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 12,
            padding: '12px', fontWeight: 700, cursor: 'pointer',
          }}>Save Changes</button>
        </div>
      )}

      {/* Profile header */}
      <div style={{ padding: '24px 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 40, background: '#1A1A26',
          border: '2px solid #6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700, color: '#6C63FF', marginBottom: 12, overflow: 'hidden',
        }}>
          {athlete.profileImageUri
            ? <img src={athlete.profileImageUri} style={{ width: 80, height: 80, objectFit: 'cover' }} alt="" />
            : athlete.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ color: '#F0F0FF', fontSize: 22, fontWeight: 800 }}>{athlete.name}</div>
        {(athlete.sport || athlete.team) && (
          <div style={{ color: '#9090B0', fontSize: 13, marginTop: 4 }}>
            {[athlete.sport, athlete.team].filter(Boolean).join(' · ')}
          </div>
        )}
        {(age != null || athlete.bodyWeight) && (
          <div style={{ color: '#5A5A7A', fontSize: 12, marginTop: 2 }}>
            {[age != null ? `Age ${age}` : null, athlete.bodyWeight ? `${athlete.bodyWeight} kg` : null].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* New Test button */}
      <div style={{ padding: '0 16px 16px' }}>
        <Link href={`/test/${id}`} style={{
          display: 'block', textAlign: 'center', background: '#6C63FF', color: '#fff',
          borderRadius: 14, padding: '14px', fontWeight: 700, fontSize: 16, textDecoration: 'none',
        }}>
          ⚡ New Test
        </Link>
      </div>

      {/* Personal bests */}
      {tests.length > 0 && (
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: 10 }}>
          {best && (
            <PBBox label="BEST JUMP" value={best.jumpHeight_cm.toFixed(1)} unit="cm" color="#FFD60A"
              date={format(new Date(best.createdAt), 'dd MMM yy')} />
          )}
          {bestRSI && (
            <PBBox label="BEST RSI" value={(bestRSI.RSImod ?? 0).toFixed(2)} unit="RSImod" color="#FF6B6B"
              date={format(new Date(bestRSI.createdAt), 'dd MMM yy')} />
          )}
          <PBBox label="TESTS" value={tests.length.toString()} unit="total" color="#6C63FF" date="all time" />
        </div>
      )}

      {/* Trend chart */}
      {tests.length >= 2 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Performance Trend</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setTrendMetric(key)} style={{
                background: trendMetric === key ? '#6C63FF' : '#1A1A26',
                border: `1px solid ${trendMetric === key ? '#6C63FF' : '#2A2A3E'}`,
                color: trendMetric === key ? '#fff' : '#9090B0',
                borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{label}</button>
            ))}
          </div>
          <TrendChart tests={tests} metric={trendMetric} />
        </div>
      )}

      {/* Test history */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Test History</div>
        {tests.length === 0 ? (
          <div style={{ color: '#5A5A7A', fontSize: 14 }}>No tests yet — tap ⚡ New Test to start</div>
        ) : tests.map((test, idx) => {
          const metrics = computeMetrics(test.takeoffFrame, test.landingFrame, test.videoFPS, test.movementStartFrame);
          const isOpen = expandedId === test.id;
          return (
            <div key={test.id} style={{
              background: '#12121A', borderRadius: 14, border: '1px solid #2A2A3E',
              marginBottom: 10, overflow: 'hidden',
            }}>
              <button onClick={() => setExpandedId(isOpen ? null : test.id)} style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 15, background: '#1A1A26',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#5A5A7A', fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>#{tests.length - idx}</div>

                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ color: '#F0F0FF', fontSize: 13, fontWeight: 600 }}>
                    {format(new Date(test.createdAt), 'dd MMM yyyy · HH:mm')}
                  </div>
                  {test.notes && <div style={{ color: '#5A5A7A', fontSize: 11, marginTop: 1 }}>{test.notes}</div>}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#FFD60A', fontSize: 16, fontWeight: 800 }}>{metrics.jumpHeight_cm.toFixed(1)} cm</div>
                  <div style={{ color: '#00D4FF', fontSize: 11 }}>{metrics.flightTime_ms.toFixed(0)} ms</div>
                </div>
                <span style={{ color: '#5A5A7A', transform: isOpen ? 'rotate(90deg)' : 'none', transition: '0.2s', fontSize: 16 }}>›</span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 14px 14px' }}>
                  <MetricCard metrics={metrics} fps={test.videoFPS} bodyWeight={athlete.bodyWeight} />
                  {test.videoUrl && (
                    <a href={test.videoUrl} download style={{
                      display: 'block', marginTop: 10, textAlign: 'center',
                      background: '#1A1A26', border: '1px solid #2A2A3E',
                      color: '#9090B0', borderRadius: 10, padding: '8px', fontSize: 13,
                      textDecoration: 'none',
                    }}>📥 Download Video</a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PBBox({ label, value, unit, color, date }: { label: string; value: string; unit: string; color: string; date: string }) {
  return (
    <div style={{
      flex: 1, background: '#12121A', borderRadius: 14, border: '1px solid #2A2A3E',
      padding: '10px 8px', textAlign: 'center',
    }}>
      <div style={{ color: '#5A5A7A', fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>{label}</div>
      <div style={{ color, fontSize: 24, fontWeight: 900, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
      <div style={{ color: '#9090B0', fontSize: 10 }}>{unit}</div>
      <div style={{ color: '#5A5A7A', fontSize: 9, marginTop: 2 }}>{date}</div>
    </div>
  );
}
