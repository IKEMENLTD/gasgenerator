const nextConfig = {
  experimental: {
    workerThreads: false,
    cpus: 1,
    optimizeCss: true,
    optimizePackageImports: ['@supabase/supabase-js', 'openai'],
  },
  
  env: {
    NODE_OPTIONS: '--max-old-space-size=400 --optimize-for-size',
  },
  
  images: {
    unoptimized: true,
  },
  
  // APIルートのタイムアウトを設定
  api: {
    responseLimit: '1mb',
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

module.exports = nextConfig;
