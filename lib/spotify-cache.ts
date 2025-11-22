import { getDatabase } from './db'
import { spotifySearchCache } from './schema'
import { eq, lt } from 'drizzle-orm'
import type { SpotifyTrack, SpotifySearchParams } from './spotify'

/**
 * Cache TTL in milliseconds (30 days)
 * Spotify data doesn't change frequently, so a longer TTL is appropriate.
 */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Generate a consistent cache key from search parameters.
 * Normalizes params by:
 * - Converting to lowercase
 * - Trimming whitespace
 * - Sorting keys alphabetically
 * - Ignoring undefined/empty values
 */
export function generateCacheKey(params: SpotifySearchParams): string {
  const normalized: Record<string, string> = {}

  if (params.artist?.trim()) {
    normalized.artist = params.artist.trim().toLowerCase()
  }
  if (params.album?.trim()) {
    normalized.album = params.album.trim().toLowerCase()
  }
  if (params.track?.trim()) {
    normalized.track = params.track.trim().toLowerCase()
  }

  // Create deterministic key by sorting keys
  const sortedEntries = Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))
  return sortedEntries.map(([k, v]) => `${k}:${v}`).join('|')
}

/**
 * Check if a cache entry has expired based on its creation timestamp.
 */
export function isCacheExpired(createdAt: number, now: number = Date.now()): boolean {
  return now - createdAt > CACHE_TTL_MS
}

/**
 * Get cached search results if they exist and are not expired.
 * Returns null on cache miss or if the entry is expired.
 * Expired entries are automatically deleted.
 */
export async function getCachedSearch(
  params: SpotifySearchParams
): Promise<SpotifyTrack[] | null> {
  const db = getDatabase()
  const cacheKey = generateCacheKey(params)

  const results = await db
    .select()
    .from(spotifySearchCache)
    .where(eq(spotifySearchCache.cache_key, cacheKey))
    .limit(1)

  if (results.length === 0) {
    return null
  }

  const entry = results[0]

  // Check if expired
  if (isCacheExpired(entry.created_at)) {
    // Delete expired entry
    await db
      .delete(spotifySearchCache)
      .where(eq(spotifySearchCache.cache_key, cacheKey))
    return null
  }

  // Parse and return cached results
  try {
    return JSON.parse(entry.results) as SpotifyTrack[]
  } catch {
    // Invalid JSON - delete and return null
    await db
      .delete(spotifySearchCache)
      .where(eq(spotifySearchCache.cache_key, cacheKey))
    return null
  }
}

/**
 * Store search results in the cache.
 * Uses upsert to update existing entries with new results.
 */
export async function setCachedSearch(
  params: SpotifySearchParams,
  tracks: SpotifyTrack[]
): Promise<void> {
  const db = getDatabase()
  const cacheKey = generateCacheKey(params)
  const now = Date.now()

  await db
    .insert(spotifySearchCache)
    .values({
      cache_key: cacheKey,
      results: JSON.stringify(tracks),
      created_at: now,
    })
    .onConflictDoUpdate({
      target: spotifySearchCache.cache_key,
      set: {
        results: JSON.stringify(tracks),
        created_at: now,
      },
    })
}

/**
 * Clear all expired cache entries.
 * Can be called periodically to clean up stale data.
 */
export async function clearExpiredCache(): Promise<number> {
  const db = getDatabase()
  const expiredBefore = Date.now() - CACHE_TTL_MS

  const result = await db
    .delete(spotifySearchCache)
    .where(lt(spotifySearchCache.created_at, expiredBefore))

  return result.rowsAffected ?? 0
}
