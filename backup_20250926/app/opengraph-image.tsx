import { ImageResponse } from 'next/og'

// OG画像を生成しない（空の透明画像を返す）
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
        }}
      >
        {/* 空のOG画像 - 何も表示しない */}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}