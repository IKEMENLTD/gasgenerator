# 🔧 エンジニアサポート機能の設定手順

## 現在の状況
✅ コード実装完了
✅ トリガー実装済み（「エンジニアへの相談」で動作）
❌ 環境変数未設定のため**通知が送られていません**

## 必要な設定

### 1. LINE グループIDの取得
エンジニアチーム用のLINEグループを作成し、グループIDを取得します。

```bash
# グループIDの取得方法
1. BOTをグループに招待
2. グループでメッセージを送信
3. Webhook受信時のログでgroupIdを確認
```

### 2. 個別エンジニアのLINE IDを取得
```bash
# ユーザーIDの取得方法
1. 各エンジニアがBOTに個別メッセージを送信
2. Webhook受信時のログでuserIdを確認
```

### 3. 環境変数の設定

#### ローカル環境 (.env.local)
```env
# Engineer Support Settings
ENGINEER_SUPPORT_GROUP_ID=Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # グループID
ENGINEER_USER_IDS=Uxxxxx1,Uxxxxx2,Uxxxxx3                   # エンジニアID（カンマ区切り）
ADMIN_DASHBOARD_URL=https://your-admin-dashboard.com        # 管理画面URL
```

#### Render.com 環境変数
1. Render.com ダッシュボード → Environment
2. 以下を追加：
   - `ENGINEER_SUPPORT_GROUP_ID`: グループID
   - `ENGINEER_USER_IDS`: エンジニアID（カンマ区切り）
   - `ADMIN_DASHBOARD_URL`: 管理画面URL

## 動作フロー

### ユーザーが「エンジニアへの相談」と送信した場合

1. **即座にユーザーへ返信**
   ```
   👨‍💻 エンジニアへの相談を受け付けました！
   
   弊社のエンジニアチームに通知を送信しました。
   営業時間内（平日9:00-18:00）であれば、30分以内に返信させていただきます。
   
   しばらくお待ちください。
   ```

2. **エンジニアグループへ通知**
   ```
   🆘 サポートリクエスト
   
   👤 ユーザー: [ユーザー名]
   🆔 ID: [ユーザーID]
   📅 時刻: [送信時刻]
   
   💬 相談内容:
   [ユーザーのメッセージ]
   
   対応お願いします！
   ```

3. **緊急時は個別通知も送信**
   - キーワード: 緊急、エラー、動かない、助けて、バグ、本番、production
   - 該当する場合、全エンジニアに個別通知

## 確認方法

### 1. 環境変数が設定されているか確認
```typescript
// /app/api/debug/route.ts で確認可能
console.log({
  groupId: process.env.ENGINEER_SUPPORT_GROUP_ID,
  engineerIds: process.env.ENGINEER_USER_IDS,
  hasGroupId: !!process.env.ENGINEER_SUPPORT_GROUP_ID,
  engineerCount: (process.env.ENGINEER_USER_IDS || '').split(',').filter(id => id).length
})
```

### 2. テスト送信
LINEで以下を送信：
- 「エンジニアへの相談したい」
- 「人間に相談」
- 「エンジニアへの相談 緊急！システムエラーが発生」

### 3. ログ確認
```bash
# Render.com のログで確認
"Engineer support request created" # 成功時
"Failed to handle support request" # エラー時
```

## トラブルシューティング

### 通知が届かない場合

1. **環境変数の確認**
   - Render.com で環境変数が設定されているか
   - グループID/ユーザーIDの形式が正しいか

2. **BOTの権限確認**
   - BOTがグループに参加しているか
   - Push Message APIが有効か

3. **エラーログ確認**
   ```sql
   -- Supabase SQLエディタで実行
   SELECT * FROM error_logs 
   WHERE error_message LIKE '%engineer%' 
   ORDER BY created_at DESC;
   ```

## 必要なデータベーステーブル

support_requests テーブルが必要です：

```sql
-- まだ作成していない場合は実行
CREATE TABLE IF NOT EXISTS support_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending',
  engineer_id VARCHAR(255),
  response TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_requests_user_id ON support_requests(user_id);
CREATE INDEX idx_support_requests_status ON support_requests(status);
```

## 実装済み機能

✅ サポートリクエスト受付
✅ エンジニアグループへの通知
✅ 緊急度判定と個別通知
✅ ユーザーコンテキスト（最新コード、エラー）の共有
✅ データベースへの記録
✅ エンジニアからの返信機能

## 現在の問題点

⚠️ **環境変数が未設定のため、通知機能が動作していません**

必要なアクション：
1. LINEグループを作成し、BOTを招待
2. グループIDを取得
3. エンジニアのユーザーIDを取得
4. 環境変数を設定（ローカル + Render.com）
5. デプロイして動作確認