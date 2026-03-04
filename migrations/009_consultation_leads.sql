-- Haiku相談モード リードデータテーブル
-- LINE Bot でのAI相談結果を保存し、営業フォローに活用する

CREATE TABLE IF NOT EXISTS consultation_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  line_user_id TEXT NOT NULL,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT '新規' CHECK (status IN ('新規', 'ヒアリング中', '商談中', '要フォロー')),
  lead_score INTEGER DEFAULT 0,
  lead_rank TEXT DEFAULT 'C' CHECK (lead_rank IN ('S', 'A', 'B', 'C')),
  name TEXT DEFAULT '',
  company TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  revenue TEXT DEFAULT '',
  employees TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  challenges TEXT DEFAULT '',
  recommended_systems JSONB,
  budget TEXT DEFAULT '',
  timeline TEXT DEFAULT '',
  message_count INTEGER DEFAULT 0,
  conversation_log TEXT DEFAULT '',
  notified_at TIMESTAMPTZ
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_consultation_leads_line_user ON consultation_leads(line_user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_leads_rank ON consultation_leads(lead_rank);
CREATE INDEX IF NOT EXISTS idx_consultation_leads_created ON consultation_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultation_leads_company ON consultation_leads(company) WHERE company != '';

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_consultation_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consultation_leads_updated_at ON consultation_leads;
CREATE TRIGGER trg_consultation_leads_updated_at
  BEFORE UPDATE ON consultation_leads
  FOR EACH ROW EXECUTE FUNCTION update_consultation_leads_updated_at();
