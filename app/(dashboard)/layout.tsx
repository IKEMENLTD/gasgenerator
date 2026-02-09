export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <nav className="bg-white border-b border-gray-200 px-4 py-3 mb-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                        TaskMate
                    </h1>
                    <div className="text-sm text-gray-500">マイページ</div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-4">
                {children}
            </main>
        </div>
    )
}
