import { describe, it, expect } from 'vitest'
import { mapRowToSong } from './mappers'
import type { Song } from './schema'

describe('mapRowToSong', () => {
  it('should map a complete row to a Song object', () => {
    const row = {
      id: 1,
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      album_artist: 'Test Album Artist',
      filename: '/path/to/file.mp3',
      spotify_id: 'spotify:track:123',
    }

    const result = mapRowToSong(row)

    expect(result).toEqual({
      id: 1,
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      album_artist: 'Test Album Artist',
      filename: '/path/to/file.mp3',
      spotify_id: 'spotify:track:123',
    })
  })

  it('should handle null fields correctly', () => {
    const row = {
      id: 2,
      title: null,
      artist: null,
      album: null,
      album_artist: null,
      filename: null,
      spotify_id: null,
    }

    const result = mapRowToSong(row)

    expect(result).toEqual({
      id: 2,
      title: null,
      artist: null,
      album: null,
      album_artist: null,
      filename: null,
      spotify_id: null,
    })
  })

  it('should handle mixed null and non-null fields', () => {
    const row = {
      id: 3,
      title: 'Song With Partial Data',
      artist: 'Known Artist',
      album: null,
      album_artist: null,
      filename: '/path/to/file.mp3',
      spotify_id: null,
    }

    const result = mapRowToSong(row)

    expect(result).toEqual({
      id: 3,
      title: 'Song With Partial Data',
      artist: 'Known Artist',
      album: null,
      album_artist: null,
      filename: '/path/to/file.mp3',
      spotify_id: null,
    })
  })

  it('should return a new object (not mutate input)', () => {
    const row = {
      id: 4,
      title: 'Test',
      artist: 'Artist',
      album: 'Album',
      album_artist: 'Album Artist',
      filename: '/path.mp3',
      spotify_id: null,
    }

    const result = mapRowToSong(row)

    expect(result).not.toBe(row)
    expect(result).toEqual(row)
  })

  it('should preserve exact type structure for Song', () => {
    const row = {
      id: 5,
      title: 'Type Test',
      artist: 'Type Artist',
      album: 'Type Album',
      album_artist: 'Type Album Artist',
      filename: '/type.mp3',
      spotify_id: 'spotify:track:type',
    }

    const result: Song = mapRowToSong(row)

    // TypeScript type check - should compile
    expect(typeof result.id).toBe('number')
    expect(result.title).toBeDefined()
  })
})
