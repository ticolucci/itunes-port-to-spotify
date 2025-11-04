import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'

let testDb: Database.Database

// Mock the database module before importing anything
vi.mock('./db', () => ({
  getDatabase: () => testDb,
  closeDatabase: vi.fn(),
}))

// Mock the Spotify SDK
vi.mock('@spotify/web-api-ts-sdk', () => ({
  SpotifyApi: {
    withClientCredentials: vi.fn(() => ({
      search: vi.fn(),
    })),
  },
}))

// Import after mocking
import {
  getNextUnmatchedSong,
  getSongsByArtist,
  saveSongMatch,
  searchSpotifyByArtistAlbum,
} from './spotify-actions'
import { resetSpotifyClient } from './spotify'
import { SpotifyApi } from '@spotify/web-api-ts-sdk'

describe('Spotify Actions', () => {
  beforeAll(() => {
    testDb = new Database(':memory:')
    const db = drizzle(testDb)
    migrate(db, {
      migrationsFolder: path.join(process.cwd(), 'drizzle/migrations'),
    })
    
    // Set up test environment variables
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id'
    process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret'
  })

  afterAll(() => {
    testDb.close()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    testDb.exec('DELETE FROM songs')
    testDb.exec('DELETE FROM spotify_tracks')
    vi.clearAllMocks()
    resetSpotifyClient()
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

  describe('searchSpotifyByArtistAlbum', () => {
    it('searches Spotify and caches results', async () => {
      const mockTracks = [
        {
          id: 'track1',
          name: 'Test Song',
          artists: [{ name: 'Test Artist' }],
          album: { name: 'Test Album' },
          uri: 'spotify:track:track1',
        },
      ]

      const mockSearch = vi.fn().mockResolvedValue({
        tracks: { items: mockTracks },
      })

      vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
        search: mockSearch,
      } as any)

      const result = await searchSpotifyByArtistAlbum('Test Artist', 'Test Album')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.tracks).toHaveLength(1)
        expect(result.tracks[0].name).toBe('Test Song')
      }

      // Verify cached in database
      const cached = testDb
        .prepare('SELECT * FROM spotify_tracks WHERE search_query = ?')
        .all('artist:Test Artist album:Test Album')
      
      expect(cached).toHaveLength(1)
    })

    it('returns cached results on second search', async () => {
      // Pre-populate cache
      testDb.prepare(
        `INSERT INTO spotify_tracks 
         (spotify_id, name, artists, album, uri, search_query, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        'cached1',
        'Cached Song',
        JSON.stringify([{ name: 'Cached Artist' }]),
        'Cached Album',
        'spotify:track:cached1',
        'artist:Cached Artist album:Cached Album',
        Date.now()
      )

      const mockSearch = vi.fn()
      vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
        search: mockSearch,
      } as any)

      const result = await searchSpotifyByArtistAlbum('Cached Artist', 'Cached Album')

      // Should NOT call Spotify API
      expect(mockSearch).not.toHaveBeenCalled()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.tracks).toHaveLength(1)
        expect(result.tracks[0].name).toBe('Cached Song')
      }
    })

    it('handles API errors', async () => {
      const mockSearch = vi.fn().mockRejectedValue(new Error('API Error'))

      vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
        search: mockSearch,
      } as any)

      const result = await searchSpotifyByArtistAlbum('Error Artist', 'Error Album')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('API Error')
      }
    })
  })
})
