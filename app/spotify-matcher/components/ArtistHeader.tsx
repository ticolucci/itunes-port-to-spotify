import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

interface ArtistHeaderProps {
  artist: string | null
  matchedCount: number
  totalCount: number
  onLoadRandomArtist: () => void
}

export function ArtistHeader({
  artist,
  matchedCount,
  totalCount,
  onLoadRandomArtist
}: ArtistHeaderProps) {
  return (
    <div className="mb-8 p-6 border rounded-lg bg-muted/50">
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">
        Current Artist
      </h2>
      <h3 className="text-2xl font-bold">
        {artist || <span className="italic text-muted-foreground">(No Artist)</span>}
      </h3>
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          {matchedCount} / {totalCount} songs matched
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadRandomArtist}
        >
          Random Artist
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
