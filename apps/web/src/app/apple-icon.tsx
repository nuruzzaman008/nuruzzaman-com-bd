import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: '#0b1f33',
          color: '#f2a900',
          fontFamily: 'sans-serif',
        }}
      >
        <span style={{ fontSize: 78, fontWeight: 700, letterSpacing: -2 }}>NB</span>
        <span style={{ fontSize: 18, color: '#a8c2dc' }}>RSE</span>
      </div>
    ),
    size,
  );
}
