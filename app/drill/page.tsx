'use client';
import dynamic from 'next/dynamic';
import NavBar from '@/components/NavBar';
import DrillTimeline from '@/components/DrillTimeline';
import { useDrillStore } from '@/store/drillStore';

// Canvas uses SVG + mouse events, safe to SSR=false to avoid hydration mismatch
const DrillCanvas = dynamic(() => import('@/components/DrillCanvas'), { ssr: false });

const card: React.CSSProperties = {
  background: '#12121A',
  border: '1px solid #2A2A3E',
  borderRadius: 12,
  padding: 14,
};

export default function DrillPage() {
  const store = useDrillStore();
  const { players, selectedEntity } = store;

  const selectedPlayer = players.find(p => p.id === selectedEntity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#F0F0FF' }}>Drill Animator</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#5A5A7A' }}>วางแผนดริลฟุตซอล · Keyframe Animation</p>
        </div>
        <button
          onClick={() => store.reset()}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2A2A3E', background: 'transparent', color: '#5A5A7A', fontSize: 12, cursor: 'pointer' }}
        >
          Reset
        </button>
      </div>

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Canvas */}
        <div style={card}>
          <DrillCanvas />
        </div>

        {/* Timeline / controls */}
        <div style={card}>
          <DrillTimeline />
        </div>

        {/* Selected entity info */}
        {selectedEntity && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedPlayer ? (
              <>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: selectedPlayer.team === 'home' ? '#3b82f6' : '#ef4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, color: '#fff',
                }}>
                  {selectedPlayer.number}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F0FF' }}>
                    {selectedPlayer.team === 'home' ? 'Home' : 'Away'} #{selectedPlayer.number}
                    {selectedPlayer.isGK && ' (GK)'}
                  </div>
                  <div style={{ fontSize: 11, color: '#5A5A7A' }}>ลากบนสนามเพื่อเคลื่อน</div>
                </div>
                <button
                  onClick={() => { store.removePlayer(selectedEntity); store.setSelectedEntity(null); }}
                  style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 6, border: 'none', background: '#7f1d1d', color: '#fca5a5', fontSize: 11, cursor: 'pointer' }}
                >
                  ลบ
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 20 }}>⚽</span>
                <div style={{ fontSize: 13, color: '#F0F0FF' }}>Ball · ลากเพื่อเคลื่อน</div>
              </>
            )}
          </div>
        )}

        {/* Add player buttons */}
        <div style={card}>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9090B0', fontWeight: 600 }}>เพิ่มผู้เล่น</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => store.addPlayer('home')}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#93c5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Home
            </button>
            <button
              onClick={() => store.addPlayer('away')}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#450a0a', color: '#fca5a5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Away
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ ...card, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <LegendItem color="#3b82f6" label="Home" />
          <LegendItem color="#1d4ed8" label="Home GK" />
          <LegendItem color="#ef4444" label="Away" />
          <LegendItem color="#b91c1c" label="Away GK" />
          <LegendItem color="#FFD60A" label="Ball" />
        </div>
      </div>

      <NavBar />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 11, color: '#9090B0' }}>{label}</span>
    </div>
  );
}
