'use client';
import { useEffect, useRef } from 'react';
import { useDrillStore } from '@/store/drillStore';

const btn = (active = false, danger = false): React.CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 8,
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  background: danger ? '#7f1d1d' : active ? '#6C63FF' : '#1A1A26',
  color: danger ? '#fca5a5' : active ? '#fff' : '#9090B0',
  transition: 'background 0.15s',
});

export default function DrillTimeline() {
  const store = useDrillStore();
  const { steps, activeStep, isPlaying, playbackT } = store;
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const stepRef = useRef(activeStep);
  stepRef.current = activeStep;

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startTimeRef.current = null;
      return;
    }

    const animate = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const curStep = stepRef.current;
      const nextStep = curStep + 1;
      if (nextStep >= steps.length) {
        store.setPlaying(false);
        store.setActiveStep(steps.length - 1);
        return;
      }
      const duration = steps[nextStep].duration;
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / duration, 1);
      store.setPlaybackT(t);

      if (t >= 1) {
        store.setActiveStep(nextStep);
        startTimeRef.current = null;
        // If there's a next step after this one, continue
        if (nextStep + 1 < steps.length) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          store.setPlaying(false);
        }
        return;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const canPlay = steps.length > 1 && activeStep < steps.length - 1;
  const canPlayAll = steps.length > 1;

  const playFromStart = () => {
    store.setActiveStep(0);
    setTimeout(() => store.setPlaying(true), 50);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Step scrubber */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', paddingBottom: 4 }}>
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => store.setActiveStep(i)}
            style={{
              minWidth: 36, height: 36, borderRadius: 8, border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              background: i === activeStep ? '#6C63FF' : '#1A1A26',
              color: i === activeStep ? '#fff' : '#9090B0',
              outline: i === activeStep ? '2px solid #6C63FF44' : 'none',
            }}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => store.addStep()}
          style={{ minWidth: 36, height: 36, borderRadius: 8, border: '1.5px dashed #2A2A3E', background: 'transparent', color: '#5A5A7A', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}
        >
          +
        </button>
      </div>

      {/* Progress bar during playback */}
      {isPlaying && (
        <div style={{ height: 3, background: '#1A1A26', borderRadius: 2 }}>
          <div style={{ height: '100%', background: '#6C63FF', borderRadius: 2, width: `${playbackT * 100}%`, transition: 'width 0.05s linear' }} />
        </div>
      )}

      {/* Playback controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isPlaying ? (
          <button style={btn(true)} onClick={() => store.setPlaying(false)}>
            ⏸ Pause
          </button>
        ) : (
          <>
            <button
              style={btn(false)}
              disabled={!canPlay}
              onClick={() => store.setPlaying(true)}
            >
              ▶ Play Step
            </button>
            <button
              style={btn(false)}
              disabled={!canPlayAll}
              onClick={playFromStart}
            >
              ⏮ Play All
            </button>
          </>
        )}
        {!isPlaying && (
          <>
            <button
              style={btn(false)}
              disabled={activeStep === 0}
              onClick={() => store.setActiveStep(activeStep - 1)}
            >
              ◀
            </button>
            <button
              style={btn(false)}
              disabled={activeStep >= steps.length - 1}
              onClick={() => store.setActiveStep(activeStep + 1)}
            >
              ▶
            </button>
            {steps.length > 1 && (
              <button
                style={{ ...btn(false, true), marginLeft: 'auto' }}
                onClick={() => store.removeStep(activeStep)}
              >
                Del Step
              </button>
            )}
          </>
        )}
      </div>

      {/* Step duration */}
      {!isPlaying && activeStep > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#5A5A7A', whiteSpace: 'nowrap' }}>Tween</span>
          <input
            type="range"
            min={300}
            max={4000}
            step={100}
            value={steps[activeStep].duration}
            onChange={e => store.setStepDuration(activeStep, Number(e.target.value))}
          />
          <span style={{ fontSize: 11, color: '#9090B0', whiteSpace: 'nowrap' }}>
            {(steps[activeStep].duration / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      <p style={{ fontSize: 10, color: '#5A5A7A', margin: 0 }}>
        Step {activeStep + 1} / {steps.length} · ลากผู้เล่นหรือบอลเพื่อตั้งตำแหน่ง
      </p>
    </div>
  );
}
