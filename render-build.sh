#!/bin/bash
# Render用のビルドスクリプト

echo "🔧 Starting Render deployment preparation..."

# パッケージをインストール
npm install

# ビルド実行
npm run build

echo "✅ Build completed successfully!"