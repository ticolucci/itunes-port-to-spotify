import { Button } from '@/components/ui/button'
import { Loader2, Check, ChevronRight, Music, Undo2, ExternalLink } from 'lucide-react'
import type { SongWithMatch } from '@/lib/song-matcher-utils'
import { hasIncompleteMetadata } from '@/lib/song-matcher-utils'
import { AISuggestion } from '../AISuggestion'
import Link from 'next/link'

interface SongTableRowProps {
  songWithMatch: SongWithMatch
  isMatching: boolean
  onMatch: (songId: number, spotifyId: string) => void
  onUndo: (songId: number) => void
  onSongUpdate?: (songId: number, update: { artist: string; title: string; album: string | null }) => void
}

export function SongTableRow({ songWithMatch, isMatching, onMatch, onUndo, onSongUpdate }: SongTableRowProps) {
  const albumImage = songWithMatch.spotifyMatch?.album.images?.[0]?.url

  return (
    <div
      key={songWithMatch.dbSong.id}
      className={`border rounded-lg p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto] gap-4 items-center ${
        songWithMatch.isMatched ? 'bg-green-50/50 border-green-200' : ''
      }`}
    >
      {/* DB Song */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
          <Music className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">
            {songWithMatch.dbSong.title || <span className="italic text-muted-foreground">(No Title)</span>}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {songWithMatch.dbSong.artist || <span className="italic">(No Artist)</span>}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {songWithMatch.dbSong.album || <span className="italic">(No Album)</span>}
          </p>
        </div>
      </div>

      {/* Arrow */}
      <div className="hidden lg:flex justify-center">
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Spotify Match */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {songWithMatch.searching ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Searching...</span>
          </div>
        ) : songWithMatch.spotifyMatch ? (
          <>
            {albumImage && (
              // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN images are already optimized
              <img
                src={albumImage}
                alt={songWithMatch.spotifyMatch.album.name}
                className="w-12 h-12 rounded flex-shrink-0 object-cover"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium truncate">
                  {songWithMatch.spotifyMatch.name}
                </p>
                {songWithMatch.similarity >= 80 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex-shrink-0">
                    {songWithMatch.similarity}%
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {songWithMatch.spotifyMatch.artists
                  .map((a) => a.name)
                  .join(', ')}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {songWithMatch.spotifyMatch.album.name}
              </p>
            </div>
          </>
        ) : hasIncompleteMetadata(songWithMatch.dbSong) ? (
          <div className="w-full">
            <p className="text-sm text-amber-600 italic mb-3">
              Incomplete metadata - skipped
            </p>
            <AISuggestion
              song={songWithMatch.dbSong}
              onFixApplied={(update) => onSongUpdate?.(songWithMatch.dbSong.id, update)}
            />
          </div>
        ) : (
          <div className="w-full">
            <p className="text-sm text-muted-foreground mb-3">
              No match found
            </p>
            <AISuggestion
              song={songWithMatch.dbSong}
              onFixApplied={(update) => onSongUpdate?.(songWithMatch.dbSong.id, update)}
            />
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-muted-foreground hover:text-foreground"
        >
          <Link href={`/spotify-matcher?songId=${songWithMatch.dbSong.id}`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
        {songWithMatch.isMatched ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUndo(songWithMatch.dbSong.id)}
            disabled={isMatching}
            className="text-muted-foreground hover:text-foreground"
          >
            {isMatching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Undo2 className="h-4 w-4 mr-2" />
            )}
            Undo
          </Button>
        ) : songWithMatch.spotifyMatch ? (
          <Button
            onClick={() =>
              onMatch(
                songWithMatch.dbSong.id,
                songWithMatch.spotifyMatch!.id
              )
            }
            disabled={isMatching}
            size="sm"
          >
            {isMatching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Match
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMatch(songWithMatch.dbSong.id, '')}
            disabled={isMatching}
          >
            Skip
          </Button>
        )}
      </div>
    </div>
  )
}
