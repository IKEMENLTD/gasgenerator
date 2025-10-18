# 4段階代理店制度 - 擬似コード実装

## 1. 代理店登録処理関数

### 擬似コード

```python
function register_agent(
    new_tracking_code: string,
    parent_code: string or null,
    company_name: string,
    agency_name: string,
    contact_email: string,
    contact_phone: string,
    address: string
) -> Agent:
    """
    新規代理店を登録し、階層構造を構築する

    Args:
        new_tracking_code: 新規代理店の招待コード（UNIQUE）
        parent_code: 親代理店の招待コード（1次代理店の場合はnull）
        company_name: 会社名
        agency_name: 代理店名
        contact_email: 連絡先メールアドレス
        contact_phone: 電話番号
        address: 住所

    Returns:
        Agent: 登録された代理店オブジェクト

    Raises:
        ValidationError: バリデーションエラー
        MaxLevelError: 最大階層（4次）を超える場合
    """

    # STEP 1: 親代理店の取得と検証
    if parent_code is null or parent_code == "ROOT":
        # 1次代理店として登録
        parent_agent = null
        new_level = 1
        new_commission_rate = 20.00
    else:
        # 親代理店を検索
        parent_agent = db.query(
            "SELECT id, level, own_commission_rate, is_active, status
             FROM agencies
             WHERE code = ?",
            [parent_code]
        ).first()

        # 親代理店が見つからない場合
        if parent_agent is null:
            raise ValidationError("招待コードが無効です。正しい招待コードを入力してください。")

        # 親代理店が無効化されている場合
        if not parent_agent.is_active or parent_agent.status != 'active':
            raise ValidationError("この招待コードは現在使用できません。代理店にお問い合わせください。")

        # 最大階層チェック（4次代理店はさらに招待できない）
        if parent_agent.level >= 4:
            raise MaxLevelError("これ以上下位の代理店を招待することはできません（最大4階層）。")

        # 新規代理店の階層とコミッション率を決定
        new_level = parent_agent.level + 1
        new_commission_rate = get_standard_commission_rate(new_level)

    # STEP 2: 招待コードの重複チェック
    existing_agent = db.query(
        "SELECT id FROM agencies WHERE code = ?",
        [new_tracking_code]
    ).first()

    if existing_agent is not null:
        raise ValidationError("この招待コードは既に使用されています。別のコードを使用してください。")

    # STEP 3: メールアドレスの重複チェック
    existing_email = db.query(
        "SELECT id FROM agencies WHERE contact_email = ?",
        [contact_email]
    ).first()

    if existing_email is not null:
        raise ValidationError("このメールアドレスは既に登録されています。")

    # STEP 4: 新規代理店レコードの作成
    new_agent = db.insert(
        "agencies",
        {
            "code": new_tracking_code,
            "name": agency_name,
            "company_name": company_name,
            "contact_email": contact_email,
            "contact_phone": contact_phone,
            "address": address,
            "parent_agency_id": parent_agent.id if parent_agent else null,
            "level": new_level,
            "own_commission_rate": new_commission_rate,
            "status": "active",
            "created_at": NOW()
        }
    )

    # STEP 5: ログ出力
    log.info(f"新規代理店登録成功: ID={new_agent.id}, Level={new_level}, Rate={new_commission_rate}%")

    if parent_agent:
        log.info(f"親代理店: ID={parent_agent.id}, Level={parent_agent.level}")

    # STEP 6: 登録完了オブジェクトを返す
    return new_agent

end function


# ヘルパー関数: 階層に応じた標準報酬率を返す
function get_standard_commission_rate(level: int) -> float:
    """
    階層レベルに基づいて標準報酬率を返す

    Level 1: 20.0%
    Level 2: 18.0%
    Level 3: 16.0%
    Level 4: 14.0%
    """
    commission_rates = {
        1: 20.00,
        2: 18.00,
        3: 16.00,
        4: 14.00
    }

    return commission_rates.get(level, 20.00)  # デフォルト20%
end function
```

