# 🚀 データベースマイグレーション実行ガイド

## 🔴 重要：今すぐ実行してください

### 手順1: Supabase Dashboard にアクセス
1. https://app.supabase.com にアクセス
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択

### 手順2: SQLを実行
1. 新しいクエリタブを開く
2. `apply-migrations.sql` の内容をコピー
3. SQL Editorに貼り付け
4. 「Run」ボタンをクリック

### 手順3: 確認
実行後、以下のメッセージが表示されれば成功：
```
✅ マイグレーション完了！
- users: payment_start_date, line_user_id追加
- requirement_extractions: AI要件抽出履歴テーブル作成
- code_quality_checks: 品質チェックテーブル作成
- インデックス: パフォーマンス改善
- ビュー: 統計ビュー作成
```

## 📊 変更内容

### 1. **usersテーブル更新**
- `payment_start_date`: 決済日ベースの月次更新用
- `last_reset_month`: 何ヶ月目かを記録
- `line_user_id`: LINE IDを正式なカラムに
- `ai_preference`: AI応答スタイル設定

### 2. **新規テーブル**
- `requirement_extractions`: AI要件抽出の履歴
- `code_quality_checks`: コード品質チェック結果

### 3. **パフォーマンス改善**
- 8個の新しいインデックス追加
- 2つの統計ビュー作成

## ⚠️ トラブルシューティング

### エラー: "column already exists"
→ 既に適用済みです。無視してOK

### エラー: "permission denied"
→ Supabase Dashboardの「Database」→「Roles」で権限確認

### エラー: "syntax error"
→ PostgreSQLバージョンが古い可能性。サポートに連絡

## ✅ 確認方法

SQLエディタで実行：
```sql
-- 新しいカラムの確認
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('payment_start_date', 'line_user_id');

-- 新しいテーブルの確認
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('requirement_extractions', 'code_quality_checks');
```

## 🎉 完了後

マイグレーション完了後は：
1. アプリを再起動
2. AI要件抽出が自動的に有効化
3. プレミアム会員の月次更新が決済日ベースに

---

**問題があれば、このファイルとエラーメッセージをスクショして報告してください。**