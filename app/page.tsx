export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          🤖 GAS自動生成システム
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          LINEでGoogle Apps Scriptを簡単生成！
        </p>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h2 className="font-semibold">📱 LINEで話しかけるだけ</h2>
            <p className="text-gray-600">自然言語でやりたいことを説明</p>
          </div>
          <div className="p-4 border rounded-lg">
            <h2 className="font-semibold">🔄 自動でコード生成</h2>
            <p className="text-gray-600">AIが最適なGASコードを作成</p>
          </div>
          <div className="p-4 border rounded-lg">
            <h2 className="font-semibold">📊 すぐに使える</h2>
            <p className="text-gray-600">コピペするだけで動作開始</p>
          </div>
        </div>
      </div>
    </main>
  )
}