---

## 2. コミッション計算関数

### 擬似コード

```python
function calculate_commissions(
    deal_amount: float,
    closing_agency_id: uuid,
    conversion_id: uuid
) -> CommissionResult:
    """
    案件成約時のコミッションを計算し、全ての関連代理店に分配する

    Args:
        deal_amount: 案件総額（円）
        closing_agency_id: 成約させた代理店のID
        conversion_id: コンバージョン記録のID

    Returns:
        CommissionResult: {
            total_commission: 総報酬額,
            distributions: [報酬分配リスト]
        }

    Raises:
        ValidationError: バリデーションエラー
        AgencyNotFoundError: 代理店が見つからない
    """

    # STEP 1: バリデーション
    if deal_amount <= 0:
        raise ValidationError("案件総額は正の数値である必要があります")

    # STEP 2: 成約代理店の情報を取得
    closing_agent = db.query(
        "SELECT id, level, own_commission_rate, parent_agency_id, name
         FROM agencies
         WHERE id = ? AND is_active = true",
        [closing_agency_id]
    ).first()

    if closing_agent is null:
        raise AgencyNotFoundError("成約代理店が見つかりません")

    # STEP 3: 報酬分配リストの初期化
    distributions = []
    total_commission = 0

    # STEP 4: 成約代理店自身の報酬計算（自己報酬）
    own_commission_amount = deal_amount * (closing_agent.own_commission_rate / 100)
    total_commission += own_commission_amount

    distributions.append({
        "agency_id": closing_agent.id,
        "agency_name": closing_agent.name,
        "agency_level": closing_agent.level,
        "commission_type": "own",
        "commission_rate": closing_agent.own_commission_rate,
        "commission_amount": own_commission_amount,
        "deal_amount": deal_amount
    })

    log.info(f"成約代理店: {closing_agent.name} (Level {closing_agent.level})")
    log.info(f"自己報酬: ¥{own_commission_amount:,.0f} ({closing_agent.own_commission_rate}%)")

    # STEP 5: 上位代理店へのリファラルコミッション計算
    current_agency = closing_agent
    referral_rate = 2.00  # 固定2%

    while current_agency.parent_agency_id is not null:
        # 親代理店の情報を取得
        parent_agent = db.query(
            "SELECT id, level, parent_agency_id, name
             FROM agencies
             WHERE id = ? AND is_active = true",
            [current_agency.parent_agency_id]
        ).first()

        if parent_agent is null:
            # 親代理店が見つからない、または無効化されている場合
            log.warning(f"親代理店が見つかりません: ID={current_agency.parent_agency_id}")
            break

        # リファラルコミッション計算
        referral_commission_amount = deal_amount * (referral_rate / 100)
        total_commission += referral_commission_amount

        distributions.append({
            "agency_id": parent_agent.id,
            "agency_name": parent_agent.name,
            "agency_level": parent_agent.level,
            "commission_type": "referral",
            "commission_rate": referral_rate,
            "commission_amount": referral_commission_amount,
            "deal_amount": deal_amount
        })

        log.info(f"リファラル報酬: {parent_agent.name} (Level {parent_agent.level})")
        log.info(f"報酬額: ¥{referral_commission_amount:,.0f} ({referral_rate}%)")

        # 次の親へ
        current_agency = parent_agent

        # 安全対策: 無限ループ防止（最大4階層）
        if len(distributions) > 10:
            log.error("階層が深すぎます。処理を中断します。")
            break

    # STEP 6: データベースに報酬分配記録を保存
    for distribution in distributions:
        db.insert(
            "agency_commission_distributions",
            {
                "conversion_id": conversion_id,
                "agency_id": distribution["agency_id"],
                "closing_agency_id": closing_agency_id,
                "deal_amount": deal_amount,
                "commission_type": distribution["commission_type"],
                "commission_rate": distribution["commission_rate"],
                "commission_amount": distribution["commission_amount"],
                "agency_level": distribution["agency_level"],
                "payment_status": "pending",
                "created_at": NOW()
            }
        )

    # STEP 7: 結果を返す
    result = {
        "success": true,
        "total_commission": total_commission,
        "distributions": distributions,
        "closing_agency": {
            "id": closing_agent.id,
            "name": closing_agent.name,
            "level": closing_agent.level
        }
    }

    log.info(f"コミッション計算完了: 総額 ¥{total_commission:,.0f}")

    return result

end function
```

