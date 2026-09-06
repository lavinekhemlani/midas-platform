export default function TestingThemingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Testing Tailwind dark: Prefix
      </h1>

      <div className="space-y-6">
        {/* Background colors */}
        <section className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Background Colors
          </h2>
          <div className="flex gap-4 flex-wrap">
            <div className="w-24 h-24 rounded bg-blue-500 dark:bg-blue-700 flex items-center justify-center text-white text-xs">
              blue-500 / dark:blue-700
            </div>
            <div className="w-24 h-24 rounded bg-green-500 dark:bg-green-700 flex items-center justify-center text-white text-xs">
              green-500 / dark:green-700
            </div>
            <div className="w-24 h-24 rounded bg-red-500 dark:bg-red-700 flex items-center justify-center text-white text-xs">
              red-500 / dark:red-700
            </div>
          </div>
        </section>

        {/* Text colors */}
        <section className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Text Colors
          </h2>
          <p className="text-gray-900 dark:text-gray-100">
            This text is gray-900 in light mode, gray-100 in dark mode.
          </p>
          <p className="text-blue-600 dark:text-blue-400">
            This text is blue-600 in light mode, blue-400 in dark mode.
          </p>
          <p className="text-green-600 dark:text-green-400">
            This text is green-600 in light mode, green-400 in dark mode.
          </p>
        </section>

        {/* Borders */}
        <section className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Borders</h2>
          <div className="flex gap-4 flex-wrap">
            <div className="w-24 h-24 rounded border-4 border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs">
              gray border
            </div>
            <div className="w-24 h-24 rounded border-4 border-blue-500 dark:border-blue-300 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs">
              blue border
            </div>
          </div>
        </section>

        {/* Shadows */}
        <section className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Shadows & Effects
          </h2>
          <div className="flex gap-4 flex-wrap">
            <div className="w-32 h-24 rounded bg-white dark:bg-gray-700 shadow-lg dark:shadow-gray-900/50 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs">
              shadow-lg
            </div>
            <div className="w-32 h-24 rounded bg-white dark:bg-gray-700 shadow-xl dark:shadow-blue-500/20 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs">
              colored shadow
            </div>
          </div>
        </section>

        {/* Hover states */}
        <section className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Hover States (hover over buttons)
          </h2>
          <div className="flex gap-4 flex-wrap">
            <button className="px-4 py-2 rounded bg-blue-500 dark:bg-blue-700 hover:bg-blue-600 dark:hover:bg-blue-500 text-white transition-colors">
              Hover me
            </button>
            <button className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 transition-colors">
              Hover me too
            </button>
          </div>
        </section>

        {/* Ring / Focus states */}
        <section className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Focus States (click to focus)
          </h2>
          <input
            type="text"
            placeholder="Focus me..."
            className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none"
          />
        </section>

        {/* Status indicator */}
        <section className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Status Check
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            If the <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">dark:</code> prefix
            is working:
          </p>
          <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300">
            <li>
              In <strong>light mode</strong>: backgrounds should be light gray/white
            </li>
            <li>
              In <strong>dark mode</strong>: backgrounds should be dark gray
            </li>
            <li>Colors should shift appropriately between modes</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
