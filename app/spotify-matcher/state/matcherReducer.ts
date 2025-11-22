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
  autoMatchEnabled: boolean
  processedAutoMatches: Set<number>
  autoMatchInProgress: boolean
  debugInfo: DebugInfo | null
}

export const initialMatcherState: MatcherState = {
  currentArtist: null,
  songs: [],
  loading: true,
  error: null,
  matchingIds: new Set(),
  currentReviewIndex: 0,
  autoMatchEnabled: false,
  processedAutoMatches: new Set(),
  autoMatchInProgress: false,
  debugInfo: null,
}

export type MatcherAction =
  // Page-level actions
  | { type: 'LOAD_ARTIST_START' }
  | { type: 'LOAD_ARTIST_SUCCESS'; payload: { artist: string | null; songs: SongWithMatch[] } }
  | { type: 'LOAD_ARTIST_ERROR'; payload: { error: string } }
  | { type: 'SET_AUTO_MATCH_ENABLED'; payload: boolean }
  | { type: 'SET_AUTO_MATCH_IN_PROGRESS'; payload: boolean }
  | { type: 'ADD_PROCESSED_AUTO_MATCHES'; payload: number[] }
  | { type: 'ADD_MATCHING_ID'; payload: number }
  | { type: 'REMOVE_MATCHING_ID'; payload: number }
  | { type: 'INCREMENT_REVIEW_INDEX' }
  | { type: 'SET_DEBUG_INFO'; payload: DebugInfo | null }
  // Song-specific actions
  | { type: 'SET_SONG_SEARCHING'; payload: { songId: number; searching: boolean } }
  | { type: 'UPDATE_SONG_MATCH'; payload: { songId: number; spotifyMatch: SpotifyTrack; similarity: number; allMatches?: Array<{ track: SpotifyTrack; similarity: number }> } }
  | { type: 'AUTO_MATCH_SONG'; payload: { songId: number; spotifyMatch: SpotifyTrack; similarity: number; spotifyId: string; allMatches?: Array<{ track: SpotifyTrack; similarity: number }> } }
  | { type: 'MARK_SONG_MATCHED'; payload: { songId: number; spotifyId: string } }
  | { type: 'BATCH_MATCH_SONGS'; payload: Map<number, { spotifyMatch: SpotifyTrack; similarity: number }> }
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
        processedAutoMatches: new Set(),
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

    case 'SET_AUTO_MATCH_ENABLED':
      return {
        ...state,
        autoMatchEnabled: action.payload,
      }

    case 'SET_AUTO_MATCH_IN_PROGRESS':
      return {
        ...state,
        autoMatchInProgress: action.payload,
      }

    case 'ADD_PROCESSED_AUTO_MATCHES': {
      const newSet = new Set(state.processedAutoMatches)
      action.payload.forEach((id) => newSet.add(id))
      return {
        ...state,
        processedAutoMatches: newSet,
      }
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

    case 'AUTO_MATCH_SONG':
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
                isMatched: true,
                dbSong: { ...item.dbSong, spotify_id: action.payload.spotifyId },
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

    case 'BATCH_MATCH_SONGS':
      return {
        ...state,
        songs: state.songs.map((item) => {
          const matchData = action.payload.get(item.dbSong.id)
          return matchData
            ? {
                ...item,
                spotifyMatch: matchData.spotifyMatch,
                similarity: matchData.similarity,
                searching: false,
                isMatched: true,
                dbSong: { ...item.dbSong, spotify_id: matchData.spotifyMatch.id },
              }
            : item
        }),
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
