import { describe, it, expect } from 'vitest'
import {
  matcherReducer,
  initialMatcherState,
  type MatcherState,
  type MatcherAction,
} from './matcherReducer'
import {
  createMockSong,
  createMockSpotifyTrack,
  createMockSongWithMatch,
} from '@/lib/test-helpers/fixtures'

describe('matcherReducer', () => {
  describe('initialMatcherState', () => {
    it('has correct default values', () => {
      expect(initialMatcherState.currentArtist).toBeNull()
      expect(initialMatcherState.songs).toEqual([])
      expect(initialMatcherState.loading).toBe(true)
      expect(initialMatcherState.error).toBeNull()
      expect(initialMatcherState.matchingIds).toEqual(new Set())
      expect(initialMatcherState.currentReviewIndex).toBe(0)
      expect(initialMatcherState.debugInfo).toBeNull()
    })
  })

  describe('LOAD_ARTIST_START', () => {
    it('sets loading true and clears error', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        loading: false,
        error: 'previous error',
      }
      const action: MatcherAction = { type: 'LOAD_ARTIST_START' }

      const result = matcherReducer(state, action)

      expect(result.loading).toBe(true)
      expect(result.error).toBeNull()
    })
  })

  describe('LOAD_ARTIST_SUCCESS', () => {
    it('sets artist, songs, loading false, and resets review index', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        loading: true,
        currentReviewIndex: 5,
      }
      const songs = [
        createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }) }),
        createMockSongWithMatch({ dbSong: createMockSong({ id: 2 }) }),
      ]
      const action: MatcherAction = {
        type: 'LOAD_ARTIST_SUCCESS',
        payload: { artist: 'Test Artist', songs },
      }

      const result = matcherReducer(state, action)

      expect(result.currentArtist).toBe('Test Artist')
      expect(result.songs).toEqual(songs)
      expect(result.loading).toBe(false)
      expect(result.currentReviewIndex).toBe(0)
    })
  })

  describe('LOAD_ARTIST_ERROR', () => {
    it('sets error and loading false', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        loading: true,
      }
      const action: MatcherAction = {
        type: 'LOAD_ARTIST_ERROR',
        payload: { error: 'Failed to load' },
      }

      const result = matcherReducer(state, action)

      expect(result.error).toBe('Failed to load')
      expect(result.loading).toBe(false)
    })
  })

  describe('ADD_MATCHING_ID', () => {
    it('adds song ID to matching set', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        matchingIds: new Set([1]),
      }
      const action: MatcherAction = { type: 'ADD_MATCHING_ID', payload: 2 }

      const result = matcherReducer(state, action)

      expect(result.matchingIds.has(1)).toBe(true)
      expect(result.matchingIds.has(2)).toBe(true)
    })
  })

  describe('REMOVE_MATCHING_ID', () => {
    it('removes song ID from matching set', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        matchingIds: new Set([1, 2, 3]),
      }
      const action: MatcherAction = { type: 'REMOVE_MATCHING_ID', payload: 2 }

      const result = matcherReducer(state, action)

      expect(result.matchingIds.has(1)).toBe(true)
      expect(result.matchingIds.has(2)).toBe(false)
      expect(result.matchingIds.has(3)).toBe(true)
    })
  })

  describe('INCREMENT_REVIEW_INDEX', () => {
    it('increments review index', () => {
      const state: MatcherState = { ...initialMatcherState, currentReviewIndex: 3 }
      const action: MatcherAction = { type: 'INCREMENT_REVIEW_INDEX' }

      const result = matcherReducer(state, action)

      expect(result.currentReviewIndex).toBe(4)
    })
  })

  describe('SET_DEBUG_INFO', () => {
    it('sets debug info', () => {
      const state: MatcherState = { ...initialMatcherState, debugInfo: null }
      const debugInfo = {
        query: 'track:Test',
        trackCount: 10,
        topResults: [{ name: 'Test', artist: 'Artist', album: 'Album' }],
      }
      const action: MatcherAction = { type: 'SET_DEBUG_INFO', payload: debugInfo }

      const result = matcherReducer(state, action)

      expect(result.debugInfo).toEqual(debugInfo)
    })

    it('clears debug info with null', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        debugInfo: { query: 'test', trackCount: 5, topResults: [] },
      }
      const action: MatcherAction = { type: 'SET_DEBUG_INFO', payload: null }

      const result = matcherReducer(state, action)

      expect(result.debugInfo).toBeNull()
    })
  })

  // Song-specific actions (migrated from songsReducer)
  describe('SET_SONG_SEARCHING', () => {
    it('sets searching flag for specific song', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        songs: [
          createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }), searching: false }),
          createMockSongWithMatch({ dbSong: createMockSong({ id: 2 }), searching: false }),
        ],
      }
      const action: MatcherAction = {
        type: 'SET_SONG_SEARCHING',
        payload: { songId: 1, searching: true },
      }

      const result = matcherReducer(state, action)

      expect(result.songs[0].searching).toBe(true)
      expect(result.songs[1].searching).toBe(false)
    })
  })

  describe('UPDATE_SONG_MATCH', () => {
    it('updates spotify match and similarity', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        songs: [createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }), searching: true })],
      }
      const spotifyTrack = createMockSpotifyTrack()
      const action: MatcherAction = {
        type: 'UPDATE_SONG_MATCH',
        payload: { songId: 1, spotifyMatch: spotifyTrack, similarity: 85 },
      }

      const result = matcherReducer(state, action)

      expect(result.songs[0].spotifyMatch).toEqual(spotifyTrack)
      expect(result.songs[0].similarity).toBe(85)
      expect(result.songs[0].searching).toBe(false)
    })

    it('stores all matches when provided', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        songs: [createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }) })],
      }
      const spotifyTrack = createMockSpotifyTrack()
      const allMatches = [
        { track: spotifyTrack, similarity: 85 },
        { track: createMockSpotifyTrack({ id: 'track2' }), similarity: 70 },
      ]
      const action: MatcherAction = {
        type: 'UPDATE_SONG_MATCH',
        payload: { songId: 1, spotifyMatch: spotifyTrack, similarity: 85, allMatches },
      }

      const result = matcherReducer(state, action)

      expect(result.songs[0].allMatches).toEqual(allMatches)
    })
  })

  describe('MARK_SONG_MATCHED', () => {
    it('marks song as matched with spotify_id', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        songs: [
          createMockSongWithMatch({
            dbSong: createMockSong({ id: 1 }),
            spotifyMatch: createMockSpotifyTrack(),
            isMatched: false,
          }),
        ],
      }
      const action: MatcherAction = {
        type: 'MARK_SONG_MATCHED',
        payload: { songId: 1, spotifyId: 'spotify123' },
      }

      const result = matcherReducer(state, action)

      expect(result.songs[0].isMatched).toBe(true)
      expect(result.songs[0].dbSong.spotify_id).toBe('spotify123')
    })
  })

  describe('CLEAR_SONG_MATCH', () => {
    it('unmatches song and clears spotify_id', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        songs: [
          createMockSongWithMatch({
            dbSong: createMockSong({ id: 1, spotify_id: 'spotify123' }),
            spotifyMatch: createMockSpotifyTrack(),
            isMatched: true,
            similarity: 85,
          }),
        ],
      }
      const action: MatcherAction = { type: 'CLEAR_SONG_MATCH', payload: { songId: 1 } }

      const result = matcherReducer(state, action)

      expect(result.songs[0].isMatched).toBe(false)
      expect(result.songs[0].dbSong.spotify_id).toBeNull()
    })
  })

  describe('UPDATE_SONG_METADATA', () => {
    it('updates song metadata', () => {
      const state: MatcherState = {
        ...initialMatcherState,
        songs: [
          createMockSongWithMatch({
            dbSong: createMockSong({ id: 1, artist: 'Old Artist', title: 'Old Title', album: 'Old Album' }),
          }),
        ],
      }
      const action: MatcherAction = {
        type: 'UPDATE_SONG_METADATA',
        payload: { songId: 1, artist: 'New Artist', title: 'New Title', album: 'New Album' },
      }

      const result = matcherReducer(state, action)

      expect(result.songs[0].dbSong.artist).toBe('New Artist')
      expect(result.songs[0].dbSong.title).toBe('New Title')
      expect(result.songs[0].dbSong.album).toBe('New Album')
    })
  })

  describe('default case', () => {
    it('returns state unchanged for unknown action', () => {
      const state: MatcherState = { ...initialMatcherState }
      const action = { type: 'UNKNOWN_ACTION' } as unknown as MatcherAction

      const result = matcherReducer(state, action)

      expect(result).toBe(state)
    })
  })

  describe('immutability', () => {
    it('does not mutate original state for songs updates', () => {
      const originalSong = createMockSongWithMatch({ dbSong: createMockSong({ id: 1 }), searching: false })
      const state: MatcherState = {
        ...initialMatcherState,
        songs: [originalSong],
      }
      const action: MatcherAction = {
        type: 'SET_SONG_SEARCHING',
        payload: { songId: 1, searching: true },
      }

      matcherReducer(state, action)

      expect(originalSong.searching).toBe(false)
    })

    it('does not mutate original state for Set updates', () => {
      const originalSet = new Set([1, 2])
      const state: MatcherState = {
        ...initialMatcherState,
        matchingIds: originalSet,
      }
      const action: MatcherAction = { type: 'ADD_MATCHING_ID', payload: 3 }

      matcherReducer(state, action)

      expect(originalSet.has(3)).toBe(false)
    })
  })
})