---

## 3. 使用例

### 3.1 代理店登録の例

```python
# 例1: 1次代理店の登録
agent_1 = register_agent(
    new_tracking_code="AG1234ABCD",
    parent_code=null,  # 1次代理店なので親なし
    company_name="株式会社A",
    agency_name="A代理店",
    contact_email="a@example.com",
    contact_phone="090-1111-1111",
    address="東京都..."
)
# 結果: level=1, own_commission_rate=20.0%


# 例2: 2次代理店の登録（1次代理店から招待）
agent_2 = register_agent(
    new_tracking_code="AG5678EFGH",
    parent_code="AG1234ABCD",  # 1次代理店の招待コード
    company_name="株式会社B",
    agency_name="B代理店",
    contact_email="b@example.com",
    contact_phone="090-2222-2222",
    address="大阪府..."
)
# 結果: level=2, own_commission_rate=18.0%, parent_agency_id=agent_1.id


# 例3: 3次代理店の登録（2次代理店から招待）
agent_3 = register_agent(
    new_tracking_code="AG9999IJKL",
    parent_code="AG5678EFGH",  # 2次代理店の招待コード
    company_name="株式会社C",
    agency_name="C代理店",
    contact_email="c@example.com",
    contact_phone="090-3333-3333",
    address="福岡県..."
)
# 結果: level=3, own_commission_rate=16.0%, parent_agency_id=agent_2.id
```

### 3.2 コミッション計算の例

```python
# 4次代理店が¥100,000の案件を成約した場合
result = calculate_commissions(
    deal_amount=100000,
    closing_agency_id="uuid-of-4th-agent",
    conversion_id="uuid-of-conversion"
)

# 結果:
# {
#   "total_commission": 20000,
#   "distributions": [
#     {
#       "agency_name": "4次代理店",
#       "commission_type": "own",
#       "commission_rate": 14.0,
#       "commission_amount": 14000  # ¥100,000 × 14%
#     },
#     {
#       "agency_name": "3次代理店（親）",
#       "commission_type": "referral",
#       "commission_rate": 2.0,
#       "commission_amount": 2000  # ¥100,000 × 2%
#     },
#     {
#       "agency_name": "2次代理店（祖父）",
#       "commission_type": "referral",
#       "commission_rate": 2.0,
#       "commission_amount": 2000  # ¥100,000 × 2%
#     },
#     {
#       "agency_name": "1次代理店（曾祖父）",
#       "commission_type": "referral",
#       "commission_rate": 2.0,
#       "commission_amount": 2000  # ¥100,000 × 2%
#     }
#   ]
# }
```

---

## 4. データ構造

### Agent オブジェクト
```python
class Agent:
    id: UUID
    code: string  # 招待コード
    name: string
    company_name: string
    contact_email: string
    contact_phone: string
    address: string
    parent_agency_id: UUID or null
    level: int  # 1, 2, 3, 4
    own_commission_rate: float  # 20.0, 18.0, 16.0, 14.0
    status: string  # 'active', 'inactive', 'suspended'
    created_at: datetime
```

### CommissionDistribution オブジェクト
```python
class CommissionDistribution:
    id: UUID
    conversion_id: UUID
    agency_id: UUID
    closing_agency_id: UUID
    deal_amount: float
    commission_type: string  # 'own' or 'referral'
    commission_rate: float
    commission_amount: float
    agency_level: int
    payment_status: string  # 'pending', 'approved', 'paid', 'cancelled'
    created_at: datetime
```
