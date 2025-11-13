import type { Song } from '@/lib/schema'
import type { SpotifyTrack } from '@/lib/spotify'
import type { SongWithMatch } from '@/lib/song-matcher-utils'
import { merge } from 'lodash'

/**
 * Utility type for deep partial - makes all properties and nested properties optional
 */
type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>
} : T

/**
 * Creates a mock Song object for testing.
 * All fields have sensible defaults and can be overridden.
 *
 * @example
 * const song = createMockSong({ title: 'Custom Title' })
 */
export const createMockSong = (overrides: Partial<Song> = {}): Song => ({
  id: 1,
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  album_artist: null,
  filename: null,
  spotify_id: null,
  ...overrides,
})

/**
 * Creates a mock SpotifyTrack object for testing.
 * Matches the structure returned by Spotify API.
 * Supports deep partial overrides for nested objects like album.
 *
 * @example
 * const track = createMockSpotifyTrack({ id: 'custom_id' })
 * const track = createMockSpotifyTrack({ album: { name: 'Abbey Road' } }) // images provided by default
 */
export const createMockSpotifyTrack = (overrides: DeepPartial<SpotifyTrack> = {}): SpotifyTrack => merge({
  id: 'spotify123',
  name: 'Test Song',
  artists: [{ name: 'Test Artist', id: 'artist1' }],
  album: {
    name: 'Test Album',
    images: [{ url: 'https://example.com/image.jpg', height: 640, width: 640 }],
  },
  uri: 'spotify:track:123',
}, overrides)

/**
 * Creates a mock SongWithMatch object for testing matcher state.
 * Combines a database song with optional Spotify match data.
 *
 * @example
 * const match = createMockSongWithMatch({
 *   similarity: 95,
 *   isMatched: true
 * })
 */
export const createMockSongWithMatch = (overrides: Partial<SongWithMatch> = {}): SongWithMatch => ({
  dbSong: createMockSong(),
  spotifyMatch: null,
  similarity: 0,
  isMatched: false,
  searching: false,
  ...overrides,
})

/**
 * Creates an array of mock Song objects for pagination testing.
 * Generates songs with sequential IDs and varied artist/album values.
 *
 * @param count - Number of songs to create
 * @param startId - Starting ID for sequential generation
 *
 * @example
 * const songs = createMockSongs(50, 1) // Creates songs 1-50
 * const nextPage = createMockSongs(50, 51) // Creates songs 51-100
 */
export const createMockSongs = (count: number, startId: number = 1): Song[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    title: `Song ${startId + i}`,
    artist: `Artist ${(startId + i) % 5}`, // Cycles through 5 artists
    album: `Album ${(startId + i) % 3}`, // Cycles through 3 albums
    album_artist: `Album Artist ${(startId + i) % 2}`, // Cycles through 2 album artists
    filename: `file${startId + i}.mp3`,
    spotify_id: null,
  }))
}
