/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 常に型チェックを実施（セキュリティのため）
    ignoreBuildErrors: false,
  },
  eslint: {
    // Render環境での依存関係エラー回避のため一時的に無効化
    ignoreDuringBuilds: true,
  },
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['@line/bot-sdk'],
  },
  // Rewrite rules to ensure Next.js routes work correctly
  // Rewrite rules removed to prevent conflicts with API routes

  webpack: (config, { isServer }) => {
    // Renderのビルド環境でのパス解決を修正
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname,
      '@/lib': __dirname + '/lib',
      '@/app': __dirname + '/app',
      '@/types': __dirname + '/types',
    }
    return config
  },
}

module.exports = nextConfig
