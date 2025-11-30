/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SongTableRow } from './SongTableRow'
import { createMockSong, createMockSpotifyTrack, createMockSongWithMatch } from '@/lib/test-helpers/fixtures'

describe('SongTableRow', () => {
  const defaultProps = {
    songWithMatch: createMockSongWithMatch({
      dbSong: createMockSong({ id: 1, title: 'Test Song', artist: 'Test Artist', album: 'Test Album' }),
      spotifyMatch: createMockSpotifyTrack({
        id: 'track123',
        name: 'Spotify Song',
        artists: [{ name: 'Spotify Artist' }],
        album: {
          name: 'Spotify Album',
          images: [{ url: 'https://example.com/album.jpg', height: 300, width: 300 }],
        },
      }),
      similarity: 90,
      isMatched: false,
    }),
    isMatching: false,
    onMatch: vi.fn(),
    onUndo: vi.fn(),
    onSongUpdate: vi.fn(),
    handlePlaySong: vi.fn(),
  }

  describe('Rendering', () => {
    it('renders database song information', () => {
      render(<SongTableRow {...defaultProps} />)

      expect(screen.getByText('Test Song')).toBeInTheDocument()
      expect(screen.getByText('Test Artist')).toBeInTheDocument()
      expect(screen.getByText('Test Album')).toBeInTheDocument()
    })

    it('renders Spotify match information', () => {
      render(<SongTableRow {...defaultProps} />)

      expect(screen.getByText('Spotify Song')).toBeInTheDocument()
      expect(screen.getByText('Spotify Artist')).toBeInTheDocument()
      expect(screen.getByText('Spotify Album')).toBeInTheDocument()
    })

    it('renders album image when available', () => {
      render(<SongTableRow {...defaultProps} />)

      const albumImage = screen.getByAltText('Spotify Album')
      expect(albumImage).toBeInTheDocument()
      expect(albumImage).toHaveAttribute('src', 'https://example.com/album.jpg')
    })

    it('renders without album image when not available', () => {
      const propsWithoutImage = {
        ...defaultProps,
        songWithMatch: {
          ...createMockSongWithMatch({
            dbSong: createMockSong(),
            spotifyMatch: createMockSpotifyTrack({
              album: {
                name: 'Album',
                images: [],
              },
            }),
          }),
          // Override the spotifyMatch to ensure no images
          spotifyMatch: {
            ...createMockSpotifyTrack(),
            album: {
              name: 'Album',
              images: [],
            },
          },
        },
      }

      render(<SongTableRow {...propsWithoutImage} />)

      // The component should still render but without the img tag
      expect(screen.getByText('Album')).toBeInTheDocument() // Album name is still shown in text
    })

    it('shows similarity score when >= 80%', () => {
      render(<SongTableRow {...defaultProps} />)

      expect(screen.getByText('90%')).toBeInTheDocument()
    })

    it('hides similarity score when < 80%', () => {
      const lowSimilarityProps = {
        ...defaultProps,
        songWithMatch: createMockSongWithMatch({
          ...defaultProps.songWithMatch,
          similarity: 70,
        }),
      }

      render(<SongTableRow {...lowSimilarityProps} />)

      expect(screen.queryByText('70%')).not.toBeInTheDocument()
    })
  })

  describe('Playback', () => {
    it('calls handlePlaySong with correct ID when album image is clicked', async () => {
      const user = userEvent.setup()
      const handlePlaySong = vi.fn()

      render(<SongTableRow {...defaultProps} handlePlaySong={handlePlaySong} />)

      const albumImage = screen.getByAltText('Spotify Album')
      await user.click(albumImage)

      expect(handlePlaySong).toHaveBeenCalledWith('track123')
      expect(handlePlaySong).toHaveBeenCalledTimes(1)
    })

    it('does not render clickable image when no Spotify match', () => {
      const noMatchProps = {
        ...defaultProps,
        songWithMatch: createMockSongWithMatch({
          dbSong: createMockSong(),
          spotifyMatch: null,
        }),
      }

      render(<SongTableRow {...noMatchProps} />)

      expect(screen.queryByAltText(/album/i)).not.toBeInTheDocument()
    })
  })

  describe('Match/Undo buttons', () => {
    it('shows Match button when not matched', () => {
      render(<SongTableRow {...defaultProps} />)

      expect(screen.getByRole('button', { name: /Match/i })).toBeInTheDocument()
    })

    it('calls onMatch when Match button is clicked', async () => {
      const user = userEvent.setup()
      const onMatch = vi.fn()

      render(<SongTableRow {...defaultProps} onMatch={onMatch} />)

      await user.click(screen.getByRole('button', { name: /Match/i }))

      expect(onMatch).toHaveBeenCalledWith(1, 'track123')
    })

    it('shows Undo button when already matched', () => {
      const matchedProps = {
        ...defaultProps,
        songWithMatch: createMockSongWithMatch({
          ...defaultProps.songWithMatch,
          isMatched: true,
        }),
      }

      render(<SongTableRow {...matchedProps} />)

      expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument()
    })

    it('calls onUndo when Undo button is clicked', async () => {
      const user = userEvent.setup()
      const onUndo = vi.fn()
      const matchedProps = {
        ...defaultProps,
        songWithMatch: createMockSongWithMatch({
          ...defaultProps.songWithMatch,
          isMatched: true,
        }),
        onUndo,
      }

      render(<SongTableRow {...matchedProps} />)

      await user.click(screen.getByRole('button', { name: /Undo/i }))

      expect(onUndo).toHaveBeenCalledWith(1)
    })

    it('disables buttons when isMatching is true', () => {
      const props = {
        ...defaultProps,
        isMatching: true,
      }

      render(<SongTableRow {...props} />)

      expect(screen.getByRole('button', { name: /Match/i })).toBeDisabled()
    })
  })

  describe('States', () => {
    it('shows searching state', () => {
      const searchingProps = {
        ...defaultProps,
        songWithMatch: createMockSongWithMatch({
          dbSong: createMockSong(),
          spotifyMatch: null,
          searching: true,
        }),
      }

      render(<SongTableRow {...searchingProps} />)

      expect(screen.getByText('Searching...')).toBeInTheDocument()
    })

    it('shows no match found message when no Spotify match', () => {
      const noMatchProps = {
        ...defaultProps,
        songWithMatch: createMockSongWithMatch({
          dbSong: createMockSong({ title: 'Song', artist: 'Artist', album: 'Album' }),
          spotifyMatch: null,
        }),
      }

      render(<SongTableRow {...noMatchProps} />)

      expect(screen.getByText('No match found')).toBeInTheDocument()
    })

    it('applies matched styling when isMatched is true', () => {
      const matchedProps = {
        ...defaultProps,
        songWithMatch: createMockSongWithMatch({
          ...defaultProps.songWithMatch,
          isMatched: true,
        }),
      }

      const { container } = render(<SongTableRow {...matchedProps} />)
      const rowDiv = container.querySelector('.bg-green-50\\/50')

      expect(rowDiv).toBeInTheDocument()
    })
  })
})
