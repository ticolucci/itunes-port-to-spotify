import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpotifyMatcherPage from './page'

// Mock the Server Actions
vi.mock('@/lib/spotify-actions', () => ({
  getNextUnmatchedSong: vi.fn(),
  getSongsByArtist: vi.fn(),
  searchSpotifyByArtistAlbum: vi.fn(),
  saveSongMatch: vi.fn(),
}))

import {
  getNextUnmatchedSong,
  getSongsByArtist,
  searchSpotifyByArtistAlbum,
  saveSongMatch,
} from '@/lib/spotify-actions'

const mockGetNextUnmatchedSong = vi.mocked(getNextUnmatchedSong)
const mockGetSongsByArtist = vi.mocked(getSongsByArtist)
const mockSearchSpotify = vi.mocked(searchSpotifyByArtistAlbum)
const mockSaveSongMatch = vi.mocked(saveSongMatch)

describe('SpotifyMatcherPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and displays unmatched song with artist songs', async () => {
    mockGetNextUnmatchedSong.mockResolvedValue({
      success: true,
      song: {
        id: 1,
        title: 'Come Together',
        artist: 'The Beatles',
        album: 'Abbey Road',
        album_artist: 'The Beatles',
        filename: 'file.mp3',
        spotify_id: null,
      },
    })

    mockGetSongsByArtist.mockResolvedValue({
      success: true,
      songs: [
        {
          id: 1,
          title: 'Come Together',
          artist: 'The Beatles',
          album: 'Abbey Road',
          album_artist: 'The Beatles',
          filename: 'file1.mp3',
          spotify_id: null,
        },
        {
          id: 2,
          title: 'Something',
          artist: 'The Beatles',
          album: 'Abbey Road',
          album_artist: 'The Beatles',
          filename: 'file2.mp3',
          spotify_id: null,
        },
      ],
    })

    mockSearchSpotify.mockResolvedValue({
      success: true,
      tracks: [
        {
          id: 'spotify123',
          name: 'Come Together',
          artists: [{ name: 'The Beatles' }],
          album: { name: 'Abbey Road' },
          uri: 'spotify:track:123',
        },
      ],
    })

    render(<SpotifyMatcherPage />)

    // Wait for data to load and check for page title
    await waitFor(() => {
      expect(screen.getByText(/Spotify Matcher/i)).toBeInTheDocument()
    })

    // Check that the current song is displayed
    expect(screen.getByText('Current Song')).toBeInTheDocument()
    expect(screen.getAllByText(/Come Together/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/The Beatles/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Abbey Road/i).length).toBeGreaterThan(0)

    // Check that artist songs are listed
    expect(screen.getByText(/Songs by The Beatles/i)).toBeInTheDocument()
    expect(screen.getByText('Something')).toBeInTheDocument()

    // Check that Spotify matches are shown
    expect(screen.getByText(/Spotify Matches/i)).toBeInTheDocument()
    expect(screen.getByText(/It's a Match/i)).toBeInTheDocument()
  })
})
