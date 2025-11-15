import { calculateSimilarity } from './similarity'

export interface SongMetadata {
  artist: string | null
  title: string | null
  album: string | null
}

/**
 * Calculate enhanced similarity between two songs considering artist, title, and album.
 *
 * Strategy:
 * - Emphasizes artist matching (covers are penalized)
 * - Title must match well for high scores
 * - Album provides small bonus/tiebreaker
 *
 * @param local - The song from the local iTunes library
 * @param spotify - The song from Spotify search results
 * @returns Similarity percentage (0-100)
 */
export function calculateEnhancedSimilarity(
  local: SongMetadata,
  spotify: SongMetadata
): number {
  // Handle "null" string literals as actual nulls
  const localArtist = local.artist === 'null' ? null : local.artist
  const localTitle = local.title === 'null' ? null : local.title
  const localAlbum = local.album === 'null' ? null : local.album
  const spotifyArtist = spotify.artist === 'null' ? null : spotify.artist
  const spotifyTitle = spotify.title === 'null' ? null : spotify.title
  const spotifyAlbum = spotify.album === 'null' ? null : spotify.album

  // Calculate individual similarities
  const titleSim = calculateSimilarity(localTitle, spotifyTitle)
  const artistSim = calculateSimilarity(localArtist, spotifyArtist)
  const albumSim = calculateSimilarity(localAlbum, spotifyAlbum)

  // Handle missing title - critical field
  if (!localTitle || !spotifyTitle) {
    if (!localTitle && !spotifyTitle) {
      // Both missing title - use artist+album
      return Math.round(artistSim * 0.6 + albumSim * 0.4)
    }
    // One missing title - very low confidence
    return Math.round(artistSim * 0.2 + albumSim * 0.1)
  }

  // Title doesn't match well - likely different songs
  // Word overlap can give false positives ("Same Song" vs "Different Song")
  if (titleSim < 70) {
    // Poor title match - cap at 15%
    return Math.round(Math.min(15, artistSim * 0.1 + titleSim * 0.05))
  }

  // Check for missing artist scenarios BEFORE cover detection
  // Both missing artist - treat as perfect artist match
  if ((!localArtist || localArtist === 'null') && (!spotifyArtist || spotifyArtist === 'null')) {
    // Both null artists = high confidence based on title+album
    const adjScore = titleSim * 0.85 + albumSim * 0.1
    return Math.round(Math.min(95, adjScore))
  }

  // One missing artist but excellent title+album
  if ((!localArtist || localArtist === 'null' || !spotifyArtist || spotifyArtist === 'null')) {
    if (titleSim >= 95 && albumSim >= 95) {
      // Missing artist but perfect title+album - likely same
      return Math.round(titleSim * 0.7 + albumSim * 0.2)
    }
  }

  // Perfect artist + perfect title
  if (artistSim === 100 && titleSim === 100) {
    // If album name matches title (song named after album), definitely same
    if (localAlbum === localTitle || spotifyAlbum === spotifyTitle) {
      return 100
    }
    // If album also matches well, it's perfect
    if (albumSim >= 80) {
      return 100
    }
    // Album doesn't match - compilation case, but not quite perfect
    // Return high 90s to distinguish from perfect match
    return 98
  }

  // Cover detection: good title but poor-to-moderate artist match WITH high album similarity
  // If both artist AND album are low, it's more likely metadata variation than a cover
  if (titleSim >= 95 && artistSim < 62 && albumSim >= 60) {
    // Likely a cover - cap at 45%
    const baseScore = 25 + artistSim * 0.1 + albumSim * 0.05
    return Math.round(Math.min(45, baseScore))
  }

  // Normal case: weighted scoring
  // Title: 50% - most important
  // Artist: 40% - prevents covers
  // Album: 10% - tiebreaker
  const score = artistSim * 0.4 + titleSim * 0.5 + albumSim * 0.1

  return Math.round(score)
}
