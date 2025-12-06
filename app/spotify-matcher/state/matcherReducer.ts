import type { SongWithMatch } from '@/lib/song-matcher-utils'
import type { SpotifyTrack } from '@/lib/spotify'

export interface DebugInfo {
  query: string
  trackCount: number
  topResults: Array<{ name: string; artist: string; album: string }>
}

export interface MatcherState {
  currentArtist: string | null
  songs: SongWithMatch[]
  loading: boolean
  error: string | null
  matchingIds: Set<number>
  currentReviewIndex: number
  debugInfo: DebugInfo | null
}

export const initialMatcherState: MatcherState = {
  currentArtist: null,
  songs: [],
  loading: true,
  error: null,
  matchingIds: new Set(),
  currentReviewIndex: 0,
  debugInfo: null,
}

export type MatcherAction =
  // Page-level actions
  | { type: 'LOAD_ARTIST_START' }
  | { type: 'LOAD_ARTIST_SUCCESS'; payload: { artist: string | null; songs: SongWithMatch[] } }
  | { type: 'LOAD_ARTIST_ERROR'; payload: { error: string } }
  | { type: 'ADD_MATCHING_ID'; payload: number }
  | { type: 'REMOVE_MATCHING_ID'; payload: number }
  | { type: 'INCREMENT_REVIEW_INDEX' }
  | { type: 'SET_DEBUG_INFO'; payload: DebugInfo | null }
  // Song-specific actions
  | { type: 'SET_SONG_SEARCHING'; payload: { songId: number; searching: boolean } }
  | { type: 'UPDATE_SONG_MATCH'; payload: { songId: number; spotifyMatch: SpotifyTrack; similarity: number; allMatches?: Array<{ track: SpotifyTrack; similarity: number }> } }
  | { type: 'MARK_SONG_MATCHED'; payload: { songId: number; spotifyId: string } }
  | { type: 'CLEAR_SONG_MATCH'; payload: { songId: number } }
  | { type: 'UPDATE_SONG_METADATA'; payload: { songId: number; artist: string; title: string; album: string | null } }

export function matcherReducer(state: MatcherState, action: MatcherAction): MatcherState {
  switch (action.type) {
    // Page-level actions
    case 'LOAD_ARTIST_START':
      return {
        ...state,
        loading: true,
        error: null,
      }

    case 'LOAD_ARTIST_SUCCESS':
      return {
        ...state,
        currentArtist: action.payload.artist,
        songs: action.payload.songs,
        loading: false,
        currentReviewIndex: 0,
      }

    case 'LOAD_ARTIST_ERROR':
      return {
        ...state,
        error: action.payload.error,
        loading: false,
      }

    case 'ADD_MATCHING_ID': {
      const newSet = new Set(state.matchingIds)
      newSet.add(action.payload)
      return {
        ...state,
        matchingIds: newSet,
      }
    }

    case 'REMOVE_MATCHING_ID': {
      const newSet = new Set(state.matchingIds)
      newSet.delete(action.payload)
      return {
        ...state,
        matchingIds: newSet,
      }
    }

    case 'INCREMENT_REVIEW_INDEX':
      return {
        ...state,
        currentReviewIndex: state.currentReviewIndex + 1,
      }

    case 'SET_DEBUG_INFO':
      return {
        ...state,
        debugInfo: action.payload,
      }

    // Song-specific actions
    case 'SET_SONG_SEARCHING':
      return {
        ...state,
        songs: state.songs.map((item) =>
          item.dbSong.id === action.payload.songId
            ? { ...item, searching: action.payload.searching }
            : item
        ),
      }

    case 'UPDATE_SONG_MATCH':
      return {
        ...state,
        songs: state.songs.map((item) =>
          item.dbSong.id === action.payload.songId
            ? {
                ...item,
                spotifyMatch: action.payload.spotifyMatch,
                similarity: action.payload.similarity,
                allMatches: action.payload.allMatches,
                searching: false,
              }
            : item
        ),
      }

    case 'MARK_SONG_MATCHED':
      return {
        ...state,
        songs: state.songs.map((item) =>
          item.dbSong.id === action.payload.songId
            ? {
                ...item,
                isMatched: true,
                dbSong: { ...item.dbSong, spotify_id: action.payload.spotifyId },
              }
            : item
        ),
      }

    case 'CLEAR_SONG_MATCH':
      return {
        ...state,
        songs: state.songs.map((item) =>
          item.dbSong.id === action.payload.songId
            ? {
                ...item,
                isMatched: false,
                dbSong: { ...item.dbSong, spotify_id: null },
              }
            : item
        ),
      }

    case 'UPDATE_SONG_METADATA':
      return {
        ...state,
        songs: state.songs.map((item) =>
          item.dbSong.id === action.payload.songId
            ? {
                ...item,
                dbSong: {
                  ...item.dbSong,
                  artist: action.payload.artist,
                  title: action.payload.title,
                  album: action.payload.album,
                },
              }
            : item
        ),
      }

    default:
      return state
  }
}
