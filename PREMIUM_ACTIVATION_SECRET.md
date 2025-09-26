# 🔐 TaskMate プレミアムアクティベーション（極秘）

## ⚠️ 警告
**このドキュメントは極秘情報です。絶対に外部に漏らさないでください。**

## 🎯 アクティベーション方法

### 方法1: マスターコード（即時有効化）

以下のマスターコードをLINEで送信すると、即座に10年間のプレミアムプランが有効化されます：

```
TASKMATE_PREMIUM_2024_MASTER_ACTIVATION_6B4E2A9F3D8C1B7E5A2F9D4C8B3E7A1D
```

緊急用コード：
```
EMERGENCY_OVERRIDE_TASKMATE_PREMIUM_ACCESS_9F3E8B2C4A7D1E5B3F9C2A8E4D7B1A6C
```

### 方法2: パターンベースコード

以下の形式でコードを生成して送信：

1. **年間プレミアム（1年）**
   ```
   PREMIUM-ACTIVATE-2024-[32文字のランダム英数字]
   ```
   例: `PREMIUM-ACTIVATE-2024-A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6`

2. **特別アクセス（1年）**
   ```
   TM-SPECIAL-[48文字のランダム英数字]
   ```
   例: `TM-SPECIAL-A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4`

### 方法3: コード生成スクリプト

```bash
# コード生成ツールを実行
node scripts/generate-activation-code.js

# 選択肢：
# 1. マスターコード (10年)
# 2. 年間コード (1年)
# 3. 月間コード (30日)
# 4. テストコード (7日)
# 5. カスタム期間
```

### 方法4: Admin API経由

```bash
# 新しいアクティベーションコード生成
curl -X POST https://[your-domain]/api/admin/premium \
  -H "Authorization: Bearer [ADMIN_API_KEY].[TIMESTAMP].[SIGNATURE]" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "premium",
    "duration": 365
  }'

# 特定ユーザーに直接付与
curl -X PUT https://[your-domain]/api/admin/premium \
  -H "Authorization: Bearer [ADMIN_API_KEY].[TIMESTAMP].[SIGNATURE]" \
  -H "Content-Type: application/json" \
  -d '{
    "lineUserId": "U1234567890abcdef",
    "duration": 365,
    "reason": "special_promotion"
  }'
```

## 🔥 使用手順

1. **LINEで友だち追加**
   - TaskMate公式アカウントを友だち追加

2. **コード送信**
   - 上記のコードをそのままトークで送信
   - 64文字以上のコードは自動的にプレミアム認証として処理

3. **有効化確認**
   - 成功時：プレミアムプラン有効化メッセージが返信される
   - 失敗時：通常のメッセージとして処理（エラーは表示されない）

## 🎁 プレミアム特典

- ✅ 無制限トラッキングリンク作成
- ✅ 高度な分析機能
- ✅ API アクセス
- ✅ 優先サポート
- ✅ カスタムドメイン（マスターコードのみ）
- ✅ ホワイトラベル機能（マスターコードのみ）
- ✅ 専任サポート（マスターコードのみ）

## 📊 データベース確認

```sql
-- プレミアムユーザー一覧
SELECT
  line_user_id,
  is_premium,
  premium_activated_at,
  premium_expires_at,
  premium_features
FROM user_states
WHERE is_premium = true;

-- アクティベーションコード使用履歴
SELECT
  code,
  type,
  used_by,
  used_at,
  metadata
FROM activation_codes
WHERE used = true
ORDER BY used_at DESC;
```

## 🚨 セキュリティ注意事項

1. **マスターコードは絶対に外部に漏らさない**
2. **生成したコードは安全に管理**
3. **不審なアクティベーションは即座に調査**
4. **定期的にコードをローテーション**

## 🔄 コードローテーション

マスターコードを変更する場合：

1. `/lib/premium-handler.ts`の`MASTER_CODES`配列を編集
2. 古いコードを削除
3. 新しいコードを追加
4. デプロイ

```typescript
const MASTER_CODES = [
  'NEW_MASTER_CODE_HERE',
  'EMERGENCY_CODE_HERE'
]
```

## 📞 緊急時連絡先

問題発生時は即座に開発チームに連絡してください。

---

**最終更新日**: 2024年
**機密レベル**: 最高機密