// キュー処理の修正

// 1. app/api/webhook/route.ts の修正
// ジョブをキューに入れた後、すぐに処理を開始
export async function POST(request: Request) {
  // ... 既存のコード ...
  
  // ジョブをキューに追加
  const job = await QueueQueries.addJob({
    userId,
    category,
    requestText,
    priority: 0
  });
  
  // ローディングメッセージを送信
  await sendLoadingMessage(userId);
  
  // 【重要】すぐに処理を開始（キューを待たない）
  setTimeout(async () => {
    try {
      // 直接処理を実行
      await processJob(job);
    } catch (error) {
      logger.error('Job processing failed', { error, jobId: job.id });
      await sendErrorMessage(userId, 'コード生成に失敗しました。もう一度お試しください。');
    }
  }, 1000); // 1秒後に処理開始
  
  return NextResponse.json({ success: true });
}

// 2. lib/queue/queue-processor.ts の追加
export class QueueProcessor {
  static async processJob(job: any) {
    const { userId, category, requestText } = job;
    
    try {
      // ステータスを処理中に更新
      await QueueQueries.updateJobStatus(job.id, 'processing');
      
      // コード生成
      const code = await generateGASCode(category, requestText);
      
      // 結果を送信
      await sendCodeToUser(userId, code);
      
      // ステータスを完了に更新
      await QueueQueries.updateJobStatus(job.id, 'completed');
      
    } catch (error) {
      // エラー処理
      await QueueQueries.updateJobStatus(job.id, 'failed');
      throw error;
    }
  }
}

// 3. lib/services/code-generator.ts
async function generateGASCode(category: string, requestText: string): Promise<string> {
  // Claude APIを呼び出し
  const prompt = buildPrompt(category, requestText);
  const response = await claude.complete({
    prompt,
    max_tokens: 2000,
  });
  
  return formatCode(response.completion);
}

// 4. lib/line/message-sender.ts
async function sendCodeToUser(userId: string, code: string) {
  const message = {
    type: 'text',
    text: `✅ コード生成完了！\n\n${code}\n\n📝 このコードをGoogle Apps Scriptにコピーしてください。`
  };
  
  await lineClient.pushMessage(userId, message);
}

// 5. Renderのクーロンジョブ設定を確認
// Render Dashboard > Settings > Cron Jobs
// 以下を設定：
/*
Command: curl -X POST https://gasgenerator.onrender.com/api/cron/process-queue \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
  
Schedule: */1 * * * * (1分ごと)
*/