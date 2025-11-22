export interface DebugInfo {
  query: string
  trackCount: number
  topResults: Array<{ name: string; artist: string; album: string }>
}

interface DebugPanelProps {
  debugInfo: DebugInfo | null
}

export function DebugPanel({ debugInfo }: DebugPanelProps) {
  if (!debugInfo) return null

  return (
    <div data-testid="debug-panel" className="mb-8 p-4 border-2 border-yellow-300 rounded-lg bg-yellow-50">
      <h3 className="font-bold text-yellow-900 mb-2">🐛 DEBUG: Spotify Search</h3>
      <div className="text-sm space-y-2">
        <div>
          <span className="font-semibold">Query:</span> <code className="bg-yellow-100 px-1">{debugInfo.query}</code>
        </div>
        <div>
          <span className="font-semibold">Results Found:</span> {debugInfo.trackCount}
        </div>
        {debugInfo.topResults.length > 0 && (
          <div>
            <span className="font-semibold">Top 3 Results:</span>
            <ul className="list-disc ml-6 mt-1">
              {debugInfo.topResults.map((track, idx) => (
                <li key={idx}>
                  <strong>{track.name}</strong> by {track.artist} ({track.album})
                </li>
              ))}
            </ul>
          </div>
        )}
        {debugInfo.trackCount === 0 && (
          <div className="text-red-700 font-semibold">
            ⚠️ NO RESULTS - Search may be too restrictive!
          </div>
        )}
      </div>
    </div>
  )
}
