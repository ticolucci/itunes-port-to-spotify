import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getSpotifyClient, resetSpotifyClient, type SpotifyApiTrack } from './spotify'
import Database from 'better-sqlite3'
import { SpotifyApi } from '@spotify/web-api-ts-sdk'

// Mock the Spotify SDK
vi.mock('@spotify/web-api-ts-sdk', () => ({
  SpotifyApi: {
    withClientCredentials: vi.fn(() => ({
      search: vi.fn(),
    })),
  },
}))

describe('SpotifyClient Singleton with Memoization', () => {
  let db: Database.Database
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Set up test environment variables
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id'
    process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret'
    
    // Create in-memory database for testing
    db = new Database(':memory:')
    
    // Create spotify_tracks table
    db.exec(`
      CREATE TABLE spotify_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        spotify_id TEXT NOT NULL,
        name TEXT NOT NULL,
        artists TEXT NOT NULL,
        album TEXT NOT NULL,
        uri TEXT NOT NULL,
        search_query TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX idx_spotify_tracks_search_spotify 
        ON spotify_tracks (search_query, spotify_id);
    `)
  })
  
  afterEach(() => {
    db.close()
    resetSpotifyClient()
  })

  it('returns the same instance when called multiple times', () => {
    const client1 = getSpotifyClient(db)
    const client2 = getSpotifyClient(db)
    
    expect(client1).toBe(client2)
  })

  it('fetches from Spotify API when cache is empty', async () => {
    const mockTracks = [
      {
        id: 'spotify123',
        name: 'Test Song',
        artists: [{ name: 'Test Artist' }],
        album: { name: 'Test Album' },
        uri: 'spotify:track:123',
      },
    ]

    const mockSearch = vi.fn().mockResolvedValue({
      tracks: {
        items: mockTracks,
      },
    })

    vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
      search: mockSearch,
    } as any)

    const client = getSpotifyClient(db)
    const results = await client.searchTracks({
      artist: 'Test Artist',
      album: 'Test Album',
    })

    expect(mockSearch).toHaveBeenCalledWith(
      'artist:Test Artist album:Test Album',
      ['track'],
      undefined,
      20
    )
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'spotify123',
      name: 'Test Song',
    })

    // Verify data was saved to database
    const cachedTracks = db
      .prepare('SELECT * FROM spotify_tracks WHERE search_query = ?')
      .all('artist:Test Artist album:Test Album')
    
    expect(cachedTracks).toHaveLength(1)
    expect(cachedTracks[0]).toMatchObject({
      spotify_id: 'spotify123',
      name: 'Test Song',
      album: 'Test Album',
    })
  })

  it('returns cached results without calling Spotify API', async () => {
    // Pre-populate cache
    const query = 'artist:Cached Artist album:Cached Album'
    db.prepare(
      `INSERT INTO spotify_tracks 
       (spotify_id, name, artists, album, uri, search_query, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'cached123',
      'Cached Song',
      JSON.stringify([{ name: 'Cached Artist' }]),
      'Cached Album',
      'spotify:track:cached123',
      query,
      Date.now()
    )

    const mockSearch = vi.fn()
    vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
      search: mockSearch,
    } as any)

    const client = getSpotifyClient(db)
    const results = await client.searchTracks({
      artist: 'Cached Artist',
      album: 'Cached Album',
    })

    // Should NOT call Spotify API
    expect(mockSearch).not.toHaveBeenCalled()
    
    // Should return cached data
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'cached123',
      name: 'Cached Song',
      artists: [{ name: 'Cached Artist' }],
      album: { name: 'Cached Album' },
    })
  })

  it('handles multiple tracks in cache', async () => {
    const query = 'artist:Multi Artist'
    const mockSearch = vi.fn()
    
    // Pre-populate with multiple tracks
    const insertStmt = db.prepare(
      `INSERT INTO spotify_tracks 
       (spotify_id, name, artists, album, uri, search_query, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    
    const now = Date.now()
    insertStmt.run('track1', 'Song 1', JSON.stringify([{ name: 'Multi Artist' }]), 'Album 1', 'uri1', query, now)
    insertStmt.run('track2', 'Song 2', JSON.stringify([{ name: 'Multi Artist' }]), 'Album 2', 'uri2', query, now)
    insertStmt.run('track3', 'Song 3', JSON.stringify([{ name: 'Multi Artist' }]), 'Album 3', 'uri3', query, now)

    vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
      search: mockSearch,
    } as any)

    const client = getSpotifyClient(db)
    const results = await client.searchTracks({ artist: 'Multi Artist' })

    expect(mockSearch).not.toHaveBeenCalled()
    expect(results).toHaveLength(3)
    expect(results.map(r => r.id)).toEqual(['track1', 'track2', 'track3'])
  })

  it('saves multiple tracks from API response', async () => {
    const mockTracks = [
      {
        id: 'track1',
        name: 'Song 1',
        artists: [{ name: 'Artist' }],
        album: { name: 'Album 1' },
        uri: 'uri1',
      },
      {
        id: 'track2',
        name: 'Song 2',
        artists: [{ name: 'Artist' }],
        album: { name: 'Album 2' },
        uri: 'uri2',
      },
    ]

    const mockSearch = vi.fn().mockResolvedValue({
      tracks: { items: mockTracks },
    })

    vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
      search: mockSearch,
    } as any)

    const client = getSpotifyClient(db)
    await client.searchTracks({ artist: 'Artist' })

    const cached = db
      .prepare('SELECT * FROM spotify_tracks WHERE search_query = ?')
      .all('artist:Artist')
    
    expect(cached).toHaveLength(2)
  })

  it('handles tracks with multiple artists', async () => {
    const mockTracks = [
      {
        id: 'collab1',
        name: 'Collab Song',
        artists: [{ name: 'Artist 1' }, { name: 'Artist 2' }],
        album: { name: 'Collab Album' },
        uri: 'uri:collab',
      },
    ]

    const mockSearch = vi.fn().mockResolvedValue({
      tracks: { items: mockTracks },
    })

    vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
      search: mockSearch,
    } as any)

    const client = getSpotifyClient(db)
    const results = await client.searchTracks({ artist: 'Artist 1' })

    expect(results[0].artists).toHaveLength(2)
    expect(results[0].artists[0].name).toBe('Artist 1')
    expect(results[0].artists[1].name).toBe('Artist 2')

    // Verify cached correctly
    const cached = db
      .prepare('SELECT artists FROM spotify_tracks WHERE spotify_id = ?')
      .get('collab1') as { artists: string }
    
    const parsedArtists = JSON.parse(cached.artists)
    expect(parsedArtists).toHaveLength(2)
  })

  it('prevents duplicate entries with unique constraint', async () => {
    const query = 'artist:Dupe Artist'
    
    // First insert
    db.prepare(
      `INSERT INTO spotify_tracks 
       (spotify_id, name, artists, album, uri, search_query, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('dupe123', 'Dupe Song', '[]', 'Album', 'uri', query, Date.now())

    // Try to insert same track for same query (should be ignored by ON CONFLICT)
    db.prepare(
      `INSERT INTO spotify_tracks 
       (spotify_id, name, artists, album, uri, search_query, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(search_query, spotify_id) DO NOTHING`
    ).run('dupe123', 'Dupe Song Updated', '[]', 'Album', 'uri', query, Date.now())

    const tracks = db
      .prepare('SELECT * FROM spotify_tracks WHERE search_query = ?')
      .all(query)
    
    expect(tracks).toHaveLength(1)
    expect((tracks[0] as any).name).toBe('Dupe Song') // Should keep original
  })

  it('throws error when credentials not configured', async () => {
    delete process.env.SPOTIFY_CLIENT_ID
    delete process.env.SPOTIFY_CLIENT_SECRET

    const client = getSpotifyClient(db)
    
    await expect(
      client.searchTracks({ artist: 'Test' })
    ).rejects.toThrow('Spotify credentials not configured')
  })
})
