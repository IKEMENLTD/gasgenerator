/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ビルド時の型チェックを無効化
    ignoreBuildErrors: true,
  },
  eslint: {
    // ビルド時のESLintを無効化
    ignoreDuringBuilds: true,
  },
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['@line/bot-sdk'],
  },
}

module.exports = nextConfig
