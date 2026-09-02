import { ImageResponse } from 'next/og';

import { brand } from '@/lib/site';

export const alt = `${brand.owner} — প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং শিক্ষা ও টুলস`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The default social card. Generated from the brand tokens rather than a
 * bitmap, so it stays correct if the wording changes and never ships a fake
 * product screenshot.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0b1f33 0%, #14304d 60%, #1261a6 100%)',
          padding: '72px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#f2a900',
              color: '#0b1f33',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            NB
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>Engr. Md. Nuruzzaman, RSE</span>
            <span style={{ fontSize: 20, color: '#a8c2dc' }}>nuruzzaman.com.bd</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>
            Practical engineering education, tools and courses
          </span>
          <span style={{ fontSize: 26, color: '#cfe0ef' }}>
            Structural &amp; Engineering Design Tools for AutoCAD
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            fontSize: 20,
            color: '#0b1f33',
          }}
        >
          {['Courses', 'Engineering Tools', 'Verified articles'].map((chip) => (
            <span
              key={chip}
              style={{
                background: '#ffffff',
                borderRadius: 999,
                padding: '10px 22px',
                fontWeight: 600,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
