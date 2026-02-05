import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900">Qartuli Vici Admin</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4">
        <Routes>
          <Route
            path="/"
            element={
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
                <p className="text-gray-600">Admin panel is under construction.</p>
                <p className="text-gray-500 mt-2 text-sm">
                  This will include user management, word collections, quiz analytics, and more.
                </p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
