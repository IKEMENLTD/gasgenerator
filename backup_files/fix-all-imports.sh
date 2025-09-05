#!/bin/bash
echo "🔧 全ての@/libインポートを相対パスに修正中..."

# lib内のファイルを修正
find lib -name "*.ts" -type f | while read file; do
  echo "修正中: $file"
  sed -i "s|from '@/lib/|from '../|g" "$file"
  sed -i "s|from '@/types/|from '../../types/|g" "$file"
done

# 特定のファイルを個別修正
sed -i "s|from '\.\./|from './|g" lib/line/*.ts
sed -i "s|from '\.\./|from './|g" lib/claude/*.ts
sed -i "s|from '\.\./|from './|g" lib/utils/*.ts
sed -i "s|from '\.\./|from './|g" lib/constants/*.ts
sed -i "s|from '\.\./|from './|g" lib/conversation/*.ts
sed -i "s|from '\.\./|from './|g" lib/queue/*.ts
sed -i "s|from '\.\./|from './|g" lib/supabase/*.ts

echo "✅ インポート修正完了"