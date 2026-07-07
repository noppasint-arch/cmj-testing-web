'use client';
import Link from 'next/link';

const VIDEO_URL = 'https://youtu.be/sa-ogG6Nkqo?si=GcoPmxR6bXUCJp2f';

export default function VideoQrPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/" style={{ color: '#6C63FF', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          ‹ Back
        </Link>
        <div style={{ color: '#5A5A7A', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginTop: 12, marginBottom: 2 }}>CMJ TESTING</div>
        <div style={{ color: '#F0F0FF', fontSize: 24, fontWeight: 800 }}>Video QR Code</div>
      </div>

      {/* QR card */}
      <div style={{
        background: '#12121A', borderRadius: 16, border: '1px solid #2A2A3E',
        padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 12, lineHeight: 0 }}>
          <img src="/video-qr.svg" alt="QR code linking to the video" style={{ width: '100%', maxWidth: 280, height: 'auto' }} />
        </div>
        <div style={{ color: '#9090B0', fontSize: 13, textAlign: 'center' }}>
          Scan with your phone camera to watch the video
        </div>
        <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer" style={{
          background: '#6C63FF', color: '#fff', borderRadius: 12,
          padding: '10px 18px', fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>
          ▶ Open video
        </a>
      </div>
    </div>
  );
}
