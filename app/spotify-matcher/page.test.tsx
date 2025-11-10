import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'

let testDb: Database.Database
let drizzleDb: ReturnType<typeof drizzle>

// Mock the database module before importing anything
vi.mock('@/lib/db', () => ({
  getDatabase: () => drizzleDb,
  closeDatabase: vi.fn(),
}))

// Mock Spotify API
vi.mock('@/lib/spotify', () => ({
  searchSpotifyTracks: vi.fn(),
}))

import { searchSpotifyTracks } from '@/lib/spotify'
import SpotifyMatcherPage from './page'

const mockSearchSpotifyTracks = vi.mocked(searchSpotifyTracks)

describe('SpotifyMatcherPage', () => {
  beforeAll(() => {
    // Create in-memory database for testing
    testDb = new Database(':memory:')

    // Use Drizzle migrations to create schema
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
    vi.clearAllMocks()
  })

  it('loads and displays random artist with songs and matches', async () => {
    // Insert test data - multiple songs by The Beatles
    const insert = testDb.prepare(`
      INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    insert.run('Come Together', 'The Beatles', 'Abbey Road', 'The Beatles', 'file1.mp3', null)
    insert.run('Something', 'The Beatles', 'Abbey Road', 'The Beatles', 'file2.mp3', null)
    insert.run('Here Comes The Sun', 'The Beatles', 'Abbey Road', 'The Beatles', 'file3.mp3', null)

    // Mock Spotify search to return matches
    mockSearchSpotifyTracks.mockResolvedValue([
      {
        id: 'spotify123',
        name: 'Come Together',
        artists: [{ name: 'The Beatles' }],
        album: {
          name: 'Abbey Road',
          images: [{ url: 'https://example.com/cover.jpg', height: 300, width: 300 }],
        },
        uri: 'spotify:track:123',
      },
    ])

    render(<SpotifyMatcherPage />)

    // Wait for data to load and check for page title
    await waitFor(() => {
      expect(screen.getByText(/Spotify Matcher/i)).toBeInTheDocument()
    })

    // Check that the current artist is displayed
    expect(screen.getByText('Current Artist')).toBeInTheDocument()
    expect(screen.getAllByText(/The Beatles/i).length).toBeGreaterThan(0)

    // Check that songs are listed (3 songs by The Beatles)
    await waitFor(() => {
      expect(screen.getAllByText('Come Together').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Something').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Here Comes The Sun').length).toBeGreaterThan(0)
    })

    // Check that match buttons are shown for unmatched songs
    await waitFor(() => {
      const matchButtons = screen.getAllByRole('button', { name: /Match/i })
      expect(matchButtons.length).toBeGreaterThan(0)
    })
  })

  it('handles songs with null metadata and allows matching with Spotify results', async () => {
    // Insert songs with valid titles but null album/artist
    const insert = testDb.prepare(`
      INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    insert.run('Mystery Song 1', 'Unknown Artist', null, null, 'file1.mp3', null)  // null album
    insert.run('Some Song', null, 'Some Album', null, 'file2.mp3', null)           // null artist

    // Mock Spotify search to return potential matches despite incomplete metadata
    mockSearchSpotifyTracks.mockResolvedValue([
      {
        id: 'spotify456',
        name: 'Mystery Track',
        artists: [{ name: 'Unknown Artist' }],
        album: {
          name: 'Unknown Album',
          images: [{ url: 'https://example.com/cover.jpg', height: 300, width: 300 }],
        },
        uri: 'spotify:track:456',
      },
    ])

    // Should render without throwing errors
    render(<SpotifyMatcherPage />)

    await waitFor(() => {
      expect(screen.getByText(/Spotify Matcher/i)).toBeInTheDocument()
    })

    // Check that songs with valid titles are displayed
    // Note: Due to random selection, either "Mystery Song 1" or "Some Song" will be shown
    await waitFor(() => {
      const hasMysterySong = screen.queryAllByText('Mystery Song 1').length > 0
      const hasSomeSong = screen.queryAllByText('Some Song').length > 0
      expect(hasMysterySong || hasSomeSong).toBe(true)
    })

    // Check that Spotify matches are still displayed
    await waitFor(() => {
      expect(screen.getAllByText('Mystery Track').length).toBeGreaterThan(0)
    })

    // User should still be able to match despite incomplete metadata (null album/artist)
    const matchButtons = screen.getAllByRole('button', { name: /Match/i })
    expect(matchButtons.length).toBeGreaterThan(0)
  })

  it('filters out songs without titles', async () => {
    // Insert songs: some with titles, some without
    const insert = testDb.prepare(`
      INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    insert.run(null, 'Artist 1', 'Album 1', null, 'file1.mp3', null)      // null title - should be filtered
    insert.run('', 'Artist 2', 'Album 2', null, 'file2.mp3', null)        // empty title - should be filtered
    insert.run('Valid Song', 'Artist 3', 'Album 3', null, 'file3.mp3', null)  // valid - should appear

    // Mock Spotify search
    mockSearchSpotifyTracks.mockResolvedValue([
      {
        id: 'spotify789',
        name: 'Valid Song Match',
        artists: [{ name: 'Artist 3' }],
        album: {
          name: 'Album 3',
          images: [{ url: 'https://example.com/cover.jpg', height: 300, width: 300 }],
        },
        uri: 'spotify:track:789',
      },
    ])

    render(<SpotifyMatcherPage />)

    await waitFor(() => {
      expect(screen.getByText(/Spotify Matcher/i)).toBeInTheDocument()
    })

    // Should NOT display songs without titles
    await waitFor(() => {
      expect(screen.queryByText(/No Title/i)).not.toBeInTheDocument()
    })

    // Should ONLY display the song with a valid title
    await waitFor(() => {
      expect(screen.getAllByText('Valid Song').length).toBeGreaterThan(0)
    })

    // Should display Artist 3 (from the valid song)
    expect(screen.getAllByText(/Artist 3/i).length).toBeGreaterThan(0)

    // Should NOT display Artist 1 or Artist 2 (their songs have no titles)
    expect(screen.queryByText(/Artist 1/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Artist 2/i)).not.toBeInTheDocument()
  })

  it('automatically matches songs with similarity >= 80% when toggle enabled', async () => {
    // Insert song with exact title that will match at 100% similarity
    const insert = testDb.prepare(`
      INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    insert.run('Exact Match Song', 'Test Artist', 'Test Album', null, 'file1.mp3', null)

    // Mock Spotify to return exact match (will get 100% similarity)
    mockSearchSpotifyTracks.mockResolvedValue([
      {
        id: 'spotify-auto-match',
        name: 'Exact Match Song',  // Exact match will give 100% similarity
        artists: [{ name: 'Test Artist' }],
        album: {
          name: 'Test Album',
          images: [{ url: 'https://example.com/cover.jpg', height: 300, width: 300 }],
        },
        uri: 'spotify:track:auto',
      },
    ])

    const { container } = render(<SpotifyMatcherPage />)

    // Enable auto-match toggle immediately (synchronously if possible)
    const toggle = await waitFor(() => {
      const t = container.querySelector('input[type="checkbox"][aria-label*="Auto-match"]') as HTMLInputElement
      expect(t).toBeTruthy()
      return t
    })

    // Click toggle immediately to enable auto-match before searches complete
    act(() => {
      toggle.click()
    })

    // Wait for auto-match to complete
    await waitFor(
      () => {
        // Check if song was auto-matched by verifying it's marked as matched
        const undoButtons = screen.queryAllByRole('button', { name: /Undo/i })
        expect(undoButtons.length).toBeGreaterThan(0)
      },
      { timeout: 3000 }
    )

    // Verify the song was saved to database with spotify_id
    const matchedSongs = testDb.prepare('SELECT * FROM songs WHERE spotify_id IS NOT NULL').all()
    expect(matchedSongs.length).toBe(1)
    expect(matchedSongs[0].spotify_id).toBe('spotify-auto-match')
  })

  it('does not auto-match songs with similarity < 80% even when toggle enabled', async () => {
    // Insert song that will get low similarity match
    const insert = testDb.prepare(`
      INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    insert.run('Original Song Title', 'Test Artist', 'Test Album', null, 'file1.mp3', null)

    // Mock Spotify to return partial match (will get low similarity)
    mockSearchSpotifyTracks.mockResolvedValue([
      {
        id: 'spotify-partial',
        name: 'Completely Different Title',  // Very different, low similarity
        artists: [{ name: 'Test Artist' }],
        album: {
          name: 'Test Album',
          images: [{ url: 'https://example.com/cover.jpg', height: 300, width: 300 }],
        },
        uri: 'spotify:track:partial',
      },
    ])

    const { container } = render(<SpotifyMatcherPage />)

    await waitFor(() => {
      expect(screen.getByText(/Spotify Matcher/i)).toBeInTheDocument()
    })

    // Enable auto-match toggle
    const toggle = container.querySelector('input[type="checkbox"][aria-label*="Auto-match"]') as HTMLInputElement
    if (toggle && !toggle.checked) {
      toggle.click()
    }

    // Wait for search to complete
    await waitFor(() => {
      expect(screen.getAllByText('Completely Different Title').length).toBeGreaterThan(0)
    })

    // Verify Match button is still shown (not auto-matched due to low similarity)
    const matchButtons = screen.getAllByRole('button', { name: /Match/i })
    expect(matchButtons.length).toBeGreaterThan(0)

    // Verify song was NOT saved to database
    const matchedSongs = testDb.prepare('SELECT * FROM songs WHERE spotify_id IS NOT NULL').all()
    expect(matchedSongs.length).toBe(0)
  })

  it('does not auto-match when toggle disabled (default behavior)', async () => {
    // Insert song with exact title that would auto-match if toggle were enabled
    const insert = testDb.prepare(`
      INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    insert.run('Toggle Test Song', 'Test Artist', 'Test Album', null, 'file1.mp3', null)

    // Mock Spotify to return exact match
    mockSearchSpotifyTracks.mockResolvedValue([
      {
        id: 'spotify-toggle',
        name: 'Toggle Test Song',  // Exact match (100% similarity)
        artists: [{ name: 'Test Artist' }],
        album: {
          name: 'Test Album',
          images: [{ url: 'https://example.com/cover.jpg', height: 300, width: 300 }],
        },
        uri: 'spotify:track:toggle',
      },
    ])

    render(<SpotifyMatcherPage />)

    await waitFor(() => {
      expect(screen.getByText(/Spotify Matcher/i)).toBeInTheDocument()
    })

    // Wait for search to complete
    await waitFor(() => {
      expect(screen.getAllByText('Toggle Test Song').length).toBeGreaterThan(0)
    })

    // Verify Match button is shown (not auto-matched because toggle is OFF by default)
    await waitFor(() => {
      const matchButtons = screen.getAllByRole('button', { name: /Match/i })
      expect(matchButtons.length).toBeGreaterThan(0)
    })

    // Verify song was NOT saved to database
    const matchedSongs = testDb.prepare('SELECT * FROM songs WHERE spotify_id IS NOT NULL').all()
    expect(matchedSongs.length).toBe(0)
  })

  it('displays message when no unmatched songs exist', async () => {
    // Insert only matched songs (all have spotify_id)
    const insert = testDb.prepare(`
      INSERT INTO songs (title, artist, album, album_artist, filename, spotify_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    insert.run('Matched Song', 'Artist', 'Album', 'Artist', 'file.mp3', 'spotify123')

    render(<SpotifyMatcherPage />)

    // Should show "all matched" message
    await waitFor(() => {
      expect(screen.getByText(/No unmatched songs/i)).toBeInTheDocument()
    })
  })
})
