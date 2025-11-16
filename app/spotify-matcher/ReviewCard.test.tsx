/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewCard } from './ReviewCard'
import { createMockSong, createMockSpotifyTrack, createMockSongWithMatch } from '@/lib/test-helpers/fixtures'

describe('ReviewCard', () => {
  const bestMatchTrack = createMockSpotifyTrack({ id: 'track1', name: 'Match 1' })
  const defaultProps = {
    currentReview: createMockSongWithMatch({
      dbSong: createMockSong({ title: 'Test Song', artist: 'Test Artist' }),
      spotifyMatch: bestMatchTrack,
      allMatches: [
        { track: bestMatchTrack, similarity: 95 },
        { track: createMockSpotifyTrack({ id: 'track2', name: 'Match 2' }), similarity: 85 },
        { track: createMockSpotifyTrack({ id: 'track3', name: 'Match 3' }), similarity: 75 },
      ],
      similarity: 95,
      isMatched: false,
    }),
    currentIndex: 0,
    totalCount: 10,
    isMatching: false,
    onMatch: vi.fn(),
    onSkip: vi.fn(),
  }

  describe('Single match display', () => {
    it('should render the best match by default', () => {
      render(<ReviewCard {...defaultProps} />)

      expect(screen.getByTestId('library-song-title')).toHaveTextContent('Test Song')
      expect(screen.getByText('Spotify Match')).toBeInTheDocument()
    })

    it('should show match and skip buttons', () => {
      render(<ReviewCard {...defaultProps} />)

      expect(screen.getByTestId('match-button')).toBeInTheDocument()
      expect(screen.getByTestId('skip-button')).toBeInTheDocument()
    })

    it('should show "See X more matches" button when multiple matches exist', () => {
      render(<ReviewCard {...defaultProps} />)

      expect(screen.getByText('See 2 more matches')).toBeInTheDocument()
    })

    it('should not show "See more" button when only one match exists', () => {
      const singleMatchProps = {
        ...defaultProps,
        currentReview: createMockSongWithMatch({
          dbSong: createMockSong(),
          spotifyMatch: createMockSpotifyTrack(),
          allMatches: [
            { track: createMockSpotifyTrack({ id: 'track1' }), similarity: 95 },
          ],
          similarity: 95,
        }),
      }

      render(<ReviewCard {...singleMatchProps} />)

      expect(screen.queryByText(/See \d+ more match/)).not.toBeInTheDocument()
    })
  })

  describe('Expandable matches', () => {
    it('should expand and show all additional matches when "See more" is clicked', async () => {
      const user = userEvent.setup()
      render(<ReviewCard {...defaultProps} />)

      const expandButton = screen.getByText('See 2 more matches')
      await user.click(expandButton)

      // Should show the additional matches (not including the best match)
      expect(screen.getByText('Match 2')).toBeInTheDocument()
      expect(screen.getByText('Match 3')).toBeInTheDocument()
    })

    it('should change button text to "Show less" when expanded', async () => {
      const user = userEvent.setup()
      render(<ReviewCard {...defaultProps} />)

      const expandButton = screen.getByText('See 2 more matches')
      await user.click(expandButton)

      expect(screen.getByText('Show less')).toBeInTheDocument()
    })

    it('should collapse when "Show less" is clicked', async () => {
      const user = userEvent.setup()
      render(<ReviewCard {...defaultProps} />)

      // Expand
      await user.click(screen.getByText('See 2 more matches'))
      expect(screen.getByText('Match 2')).toBeInTheDocument()

      // Collapse
      await user.click(screen.getByText('Show less'))
      expect(screen.queryByText('Match 2')).not.toBeInTheDocument()
    })

    it('should display match cards in horizontal grid layout', async () => {
      const user = userEvent.setup()
      render(<ReviewCard {...defaultProps} />)

      await user.click(screen.getByText('See 2 more matches'))

      const matchGrid = screen.getByTestId('additional-matches-grid')
      expect(matchGrid).toBeInTheDocument()
    })

    it('should show similarity scores for each additional match', async () => {
      const user = userEvent.setup()
      render(<ReviewCard {...defaultProps} />)

      await user.click(screen.getByText('See 2 more matches'))

      expect(screen.getByText('85% match')).toBeInTheDocument()
      expect(screen.getByText('75% match')).toBeInTheDocument()
    })
  })

  describe('Match selection', () => {
    it('should call onMatch with the best match when primary Match button is clicked', async () => {
      const user = userEvent.setup()
      const onMatch = vi.fn()
      render(<ReviewCard {...defaultProps} onMatch={onMatch} />)

      await user.click(screen.getByTestId('match-button'))

      expect(onMatch).toHaveBeenCalledWith(1, 'track1')
    })

    it('should call onMatch when an alternative match card is clicked', async () => {
      const user = userEvent.setup()
      const onMatch = vi.fn()
      render(<ReviewCard {...defaultProps} onMatch={onMatch} />)

      // Expand to see alternatives
      await user.click(screen.getByText('See 2 more matches'))

      // Click the second match
      const match2Card = screen.getByTestId('match-card-track2')
      await user.click(match2Card)

      expect(onMatch).toHaveBeenCalledWith(1, 'track2')
    })

    it('should call onSkip when skip button is clicked', async () => {
      const user = userEvent.setup()
      const onSkip = vi.fn()
      render(<ReviewCard {...defaultProps} onSkip={onSkip} />)

      await user.click(screen.getByTestId('skip-button'))

      expect(onSkip).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge cases', () => {
    it('should not render when spotifyMatch is null', () => {
      const noMatchProps = {
        ...defaultProps,
        currentReview: createMockSongWithMatch({
          spotifyMatch: null,
          allMatches: [],
        }),
      }

      const { container } = render(<ReviewCard {...noMatchProps} />)
      expect(container.firstChild).toBeNull()
    })

    it('should not render when song is already matched', () => {
      const matchedProps = {
        ...defaultProps,
        currentReview: createMockSongWithMatch({
          spotifyMatch: createMockSpotifyTrack(),
          isMatched: true,
        }),
      }

      const { container } = render(<ReviewCard {...matchedProps} />)
      expect(container.firstChild).toBeNull()
    })

    it('should handle allMatches being undefined (backward compatibility)', () => {
      const legacyProps = {
        ...defaultProps,
        currentReview: {
          ...createMockSongWithMatch({
            spotifyMatch: createMockSpotifyTrack(),
          }),
          allMatches: undefined as any,
        },
      }

      render(<ReviewCard {...legacyProps} />)

      // Should render without the "See more" button
      expect(screen.queryByText(/See \d+ more match/)).not.toBeInTheDocument()
    })
  })
})
