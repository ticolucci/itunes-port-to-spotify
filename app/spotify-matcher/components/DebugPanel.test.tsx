import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DebugPanel, DebugInfo } from './DebugPanel'

describe('DebugPanel', () => {
  const defaultDebugInfo: DebugInfo = {
    query: 'track:Test Song',
    trackCount: 5,
    topResults: [
      { name: 'Song 1', artist: 'Artist 1', album: 'Album 1' },
      { name: 'Song 2', artist: 'Artist 2', album: 'Album 2' },
      { name: 'Song 3', artist: 'Artist 3', album: 'Album 3' },
    ],
  }

  describe('rendering', () => {
    it('should render debug panel with query information', () => {
      render(<DebugPanel debugInfo={defaultDebugInfo} />)

      expect(screen.getByTestId('debug-panel')).toBeInTheDocument()
      expect(screen.getByText('track:Test Song')).toBeInTheDocument()
    })

    it('should display results count', () => {
      render(<DebugPanel debugInfo={defaultDebugInfo} />)

      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('should display top 3 results', () => {
      render(<DebugPanel debugInfo={defaultDebugInfo} />)

      expect(screen.getByText(/Song 1/)).toBeInTheDocument()
      expect(screen.getByText(/Artist 1/)).toBeInTheDocument()
      expect(screen.getByText(/Song 2/)).toBeInTheDocument()
      expect(screen.getByText(/Song 3/)).toBeInTheDocument()
    })
  })

  describe('empty results', () => {
    it('should show warning when no results found', () => {
      const emptyDebugInfo: DebugInfo = {
        query: 'track:Unknown Song',
        trackCount: 0,
        topResults: [],
      }

      render(<DebugPanel debugInfo={emptyDebugInfo} />)

      expect(screen.getByText(/NO RESULTS/)).toBeInTheDocument()
    })

    it('should not show warning when results exist', () => {
      render(<DebugPanel debugInfo={defaultDebugInfo} />)

      expect(screen.queryByText(/NO RESULTS/)).not.toBeInTheDocument()
    })
  })

  describe('null handling', () => {
    it('should return null when debugInfo is null', () => {
      const { container } = render(<DebugPanel debugInfo={null} />)

      expect(container.firstChild).toBeNull()
    })
  })
})
