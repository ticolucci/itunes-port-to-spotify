import { describe, it, expect } from 'vitest'
import { songsReducer, type SongsAction } from './songsReducer'
import type { SongWithMatch } from '@/lib/song-matcher-utils'
import type { Song } from '@/lib/schema'
import type { SpotifyTrack } from '@/lib/spotify'

// Test fixtures
const createMockSong = (overrides: Partial<Song> = {}): Song => ({
  id: 1,
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  album_artist: null,
  filename: null,
  spotify_id: null,
  ...overrides,
})

const createMockSpotifyTrack = (overrides: Partial<SpotifyTrack> = {}): SpotifyTrack => ({
  id: 'spotify123',
  name: 'Test Song',
  artists: [{ name: 'Test Artist', id: 'artist1' }],
  album: {
    name: 'Test Album',
    images: [{ url: 'https://example.com/image.jpg', height: 640, width: 640 }],
  },
  ...overrides,
})

const createMockSongWithMatch = (overrides: Partial<SongWithMatch> = {}): SongWithMatch => ({
  dbSong: createMockSong(),
  spotifyMatch: null,
  similarity: 0,
  isMatched: false,
  searching: false,
  ...overrides,
})

describe('songsReducer', () => {
  describe('SET_SONGS', () => {
    it('replaces entire state with payload', () => {
      const initialState: SongWithMatch[] = [createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }) })]
      const newState: SongWithMatch[] = [
        createMockSongWithMatch({ dbSong: createMockSong({ id: 2 }) }),
        createMockSongWithMatch({ dbSong: createMockSong({ id: 3 }) }),
      ]
      const action: SongsAction = { type: 'SET_SONGS', payload: newState }

      const result = songsReducer(initialState, action)

      expect(result).toEqual(newState)
      expect(result).toHaveLength(2)
    })
  })

  describe('SET_SEARCHING', () => {
    it('sets searching flag for specific song', () => {
      const state: SongWithMatch[] = [
        createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }), searching: false }),
        createMockSongWithMatch({ dbSong: createMockSong({ id: 2 }), searching: false }),
      ]
      const action: SongsAction = { type: 'SET_SEARCHING', payload: { songId: 1, searching: true } }

      const result = songsReducer(state, action)

      expect(result[0].searching).toBe(true)
      expect(result[1].searching).toBe(false)
    })

    it('can clear searching flag', () => {
      const state: SongWithMatch[] = [
        createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }), searching: true }),
      ]
      const action: SongsAction = { type: 'SET_SEARCHING', payload: { songId: 1, searching: false } }

      const result = songsReducer(state, action)

      expect(result[0].searching).toBe(false)
    })
  })

  describe('UPDATE_MATCH', () => {
    it('updates spotify match and similarity', () => {
      const state: SongWithMatch[] = [
        createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }), searching: true }),
      ]
      const spotifyTrack = createMockSpotifyTrack()
      const action: SongsAction = {
        type: 'UPDATE_MATCH',
        payload: { songId: 1, spotifyMatch: spotifyTrack, similarity: 85 },
      }

      const result = songsReducer(state, action)

      expect(result[0].spotifyMatch).toEqual(spotifyTrack)
      expect(result[0].similarity).toBe(85)
      expect(result[0].searching).toBe(false)
    })

    it('does not modify other songs', () => {
      const state: SongWithMatch[] = [
        createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }) }),
        createMockSongWithMatch({ dbSong: createMockSong({ id: 2 }) }),
      ]
      const spotifyTrack = createMockSpotifyTrack()
      const action: SongsAction = {
        type: 'UPDATE_MATCH',
        payload: { songId: 1, spotifyMatch: spotifyTrack, similarity: 85 },
      }

      const result = songsReducer(state, action)

      expect(result[0].spotifyMatch).toEqual(spotifyTrack)
      expect(result[1].spotifyMatch).toBeNull()
    })
  })

  describe('AUTO_MATCH', () => {
    it('updates match and marks as matched', () => {
      const state: SongWithMatch[] = [
        createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }), searching: true }),
      ]
      const spotifyTrack = createMockSpotifyTrack({ id: 'spotify123' })
      const action: SongsAction = {
        type: 'AUTO_MATCH',
        payload: { songId: 1, spotifyMatch: spotifyTrack, similarity: 90, spotifyId: 'spotify123' },
      }

      const result = songsReducer(state, action)

      expect(result[0].spotifyMatch).toEqual(spotifyTrack)
      expect(result[0].similarity).toBe(90)
      expect(result[0].isMatched).toBe(true)
      expect(result[0].searching).toBe(false)
      expect(result[0].dbSong.spotify_id).toBe('spotify123')
    })
  })

  describe('MARK_MATCHED', () => {
    it('marks song as matched with spotify_id', () => {
      const state: SongWithMatch[] = [
        createMockSongWithMatch({
          dbSong: createMockSong({ id: 1 }),
          spotifyMatch: createMockSpotifyTrack(),
          isMatched: false,
        }),
      ]
      const action: SongsAction = {
        type: 'MARK_MATCHED',
        payload: { songId: 1, spotifyId: 'spotify123' },
      }

      const result = songsReducer(state, action)

      expect(result[0].isMatched).toBe(true)
      expect(result[0].dbSong.spotify_id).toBe('spotify123')
    })

    it('preserves existing spotifyMatch', () => {
      const spotifyTrack = createMockSpotifyTrack()
      const state: SongWithMatch[] = [
        createMockSongWithMatch({
          dbSong: createMockSong({ id: 1 }),
          spotifyMatch: spotifyTrack,
          similarity: 85,
        }),
      ]
      const action: SongsAction = {
        type: 'MARK_MATCHED',
        payload: { songId: 1, spotifyId: 'spotify123' },
      }

      const result = songsReducer(state, action)

      expect(result[0].spotifyMatch).toEqual(spotifyTrack)
      expect(result[0].similarity).toBe(85)
    })
  })

  describe('BATCH_MATCH', () => {
    it('updates multiple songs at once', () => {
      const state: SongWithMatch[] = [
        createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }) }),
        createMockSongWithMatch({ dbSong: createMockSong({ id: 2 }) }),
        createMockSongWithMatch({ dbSong: createMockSong({ id: 3 }) }),
      ]
      const track1 = createMockSpotifyTrack({ id: 'spotify1' })
      const track2 = createMockSpotifyTrack({ id: 'spotify2' })
      const matchResults = new Map([
        [1, { spotifyMatch: track1, similarity: 85 }],
        [3, { spotifyMatch: track2, similarity: 92 }],
      ])
      const action: SongsAction = { type: 'BATCH_MATCH', payload: matchResults }

      const result = songsReducer(state, action)

      expect(result[0].isMatched).toBe(true)
      expect(result[0].spotifyMatch).toEqual(track1)
      expect(result[0].similarity).toBe(85)
      expect(result[0].dbSong.spotify_id).toBe('spotify1')

      expect(result[1].isMatched).toBe(false)
      expect(result[1].spotifyMatch).toBeNull()

      expect(result[2].isMatched).toBe(true)
      expect(result[2].spotifyMatch).toEqual(track2)
      expect(result[2].similarity).toBe(92)
      expect(result[2].dbSong.spotify_id).toBe('spotify2')
    })

    it('handles empty batch', () => {
      const state: SongWithMatch[] = [
        createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }) }),
      ]
      const matchResults = new Map()
      const action: SongsAction = { type: 'BATCH_MATCH', payload: matchResults }

      const result = songsReducer(state, action)

      expect(result).toEqual(state)
    })
  })

  describe('CLEAR_MATCH', () => {
    it('unmatches song and clears spotify_id', () => {
      const state: SongWithMatch[] = [
        createMockSongWithMatch({
          dbSong: createMockSong({ id: 1, spotify_id: 'spotify123' }),
          spotifyMatch: createMockSpotifyTrack(),
          isMatched: true,
          similarity: 85,
        }),
      ]
      const action: SongsAction = { type: 'CLEAR_MATCH', payload: { songId: 1 } }

      const result = songsReducer(state, action)

      expect(result[0].isMatched).toBe(false)
      expect(result[0].dbSong.spotify_id).toBeNull()
    })

    it('preserves spotifyMatch for potential re-matching', () => {
      const spotifyTrack = createMockSpotifyTrack()
      const state: SongWithMatch[] = [
        createMockSongWithMatch({
          dbSong: createMockSong({ id: 1, spotify_id: 'spotify123' }),
          spotifyMatch: spotifyTrack,
          isMatched: true,
        }),
      ]
      const action: SongsAction = { type: 'CLEAR_MATCH', payload: { songId: 1 } }

      const result = songsReducer(state, action)

      expect(result[0].spotifyMatch).toEqual(spotifyTrack)
    })
  })

  describe('default case', () => {
    it('returns state unchanged for unknown action', () => {
      const state: SongWithMatch[] = [createMockSongWithMatch()]
      const action = { type: 'UNKNOWN_ACTION' } as unknown as SongsAction

      const result = songsReducer(state, action)

      expect(result).toBe(state)
    })
  })

  describe('immutability', () => {
    it('does not mutate original state', () => {
      const originalSong = createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }), searching: false })
      const state: SongWithMatch[] = [originalSong]
      const action: SongsAction = { type: 'SET_SEARCHING', payload: { songId: 1, searching: true } }

      songsReducer(state, action)

      expect(originalSong.searching).toBe(false)
    })
  })
})
