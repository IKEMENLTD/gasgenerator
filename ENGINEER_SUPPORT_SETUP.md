# 🚀 エンジニアサポート機能 設定ガイド

このガイドでは、LINE Botにエンジニアサポート機能（人間のエンジニアへの転送機能）を設定する方法を詳しく説明します。

## 📋 目次
1. [概要](#概要)
2. [事前準備](#事前準備)
3. [LINE グループIDの取得](#line-グループidの取得)
4. [エンジニアのユーザーIDの取得](#エンジニアのユーザーidの取得)
5. [環境変数の設定](#環境変数の設定)
6. [動作確認](#動作確認)
7. [トラブルシューティング](#トラブルシューティング)

## 概要

エンジニアサポート機能を使うと：
- ユーザーが「エンジニアに相談」ボタンを押すと、指定したLINEグループに通知が送信されます
- エンジニアチームがリアルタイムでサポートできます
- ユーザーのコンテキスト（生成したコード、エラー内容など）が自動的に共有されます

## 事前準備

### 必要なもの
- [ ] LINE Developers アカウント
- [ ] LINE Botのチャンネル（作成済み）
- [ ] エンジニアサポート用のLINEグループ
- [ ] Renderアカウント（デプロイ先）

### LINEグループの準備
1. LINEアプリで新規グループを作成
2. グループ名を設定（例：「GAS Generator サポート」）
3. エンジニアメンバーを招待
4. **重要**: Botをグループに追加（後述）

## LINE グループIDの取得

### 方法1: Webhookログから取得（推奨）

#### ステップ1: デバッグコードを追加

```typescript
// app/api/webhook/route.ts の processTextMessage関数内に追加

async function processTextMessage(event: any, requestId: string): Promise<boolean> {
  const userId = event.source?.userId
  const messageText = event.message?.text?.trim() || ''
  const replyToken = event.replyToken
  
  // 🔍 デバッグコード追加（ここから）
  console.log('=== DEBUG: Event Source Info ===')
  console.log('Source Type:', event.source?.type)
  console.log('User ID:', event.source?.userId)
  console.log('Group ID:', event.source?.groupId)
  console.log('Room ID:', event.source?.roomId)
  console.log('Message:', messageText)
  console.log('================================')
  
  // グループIDを含むメッセージを返信（グループ内でのみ）
  if (event.source?.type === 'group' && messageText === 'グループID確認') {
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: `📍 グループID: ${event.source.groupId}\n\nこのIDを環境変数 ENGINEER_SUPPORT_GROUP_ID に設定してください。`
    }])
    return true
  }
  // 🔍 デバッグコード追加（ここまで）
  
  // 以下、既存のコード...
}
```

#### ステップ2: デプロイして確認

1. コードをGitHubにプッシュ
2. Renderで自動デプロイを待つ
3. LINEグループにBotを招待
4. グループ内で「グループID確認」と送信
5. BotがグループIDを返信

#### ステップ3: Renderログから確認

Renderのダッシュボードで：
1. **Logs** タブを開く
2. 以下のようなログを探す：
```
=== DEBUG: Event Source Info ===
Source Type: group
User ID: U1234567890abcdef
Group ID: C9876543210fedcba  ← これがグループID
Room ID: null
Message: グループID確認
================================
```

### 方法2: LINE Official Account Managerから確認

1. [LINE Official Account Manager](https://manager.line.biz/)にログイン
2. 対象のBotチャンネルを選択
3. **チャット** → **グループチャット** を確認
4. グループIDが表示される場合があります（権限による）

## エンジニアのユーザーIDの取得

### ステップ1: 個別メッセージでID取得

#### デバッグコード（既に追加済みの場合はスキップ）
上記のデバッグコードがあれば、個人チャットでもIDが取得できます。

#### 手順
1. エンジニアがBotに個別でメッセージを送信
2. Renderログを確認：
```
=== DEBUG: Event Source Info ===
Source Type: user
User ID: Uabc123def456ghi789  ← これがユーザーID
Group ID: null
Room ID: null
Message: こんにちは
================================
```

### ステップ2: 複数のエンジニアIDを収集

各エンジニアに以下の手順を実施してもらう：
1. Botとの個人チャットを開始
2. 「ID確認」などのメッセージを送信
3. ログからUser IDを記録

## 環境変数の設定

### Renderでの設定手順

#### 1. Renderダッシュボードにログイン
[https://dashboard.render.com](https://dashboard.render.com)

#### 2. 対象のサービスを選択
「gas-generator」などのサービス名をクリック

#### 3. Environment タブを開く
左側のメニューから「Environment」を選択

#### 4. 環境変数を追加

**Add Environment Variable** をクリックして以下を追加：

| Key | Value | 説明 |
|-----|-------|------|
| `ENGINEER_SUPPORT_GROUP_ID` | `C9876543210fedcba` | LINEグループのID（必須） |
| `ENGINEER_USER_IDS` | `Uabc123,Udef456,Ughi789` | エンジニアのID（カンマ区切り、オプション） |
| `ADMIN_DASHBOARD_URL` | `https://admin.yourdomain.com` | 管理画面URL（オプション） |

#### 5. 保存とデプロイ
**Save Changes** をクリック → 自動的に再デプロイされます

### 環境変数の詳細説明

#### ENGINEER_SUPPORT_GROUP_ID（必須）
```bash
ENGINEER_SUPPORT_GROUP_ID=C9876543210fedcba
```
- **用途**: サポートリクエストの通知先グループ
- **形式**: `C`で始まる文字列
- **取得方法**: 上記の「LINE グループIDの取得」参照

#### ENGINEER_USER_IDS（オプション）
```bash
ENGINEER_USER_IDS=Uabc123def456,Udef456ghi789,Ughi789jkl012
```
- **用途**: 緊急時に個別通知を送るエンジニアのリスト
- **形式**: `U`で始まる文字列をカンマ区切り
- **動作**: 「緊急」「エラー」などのキーワードを検出時に個別通知

#### ADMIN_DASHBOARD_URL（オプション）
```bash
ADMIN_DASHBOARD_URL=https://admin.yourdomain.com
# または空欄
ADMIN_DASHBOARD_URL=
```
- **用途**: 通知メッセージ内に管理画面へのリンクを含める
- **形式**: 完全なURL
- **省略時**: リンクボタンが表示されない

## 動作確認

### 1. 基本動作テスト

1. LINEでBotとの個人チャットを開く
2. 「エンジニアに相談」と送信
3. 以下を確認：
   - ユーザーに確認メッセージが返信される
   - エンジニアグループに通知が送信される

### 2. 通知内容の確認

エンジニアグループに以下のような通知が届くことを確認：

```
🆘 サポートリクエスト

👤 ユーザー: 山田太郎
🆔 ID: U1234567890
📅 時刻: 2025/09/08 18:30

💬 相談内容:
コードが動きません

⚠️ エラー:
TypeError: Cannot read property...

対応お願いします！
```

### 3. ボタン動作確認

通知メッセージのボタンが機能することを確認：
- ✅ 対応開始
- 📝 メモ追加
- 📊 ユーザー履歴確認（ADMIN_DASHBOARD_URL設定時）

## トラブルシューティング

### グループに通知が届かない

#### 確認事項
- [ ] Botがグループに参加している
- [ ] ENGINEER_SUPPORT_GROUP_IDが正しく設定されている
- [ ] Renderで環境変数が保存されている
- [ ] 再デプロイが完了している

#### 解決方法
1. Renderログでエラーを確認
2. グループIDを再取得して設定し直す
3. Botをグループから削除して再度招待

### 個別通知が届かない

#### 確認事項
- [ ] ENGINEER_USER_IDSが正しく設定されている
- [ ] カンマ区切りでスペースが入っていない
- [ ] ユーザーIDが正しい（Uで始まる）

#### 解決方法
```bash
# 正しい形式
ENGINEER_USER_IDS=Uabc123,Udef456,Ughi789

# 間違った形式（スペースあり）
ENGINEER_USER_IDS=Uabc123, Udef456, Ughi789
```

### エラーメッセージ: "Unauthorized engineer"

#### 原因
エンジニア以外のユーザーが返信機能を使おうとしている

#### 解決方法
ENGINEER_USER_IDSに該当ユーザーのIDを追加

## セキュリティ考慮事項

### 1. グループのプライバシー設定
- グループを「非公開」に設定
- メンバーの追加は管理者のみ可能に

### 2. 個人情報の取り扱い
- ユーザーIDは個人を特定できないハッシュ値
- 実名は表示名から取得（ユーザーが設定したもの）
- センシティブな情報は自動的にマスク処理

### 3. アクセス制御
- エンジニアのみが返信機能を使用可能
- 環境変数で明示的に許可されたユーザーのみ

## よくある質問

### Q: グループIDとユーザーIDは公開しても大丈夫？
**A**: いいえ。これらのIDは秘密情報として扱ってください。GitHubなどに公開しないよう注意。

### Q: エンジニアが退職した場合は？
**A**: ENGINEER_USER_IDSから該当IDを削除して再デプロイしてください。

### Q: 複数のグループに通知を送りたい
**A**: 現在の実装では1グループのみ対応。複数グループ対応が必要な場合はコードの修正が必要です。

### Q: 通知を一時的に止めたい
**A**: ENGINEER_SUPPORT_GROUP_IDを空欄にして再デプロイすると機能が無効化されます。

### Q: ユーザーの過去の履歴を見たい
**A**: ADMIN_DASHBOARD_URLに管理画面のURLを設定すると、通知メッセージから直接アクセスできます。

## サポート

設定で困った場合は：
1. Renderのログを確認
2. このドキュメントのトラブルシューティングを参照
3. GitHubでIssueを作成

---

最終更新: 2025/09/08
バージョン: 1.0.0