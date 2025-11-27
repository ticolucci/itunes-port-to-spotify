/**
 * Real, popular songs for testing
 *
 * These are well-known, classic tracks that:
 * - Are unlikely to be removed from Spotify
 * - Have stable metadata (won't change names/albums)
 * - Are globally available
 * - Represent diverse genres and eras
 *
 * Used across both unit tests and E2E tests to ensure consistent,
 * realistic test data with actual Spotify API responses.
 */

export interface TestSong {
  title: string
  artist: string
  album: string
  albumArtist?: string
  /**
   * Spotify track ID (verified as of 2024)
   * Used to validate search results
   */
  spotifyId?: string
  /**
   * Approximate number of expected matches when searching Spotify
   * Used for test assertions (e.g., "expect at least N results")
   */
  expectedMinMatches?: number
}

export interface TestArtist {
  name: string
  songs: Record<string, TestSong>
}

/**
 * Popular songs organized by artist
 */
export const POPULAR_SONGS: Record<string, TestArtist> = {
  'The Beatles': {
    name: 'The Beatles',
    songs: {
      'Hey Jude': {
        title: 'Hey Jude',
        artist: 'The Beatles',
        album: '1',
        albumArtist: 'The Beatles',
        spotifyId: '0aym2LBJBk9DAYuHHutrIl',
        expectedMinMatches: 5,
      },
      'Let It Be': {
        title: 'Let It Be',
        artist: 'The Beatles',
        album: 'Let It Be',
        albumArtist: 'The Beatles',
        spotifyId: '7iN1s7xHE4ifF5povM6A48',
        expectedMinMatches: 5,
      },
      'Yesterday': {
        title: 'Yesterday',
        artist: 'The Beatles',
        album: 'Help!',
        albumArtist: 'The Beatles',
        spotifyId: '3BQHpFgAp4l80e1XslIjNI',
        expectedMinMatches: 10,
      },
      'Come Together': {
        title: 'Come Together',
        artist: 'The Beatles',
        album: 'Abbey Road',
        albumArtist: 'The Beatles',
        spotifyId: '2EqlS6tkEnglzr7tkKAAYD',
        expectedMinMatches: 5,
      },
    },
  },
  'Queen': {
    name: 'Queen',
    songs: {
      'Bohemian Rhapsody': {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        albumArtist: 'Queen',
        spotifyId: '4u7EnebtmKWzUH433cf5Qv',
        expectedMinMatches: 5,
      },
      'We Will Rock You': {
        title: 'We Will Rock You',
        artist: 'Queen',
        album: 'News of the World',
        albumArtist: 'Queen',
        spotifyId: '4pbJqGIASGPr0ZpGpnWkDn',
        expectedMinMatches: 5,
      },
    },
  },
  'Radiohead': {
    name: 'Radiohead',
    songs: {
      'Karma Police': {
        title: 'Karma Police',
        artist: 'Radiohead',
        album: 'OK Computer',
        albumArtist: 'Radiohead',
        spotifyId: '63OQupATfueTdZMWTxW03A',
        expectedMinMatches: 3,
      },
      'Creep': {
        title: 'Creep',
        artist: 'Radiohead',
        album: 'Pablo Honey',
        albumArtist: 'Radiohead',
        spotifyId: '70LcF31zb1H0PyJoS1Sx1r',
        expectedMinMatches: 5,
      },
    },
  },
  'Pink Floyd': {
    name: 'Pink Floyd',
    songs: {
      'Money': {
        title: 'Money',
        artist: 'Pink Floyd',
        album: 'The Dark Side of the Moon',
        albumArtist: 'Pink Floyd',
        spotifyId: '6FBPOJLxUZEair6x4kLDhf',
        expectedMinMatches: 5,
      },
      'Wish You Were Here': {
        title: 'Wish You Were Here',
        artist: 'Pink Floyd',
        album: 'Wish You Were Here',
        albumArtist: 'Pink Floyd',
        spotifyId: '6mFkJmJqdDVQ1REhVfGgd1',
        expectedMinMatches: 5,
      },
    },
  },
  'Nirvana': {
    name: 'Nirvana',
    songs: {
      'Smells Like Teen Spirit': {
        title: 'Smells Like Teen Spirit',
        artist: 'Nirvana',
        album: 'Nevermind',
        albumArtist: 'Nirvana',
        spotifyId: '4CeeEOM32jQcH3eN9Q2dGj',
        expectedMinMatches: 3,
      },
      'Come as You Are': {
        title: 'Come as You Are',
        artist: 'Nirvana',
        album: 'Nevermind',
        albumArtist: 'Nirvana',
        spotifyId: '1pzK1JESlXvCrUogPWv1Ke',
        expectedMinMatches: 3,
      },
    },
  },
}

/**
 * Helper function to get a test song by artist and title
 */
export function getTestSong(artist: string, title: string): TestSong | undefined {
  return POPULAR_SONGS[artist]?.songs[title]
}

/**
 * Get all test songs as a flat array
 */
export function getAllTestSongs(): TestSong[] {
  const songs: TestSong[] = []
  for (const artist of Object.values(POPULAR_SONGS)) {
    for (const song of Object.values(artist.songs)) {
      songs.push(song)
    }
  }
  return songs
}

/**
 * Get a random test song (useful for E2E tests)
 */
export function getRandomTestSong(): TestSong {
  const allSongs = getAllTestSongs()
  return allSongs[Math.floor(Math.random() * allSongs.length)]
}
