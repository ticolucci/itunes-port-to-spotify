/**
 * Calculate similarity percentage between two song titles.
 * Returns a value between 0-100 indicating match confidence.
 *
 * @param localTitle - The title from the local iTunes library
 * @param spotifyTitle - The title from Spotify search results
 * @returns Similarity percentage (0-100)
 */
export function calculateSimilarity(localTitle: string | null, spotifyTitle: string | null): number {
  // Handle null/undefined values
  if (!localTitle || !spotifyTitle) return 0

  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]/g, '')
  const local = normalize(localTitle)
  const spotify = normalize(spotifyTitle)

  // Check for empty strings after normalization
  if (!local || !spotify) return 0

  if (local === spotify) return 100

  // Simple substring matching
  if (local.includes(spotify) || spotify.includes(local)) return 80

  // Check word overlap - split BEFORE normalization to preserve word boundaries
  const normalizeWord = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
  const localWords = localTitle.split(/\s+/).map(normalizeWord).filter(w => w.length > 0)
  const spotifyWords = spotifyTitle.split(/\s+/).map(normalizeWord).filter(w => w.length > 0)
  const commonWords = localWords.filter((word) => spotifyWords.includes(word))
  const similarity = (commonWords.length / Math.max(localWords.length, spotifyWords.length)) * 100

  return Math.round(similarity)
}
