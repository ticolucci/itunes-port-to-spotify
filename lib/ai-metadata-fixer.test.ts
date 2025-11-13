/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fixMetadataWithAI, clearMetadataCache, getCacheStats } from './ai-metadata-fixer'
import { createMockSong } from '@/lib/test-helpers/fixtures'

// Mock Groq chat completions create function
const mockChatCompletionsCreate = vi.fn()

// Mock the Groq SDK with a proper class
vi.mock('groq-sdk', () => {
  class MockGroq {
    chat = {
      completions: {
        create: mockChatCompletionsCreate,
      },
    }
  }

  return {
    default: MockGroq,
  }
})

const mockGroqResponse = (content: string) => {
  mockChatCompletionsCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content,
        },
      },
    ],
  } as any)
}

describe('AI Metadata Fixer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMetadataCache()
    process.env.GROQ_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    delete process.env.GROQ_API_KEY
  })

  describe('fixMetadataWithAI', () => {
    it('should fix metadata with extra whitespace', async () => {
      mockGroqResponse(
        JSON.stringify({
          suggestedArtist: 'The Beatles',
          suggestedTrack: 'Hey Jude',
          suggestedAlbum: 'Past Masters',
          confidence: 'high',
          reasoning: 'Removed extra whitespace',
          alternativeSearchQueries: ['The Beatles Hey Jude', 'Hey Jude Beatles'],
        })
      )

      const song = createMockSong({
        id: 1,
        title: ' Hey Jude  ',
        artist: 'The Beatles ',
        album: '  Past Masters ',
        filename: 'file.mp3',
      })

      const result = await fixMetadataWithAI(song)

      expect(result).toMatchObject({
        suggestedArtist: 'The Beatles',
        suggestedTrack: 'Hey Jude',
        suggestedAlbum: 'Past Masters',
        confidence: 'high',
        reasoning: 'Removed extra whitespace',
      })
      expect(result?.alternativeSearchQueries).toHaveLength(2)
    })

    it('should extract featured artists', async () => {
      mockGroqResponse(
        JSON.stringify({
          suggestedArtist: 'Daft Punk',
          suggestedTrack: 'Get Lucky',
          suggestedAlbum: 'Random Access Memories',
          confidence: 'medium',
          reasoning: 'Extracted main artist, removed featured artist from artist field',
          alternativeSearchQueries: [
            'Daft Punk Get Lucky',
            'Get Lucky Pharrell',
            'Daft Punk Get Lucky Pharrell',
          ],
        })
      )

      const song = createMockSong({
        id: 2,
        title: 'Get Lucky',
        artist: 'Daft Punk feat. Pharrell Williams',
        album: 'Random Access Memories',
        filename: 'file.mp3',
      })

      const result = await fixMetadataWithAI(song)

      expect(result).toMatchObject({
        suggestedArtist: 'Daft Punk',
        suggestedTrack: 'Get Lucky',
        confidence: 'medium',
      })
      expect(result?.alternativeSearchQueries).toHaveLength(3)
    })

    it('should handle empty/null metadata gracefully', async () => {
      mockGroqResponse(
        JSON.stringify({
          suggestedArtist: 'Unknown Artist',
          suggestedTrack: 'Unknown Track',
          confidence: 'low',
          reasoning: 'Missing critical metadata',
          alternativeSearchQueries: [],
        })
      )

      const song = createMockSong({
        id: 3,
        title: null,
        artist: null,
        album: null,
        filename: 'file.mp3',
      })

      const result = await fixMetadataWithAI(song)

      expect(result).toBeTruthy()
      expect(result?.confidence).toBe('low')
    })

    it('should cache results for identical songs', async () => {
      mockGroqResponse(
        JSON.stringify({
          suggestedArtist: 'Artist',
          suggestedTrack: 'Track',
          confidence: 'high',
          reasoning: 'Fixed',
          alternativeSearchQueries: [],
        })
      )

      const song = createMockSong({
        id: 4,
        title: 'Track',
        artist: 'Artist',
        album: 'Album',
        filename: 'file.mp3',
      })

      // First call
      await fixMetadataWithAI(song)
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1)

      // Second call with same metadata should use cache
      await fixMetadataWithAI(song)
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1) // Still 1!

      // Verify cache stats
      const stats = getCacheStats()
      expect(stats.size).toBe(1)
    })

    it('should return null on API error', async () => {
      mockChatCompletionsCreate.mockRejectedValue(new Error('API Error'))

      const song = createMockSong({
        id: 5,
        title: 'Track',
        artist: 'Artist',
        album: 'Album',
        filename: 'file.mp3',
      })

      const result = await fixMetadataWithAI(song)
      expect(result).toBeNull()
    })

    it('should return null on invalid JSON response', async () => {
      mockGroqResponse('invalid json {{{')

      const song = createMockSong({
        id: 6,
        title: 'Track',
        artist: 'Artist',
        album: 'Album',
        filename: 'file.mp3',
      })

      const result = await fixMetadataWithAI(song)
      expect(result).toBeNull()
    })

    it('should return null on schema validation error', async () => {
      mockGroqResponse(
        JSON.stringify({
          // Missing required fields
          suggestedArtist: 'Artist',
          // No suggestedTrack, confidence, reasoning, alternativeSearchQueries
        })
      )

      const song = createMockSong({
        id: 7,
        title: 'Track',
        artist: 'Artist',
        album: 'Album',
        filename: 'file.mp3',
      })

      const result = await fixMetadataWithAI(song)
      expect(result).toBeNull()
    })

    it('should return null if GROQ_API_KEY is not set', async () => {
      // Clear the API key
      delete process.env.GROQ_API_KEY

      // Also clear cache to ensure fresh groq client initialization
      clearMetadataCache()

      const song = createMockSong({
        id: 8,
        title: 'Track',
        artist: 'Artist',
        album: 'Album',
        filename: 'file.mp3',
      })

      // The function catches the error and returns null for graceful degradation
      const result = await fixMetadataWithAI(song)
      expect(result).toBeNull()
    })

    it('should handle empty response from API', async () => {
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      } as any)

      const song = createMockSong({
        id: 9,
        title: 'Track',
        artist: 'Artist',
        album: 'Album',
        filename: 'file.mp3',
      })

      const result = await fixMetadataWithAI(song)
      expect(result).toBeNull()
    })
  })

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      mockGroqResponse(
        JSON.stringify({
          suggestedArtist: 'Artist',
          suggestedTrack: 'Track',
          confidence: 'high',
          reasoning: 'Fixed',
          alternativeSearchQueries: [],
        })
      )

      const song = createMockSong({
        id: 10,
        title: 'Track',
        artist: 'Artist',
        album: 'Album',
        filename: 'file.mp3',
      })

      await fixMetadataWithAI(song)
      expect(getCacheStats().size).toBe(1)

      clearMetadataCache()
      expect(getCacheStats().size).toBe(0)
    })

    it('should provide cache stats', async () => {
      mockGroqResponse(
        JSON.stringify({
          suggestedArtist: 'Artist',
          suggestedTrack: 'Track',
          confidence: 'high',
          reasoning: 'Fixed',
          alternativeSearchQueries: [],
        })
      )

      const song1 = createMockSong({
        id: 11,
        title: 'Track1',
        artist: 'Artist1',
        album: 'Album1',
        filename: 'file1.mp3',
      })

      const song2 = createMockSong({
        id: 12,
        title: 'Track2',
        artist: 'Artist2',
        album: 'Album2',
        filename: 'file2.mp3',
      })

      await fixMetadataWithAI(song1)
      await fixMetadataWithAI(song2)

      const stats = getCacheStats()
      expect(stats.size).toBe(2)
      expect(stats.keys).toHaveLength(2)
      expect(stats.keys).toContain('Artist1:Track1:Album1')
      expect(stats.keys).toContain('Artist2:Track2:Album2')
    })
  })
})
