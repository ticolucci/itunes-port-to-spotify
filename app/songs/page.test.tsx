import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SongsPage from './page'
import type { Song } from '@/lib/schema'

// Mock the Server Action
vi.mock('@/lib/actions', () => ({
  fetchSongs: vi.fn(),
}))

import { fetchSongs } from '@/lib/actions'

const mockFetchSongs = vi.mocked(fetchSongs)

const createMockSongs = (count: number, startId: number = 1): Song[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    title: `Song ${startId + i}`,
    artist: `Artist ${(startId + i) % 5}`,
    album: `Album ${(startId + i) % 3}`,
    album_artist: `Album Artist ${(startId + i) % 2}`,
    filename: `file${startId + i}.mp3`,
  }))
}

describe('SongsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('displays loading spinner initially', () => {
      mockFetchSongs.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves - keeps loading
          })
      )

      render(<SongsPage />)

      expect(screen.getByText(/loading songs from database/i)).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('displays error message when fetch fails', async () => {
      mockFetchSongs.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      })

      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByText(/error loading songs/i)).toBeInTheDocument()
        expect(screen.getByText(/database connection failed/i)).toBeInTheDocument()
      })
    })
  })

  describe('successful data loading', () => {
    beforeEach(() => {
      mockFetchSongs.mockResolvedValue({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50),
      })
    })

    it('displays songs in a table', async () => {
      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
      })

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('Song 1')).toBeInTheDocument()
      // Verify we have multiple rows with data (getAllByRole returns all rows including header)
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBeGreaterThan(1) // At least header + 1 data row
    })

    it('displays correct column headers', async () => {
      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      expect(screen.getByRole('columnheader', { name: /^title$/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /^artist$/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /^album$/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /album artist/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument()
    })
  })

  describe('pagination', () => {
    it('displays pagination info correctly', async () => {
      mockFetchSongs.mockResolvedValue({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50),
      })

      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByText(/showing 1 to 50 of 100 songs/i)).toBeInTheDocument()
        expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument()
      })
    })

    it('previous button is disabled on first page', async () => {
      mockFetchSongs.mockResolvedValue({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50),
      })

      render(<SongsPage />)

      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: /previous/i })
        expect(prevButton).toBeDisabled()
      })
    })

    it('next button navigates to next page', async () => {
      const user = userEvent.setup()

      // First call - page 1
      mockFetchSongs.mockResolvedValueOnce({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50, 1),
      })

      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument()
      })

      // Second call - page 2
      mockFetchSongs.mockResolvedValueOnce({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50, 51),
      })

      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      await waitFor(() => {
        expect(mockFetchSongs).toHaveBeenCalledTimes(2)
        expect(mockFetchSongs).toHaveBeenLastCalledWith({ limit: 50, offset: 50 })
      })
    })

    it('previous button navigates to previous page', async () => {
      const user = userEvent.setup()

      // Start on page 2
      mockFetchSongs.mockResolvedValueOnce({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50, 51),
      })

      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      // Navigate to page 2 first
      mockFetchSongs.mockResolvedValueOnce({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50, 51),
      })

      await user.click(screen.getByRole('button', { name: /next/i }))

      // Then back to page 1
      mockFetchSongs.mockResolvedValueOnce({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50, 1),
      })

      await user.click(screen.getByRole('button', { name: /previous/i }))

      await waitFor(() => {
        expect(mockFetchSongs).toHaveBeenCalledWith({ limit: 50, offset: 0 })
      })
    })
  })

  describe('selection', () => {
    beforeEach(() => {
      mockFetchSongs.mockResolvedValue({
        success: true,
        total: 3,
        count: 3,
        songs: createMockSongs(3),
      })
    })

    it('allows selecting individual songs', async () => {
      const user = userEvent.setup()

      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      const checkboxes = screen.getAllByRole('checkbox')
      const firstSongCheckbox = checkboxes[1] // Skip "select all" checkbox

      await user.click(firstSongCheckbox)

      await waitFor(() => {
        expect(screen.getByText(/1 song selected/i)).toBeInTheDocument()
      })
    })

    it('select all checkbox selects all visible songs', async () => {
      const user = userEvent.setup()

      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
      await user.click(selectAllCheckbox)

      await waitFor(() => {
        expect(screen.getByText(/3 songs selected/i)).toBeInTheDocument()
      })
    })

    it('displays bulk action buttons when songs are selected', async () => {
      const user = userEvent.setup()

      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      const firstCheckbox = screen.getAllByRole('checkbox')[1]
      await user.click(firstCheckbox)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /search selected/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /remove selected/i })).toBeInTheDocument()
      })
    })

    it('clears selection when changing pages', async () => {
      const user = userEvent.setup()

      // Page 1
      mockFetchSongs.mockResolvedValueOnce({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50, 1),
      })

      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      // Select a song
      const firstCheckbox = screen.getAllByRole('checkbox')[1]
      await user.click(firstCheckbox)

      await waitFor(() => {
        expect(screen.getByText(/1 song selected/i)).toBeInTheDocument()
      })

      // Navigate to next page
      mockFetchSongs.mockResolvedValueOnce({
        success: true,
        total: 100,
        count: 50,
        songs: createMockSongs(50, 51),
      })

      await user.click(screen.getByRole('button', { name: /next/i }))

      await waitFor(() => {
        expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('row actions', () => {
    beforeEach(() => {
      mockFetchSongs.mockResolvedValue({
        success: true,
        total: 1,
        count: 1,
        songs: createMockSongs(1),
      })

      // Mock window.alert
      vi.spyOn(window, 'alert').mockImplementation(() => {})
    })

    it('displays search and delete buttons for each row', async () => {
      render(<SongsPage />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      const searchButtons = screen.getAllByRole('button', { name: '' }).filter((btn) =>
        btn.querySelector('svg')?.classList.contains('lucide-search')
      )
      const deleteButtons = screen.getAllByRole('button', { name: '' }).filter((btn) =>
        btn.querySelector('svg')?.classList.contains('lucide-trash-2')
      )

      expect(searchButtons).toHaveLength(1)
      expect(deleteButtons).toHaveLength(1)
    })
  })
})
