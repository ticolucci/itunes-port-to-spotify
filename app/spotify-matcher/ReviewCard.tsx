import { Button } from '@/components/ui/button'
import { Loader2, Check, X, Music } from 'lucide-react'
import type { Song } from '@/lib/schema'
import type { SpotifyTrack } from '@/lib/spotify'

interface SongWithMatch {
  dbSong: Song
  spotifyMatch: SpotifyTrack | null
  similarity: number
  isMatched: boolean
  searching: boolean
}

interface ReviewCardProps {
  currentReview: SongWithMatch
  currentIndex: number
  totalCount: number
  isMatching: boolean
  onMatch: (songId: number, spotifyId: string) => void
  onSkip: () => void
}

export function ReviewCard({
  currentReview,
  currentIndex,
  totalCount,
  isMatching,
  onMatch,
  onSkip,
}: ReviewCardProps) {
  if (!currentReview.spotifyMatch || currentReview.isMatched) {
    return null
  }

  return (
    <div data-testid="review-card" className="mb-8 p-8 border-2 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 shadow-lg">
      <div className="text-center mb-6">
        <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium mb-2">
          Quick Review {currentIndex + 1} / {totalCount}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Your Library */}
        <div className="text-center">
          <p className="text-sm font-semibold text-muted-foreground mb-3">
            Your Library
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
              <Music className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <p data-testid="library-song-title" className="font-bold text-lg">{currentReview.dbSong.title || <span className="italic text-muted-foreground">(No Title)</span>}</p>
              <p data-testid="library-song-artist" className="text-muted-foreground">
                {currentReview.dbSong.artist || <span className="italic">(No Artist)</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentReview.dbSong.album || <span className="italic">(No Album)</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Spotify Match */}
        <div className="text-center">
          <p className="text-sm font-semibold text-muted-foreground mb-3">
            Spotify Match
          </p>
          <div className="flex flex-col items-center gap-3">
            {currentReview.spotifyMatch.album.images?.[0]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN images are already optimized
              <img
                src={currentReview.spotifyMatch.album.images[0].url}
                alt={currentReview.spotifyMatch.album.name}
                className="w-20 h-20 rounded-lg object-cover shadow-md"
              />
            ) : (
              <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                <Music className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-bold text-lg">
                {currentReview.spotifyMatch.name}
              </p>
              <p className="text-muted-foreground">
                {currentReview.spotifyMatch.artists
                  .map((a) => a.name)
                  .join(', ')}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentReview.spotifyMatch.album.name}
              </p>
              <span
                className={`inline-block mt-2 text-xs px-2 py-1 rounded ${
                  currentReview.similarity >= 80
                    ? 'bg-green-100 text-green-700'
                    : 'invisible'
                }`}
              >
                {currentReview.similarity >= 80
                  ? `${currentReview.similarity}% match`
                  : 'placeholder'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-6">
        <Button
          data-testid="skip-button"
          variant="outline"
          size="lg"
          onClick={onSkip}
          className="w-32 h-14 border-2"
        >
          <X className="h-5 w-5 mr-2" />
          Skip
        </Button>
        <Button
          data-testid="match-button"
          size="lg"
          onClick={() =>
            onMatch(currentReview.dbSong.id, currentReview.spotifyMatch!.id)
          }
          disabled={isMatching}
          className="w-32 h-14"
        >
          {isMatching ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Match
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
