import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom right, #FFD700, #16a34a)',
          fontSize: 200,
          fontWeight: 'bold',
          color: 'white',
        }}
      >
        CE
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  );
}
