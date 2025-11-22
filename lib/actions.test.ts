import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'

let testDb: Database.Database
let drizzleDb: ReturnType<typeof drizzle>

// Mock the database module before importing anything
vi.mock('./db', () => ({
  getDatabase: () => drizzleDb,
  closeDatabase: vi.fn(),
}))

// Import after mocking
import { fetchSongs } from './actions'

describe('fetchSongs Server Action', () => {
  beforeAll(() => {
    // Create in-memory database for testing
    testDb = new Database(':memory:')

    // Use Drizzle migrations to create schema (single source of truth)
    drizzleDb = drizzle(testDb)
    migrate(drizzleDb, {
      migrationsFolder: path.join(process.cwd(), 'drizzle/migrations'),
    })
  })

  afterAll(() => {
    testDb.close()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    // Clear the table before each test
    testDb.exec('DELETE FROM songs')
  })

  describe('with no songs', () => {
    it('returns empty array and zero count', async () => {
      const result = await fetchSongs()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.songs).toEqual([])
        expect(result.total).toBe(0)
        expect(result.count).toBe(0)
      }
    })
  })

  describe('with songs in database', () => {
    beforeEach(() => {
      // Insert test data
      const insert = testDb.prepare(`
        INSERT INTO songs (title, artist, album, album_artist, filename)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (let i = 1; i <= 100; i++) {
        insert.run(
          `Song ${i}`,
          `Artist ${i % 10}`,
          `Album ${i % 5}`,
          `Album Artist ${i % 3}`,
          `file${i}.mp3`
        )
      }
    })

    it('returns all songs without pagination', async () => {
      const result = await fetchSongs()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.songs).toHaveLength(100)
        expect(result.total).toBe(100)
        expect(result.count).toBe(100)
        expect(result.songs[0].title).toBe('Song 1')
        expect(result.songs[99].title).toBe('Song 100')
      }
    })

    it('returns correct total count with pagination', async () => {
      const result = await fetchSongs({ limit: 10, offset: 0 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.total).toBe(100) // Total songs in database
        expect(result.count).toBe(10) // Songs in current page
        expect(result.songs).toHaveLength(10)
      }
    })

    it('respects limit parameter', async () => {
      const result = await fetchSongs({ limit: 25 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.songs).toHaveLength(25)
        expect(result.count).toBe(25)
        expect(result.songs[0].title).toBe('Song 1')
        expect(result.songs[24].title).toBe('Song 25')
      }
    })

    it('respects offset parameter', async () => {
      const result = await fetchSongs({ limit: 10, offset: 50 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.songs).toHaveLength(10)
        expect(result.songs[0].title).toBe('Song 51')
        expect(result.songs[9].title).toBe('Song 60')
      }
    })

    it('handles offset beyond available songs', async () => {
      const result = await fetchSongs({ limit: 10, offset: 200 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.songs).toHaveLength(0)
        expect(result.total).toBe(100)
        expect(result.count).toBe(0)
      }
    })

    it('maps database fields to Song type correctly', async () => {
      const result = await fetchSongs({ limit: 1 })

      expect(result.success).toBe(true)
      if (result.success) {
        const song = result.songs[0]
        expect(song).toHaveProperty('id')
        expect(song).toHaveProperty('title')
        expect(song).toHaveProperty('artist')
        expect(song).toHaveProperty('album')
        expect(song).toHaveProperty('album_artist')
        expect(song).toHaveProperty('filename')
        expect(typeof song.id).toBe('number')
        expect(typeof song.title).toBe('string')
      }
    })

    it('handles null/empty values correctly', async () => {
      // Insert song with null values
      testDb.prepare(`
        INSERT INTO songs (title, artist, album, album_artist, filename)
        VALUES (?, ?, ?, ?, ?)
      `).run(null, null, null, null, null)

      const result = await fetchSongs({ limit: 1, offset: 100 })

      expect(result.success).toBe(true)
      if (result.success) {
        const song = result.songs[0]
        expect(song.title).toBe(null)
        expect(song.artist).toBe(null)
        expect(song.album).toBe(null)
        expect(song.album_artist).toBe(null)
        expect(song.filename).toBe(null)
      }
    })
  })

  describe('pagination scenarios', () => {
    beforeEach(() => {
      const insert = testDb.prepare(`
        INSERT INTO songs (title, artist, album, album_artist, filename)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (let i = 1; i <= 75; i++) {
        insert.run(`Song ${i}`, 'Artist', 'Album', '', 'file.mp3')
      }
    })

    it('handles last page with partial results', async () => {
      const result = await fetchSongs({ limit: 50, offset: 50 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.songs).toHaveLength(25) // Only 25 songs left
        expect(result.total).toBe(75)
        expect(result.count).toBe(25)
      }
    })

    it('calculates pages correctly', async () => {
      const pageSize = 50
      const total = 75
      const expectedPages = Math.ceil(total / pageSize) // Should be 2

      // Page 1
      const page1 = await fetchSongs({ limit: pageSize, offset: 0 })
      expect(page1.success && page1.songs).toHaveLength(50)

      // Page 2
      const page2 = await fetchSongs({ limit: pageSize, offset: 50 })
      expect(page2.success && page2.songs).toHaveLength(25)

      expect(expectedPages).toBe(2)
    })
  })

  describe('filtering', () => {
    beforeEach(() => {
      // Insert test data with varied metadata for filtering tests
      const insert = testDb.prepare(`
        INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      // Songs with Spotify matches
      insert.run('Bohemian Rhapsody', 'Queen', 'A Night at the Opera', 'Queen', 'file1.mp3', 'spotify:track:123')
      insert.run('Killer Queen', 'Queen', 'Sheer Heart Attack', 'Queen', 'file2.mp3', 'spotify:track:456')
      insert.run('Another One Bites the Dust', 'Queen', 'The Game', 'Queen', 'file3.mp3', null)

      // Songs without Spotify matches
      insert.run('Yesterday', 'The Beatles', 'Help!', 'The Beatles', 'file4.mp3', null)
      insert.run('Let It Be', 'The Beatles', 'Let It Be', 'The Beatles', 'file5.mp3', null)
      insert.run('Hey Jude', 'The Beatles', 'Hey Jude', 'The Beatles', 'file6.mp3', 'spotify:track:789')

      // More varied data
      insert.run('Thriller', 'Michael Jackson', 'Thriller', 'Michael Jackson', 'file7.mp3', 'spotify:track:abc')
      insert.run('Beat It', 'Michael Jackson', 'Thriller', 'Michael Jackson', 'file8.mp3', null)
    })

    describe('title filter (starts with)', () => {
      it('filters songs by title prefix', async () => {
        const result = await fetchSongs({ filters: { title: 'Bo' } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(1)
          expect(result.songs[0].title).toBe('Bohemian Rhapsody')
        }
      })

      it('is case-insensitive', async () => {
        const result = await fetchSongs({ filters: { title: 'killer' } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(1)
          expect(result.songs[0].title).toBe('Killer Queen')
        }
      })

      it('returns multiple matches', async () => {
        const result = await fetchSongs({ filters: { title: 'B' } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(2) // Bohemian Rhapsody, Beat It
          expect(result.songs.every(s => s.title?.toLowerCase().startsWith('b'))).toBe(true)
        }
      })
    })

    describe('artist filter (starts with)', () => {
      it('filters songs by artist prefix', async () => {
        const result = await fetchSongs({ filters: { artist: 'Queen' } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(3)
          expect(result.songs.every(s => s.artist === 'Queen')).toBe(true)
        }
      })

      it('is case-insensitive', async () => {
        const result = await fetchSongs({ filters: { artist: 'the b' } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(3) // All Beatles songs
          expect(result.songs.every(s => s.artist === 'The Beatles')).toBe(true)
        }
      })
    })

    describe('album filter (starts with)', () => {
      it('filters songs by album prefix', async () => {
        const result = await fetchSongs({ filters: { album: 'Thrill' } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(2) // Thriller album has 2 songs
          expect(result.songs.every(s => s.album === 'Thriller')).toBe(true)
        }
      })

      it('handles special characters in filter', async () => {
        const result = await fetchSongs({ filters: { album: 'Help' } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(1)
          expect(result.songs[0].album).toBe('Help!')
        }
      })
    })

    describe('hasSpotifyMatch filter', () => {
      it('filters songs with Spotify matches when true', async () => {
        const result = await fetchSongs({ filters: { hasSpotifyMatch: true } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(4) // 4 songs have spotify_id
          expect(result.songs.every(s => s.spotify_id !== null)).toBe(true)
        }
      })

      it('filters songs without Spotify matches when false', async () => {
        const result = await fetchSongs({ filters: { hasSpotifyMatch: false } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(4) // 4 songs without spotify_id
          expect(result.songs.every(s => s.spotify_id === null)).toBe(true)
        }
      })
    })

    describe('combined filters', () => {
      it('applies multiple filters together', async () => {
        const result = await fetchSongs({
          filters: {
            artist: 'Queen',
            hasSpotifyMatch: true,
          },
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(2) // Queen songs with Spotify match
          expect(result.songs.every(s => s.artist === 'Queen' && s.spotify_id !== null)).toBe(true)
        }
      })

      it('works with pagination', async () => {
        const result = await fetchSongs({
          filters: { hasSpotifyMatch: false },
          limit: 2,
          offset: 0,
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(2)
          expect(result.total).toBe(4) // Total unmatched songs
          expect(result.count).toBe(2) // Page size
        }
      })

      it('returns correct total when filtering with pagination', async () => {
        const result = await fetchSongs({
          filters: { artist: 'The Beatles' },
          limit: 1,
          offset: 0,
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(1)
          expect(result.total).toBe(3) // Total Beatles songs
        }
      })
    })

    describe('empty filter values', () => {
      it('ignores empty string filters', async () => {
        const result = await fetchSongs({ filters: { title: '' } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(8) // All songs
        }
      })

      it('ignores undefined hasSpotifyMatch', async () => {
        const result = await fetchSongs({ filters: { hasSpotifyMatch: undefined } })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.songs).toHaveLength(8) // All songs
        }
      })
    })
  })
})
