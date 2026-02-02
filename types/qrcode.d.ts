// QRCode型定義（本番ビルドで@types/qrcodeが使えない場合の対策）
declare module 'qrcode' {
  interface QRCodeOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    type?: 'image/png' | 'image/jpeg' | 'image/webp'
    width?: number
    margin?: number
    color?: {
      dark?: string
      light?: string
    }
  }

  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>
  export function toString(text: string, options?: QRCodeOptions): Promise<string>
  export function toBuffer(text: string, options?: QRCodeOptions): Promise<Buffer>
}
