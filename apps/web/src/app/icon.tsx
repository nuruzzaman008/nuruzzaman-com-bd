import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * The browser tab icon, generated from the brand tokens rather than shipped as
 * a binary, so it stays in step if the palette changes.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1f33',
          color: '#f2a900',
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: -0.5,
          borderRadius: 6,
        }}
      >
        NB
      </div>
    ),
    size,
  );
}
