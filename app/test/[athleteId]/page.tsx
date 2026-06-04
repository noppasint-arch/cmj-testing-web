'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAthleteStore } from '@/store/athleteStore';
import { useTestStore } from '@/store/testStore';
import { CMJTest } from '@/lib/db';
import { computeMetrics, validateMarkers } from '@/lib/calculations';

type Step = 'record' | 'analyze';

const FPS_OPTIONS = [30, 60, 120, 240];

export default function TestPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const router = useRouter();
  const { athletes, load: loadAthletes } = useAthleteStore();
  const { upsert } = useTestStore();

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('record');

  // ── Record state ──────────────────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const liveRef = useRef<HTMLVideoElement | null>(null);

  // ── Analyze state ─────────────────────────────────────────────────────────
  const [fps, setFps] = useState(60);
  const [showFpsMenu, setShowFpsMenu] = useState(false);
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [takeoffFrame, setTakeoffFrame] = useState<number | null>(null);
  const [landingFrame, setLandingFrame] = useState<number | null>(null);
  const [movementStartFrame, setMovementStartFrame] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [flashMarker, setFlashMarker] = useState<string | null>(null);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0);
  const [autoLog, setAutoLog] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartFrame = useRef(0);

  useEffect(() => { loadAthletes(); }, []);

  // ── Camera setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'record') return;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (liveRef.current) {
          liveRef.current.srcObject = stream;
          liveRef.current.play();
        }
        setCameraReady(true);
      } catch (e) {
        setCameraError('Cannot access camera. Please allow camera permission.');
      }
    })();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [step]);

  const getSupportedMimeType = (): string => {
    const types = [
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = getSupportedMimeType();
    const mr = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);
    const actualMime = mr.mimeType || 'video/mp4';
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: actualMime });
      const url = URL.createObjectURL(blob);
      setVideoBlob(blob);
      setVideoUrl(url);
      streamRef.current?.getTracks().forEach(t => t.stop());
      setStep('analyze');
    };
    mr.start(100); // collect data every 100ms for better compat
    mediaRecRef.current = mr;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
  };

  // ── Video loaded — Safari fix: duration is NaN until seeked ─────────────
  const resolveDuration = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (isNaN(dur) || !isFinite(dur)) return; // will be called again from onSeeked
    const frames = Math.floor(dur * fps);
    setTotalFrames(frames);
    setCurrentFrame(0);
    videoRef.current.currentTime = 0;
  };

  const onVideoLoaded = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (isNaN(dur) || !isFinite(dur)) {
      // Safari: seek far ahead to force the browser to read the duration
      videoRef.current.currentTime = 1e10;
    } else {
      resolveDuration();
    }
  };

  const onSeeked = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (!isNaN(dur) && isFinite(dur) && totalFrames === 0) {
      resolveDuration();
    }
  };

  const seekToFrame = (f: number) => {
    const clamped = Math.max(0, Math.min(f, totalFrames - 1));
    setCurrentFrame(clamped);
    if (videoRef.current) videoRef.current.currentTime = clamped / fps;
  };

  // ── Drag scrub ────────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartFrame.current = currentFrame;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const delta = Math.round((e.clientX - dragStartX.current) / 4);
    seekToFrame(dragStartFrame.current + delta);
  };
  const onPointerUp = () => { isDragging.current = false; };

  // ── Marker flash ──────────────────────────────────────────────────────────
  const flash = (marker: string) => {
    setFlashMarker(marker);
    setTimeout(() => setFlashMarker(null), 600);
  };

  const setMarker = (type: 'movement' | 'takeoff' | 'landing') => {
    if (type === 'movement') { setMovementStartFrame(currentFrame); flash('movement'); }
    if (type === 'takeoff') { setTakeoffFrame(currentFrame); flash('takeoff'); }
    if (type === 'landing') { setLandingFrame(currentFrame); flash('landing'); }
  };

  // ── Auto-detect markers (Ground-Strip Background Model) ──────────────────
  //
  // Method: compare each frame's ground-strip against a background reference
  // built from the first frames (athlete standing still).
  // foot_present = strip differs significantly from empty-floor background.
  // Takeoff = TRUE→FALSE transition, Landing = FALSE→TRUE transition.
  // Hard physical constraints: flight time 200–950 ms (jump height 5–115 cm).
  //
  const autoDetect = async () => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;

    setAutoDetecting(true);
    setAutoProgress(0);
    setAutoLog('Building floor reference...');

    const seekTo = (t: number) =>
      new Promise<void>(res => {
        const h = () => { video.removeEventListener('seeked', h); res(); };
        video.addEventListener('seeked', h);
        video.currentTime = t;
      });

    // ── Canvas setup ──────────────────────────────────────────────────────
    const CW = 160, CH = 90;
    const canvas = document.createElement('canvas');
    canvas.width = CW; canvas.height = CH;
    const ctx = canvas.getContext('2d')!;
    const duration = video.duration;

    // Ground-strip ROI: bottom 18% of frame, center 60% horizontally
    // (where feet meet floor, avoiding side distractions)
    const SY = Math.floor(CH * 0.82);
    const SH = CH - SY;                    // ~16px strip
    const SX = Math.floor(CW * 0.20);
    const SW = Math.floor(CW * 0.60);      // center 60% width
    const N_PIX = SW * SH;

    const toGray = (data: Uint8ClampedArray, n: number): Float32Array => {
      const g = new Float32Array(n);
      for (let p = 0; p < n; p++)
        g[p] = data[p * 4] * 0.299 + data[p * 4 + 1] * 0.587 + data[p * 4 + 2] * 0.114;
      return g;
    };

    // ── STEP 1: Build background from first 10% of video ─────────────────
    // Assumes athlete enters frame and stands still at start
    const BG_N = 8;
    const bgSum = new Float32Array(N_PIX);
    for (let i = 0; i < BG_N; i++) {
      const t = (i / (BG_N - 1)) * Math.min(duration * 0.12, 1.5);
      await seekTo(t);
      ctx.drawImage(video, 0, 0, CW, CH);
      const g = toGray(ctx.getImageData(SX, SY, SW, SH).data, N_PIX);
      for (let p = 0; p < N_PIX; p++) bgSum[p] += g[p];
      setAutoProgress(Math.round((i / BG_N) * 15));
    }
    const bgRef = bgSum.map(v => v / BG_N);

    // ── STEP 2: Sample every 2 frames, score foot presence ───────────────
    // foot_score = mean |current_strip - background|
    // High score → feet on ground. Low score → floor visible = airborne.
    const step = Math.max(1, Math.round(fps / 60)); // ~every frame up to 60fps
    const totalSamples = Math.floor(duration * fps / step);
    const frameNums: number[] = [];
    const footScore: number[] = [];

    setAutoLog('Scanning for foot contact...');

    for (let i = 0; i <= totalSamples; i++) {
      const fn = i * step;
      await seekTo(Math.min(fn / fps, duration - 0.01));
      ctx.drawImage(video, 0, 0, CW, CH);
      const g = toGray(ctx.getImageData(SX, SY, SW, SH).data, N_PIX);
      let diff = 0;
      for (let p = 0; p < N_PIX; p++) diff += Math.abs(g[p] - bgRef[p]);
      footScore.push(diff / N_PIX);
      frameNums.push(fn);
      setAutoProgress(15 + Math.round((i / totalSamples) * 72));
    }

    setAutoLog('Finding jump window...');

    // ── STEP 3: Adaptive threshold ────────────────────────────────────────
    // Median of scores ≈ "foot present" baseline; use percentile split
    const sorted = [...footScore].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const threshold = p25 + (p75 - p25) * 0.35; // 35% above lower quartile
    // foot_present = score > threshold
    const rawPresent = footScore.map(s => s > threshold);

    // ── STEP 4: Temporal smoothing (require 3 consecutive frames) ─────────
    const PERSIST = 3;
    const present = [...rawPresent];
    for (let i = PERSIST; i < present.length - PERSIST; i++) {
      const w = rawPresent.slice(i - PERSIST, i + PERSIST + 1);
      present[i] = w.filter(Boolean).length >= PERSIST;
    }

    // ── STEP 5: Find flight windows with physical constraints ─────────────
    // Max human CMJ: ~115 cm → flight 964 ms
    // Min detectable hop: ~5 cm → flight 202 ms
    const MIN_FLIGHT_S = 0.20;
    const MAX_FLIGHT_S = 0.97;
    const minSamples = Math.ceil(MIN_FLIGHT_S * fps / step);
    const maxSamples = Math.floor(MAX_FLIGHT_S * fps / step);

    const candidates: { tof: number; lnd: number; flightMs: number; score: number }[] = [];

    for (let i = 1; i < present.length - minSamples; i++) {
      // TRUE → FALSE = takeoff
      if (present[i - 1] && !present[i]) {
        for (let j = i + minSamples; j <= Math.min(i + maxSamples, present.length - 1); j++) {
          // FALSE → TRUE = landing
          if (!present[j - 1] && present[j]) {
            const flightMs = (frameNums[j] - frameNums[i]) / fps * 1000;
            // Score: prefer jumps in 300–700ms range (most common CMJ)
            // and preceded by foot-present period (athlete standing before jump)
            const prevStanding = present.slice(Math.max(0, i - Math.round(fps * 0.3 / step)), i)
              .filter(Boolean).length;
            const score = prevStanding - Math.abs(flightMs - 450) / 100;
            candidates.push({ tof: frameNums[i], lnd: frameNums[j], flightMs, score });
            break; // only take first landing after this takeoff
          }
        }
      }
    }

    setAutoProgress(92);

    if (candidates.length > 0) {
      // Best candidate = highest score
      const best = candidates.sort((a, b) => b.score - a.score)[0];

      setTakeoffFrame(best.tof);
      setLandingFrame(best.lnd);

      // Movement start: scan backward from takeoff for first motion onset
      // (full-frame inter-frame diff to catch body descending)
      let mvt: number | null = null;
      const STILL_THRESHOLD = footScore[0] * 1.3; // slightly above background noise
      for (let i = frameNums.indexOf(best.tof) - 1; i >= 0; i--) {
        if (footScore[i] < STILL_THRESHOLD) {
          // Found a low-activity frame → movement started just after this
          mvt = frameNums[Math.min(i + 2, frameNums.length - 1)];
          break;
        }
      }
      if (mvt === null) {
        // Fallback: 400ms before takeoff
        mvt = Math.max(0, best.tof - Math.round(fps * 0.4));
      }
      setMovementStartFrame(mvt);
      seekToFrame(best.tof);

      const jh = ((9.81 * (best.flightMs / 1000) ** 2) / 8 * 100).toFixed(1);
      setAutoLog(`✅ Jump detected — flight ${Math.round(best.flightMs)} ms (~${jh} cm)`);
    } else {
      // Diagnostic: report what was found
      const anyLow = present.filter(v => !v).length;
      if (anyLow < minSamples) {
        setAutoLog('⚠ Feet always on ground — is this a jump video? Try manual markers.');
      } else {
        setAutoLog('⚠ No jump in 200–950 ms range found. Fine-tune manually with ±1/±10 buttons.');
      }
    }

    setAutoProgress(100);
    setAutoDetecting(false);
    await seekTo(0);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const errors = validateMarkers(takeoffFrame, landingFrame, movementStartFrame, totalFrames);

  const save = async () => {
    if (errors.length > 0) return;
    if (takeoffFrame === null || landingFrame === null) return;
    setSaving(true);
    const metrics = computeMetrics(takeoffFrame, landingFrame, fps, movementStartFrame ?? undefined);
    const test: CMJTest = {
      id: crypto.randomUUID(),
      athleteId,
      videoUrl,
      takeoffFrame,
      landingFrame,
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

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — Record step
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'record') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
        {/* Top bar */}
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(0,0,0,0.6)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 16, cursor: 'pointer' }}>
            ‹ Back
          </button>
          <span style={{ color: '#F0F0FF', fontWeight: 700 }}>
            {athlete ? athlete.name : 'Record Jump'}
          </span>
        </div>

        {/* Camera view */}
        <video ref={liveRef} muted playsInline autoPlay
          style={{ width: '100%', flex: 1, objectFit: 'cover', background: '#111' }} />

        {cameraError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0A0A0F', flexDirection: 'column', gap: 12, padding: 32 }}>
            <div style={{ fontSize: 40 }}>📷</div>
            <div style={{ color: '#FF5252', textAlign: 'center', fontSize: 14 }}>{cameraError}</div>
            <button onClick={() => router.back()} style={{
              background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 12,
              padding: '12px 24px', fontWeight: 700, cursor: 'pointer',
            }}>Go Back</button>
          </div>
        )}

        {/* Upload option */}
        <div style={{ position: 'absolute', top: 60, right: 16 }}>
          <label style={{
            background: 'rgba(30,30,50,0.85)', border: '1px solid #2A2A3E', color: '#9090B0',
            borderRadius: 10, padding: '8px 12px', fontSize: 12, cursor: 'pointer',
          }}>
            📁 Upload
            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = URL.createObjectURL(file);
              setVideoBlob(file);
              setVideoUrl(url);
              streamRef.current?.getTracks().forEach(t => t.stop());
              setStep('analyze');
            }} />
          </label>
        </div>

        {/* Record button */}
        <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <button onClick={recording ? stopRecording : startRecording}
            disabled={!cameraReady && !recording}
            style={{
              width: 80, height: 80, borderRadius: 40, border: `4px solid ${recording ? '#FF5252' : '#fff'}`,
              background: recording ? '#FF5252' : 'rgba(255,255,255,0.15)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: '0.2s',
            }}>
            {recording
              ? <div style={{ width: 24, height: 24, background: '#fff', borderRadius: 4 }} />
              : <div style={{ width: 56, height: 56, borderRadius: 28, background: '#fff' }} />}
          </button>
        </div>

        {recording && (
          <div style={{ position: 'absolute', top: 60, left: 16, background: '#FF5252',
            borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }} />
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>REC</span>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — Analyze step
  // ─────────────────────────────────────────────────────────────────────────
  const markerColor = flashMarker ? '#4CAF50' : '#2A2A3E';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A3E',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => setStep('record')} style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 15, cursor: 'pointer' }}>
          ‹ Re-record
        </button>
        <span style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 14 }}>Frame Analysis</span>
        {/* FPS selector */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowFpsMenu(v => !v)} style={{
            background: '#1A1A26', border: '1px solid #2A2A3E', color: '#F0F0FF',
            borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
          }}>{fps} fps ▾</button>
          {showFpsMenu && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#1A1A26',
              border: '1px solid #2A2A3E', borderRadius: 10, zIndex: 50, overflow: 'hidden' }}>
              {FPS_OPTIONS.map(f => (
                <button key={f} onClick={() => {
                  setFps(f);
                  setShowFpsMenu(false);
                  if (videoRef.current && isFinite(videoRef.current.duration)) {
                    setTotalFrames(Math.floor(videoRef.current.duration * f));
                    setCurrentFrame(0);
                  }
                }}
                  style={{ display: 'block', width: '100%', padding: '10px 20px',
                    background: f === fps ? '#6C63FF' : 'none', border: 'none',
                    color: '#F0F0FF', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
                  {f} fps
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Video */}
      <div style={{
        position: 'relative', background: '#000',
        border: `2px solid ${flashMarker ? '#4CAF50' : 'transparent'}`,
        transition: 'border-color 0.3s',
      }}>
        <video ref={videoRef} src={videoUrl} playsInline
          onLoadedMetadata={onVideoLoaded}
          onSeeked={onSeeked}
          style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'contain', background: '#000' }}
        />
        {/* Frame overlay */}
        <div style={{
          position: 'absolute', bottom: 6, right: 8,
          background: 'rgba(0,0,0,0.7)', borderRadius: 6,
          padding: '2px 8px', color: '#F0F0FF', fontSize: 11, fontWeight: 700,
        }}>
          {currentFrame} / {totalFrames - 1}
        </div>
        {/* Marker indicators on video */}
        {totalFrames > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, display: 'flex' }}>
            {movementStartFrame !== null && (
              <div style={{ position: 'absolute', left: `${(movementStartFrame / totalFrames) * 100}%`,
                width: 2, height: '100%', background: '#FF9800', top: 0 }} />
            )}
            {takeoffFrame !== null && (
              <div style={{ position: 'absolute', left: `${(takeoffFrame / totalFrames) * 100}%`,
                width: 2, height: '100%', background: '#4CAF50', top: 0 }} />
            )}
            {landingFrame !== null && (
              <div style={{ position: 'absolute', left: `${(landingFrame / totalFrames) * 100}%`,
                width: 2, height: '100%', background: '#FF5252', top: 0 }} />
            )}
          </div>
        )}
      </div>

      {/* Scrubber */}
      <div style={{ padding: '10px 16px', background: '#12121A', borderBottom: '1px solid #2A2A3E' }}>
        <input type="range" min={0} max={Math.max(totalFrames - 1, 1)} value={currentFrame}
          onChange={e => seekToFrame(parseInt(e.target.value))}
          style={{ width: '100%' }} />

        {/* Drag zone */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            marginTop: 8, padding: '10px', background: '#1A1A26', borderRadius: 10,
            textAlign: 'center', color: '#5A5A7A', fontSize: 12, cursor: 'ew-resize',
            userSelect: 'none', touchAction: 'none',
          }}>
          ← Drag to scrub · Frame {currentFrame} →
        </div>

        {/* Step buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
          {[-10, -1, 1, 10].map(d => (
            <button key={d} onClick={() => seekToFrame(currentFrame + d)} style={{
              background: '#1A1A26', border: '1px solid #2A2A3E', color: '#F0F0FF',
              borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
            }}>{d > 0 ? `+${d}` : d}</button>
          ))}
        </div>
      </div>

      {/* Marker buttons */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* ── Auto-Detect button ── */}
        <button
          onClick={autoDetect}
          disabled={autoDetecting || totalFrames === 0}
          style={{
            width: '100%', border: 'none', borderRadius: 14, padding: '13px',
            background: autoDetecting ? '#1A1A26' : 'linear-gradient(135deg,#6C63FF,#00D4FF)',
            color: autoDetecting ? '#5A5A7A' : '#fff',
            fontWeight: 700, fontSize: 15, cursor: autoDetecting ? 'default' : 'pointer',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {autoDetecting ? (
            <span>🔍 Analyzing… {autoProgress}%</span>
          ) : (
            <span>✨ Auto-Detect Markers</span>
          )}
        </button>

        {/* Progress bar */}
        {autoDetecting && (
          <div style={{ height: 4, background: '#1A1A26', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: 'linear-gradient(90deg,#6C63FF,#00D4FF)',
              borderRadius: 2, transition: 'width 0.3s',
              width: `${autoProgress}%`,
            }} />
          </div>
        )}

        {/* Auto-detect log */}
        {autoLog && !autoDetecting && (
          <div style={{
            background: autoLog.startsWith('✅') ? 'rgba(76,175,80,0.1)' : 'rgba(255,152,0,0.1)',
            border: `1px solid ${autoLog.startsWith('✅') ? '#4CAF50' : '#FF9800'}`,
            borderRadius: 10, padding: '8px 12px',
            color: autoLog.startsWith('✅') ? '#4CAF50' : '#FF9800',
            fontSize: 13,
          }}>
            {autoLog}
          </div>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: '#2A2A3E' }} />
          <span style={{ color: '#5A5A7A', fontSize: 11 }}>or set manually</span>
          <div style={{ flex: 1, height: 1, background: '#2A2A3E' }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <MarkerBtn
            label="Movement Start"
            color="#FF9800"
            frame={movementStartFrame}
            onSet={() => setMarker('movement')}
            onClear={() => setMovementStartFrame(null)}
            optional
          />
          <MarkerBtn
            label="Takeoff"
            color="#4CAF50"
            frame={takeoffFrame}
            onSet={() => setMarker('takeoff')}
            onClear={() => setTakeoffFrame(null)}
          />
          <MarkerBtn
            label="Landing"
            color="#FF5252"
            frame={landingFrame}
            onSet={() => setMarker('landing')}
            onClear={() => setLandingFrame(null)}
          />
        </div>

        {/* Errors */}
        {errors.map(e => (
          <div key={e} style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid #FF5252',
            borderRadius: 8, padding: '6px 10px', color: '#FF5252', fontSize: 12 }}>
            ⚠ {e}
          </div>
        ))}

        {/* Preview metrics */}
        {takeoffFrame !== null && landingFrame !== null && errors.length === 0 && (() => {
          const m = computeMetrics(takeoffFrame, landingFrame, fps, movementStartFrame ?? undefined);
          return (
            <div style={{ background: '#1A1A26', borderRadius: 12, border: '1px solid #2A2A3E',
              padding: '10px 14px', display: 'flex', gap: 16, justifyContent: 'center' }}>
              <Stat label="Height" value={`${m.jumpHeight_cm.toFixed(1)} cm`} color="#FFD60A" />
              <Stat label="Flight" value={`${m.flightTime_ms.toFixed(0)} ms`} color="#00D4FF" />
              {m.RSImod && <Stat label="RSImod" value={m.RSImod.toFixed(2)} color="#FF6B6B" />}
            </div>
          );
        })()}

        {/* Notes */}
        <input value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)..."
          style={{ background: '#1A1A26', border: '1px solid #2A2A3E', borderRadius: 10,
            padding: '10px 12px', color: '#F0F0FF', fontSize: 13, outline: 'none', width: '100%' }} />

        {/* Save */}
        <button onClick={save} disabled={errors.length > 0 || saving || takeoffFrame === null || landingFrame === null}
          style={{
            background: errors.length > 0 || takeoffFrame === null || landingFrame === null ? '#1A1A26' : '#6C63FF',
            color: errors.length > 0 || takeoffFrame === null || landingFrame === null ? '#5A5A7A' : '#fff',
            border: 'none', borderRadius: 14, padding: '14px', fontWeight: 700, fontSize: 15,
            cursor: errors.length > 0 || takeoffFrame === null || landingFrame === null ? 'default' : 'pointer',
            width: '100%',
          }}>
          {saving ? 'Saving...' : '✓ Save Test'}
        </button>
      </div>
    </div>
  );
}

function MarkerBtn({ label, color, frame, onSet, onClear, optional }: {
  label: string; color: string; frame: number | null;
  onSet: () => void; onClear: () => void; optional?: boolean;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={onSet} style={{
        background: frame !== null ? `${color}22` : '#1A1A26',
        border: `1px solid ${frame !== null ? color : '#2A2A3E'}`,
        borderRadius: 10, padding: '8px 4px', cursor: 'pointer', width: '100%',
      }}>
        <div style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
          {label}{optional ? ' (opt)' : ''}
        </div>
        <div style={{ color: frame !== null ? color : '#5A5A7A', fontSize: 13, fontWeight: 800, marginTop: 2 }}>
          {frame !== null ? `Fr.${frame}` : 'Set'}
        </div>
      </button>
      {frame !== null && (
        <button onClick={onClear} style={{
          background: 'none', border: 'none', color: '#5A5A7A', fontSize: 10,
          cursor: 'pointer', padding: '2px',
        }}>✕ clear</button>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#5A5A7A', fontSize: 10 }}>{label}</div>
      <div style={{ color, fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
