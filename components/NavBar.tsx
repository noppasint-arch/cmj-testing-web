'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', label: 'Athletes', icon: '👤' },
  { href: '/history', label: 'History', icon: '📊' },
];

export default function NavBar() {
  const path = usePathname();
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: '#12121A', borderTop: '1px solid #2A2A3E',
      display: 'flex', zIndex: 100,
    }}>
      {tabs.map(t => {
        const active = path === t.href;
        return (
          <Link key={t.href} href={t.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 0 14px',
            color: active ? '#6C63FF' : '#5A5A7A',
            textDecoration: 'none', fontSize: 11, fontWeight: 600, gap: 2,
          }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
