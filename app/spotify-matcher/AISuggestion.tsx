'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
import type { Song } from '@/lib/schema'
import type { MetadataFix } from '@/lib/ai-metadata-fixer'
import { getAISuggestionForSong, applyAIFixToSong } from '@/lib/spotify-actions'

interface AISuggestionProps {
  song: Song
  onFixApplied?: (updatedSong: { artist: string; title: string; album: string | null }) => void
}

export function AISuggestion({ song, onFixApplied }: AISuggestionProps) {
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<MetadataFix | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchSuggestion() {
    setLoading(true)
    setError(null)

    try {
      const result = await getAISuggestionForSong(song.id)

      if (!result.success) {
        setError(result.error)
        setLoading(false)
        return
      }

      setSuggestion(result.suggestion)
    } catch (err) {
      console.error('Error fetching AI suggestion:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function applyFix() {
    if (!suggestion) return

    setApplying(true)

    try {
      const result = await applyAIFixToSong(song.id, suggestion)

      if (!result.success) {
        alert(`Error: ${result.error}`)
        setApplying(false)
        return
      }

      // Close the suggestion UI and notify parent with updated metadata
      dismiss()
      onFixApplied?.({
        artist: suggestion.suggestedArtist,
        title: suggestion.suggestedTrack,
        album: suggestion.suggestedAlbum || song.album,
      })
    } catch (err) {
      console.error('Error applying AI fix:', err)
      alert('Failed to apply fix')
    } finally {
      setApplying(false)
    }
  }

  function dismiss() {
    setSuggestion(null)
    setError(null)
  }

  // If no suggestion loaded yet, show the trigger button
  if (!suggestion && !loading && !error) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={fetchSuggestion}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        AI Fix
      </Button>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Analyzing...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
        <p className="text-red-700">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismiss}
          className="mt-2"
        >
          Dismiss
        </Button>
      </div>
    )
  }

  // Show suggestion
  if (suggestion) {
    const hasChanges =
      suggestion.suggestedArtist !== song.artist ||
      suggestion.suggestedTrack !== song.title ||
      (suggestion.suggestedAlbum && suggestion.suggestedAlbum !== song.album)

    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
        {/* Confidence Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">
              AI Suggestion
            </span>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded ${
              suggestion.confidence === 'high'
                ? 'bg-green-100 text-green-700'
                : suggestion.confidence === 'medium'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-orange-100 text-orange-700'
            }`}
          >
            {suggestion.confidence} confidence
          </span>
        </div>

        {/* Suggested Changes */}
        {hasChanges && (
          <div className="space-y-2 text-sm">
            {suggestion.suggestedArtist !== song.artist && (
              <div>
                <p className="text-muted-foreground">Artist:</p>
                <p className="line-through text-red-600">{song.artist}</p>
                <p className="text-green-700 font-medium">
                  {suggestion.suggestedArtist}
                </p>
              </div>
            )}

            {suggestion.suggestedTrack !== song.title && (
              <div>
                <p className="text-muted-foreground">Track:</p>
                <p className="line-through text-red-600">{song.title}</p>
                <p className="text-green-700 font-medium">
                  {suggestion.suggestedTrack}
                </p>
              </div>
            )}

            {suggestion.suggestedAlbum && suggestion.suggestedAlbum !== song.album && (
              <div>
                <p className="text-muted-foreground">Album:</p>
                <p className="line-through text-red-600">{song.album}</p>
                <p className="text-green-700 font-medium">
                  {suggestion.suggestedAlbum}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Reasoning */}
        <p className="text-sm text-blue-800 italic">
          {suggestion.reasoning}
        </p>

        {/* Alternative Queries */}
        {suggestion.alternativeSearchQueries.length > 0 && (
          <div className="text-xs">
            <p className="text-muted-foreground mb-1">Alternative searches:</p>
            <div className="flex flex-wrap gap-1">
              {suggestion.alternativeSearchQueries.map((query, i) => (
                <span
                  key={i}
                  className="bg-white px-2 py-1 rounded border border-blue-200 text-blue-700"
                >
                  {query}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={applyFix}
            disabled={applying || !hasChanges}
            className="flex-1"
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Applying...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Apply Fix
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={dismiss}
            disabled={applying}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return null
}
