import Bottleneck from 'bottleneck'
import type { Song } from './schema'

/**
 * Options for creating a Spotify rate limiter.
 *
 * Spotify API has a rate limit of ~180 requests per minute for most endpoints.
 * Default settings provide a conservative rate that stays well within limits.
 */
export interface LimiterOptions {
  /** Maximum number of concurrent requests (default: 3) */
  maxConcurrent?: number
  /** Minimum time between requests in ms (default: 100) */
  minTime?: number
  /** Reservoir size - max requests in the reservoir time window (default: 30) */
  reservoir?: number
  /** Time window for reservoir in ms (default: 10000 = 10 seconds) */
  reservoirRefreshInterval?: number
  /** Number to reset reservoir to when it refreshes */
  reservoirRefreshAmount?: number
}

/**
 * Options for batch searching songs.
 */
export interface BatchSearchOptions {
  /** Custom Bottleneck limiter instance (for testing or custom rate limits) */
  limiter?: Bottleneck
  /** Callback when a search fails */
  onError?: (song: Song, error: Error) => void
  /** Callback when all searches complete */
  onComplete?: (stats: BatchSearchStats) => void
}

/**
 * Statistics from a batch search operation.
 */
export interface BatchSearchStats {
  /** Total number of songs processed */
  total: number
  /** Number of successful searches */
  succeeded: number
  /** Number of failed searches */
  failed: number
}

/**
 * Creates a Bottleneck rate limiter configured for Spotify API.
 *
 * Uses token bucket algorithm with reservoir pattern for burst protection.
 * Default settings: 3 concurrent requests, 100ms between requests,
 * max 30 requests per 10 seconds.
 *
 * @param options - Custom limiter options
 * @returns Configured Bottleneck instance
 */
export function createSpotifyLimiter(options: LimiterOptions = {}): Bottleneck {
  const {
    maxConcurrent = 3,
    minTime = 100,
    reservoir = 30,
    reservoirRefreshInterval = 10000,
    reservoirRefreshAmount = 30,
  } = options

  return new Bottleneck({
    maxConcurrent,
    minTime,
    reservoir,
    reservoirRefreshInterval,
    reservoirRefreshAmount,
  })
}

// Default limiter instance for the module
let defaultLimiter: Bottleneck | null = null

/**
 * Gets or creates the default rate limiter.
 */
function getDefaultLimiter(): Bottleneck {
  if (!defaultLimiter) {
    defaultLimiter = createSpotifyLimiter()
  }
  return defaultLimiter
}

/**
 * Batch searches for Spotify matches for multiple songs with rate limiting.
 *
 * This function:
 * - Filters to only unmatched songs (no spotify_id)
 * - Rate limits API calls using Bottleneck
 * - Handles errors gracefully per-song (doesn't fail entire batch)
 * - Reports statistics via onComplete callback
 *
 * @param songs - Array of songs to search for
 * @param searchFn - Function to call for each song (typically searchForMatch)
 * @param options - Batch search options
 *
 * @example
 * await batchSearchSongs(songs, searchForMatch, {
 *   onError: (song, err) => console.error(`Failed: ${song.title}`, err),
 *   onComplete: (stats) => console.log(`Processed ${stats.total} songs`)
 * })
 */
export async function batchSearchSongs(
  songs: Song[],
  searchFn: (song: Song) => Promise<void>,
  options: BatchSearchOptions = {}
): Promise<void> {
  const { limiter = getDefaultLimiter(), onError, onComplete } = options

  // Filter to only songs that need searching
  const songsToSearch = songs.filter(song => !song.spotify_id)

  if (songsToSearch.length === 0) {
    onComplete?.({ total: 0, succeeded: 0, failed: 0 })
    return
  }

  let succeeded = 0
  let failed = 0

  // Schedule all searches with rate limiting
  const searchPromises = songsToSearch.map(song =>
    limiter.schedule(async () => {
      try {
        await searchFn(song)
        succeeded++
      } catch (error) {
        failed++
        onError?.(song, error instanceof Error ? error : new Error(String(error)))
      }
    })
  )

  // Wait for all searches to complete
  await Promise.all(searchPromises)

  onComplete?.({
    total: songsToSearch.length,
    succeeded,
    failed,
  })
}

/**
 * Resets the default limiter. Useful for testing.
 */
export function resetDefaultLimiter(): void {
  if (defaultLimiter) {
    defaultLimiter.stop()
    defaultLimiter = null
  }
}
