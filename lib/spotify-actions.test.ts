import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import * as schema from './schema'

let testDb: Database.Database
let testDbDrizzle: ReturnType<typeof drizzle>

// Mock the database module before importing anything
vi.mock('./db', () => ({
  getDatabase: () => testDbDrizzle,
  closeDatabase: vi.fn(),
}))

// Mock the Spotify client
vi.mock('./spotify', () => ({
  searchSpotifyTracks: vi.fn(),
}))

// Mock the AI metadata fixer
vi.mock('./ai-metadata-fixer', () => ({
  fixMetadataWithAI: vi.fn(),
}))

// Import after mocking
import {
  getNextUnmatchedSong,
  getSongsByArtist,
  saveSongMatch,
  getAISuggestionForSong,
  applyAIFixToSong,
  searchSpotifyForSong,
} from './spotify-actions'
import { searchSpotifyTracks, type SpotifyTrack } from './spotify'
import { fixMetadataWithAI } from './ai-metadata-fixer'
import type { MetadataFix } from './ai-metadata-fixer'

describe('Spotify Actions', () => {
  beforeAll(() => {
    testDb = new Database(':memory:')
    testDbDrizzle = drizzle(testDb, { schema })
    migrate(testDbDrizzle, {
      migrationsFolder: path.join(process.cwd(), 'drizzle/migrations'),
    })
  })

  afterAll(() => {
    testDb.close()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    testDb.exec('DELETE FROM songs')
    vi.clearAllMocks()
  })

  describe('getNextUnmatchedSong', () => {
    it('returns the first song without spotify_id', async () => {
      // Insert songs
      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run('Song 1', 'Artist 1', 'Album 1', 'Artist 1', 'file1.mp3', 'spotify123')

      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run('Song 2', 'Artist 2', 'Album 2', 'Artist 2', 'file2.mp3', null)

      const result = await getNextUnmatchedSong()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.song).toMatchObject({
          title: 'Song 2',
          artist: 'Artist 2',
          spotify_id: null,
        })
      }
    })

    it('returns success false when no unmatched songs', async () => {
      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run('Song 1', 'Artist 1', 'Album 1', 'Artist 1', 'file1.mp3', 'spotify123')

      const result = await getNextUnmatchedSong()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('No unmatched songs')
      }
    })

    it('returns success false when database is empty', async () => {
      const result = await getNextUnmatchedSong()

      expect(result.success).toBe(false)
    })
  })

  describe('getSongsByArtist', () => {
    it('returns songs by artist sorted by album', async () => {
      const insert = testDb.prepare(
        `INSERT INTO songs (title, artist, album, album_artist, filename)
         VALUES (?, ?, ?, ?, ?)`
      )

      insert.run('Song 1', 'The Beatles', 'Abbey Road', 'The Beatles', 'file1.mp3')
      insert.run('Song 2', 'The Beatles', 'Abbey Road', 'The Beatles', 'file2.mp3')
      insert.run('Song 3', 'The Beatles', 'Let It Be', 'The Beatles', 'file3.mp3')
      insert.run('Song 4', 'Different Artist', 'Album', 'Artist', 'file4.mp3')

      const result = await getSongsByArtist('The Beatles')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.songs).toHaveLength(3)
        expect(result.songs[0].album).toBe('Abbey Road')
        expect(result.songs[2].album).toBe('Let It Be')
      }
    })

    it('returns empty array when artist not found', async () => {
      const result = await getSongsByArtist('Unknown Artist')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.songs).toEqual([])
      }
    })
  })

  describe('saveSongMatch', () => {
    it('updates spotify_id for a song', async () => {
      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('Test Song', 'Test Artist', 'Test Album', 'Test Artist', 'test.mp3')

      const songId = testDb
        .prepare('SELECT id FROM songs WHERE title = ?')
        .get('Test Song') as { id: number }

      const result = await saveSongMatch(songId.id, 'spotify_abc123')

      expect(result.success).toBe(true)

      // Verify it was saved
      const updated = testDb
        .prepare('SELECT spotify_id FROM songs WHERE id = ?')
        .get(songId.id) as { spotify_id: string }

      expect(updated.spotify_id).toBe('spotify_abc123')
    })

    it('returns error for invalid song id', async () => {
      const result = await saveSongMatch(99999, 'spotify_xyz')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not found')
      }
    })
  })

  describe('getAISuggestionForSong', () => {
    it('returns AI suggestion for a song', async () => {
      // Insert test song
      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('Hey Jude  ', 'The Beatles ', 'Past Masters', 'The Beatles', 'test.mp3')

      const songId = testDb
        .prepare('SELECT id FROM songs WHERE title = ?')
        .get('Hey Jude  ') as { id: number }

      const mockSuggestion: MetadataFix = {
        suggestedArtist: 'The Beatles',
        suggestedTrack: 'Hey Jude',
        suggestedAlbum: 'Past Masters',
        confidence: 'high',
        reasoning: 'Removed extra whitespace',
        alternativeSearchQueries: ['The Beatles Hey Jude', 'Hey Jude Beatles'],
      }

      vi.mocked(fixMetadataWithAI).mockResolvedValue(mockSuggestion)

      const result = await getAISuggestionForSong(songId.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.suggestion).toEqual(mockSuggestion)
        expect(result.song).toMatchObject({
          title: 'Hey Jude  ',
          artist: 'The Beatles ',
        })
      }

      expect(fixMetadataWithAI).toHaveBeenCalledWith(
        expect.objectContaining({
          id: songId.id,
          title: 'Hey Jude  ',
          artist: 'The Beatles ',
        })
      )
    })

    it('returns error when AI service fails', async () => {
      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('Song', 'Artist', 'Album', 'Artist', 'test.mp3')

      const songId = testDb
        .prepare('SELECT id FROM songs WHERE title = ?')
        .get('Song') as { id: number }

      vi.mocked(fixMetadataWithAI).mockResolvedValue(null)

      const result = await getAISuggestionForSong(songId.id)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('AI service is unavailable')
      }
    })

    it('returns error for non-existent song', async () => {
      const result = await getAISuggestionForSong(99999)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not found')
      }
    })

    it('handles AI throwing error', async () => {
      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('Song', 'Artist', 'Album', 'Artist', 'test.mp3')

      const songId = testDb
        .prepare('SELECT id FROM songs WHERE title = ?')
        .get('Song') as { id: number }

      vi.mocked(fixMetadataWithAI).mockRejectedValue(new Error('API Error'))

      const result = await getAISuggestionForSong(songId.id)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API Error')
      }
    })
  })

  describe('applyAIFixToSong', () => {
    it('applies AI fix to song metadata', async () => {
      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('Hey Jude  ', 'The Beatles ', '  Past Masters ', 'The Beatles', 'test.mp3')

      const songId = testDb
        .prepare('SELECT id FROM songs WHERE title = ?')
        .get('Hey Jude  ') as { id: number }

      const fix: MetadataFix = {
        suggestedArtist: 'The Beatles',
        suggestedTrack: 'Hey Jude',
        suggestedAlbum: 'Past Masters',
        confidence: 'high',
        reasoning: 'Removed extra whitespace',
        alternativeSearchQueries: [],
      }

      const result = await applyAIFixToSong(songId.id, fix)

      expect(result.success).toBe(true)

      // Verify changes were applied
      const updated = testDb
        .prepare('SELECT title, artist, album FROM songs WHERE id = ?')
        .get(songId.id) as { title: string; artist: string; album: string }

      expect(updated).toEqual({
        title: 'Hey Jude',
        artist: 'The Beatles',
        album: 'Past Masters',
      })
    })

    it('preserves original album if no suggestion provided', async () => {
      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run('Track', 'Artist ', 'Original Album', 'Artist', 'test.mp3')

      const songId = testDb
        .prepare('SELECT id FROM songs WHERE title = ?')
        .get('Track') as { id: number }

      const fix: MetadataFix = {
        suggestedArtist: 'Artist',
        suggestedTrack: 'Track',
        // No suggestedAlbum
        confidence: 'high',
        reasoning: 'Minor fix',
        alternativeSearchQueries: [],
      }

      const result = await applyAIFixToSong(songId.id, fix)

      expect(result.success).toBe(true)

      const updated = testDb
        .prepare('SELECT album FROM songs WHERE id = ?')
        .get(songId.id) as { album: string }

      expect(updated.album).toBe('Original Album')
    })

    it('returns error for non-existent song', async () => {
      const fix: MetadataFix = {
        suggestedArtist: 'Artist',
        suggestedTrack: 'Track',
        confidence: 'high',
        reasoning: 'Fix',
        alternativeSearchQueries: [],
      }

      const result = await applyAIFixToSong(99999, fix)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not found')
      }
    })

    it('handles featured artist extraction correctly', async () => {
      testDb
        .prepare(
          `INSERT INTO songs (title, artist, album, album_artist, filename)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          'Get Lucky',
          'Daft Punk feat. Pharrell',
          'Random Access Memories',
          'Daft Punk',
          'test.mp3'
        )

      const songId = testDb
        .prepare('SELECT id FROM songs WHERE title = ?')
        .get('Get Lucky') as { id: number }

      const fix: MetadataFix = {
        suggestedArtist: 'Daft Punk',
        suggestedTrack: 'Get Lucky',
        suggestedAlbum: 'Random Access Memories',
        confidence: 'medium',
        reasoning: 'Extracted main artist',
        alternativeSearchQueries: ['Daft Punk Get Lucky', 'Get Lucky Pharrell'],
      }

      const result = await applyAIFixToSong(songId.id, fix)

      expect(result.success).toBe(true)

      const updated = testDb
        .prepare('SELECT artist FROM songs WHERE id = ?')
        .get(songId.id) as { artist: string }

      expect(updated.artist).toBe('Daft Punk')
    })
  })

  describe('searchSpotifyForSong', () => {
    const mockSpotifyTrack = (overrides: Partial<SpotifyTrack> = {}): SpotifyTrack => ({
      id: 'spotify123',
      name: 'Hey Jude',
      artists: [{ name: 'The Beatles' }],
      album: {
        name: 'Past Masters',
        images: [{ url: 'https://example.com/img.jpg', height: 300, width: 300 }],
      },
      uri: 'spotify:track:123',
      ...overrides,
    })

    it('uses artist+track search when results have similarity >= 50%', async () => {
      const goodMatch = mockSpotifyTrack({
        name: 'Hey Jude',
        artists: [{ name: 'The Beatles' }],
        album: { name: 'Past Masters', images: [] },
      })

      vi.mocked(searchSpotifyTracks).mockResolvedValueOnce([goodMatch])

      const result = await searchSpotifyForSong('The Beatles', 'Past Masters', 'Hey Jude')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.tracks).toHaveLength(1)
        expect(result.tracks[0].name).toBe('Hey Jude')
      }

      // Should only be called once (artist+track search)
      expect(searchSpotifyTracks).toHaveBeenCalledTimes(1)
      expect(searchSpotifyTracks).toHaveBeenCalledWith({
        artist: 'The Beatles',
        track: 'Hey Jude',
      })
    })

    it('falls back to track-only search when artist+track returns no results', async () => {
      const trackOnlyMatch = mockSpotifyTrack({
        name: 'Hey Jude',
        artists: [{ name: 'The Beatles' }],
      })

      // First call (artist+track) returns empty
      vi.mocked(searchSpotifyTracks).mockResolvedValueOnce([])
      // Second call (track-only) returns results
      vi.mocked(searchSpotifyTracks).mockResolvedValueOnce([trackOnlyMatch])

      const result = await searchSpotifyForSong('The Beatles', 'Past Masters', 'Hey Jude')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.tracks).toHaveLength(1)
      }

      // Should be called twice (artist+track, then track-only)
      expect(searchSpotifyTracks).toHaveBeenCalledTimes(2)
      expect(searchSpotifyTracks).toHaveBeenNthCalledWith(1, {
        artist: 'The Beatles',
        track: 'Hey Jude',
      })
      expect(searchSpotifyTracks).toHaveBeenNthCalledWith(2, {
        track: 'Hey Jude',
      })
    })

    it('falls back to track-only search when best match similarity is below 50%', async () => {
      // Poor match from artist+track search (different artist AND different title = very low similarity)
      // Title "Hey Dude" vs "Hey Jude" has ~80% similarity, but combined with 0% artist
      // and 0% album, the enhanced similarity will be below 50%
      const poorMatch = mockSpotifyTrack({
        name: 'Hey Dude',
        artists: [{ name: 'Some Cover Band' }],
        album: { name: 'Tribute Album', images: [] },
      })

      // Better match from track-only search
      const goodMatch = mockSpotifyTrack({
        name: 'Hey Jude',
        artists: [{ name: 'The Beatles' }],
        album: { name: 'Past Masters', images: [] },
      })

      // First call returns poor match
      vi.mocked(searchSpotifyTracks).mockResolvedValueOnce([poorMatch])
      // Second call returns better match
      vi.mocked(searchSpotifyTracks).mockResolvedValueOnce([goodMatch])

      const result = await searchSpotifyForSong('The Beatles', 'Past Masters', 'Hey Jude')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.tracks).toHaveLength(1)
        expect(result.tracks[0].artists[0].name).toBe('The Beatles')
      }

      expect(searchSpotifyTracks).toHaveBeenCalledTimes(2)
    })

    it('skips artist search when artist is null', async () => {
      const match = mockSpotifyTrack()

      vi.mocked(searchSpotifyTracks).mockResolvedValueOnce([match])

      const result = await searchSpotifyForSong(null, 'Album', 'Hey Jude')

      expect(result.success).toBe(true)

      // Should only do track-only search when artist is null
      expect(searchSpotifyTracks).toHaveBeenCalledTimes(1)
      expect(searchSpotifyTracks).toHaveBeenCalledWith({
        track: 'Hey Jude',
      })
    })

    it('returns error when search fails', async () => {
      vi.mocked(searchSpotifyTracks).mockRejectedValueOnce(new Error('API Error'))

      const result = await searchSpotifyForSong('Artist', 'Album', 'Track')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API Error')
      }
    })

    it('returns combined results when both searches find matches', async () => {
      // Artist+track search finds poor match
      const poorMatch = mockSpotifyTrack({
        id: 'poor1',
        name: 'Hey Jude',
        artists: [{ name: 'Cover Artist' }],
      })

      // Track-only search finds additional matches
      const goodMatch = mockSpotifyTrack({
        id: 'good1',
        name: 'Hey Jude',
        artists: [{ name: 'The Beatles' }],
      })

      vi.mocked(searchSpotifyTracks).mockResolvedValueOnce([poorMatch])
      vi.mocked(searchSpotifyTracks).mockResolvedValueOnce([goodMatch])

      const result = await searchSpotifyForSong('The Beatles', 'Past Masters', 'Hey Jude')

      expect(result.success).toBe(true)
      if (result.success) {
        // Should return results from fallback search when primary has poor matches
        expect(result.tracks.length).toBeGreaterThan(0)
      }
    })
  })
})
