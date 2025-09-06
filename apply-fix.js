const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase設定
const supabaseUrl = 'https://ebtcowcgkdurqdqcjrxy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidGNvd2Nna2R1cnFkcWNqcnh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY5MjAxNCwiZXhwIjoyMDcyMjY4MDE0fQ.RSMxrry0nrBDgvZEtc9s1hAFW_ojiiIU8YgACF48cCY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFix() {
  console.log('Starting schema fix...');
  
  try {
    // SQLファイルを読み込み
    const sql = fs.readFileSync('./fix-production-schema.sql', 'utf8');
    
    // SQLを実行（Supabaseではrpc経由でSQLを実行）
    // 注: Supabase Admin APIを使用する必要があるかもしれません
    console.log('Executing SQL migrations...');
    
    // 各SQLコマンドを個別に実行
    const commands = sql.split(';').filter(cmd => cmd.trim() && !cmd.trim().startsWith('--'));
    
    for (const command of commands) {
      if (command.trim()) {
        console.log(`Executing: ${command.substring(0, 50)}...`);
        // Supabaseでは直接SQLを実行できないため、管理コンソールで実行する必要があります
      }
    }
    
    console.log('\n⚠️  重要: 以下の手順でSQLを実行してください：');
    console.log('1. Supabaseダッシュボードにログイン: https://app.supabase.com');
    console.log('2. プロジェクトを選択');
    console.log('3. SQL Editorに移動');
    console.log('4. fix-production-schema.sqlの内容をコピー＆ペースト');
    console.log('5. "Run"をクリックして実行');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

applyFix();