/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 常に型チェックを実施（セキュリティのため）
    ignoreBuildErrors: false,
  },
  eslint: {
    // 常にESLintチェックを実施（セキュリティのため）
    ignoreDuringBuilds: false,
  },
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['@line/bot-sdk'],
  },
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
