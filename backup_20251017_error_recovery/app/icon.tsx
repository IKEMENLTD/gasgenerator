import { ImageResponse } from 'next/og'

// アイコンを生成しない（空の透明画像を返す）
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
          background: 'transparent',
        }}
      >
        {/* 空の透明アイコン - 何も表示しない */}
      </div>
    ),
    {
      width: 32,
      height: 32,
    }
  )
}