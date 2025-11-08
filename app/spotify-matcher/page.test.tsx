/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SpotifyMatcherPage from './page'

// Mock the Server Actions
vi.mock('@/lib/spotify-actions', () => ({
  getNextUnmatchedAlbum: vi.fn(),
  getSongsByAlbum: vi.fn(),
  searchSpotifyForSong: vi.fn(),
}))

import {
  getNextUnmatchedAlbum,
  getSongsByAlbum,
  searchSpotifyForSong,
} from '@/lib/spotify-actions'

const mockGetNextUnmatchedAlbum = vi.mocked(getNextUnmatchedAlbum)
const mockGetSongsByAlbum = vi.mocked(getSongsByAlbum)
const mockSearchSpotifyForSong = vi.mocked(searchSpotifyForSong)

describe('SpotifyMatcherPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and displays album with songs and matches', async () => {
    mockGetNextUnmatchedAlbum.mockResolvedValue({
      success: true,
      artist: 'The Beatles',
      album: 'Abbey Road',
    })

    mockGetSongsByAlbum.mockResolvedValue({
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
          spotify_id: 'spotify456',
        },
      ],
    })

    mockSearchSpotifyForSong.mockResolvedValue({
      success: true,
      tracks: [
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
      ],
    })

    render(<SpotifyMatcherPage />)

    // Wait for data to load and check for page title
    await waitFor(() => {
      expect(screen.getByText(/Spotify Matcher/i)).toBeInTheDocument()
    })

    // Check that the current album is displayed
    expect(screen.getByText('Current Album')).toBeInTheDocument()
    expect(screen.getAllByText('Abbey Road').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/The Beatles/i).length).toBeGreaterThan(0)

    // Check that progress is shown
    expect(screen.getByText(/1 \/ 2 songs matched/i)).toBeInTheDocument()

    // Check that album songs are listed
    await waitFor(() => {
      expect(screen.getAllByText('Come Together').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Something').length).toBeGreaterThan(0)
    })

    // Check that match button is shown for unmatched song
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Match/i })).toBeInTheDocument()
    })

    // Check that matched status is shown for matched song
    expect(screen.getByText('Matched')).toBeInTheDocument()
  })

  it('handles songs with null or undefined titles without crashing', async () => {
    mockGetNextUnmatchedAlbum.mockResolvedValue({
      success: true,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
    })

    mockGetSongsByAlbum.mockResolvedValue({
      success: true,
      songs: [
        {
          id: 1,
          title: null as any, // Song with null title
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          album_artist: 'Unknown Artist',
          filename: 'file1.mp3',
          spotify_id: null,
        },
        {
          id: 2,
          title: undefined as any, // Song with undefined title
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          album_artist: 'Unknown Artist',
          filename: 'file2.mp3',
          spotify_id: null,
        },
      ],
    })

    mockSearchSpotifyForSong.mockResolvedValue({
      success: true,
      tracks: [
        {
          id: 'spotify123',
          name: 'Some Track',
          artists: [{ name: 'Unknown Artist' }],
          album: {
            name: 'Unknown Album',
            images: [{ url: 'https://example.com/cover.jpg', height: 300, width: 300 }],
          },
          uri: 'spotify:track:123',
        },
      ],
    })

    // Should render without throwing errors
    render(<SpotifyMatcherPage />)

    await waitFor(() => {
      expect(screen.getByText(/Spotify Matcher/i)).toBeInTheDocument()
    })

    // Check that the page loads successfully despite null titles
    expect(screen.getByText('Current Album')).toBeInTheDocument()
    expect(screen.getAllByText('Unknown Album').length).toBeGreaterThan(0)

    // Check that songs with null titles are rendered without crashing
    await waitFor(() => {
      // Should show 0% similarity (calculateSimilarity returns 0 for null values)
      // and still show match/skip buttons without throwing errors
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    // Verify the page didn't crash - if we got here, the null safety works
    expect(screen.getByText(/0 \/ 2 songs matched/i)).toBeInTheDocument()
  })
})
