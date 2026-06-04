'use client';
import { CMJMetrics } from '@/lib/calculations';

interface Props {
  metrics: CMJMetrics;
  fps: number;
  bodyWeight?: number;
}

function Row({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '10px 0', borderBottom: '1px solid #2A2A3E' }}>
      <span style={{ color: '#9090B0', fontSize: 13 }}>{label}</span>
      <span>
        <span style={{ color: color ?? '#F0F0FF', fontSize: 22, fontWeight: 800 }}>{value}</span>
        <span style={{ color: '#5A5A7A', fontSize: 12, marginLeft: 4 }}>{unit}</span>
      </span>
    </div>
  );
}

export default function MetricCard({ metrics, fps, bodyWeight }: Props) {
  return (
    <div style={{ background: '#12121A', borderRadius: 16, border: '1px solid #2A2A3E', padding: 16 }}>
      <Row label="Jump Height" value={metrics.jumpHeight_cm.toFixed(1)} unit="cm" color="#FFD60A" />
      <Row label="Flight Time" value={metrics.flightTime_ms.toFixed(0)} unit="ms" color="#00D4FF" />
      {metrics.RSImod != null && (
        <Row label="RSImod" value={metrics.RSImod.toFixed(3)} unit="" color="#FF6B6B" />
      )}
      {metrics.timeToTakeoff_s != null && (
        <Row label="Time to Takeoff" value={(metrics.timeToTakeoff_s * 1000).toFixed(0)} unit="ms" />
      )}
      <Row label="FPS" value={fps.toString()} unit="fps" />
      {bodyWeight && (
        <Row label="Body Weight" value={bodyWeight.toString()} unit="kg" />
      )}
      {bodyWeight && (
        <Row
          label="Relative Height"
          value={(metrics.jumpHeight_cm / bodyWeight * 10).toFixed(2)}
          unit="cm/kg×10"
        />
      )}
    </div>
  );
}
