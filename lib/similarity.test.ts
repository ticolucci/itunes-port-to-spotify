import { describe, it, expect } from 'vitest'
import { calculateSimilarity } from './similarity'

describe('calculateSimilarity', () => {
  describe('exact matches', () => {
    it('returns 100 for identical titles', () => {
      expect(calculateSimilarity('Hello World', 'Hello World')).toBe(100)
    })

    it('returns 100 for titles that match after normalization', () => {
      expect(calculateSimilarity('Hello, World!', 'hello world')).toBe(100)
    })

    it('ignores special characters and case', () => {
      expect(calculateSimilarity('Test-Song (2024)', 'testsong2024')).toBe(100)
    })
  })

  describe('substring matches', () => {
    it('returns 80 when local title is substring of spotify title', () => {
      expect(calculateSimilarity('Test', 'Test Song')).toBe(80)
    })

    it('returns 80 when spotify title is substring of local title', () => {
      expect(calculateSimilarity('Test Song Extended', 'Test Song')).toBe(80)
    })

    it('handles substring with special characters', () => {
      expect(calculateSimilarity('Test-Song', 'Test-Song (Remix)')).toBe(80)
    })
  })

  describe('word overlap', () => {
    it('calculates similarity based on common words', () => {
      const similarity = calculateSimilarity('Beautiful Day', 'Beautiful Night')
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThan(80)
    })

    it('returns 0 for completely different titles', () => {
      expect(calculateSimilarity('Song A', 'Song B')).toBeGreaterThan(0)
    })

    it('handles multiple word overlap', () => {
      const similarity = calculateSimilarity('Love Me Do', 'Love Me Tender')
      expect(similarity).toBeGreaterThan(50)
    })
  })

  describe('edge cases', () => {
    it('returns 0 for null local title', () => {
      expect(calculateSimilarity(null, 'Test Song')).toBe(0)
    })

    it('returns 0 for empty local title', () => {
      expect(calculateSimilarity('', 'Test Song')).toBe(0)
    })

    it('returns 0 for empty spotify title', () => {
      expect(calculateSimilarity('Test Song', '')).toBe(0)
    })

    it('handles whitespace-only titles', () => {
      expect(calculateSimilarity('   ', 'Test Song')).toBe(0)
    })
  })

  describe('normalization', () => {
    it('removes all non-alphanumeric characters', () => {
      expect(calculateSimilarity('Song!@#$%', 'song')).toBe(100)
    })

    it('converts to lowercase', () => {
      expect(calculateSimilarity('UPPERCASE', 'uppercase')).toBe(100)
    })

    it('handles mixed case and special characters', () => {
      expect(calculateSimilarity('Test-Song (Live)', 'test song live')).toBe(100)
    })
  })

  describe('real-world examples', () => {
    it('matches song with featured artist notation', () => {
      const similarity = calculateSimilarity(
        'Get Lucky',
        'Get Lucky (feat. Pharrell Williams)'
      )
      expect(similarity).toBe(80)
    })

    it('matches song with remix suffix', () => {
      const similarity = calculateSimilarity('Song Title', 'Song Title - Remix')
      expect(similarity).toBe(80)
    })

    it('matches song with remaster notation', () => {
      const similarity = calculateSimilarity(
        'Yesterday',
        'Yesterday - Remastered 2009'
      )
      expect(similarity).toBe(80)
    })
  })
})
