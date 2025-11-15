export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-800 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span>Built by</span>
            <a
              href="https://linkedin.com/in/adamwolfers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              Adam Wolfers
            </a>
            <span>&</span>
            <a
              href="https://claude.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              Claude Code
            </a>
          </div>
          <div className="text-gray-500 text-xs">
            Track your daily habits and build lasting streaks
          </div>
        </div>
      </div>
    </footer>
  );
}
