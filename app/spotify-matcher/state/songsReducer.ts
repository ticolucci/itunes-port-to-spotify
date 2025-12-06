import type { SongWithMatch } from '@/lib/song-matcher-utils'
import type { SpotifyTrack } from '@/lib/spotify'

export type SongsAction =
  | { type: 'SET_SONGS'; payload: SongWithMatch[] }
  | { type: 'SET_SEARCHING'; payload: { songId: number; searching: boolean } }
  | { type: 'UPDATE_MATCH'; payload: { songId: number; spotifyMatch: SpotifyTrack; similarity: number; allMatches?: Array<{ track: SpotifyTrack; similarity: number }> } }
  | { type: 'MARK_MATCHED'; payload: { songId: number; spotifyId: string } }
  | { type: 'CLEAR_MATCH'; payload: { songId: number } }
  | { type: 'UPDATE_SONG_METADATA'; payload: { songId: number; artist: string; title: string; album: string | null } }

export function songsReducer(state: SongWithMatch[], action: SongsAction): SongWithMatch[] {
  switch (action.type) {
    case 'SET_SONGS':
      return action.payload

    case 'SET_SEARCHING':
      return state.map((item) =>
        item.dbSong.id === action.payload.songId
          ? { ...item, searching: action.payload.searching }
          : item
      )

    case 'UPDATE_MATCH':
      return state.map((item) =>
        item.dbSong.id === action.payload.songId
          ? {
              ...item,
              spotifyMatch: action.payload.spotifyMatch,
              similarity: action.payload.similarity,
              allMatches: action.payload.allMatches,
              searching: false,
            }
          : item
      )

    case 'MARK_MATCHED':
      return state.map((item) =>
        item.dbSong.id === action.payload.songId
          ? {
              ...item,
              isMatched: true,
              dbSong: { ...item.dbSong, spotify_id: action.payload.spotifyId },
            }
          : item
      )

    case 'CLEAR_MATCH':
      return state.map((item) =>
        item.dbSong.id === action.payload.songId
          ? {
              ...item,
              isMatched: false,
              dbSong: { ...item.dbSong, spotify_id: null },
            }
          : item
      )

    case 'UPDATE_SONG_METADATA':
      return state.map((item) =>
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
      )

    default:
      return state
  }
}
