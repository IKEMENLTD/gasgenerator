#!/bin/bash

echo "🔨 最終的な型エラー修正スクリプト"
echo "================================"

# 1. app/api/webhook/route.ts から as any を削除
echo "📝 app/api/webhook/route.ts を修正中..."
sed -i 's/\] as any)/])/g' app/api/webhook/route.ts

# 2. lib/conversation/flow-manager.ts から as any を削除
echo "📝 lib/conversation/flow-manager.ts を修正中..."
sed -i 's/\] as any)/])/g' lib/conversation/flow-manager.ts

# 3. lib/queue/processor.ts の修正
echo "📝 lib/queue/processor.ts を修正中..."
sed -i 's/messages as any/messages/g' lib/queue/processor.ts

# 4. 重複した as any を削除
echo "🧹 重複した as any を削除中..."
find . -name "*.ts" -type f ! -path "./node_modules/*" -exec sed -i 's/as any as any/as any/g' {} \;

echo "✅ 修正完了！"
echo ""
echo "📦 ビルドテスト実行中..."
npm run build