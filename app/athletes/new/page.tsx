'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAthleteStore } from '@/store/athleteStore';
import { Athlete } from '@/lib/db';

export default function NewAthletePage() {
  const router = useRouter();
  const { upsert } = useAthleteStore();
  const [form, setForm] = useState({
    name: '', sport: '', team: '', dob: '', bodyWeight: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return alert('Name is required');
    setSaving(true);
    const athlete: Athlete = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      sport: form.sport.trim() || undefined,
      team: form.team.trim() || undefined,
      dob: form.dob || undefined,
      bodyWeight: form.bodyWeight ? parseFloat(form.bodyWeight) : undefined,
      createdAt: new Date().toISOString(),
    };
    await upsert(athlete);
    router.push(`/athletes/${athlete.id}`);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid #2A2A3E' }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', color: '#6C63FF', fontSize: 16, cursor: 'pointer', padding: 0,
        }}>‹ Back</button>
        <span style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 18 }}>New Athlete</span>
      </div>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name *" value={form.name} onChange={v => set('name', v)} placeholder="Athlete name" />
        <Field label="Sport" value={form.sport} onChange={v => set('sport', v)} placeholder="e.g. Basketball" />
        <Field label="Team" value={form.team} onChange={v => set('team', v)} placeholder="e.g. Team A" />
        <Field label="Date of Birth" value={form.dob} onChange={v => set('dob', v)} type="date" />
        <Field label="Body Weight (kg)" value={form.bodyWeight} onChange={v => set('bodyWeight', v)} type="number" placeholder="e.g. 70" />
      </div>

      <div style={{ padding: 16 }}>
        <button onClick={save} disabled={saving} style={{
          width: '100%', background: '#6C63FF', color: '#fff', border: 'none',
          borderRadius: 14, padding: '16px', fontWeight: 700, fontSize: 16, cursor: 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving...' : 'Save Athlete'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <div style={{ color: '#9090B0', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: '#1A1A26', border: '1px solid #2A2A3E',
          borderRadius: 12, padding: '12px 14px', color: '#F0F0FF', fontSize: 15,
          outline: 'none',
        }}
      />
    </div>
  );
}
