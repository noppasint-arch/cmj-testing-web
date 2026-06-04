'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAthleteStore } from '@/store/athleteStore';
import NavBar from '@/components/NavBar';
import { differenceInYears } from 'date-fns';

export default function AthletesPage() {
  const { athletes, load } = useAthleteStore();
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, [load]);

  const filtered = athletes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.sport ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.team ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 70 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#5A5A7A', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 2 }}>CMJ TESTING</div>
          <div style={{ color: '#F0F0FF', fontSize: 24, fontWeight: 800 }}>Athletes</div>
        </div>
        <Link href="/athletes/new" style={{
          background: '#6C63FF', color: '#fff', borderRadius: 12,
          padding: '10px 18px', fontWeight: 700, fontSize: 14,
          textDecoration: 'none',
        }}>+ Add</Link>
      </div>

      {/* Search */}
      <div style={{ padding: '0 16px 12px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search athletes..."
          style={{
            width: '100%', background: '#1A1A26', border: '1px solid #2A2A3E',
            borderRadius: 12, padding: '10px 14px', color: '#F0F0FF', fontSize: 14,
            outline: 'none',
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#5A5A7A', marginTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No athletes yet</div>
            <div style={{ fontSize: 13 }}>Tap + Add to create your first athlete</div>
          </div>
        )}
        {filtered.map(a => {
          const age = a.dob ? differenceInYears(new Date(), new Date(a.dob)) : null;
          return (
            <Link key={a.id} href={`/athletes/${a.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#12121A', borderRadius: 16, border: '1px solid #2A2A3E',
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 24, background: '#1A1A26',
                  border: '2px solid #6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, color: '#6C63FF', flexShrink: 0, overflow: 'hidden',
                }}>
                  {a.profileImageUri
                    ? <img src={a.profileImageUri} style={{ width: 48, height: 48, objectFit: 'cover' }} alt="" />
                    : a.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                  {(a.sport || a.team) && (
                    <div style={{ color: '#9090B0', fontSize: 12, marginTop: 1 }}>
                      {[a.sport, a.team].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {(age != null || a.bodyWeight) && (
                    <div style={{ color: '#5A5A7A', fontSize: 11, marginTop: 1 }}>
                      {[age != null ? `Age ${age}` : null, a.bodyWeight ? `${a.bodyWeight} kg` : null].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <span style={{ color: '#5A5A7A', fontSize: 18 }}>›</span>
              </div>
            </Link>
          );
        })}
      </div>

      <NavBar />
    </div>
  );
}
