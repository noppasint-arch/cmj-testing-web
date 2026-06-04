'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAthleteStore } from '@/store/athleteStore';
import { useTestStore } from '@/store/testStore';
import { CMJTest } from '@/lib/db';
import { computeMetrics, validateMarkers } from '@/lib/calculations';

type Step = 'record' | 'analyze';
type MarkMode = 'idle' | 'watching'; // watching = playing slow, ready to mark

const FPS_OPTIONS = [30, 60, 120, 240];
const SLOW_SPEEDS = [1, 0.5, 0.25, 0.1];

export default function TestPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const router = useRouter();
  const { athletes, load: loadAthletes } = useAthleteStore();
  const { upsert } = useTestStore();

  const [step, setStep] = useState<Step>('record');

  // ── Record ────────────────────────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const liveRef = useRef<HTMLVideoElement | null>(null);

  // ── Analyze ───────────────────────────────────────────────────────────────
  const [fps, setFps] = useState(60);
  const [showFpsMenu, setShowFpsMenu] = useState(false);
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(0.25);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const [takeoffFrame, setTakeoffFrame] = useState<number | null>(null);
  const [landingFrame, setLandingFrame] = useState<number | null>(null);
  const [movementStartFrame, setMovementStartFrame] = useState<number | null>(null);
  const [markMode, setMarkMode] = useState<MarkMode>('idle');

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [flashMarker, setFlashMarker] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartFrame = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => { loadAthletes(); }, []);

  // ── Camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'record') return;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (liveRef.current) { liveRef.current.srcObject = stream; liveRef.current.play(); }
        setCameraReady(true);
      } catch { setCameraError('Cannot access camera. Please allow camera permission.'); }
    })();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [step]);

  const getSupportedMimeType = () => {
    const types = ['video/mp4;codecs=h264','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    for (const t of types) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
    return '';
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = getSupportedMimeType();
    const mr = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);
    const actualMime = mr.mimeType || 'video/mp4';
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: actualMime });
      setVideoUrl(URL.createObjectURL(blob));
      streamRef.current?.getTracks().forEach(t => t.stop());
      setStep('analyze');
    };
    mr.start(100);
    mediaRecRef.current = mr;
    setRecording(true);
  };

  const stopRecording = () => { mediaRecRef.current?.stop(); setRecording(false); };

  // ── Duration detection (Safari fix) ───────────────────────────────────────
  const resolveDuration = useCallback(() => {
    const video = videoRef.current;
    if (!video || isNaN(video.duration) || !isFinite(video.duration)) return;
    setTotalFrames(Math.floor(video.duration * fps));
    setCurrentFrame(0);
    video.currentTime = 0;
  }, [fps]);

  const onVideoLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isNaN(video.duration) || !isFinite(video.duration)) {
      video.currentTime = 1e10;
    } else { resolveDuration(); }
  };

  const onSeeked = () => {
    const video = videoRef.current;
    if (!video || isNaN(video.duration) || totalFrames > 0) return;
    resolveDuration();
  };

  // ── RAF frame tracker while playing ───────────────────────────────────────
  const trackFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const f = Math.round(video.currentTime * fps);
    setCurrentFrame(Math.min(f, totalFrames - 1));
    if (!video.paused && !video.ended) {
      rafRef.current = requestAnimationFrame(trackFrame);
    } else {
      setIsPlaying(false);
    }
  }, [fps, totalFrames]);

  // ── Playback controls ─────────────────────────────────────────────────────
  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playSpeed;
    video.play();
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(trackFrame);
  };

  const pause = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const togglePlay = () => isPlaying ? pause() : play();

  // ── Seek ──────────────────────────────────────────────────────────────────
  const seekToFrame = useCallback((f: number) => {
    const clamped = Math.max(0, Math.min(f, totalFrames - 1));
    setCurrentFrame(clamped);
    if (videoRef.current) videoRef.current.currentTime = clamped / fps;
  }, [fps, totalFrames]);

  // ── Drag scrub ────────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    pause();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartFrame.current = currentFrame;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const delta = Math.round((e.clientX - dragStartX.current) / 3);
    seekToFrame(dragStartFrame.current + delta);
  };
  const onPointerUp = () => { isDragging.current = false; };

  // ── Markers ───────────────────────────────────────────────────────────────
  const flash = (marker: string) => {
    setFlashMarker(marker);
    setTimeout(() => setFlashMarker(null), 500);
  };

  const markTakeoff = () => { setTakeoffFrame(currentFrame); flash('takeoff'); }
  const markLanding = () => { setLandingFrame(currentFrame); flash('landing'); }
  const markMovement = () => { setMovementStartFrame(currentFrame); flash('movement'); }

  // ── Save ──────────────────────────────────────────────────────────────────
  const errors = validateMarkers(takeoffFrame, landingFrame, movementStartFrame, totalFrames);

  const save = async () => {
    if (errors.length > 0 || takeoffFrame === null || landingFrame === null) return;
    setSaving(true);
    const metrics = computeMetrics(takeoffFrame, landingFrame, fps, movementStartFrame ?? undefined);
    const test: CMJTest = {
      id: crypto.randomUUID(), athleteId, videoUrl,
      takeoffFrame, landingFrame,
      movementStartFrame: movementStartFrame ?? undefined,
      videoFPS: fps,
      jumpHeight_cm: metrics.jumpHeight_cm,
      flightTime_ms: metrics.flightTime_ms,
      RSImod: metrics.RSImod ?? undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await upsert(test);
    router.push(`/results?testId=${test.id}&athleteId=${athleteId}`);
  };

  const athlete = athletes.find(a => a.id === athleteId);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — Record
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'record') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000', position: 'relative' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(0,0,0,0.7)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 16, cursor: 'pointer' }}>‹ Back</button>
          <span style={{ color: '#F0F0FF', fontWeight: 700 }}>{athlete?.name ?? 'Record Jump'}</span>
        </div>

        <video ref={liveRef} muted playsInline autoPlay style={{ width: '100%', flex: 1, objectFit: 'cover', background: '#111' }} />

        {cameraError && (
          <div style={{ position: 'absolute', inset: 0, background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
            <div style={{ fontSize: 40 }}>📷</div>
            <div style={{ color: '#FF5252', textAlign: 'center', fontSize: 14 }}>{cameraError}</div>
            <button onClick={() => router.back()} style={{ background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, cursor: 'pointer' }}>Go Back</button>
          </div>
        )}

        {/* Upload */}
        <div style={{ position: 'absolute', top: 60, right: 16 }}>
          <label style={{ background: 'rgba(26,26,38,0.9)', border: '1px solid #2A2A3E', color: '#9090B0', borderRadius: 10, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
            📁 Upload
            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={e => {
              const file = e.target.files?.[0]; if (!file) return;
              setVideoUrl(URL.createObjectURL(file));
              streamRef.current?.getTracks().forEach(t => t.stop());
              setStep('analyze');
            }} />
          </label>
        </div>

        {/* Record button */}
        <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <button onClick={recording ? stopRecording : startRecording} disabled={!cameraReady && !recording}
            style={{ width: 80, height: 80, borderRadius: 40, border: `4px solid ${recording ? '#FF5252' : '#fff'}`,
              background: recording ? '#FF5252' : 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {recording
              ? <div style={{ width: 24, height: 24, background: '#fff', borderRadius: 4 }} />
              : <div style={{ width: 56, height: 56, borderRadius: 28, background: '#fff' }} />}
          </button>
        </div>

        {recording && (
          <div style={{ position: 'absolute', top: 60, left: 16, background: '#FF5252', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }} />
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>REC</span>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — Analyze  (My Jump 2 style: slow-play → tap to mark)
  // ══════════════════════════════════════════════════════════════════════════
  const metrics = takeoffFrame !== null && landingFrame !== null && errors.length === 0
    ? computeMetrics(takeoffFrame, landingFrame, fps, movementStartFrame ?? undefined)
    : null;

  const allSet = takeoffFrame !== null && landingFrame !== null;
  const borderColor = flashMarker === 'takeoff' ? '#4CAF50' : flashMarker === 'landing' ? '#FF5252' : flashMarker === 'movement' ? '#FF9800' : 'transparent';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0A0A0F' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #2A2A3E',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => { pause(); setStep('record'); }} style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 15, cursor: 'pointer' }}>‹ Re-record</button>
        <span style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 14 }}>Frame Analysis</span>

        {/* FPS */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowFpsMenu(v => !v)} style={{ background: '#1A1A26', border: '1px solid #2A2A3E', color: '#F0F0FF', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
            {fps} fps ▾
          </button>
          {showFpsMenu && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#1A1A26', border: '1px solid #2A2A3E', borderRadius: 10, zIndex: 50, overflow: 'hidden', minWidth: 80 }}>
              {FPS_OPTIONS.map(f => (
                <button key={f} onClick={() => {
                  setFps(f); setShowFpsMenu(false);
                  if (videoRef.current && isFinite(videoRef.current.duration))
                    setTotalFrames(Math.floor(videoRef.current.duration * f));
                }} style={{ display: 'block', width: '100%', padding: '10px 16px', background: f === fps ? '#6C63FF' : 'none', border: 'none', color: '#F0F0FF', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
                  {f} fps
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Video ──────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', background: '#000', border: `3px solid ${borderColor}`, transition: 'border-color 0.2s', flexShrink: 0 }}>
        <video ref={videoRef} src={videoUrl} playsInline
          onLoadedMetadata={onVideoLoaded} onSeeked={onSeeked}
          onEnded={() => { setIsPlaying(false); if (rafRef.current) cancelAnimationFrame(rafRef.current); }}
          style={{ width: '100%', display: 'block', maxHeight: 230, objectFit: 'contain', background: '#000' }}
        />

        {/* Frame counter */}
        <div style={{ position: 'absolute', bottom: 6, right: 8, background: 'rgba(0,0,0,0.75)', borderRadius: 6, padding: '2px 8px', color: '#F0F0FF', fontSize: 11, fontWeight: 700 }}>
          {currentFrame} / {Math.max(0, totalFrames - 1)}
        </div>

        {/* Marker lines on video timeline */}
        {totalFrames > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 }}>
            {movementStartFrame !== null && <div style={{ position: 'absolute', left: `${(movementStartFrame / totalFrames) * 100}%`, width: 3, height: '100%', background: '#FF9800' }} />}
            {takeoffFrame !== null && <div style={{ position: 'absolute', left: `${(takeoffFrame / totalFrames) * 100}%`, width: 3, height: '100%', background: '#4CAF50' }} />}
            {landingFrame !== null && <div style={{ position: 'absolute', left: `${(landingFrame / totalFrames) * 100}%`, width: 3, height: '100%', background: '#FF5252' }} />}
          </div>
        )}
      </div>

      {/* ── Playback controls ──────────────────────────────────────────────── */}
      <div style={{ background: '#12121A', borderBottom: '1px solid #2A2A3E', padding: '8px 16px', flexShrink: 0 }}>
        {/* Scrub bar */}
        <input type="range" min={0} max={Math.max(totalFrames - 1, 1)} value={currentFrame}
          onChange={e => { pause(); seekToFrame(parseInt(e.target.value)); }}
          style={{ width: '100%', marginBottom: 8 }} />

        {/* Drag zone */}
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          style={{ background: '#1A1A26', borderRadius: 10, padding: '8px 12px', textAlign: 'center',
            color: '#5A5A7A', fontSize: 12, cursor: 'ew-resize', userSelect: 'none', touchAction: 'none', marginBottom: 8 }}>
          ← Drag to scrub · Frame {currentFrame} →
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Step buttons */}
          {[-10, -1].map(d => (
            <button key={d} onClick={() => { pause(); seekToFrame(currentFrame + d); }}
              style={{ background: '#1A1A26', border: '1px solid #2A2A3E', color: '#F0F0FF', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              {d}
            </button>
          ))}

          {/* Play/Pause */}
          <button onClick={togglePlay} style={{ flex: 1, background: isPlaying ? '#1A1A26' : '#6C63FF', border: `1px solid ${isPlaying ? '#2A2A3E' : '#6C63FF'}`, color: '#fff', borderRadius: 10, padding: '8px', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>
            {isPlaying ? '⏸' : '▶'}
          </button>

          {[1, 10].map(d => (
            <button key={d} onClick={() => { pause(); seekToFrame(currentFrame + d); }}
              style={{ background: '#1A1A26', border: '1px solid #2A2A3E', color: '#F0F0FF', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              +{d}
            </button>
          ))}

          {/* Speed selector */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowSpeedMenu(v => !v)}
              style={{ background: '#1A1A26', border: '1px solid #2A2A3E', color: '#00D4FF', borderRadius: 8, padding: '6px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {playSpeed}x ▾
            </button>
            {showSpeedMenu && (
              <div style={{ position: 'absolute', right: 0, bottom: '110%', background: '#1A1A26', border: '1px solid #2A2A3E', borderRadius: 10, zIndex: 50, overflow: 'hidden', minWidth: 70 }}>
                {SLOW_SPEEDS.map(s => (
                  <button key={s} onClick={() => {
                    setPlaySpeed(s); setShowSpeedMenu(false);
                    if (videoRef.current) videoRef.current.playbackRate = s;
                  }} style={{ display: 'block', width: '100%', padding: '8px 14px', background: s === playSpeed ? '#6C63FF' : 'none', border: 'none', color: '#F0F0FF', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Instruction banner ─────────────────────────────────────────────── */}
      {!allSet && (
        <div style={{ background: '#1A1A26', borderBottom: '1px solid #2A2A3E', padding: '8px 16px', flexShrink: 0 }}>
          <div style={{ color: '#9090B0', fontSize: 12, textAlign: 'center' }}>
            {takeoffFrame === null && landingFrame === null
              ? '▶ Play at 0.25x → pause on last frame feet touch ground → tap Takeoff'
              : takeoffFrame !== null && landingFrame === null
              ? '✅ Takeoff set · Now find first frame feet land → tap Landing'
              : '✅ Both markers set · Fine-tune with ±1 then Save'}
          </div>
        </div>
      )}

      {/* ── Marker buttons (big, tap-friendly) ────────────────────────────── */}
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>

        {/* Big 3 marker buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <BigMarkerBtn
            label="Movement" sublabel="optional"
            color="#FF9800" frame={movementStartFrame}
            onSet={markMovement} onClear={() => setMovementStartFrame(null)}
          />
          <BigMarkerBtn
            label="Takeoff" sublabel="last on ground"
            color="#4CAF50" frame={takeoffFrame}
            onSet={markTakeoff} onClear={() => setTakeoffFrame(null)}
          />
          <BigMarkerBtn
            label="Landing" sublabel="first touch"
            color="#FF5252" frame={landingFrame}
            onSet={markLanding} onClear={() => setLandingFrame(null)}
          />
        </div>

        {/* Errors */}
        {errors.map(e => (
          <div key={e} style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid #FF5252', borderRadius: 8, padding: '6px 12px', color: '#FF5252', fontSize: 12 }}>
            ⚠ {e}
          </div>
        ))}

        {/* Live metrics preview */}
        {metrics && (
          <div style={{ background: '#1A1A26', borderRadius: 14, border: '1px solid #2A2A3E', padding: '12px 16px' }}>
            <div style={{ color: '#5A5A7A', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>RESULT PREVIEW</div>
            <div style={{ display: 'flex', gap: 0 }}>
              <StatBox label="Jump Height" value={metrics.jumpHeight_cm.toFixed(1)} unit="cm" color="#FFD60A" />
              <StatBox label="Flight Time" value={metrics.flightTime_ms.toFixed(0)} unit="ms" color="#00D4FF" />
              {metrics.RSImod != null && <StatBox label="RSImod" value={metrics.RSImod.toFixed(2)} unit="" color="#FF6B6B" />}
            </div>
          </div>
        )}

        {/* Notes */}
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)..."
          style={{ background: '#1A1A26', border: '1px solid #2A2A3E', borderRadius: 10, padding: '10px 12px', color: '#F0F0FF', fontSize: 13, outline: 'none', width: '100%' }} />

        {/* Save */}
        <button onClick={save}
          disabled={errors.length > 0 || saving || takeoffFrame === null || landingFrame === null}
          style={{
            background: !allSet || errors.length > 0 ? '#1A1A26' : 'linear-gradient(135deg,#6C63FF,#5A52DD)',
            color: !allSet || errors.length > 0 ? '#5A5A7A' : '#fff',
            border: 'none', borderRadius: 14, padding: '15px', fontWeight: 700, fontSize: 16,
            cursor: !allSet || errors.length > 0 ? 'default' : 'pointer', width: '100%',
          }}>
          {saving ? 'Saving...' : allSet && errors.length === 0 ? '✓ Save Test' : 'Set Takeoff & Landing first'}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BigMarkerBtn({ label, sublabel, color, frame, onSet, onClear }: {
  label: string; sublabel: string; color: string; frame: number | null;
  onSet: () => void; onClear: () => void;
}) {
  const isSet = frame !== null;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={onSet}
        style={{
          background: isSet ? `${color}18` : '#1A1A26',
          border: `2px solid ${isSet ? color : '#2A2A3E'}`,
          borderRadius: 12, padding: '10px 4px', cursor: 'pointer', width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: isSet ? color : '#3A3A5A' }} />
        <div style={{ color: isSet ? color : '#9090B0', fontSize: 11, fontWeight: 800 }}>{label}</div>
        <div style={{ color: '#5A5A7A', fontSize: 9 }}>{sublabel}</div>
        <div style={{ color: isSet ? color : '#5A5A7A', fontSize: 15, fontWeight: 900, marginTop: 2 }}>
          {isSet ? `Fr.${frame}` : 'TAP'}
        </div>
      </button>
      {isSet && (
        <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#5A5A7A', fontSize: 10, cursor: 'pointer', padding: '2px' }}>✕ clear</button>
      )}
    </div>
  );
}

function StatBox({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #2A2A3E', padding: '0 8px' }}>
      <div style={{ color: '#5A5A7A', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{label.toUpperCase()}</div>
      <div style={{ color, fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>{value}</div>
      <div style={{ color: '#9090B0', fontSize: 10 }}>{unit}</div>
    </div>
  );
}
