import { describe, it, expect } from 'vitest'
import type { Song } from '@/lib/schema'
import {
  shouldSkipSong,
  hasIncompleteMetadata,
  isEligibleForAutoMatch,
  shouldAttemptAutoMatch,
  getMatchedCount,
  getUnmatchedSongs,
  hasMoreToReview,
  createInitialSongs,
  getEligibleAutoMatchSongs,
  findNextReviewableIndex,
  type SongWithMatch,
} from './song-matcher-utils'
import {
  createMockSong,
  createMockSpotifyTrack,
  createMockSongWithMatch,
} from '@/lib/test-helpers/fixtures'

describe('shouldSkipSong', () => {
  it('returns true when title is null', () => {
    const song = createMockSong({ title: null })
    expect(shouldSkipSong(song)).toBe(true)
  })

  it('returns true when title is empty string', () => {
    const song = createMockSong({ title: '' })
    expect(shouldSkipSong(song)).toBe(true)
  })

  it('returns true when title is whitespace only', () => {
    const song = createMockSong({ title: '   ' })
    expect(shouldSkipSong(song)).toBe(true)
  })

  it('returns false when title exists', () => {
    const song = createMockSong({ title: 'Valid Title' })
    expect(shouldSkipSong(song)).toBe(false)
  })
})

describe('hasIncompleteMetadata', () => {
  it('returns true when title is missing', () => {
    const song = createMockSong({ title: null })
    expect(hasIncompleteMetadata(song)).toBe(true)
  })

  it('returns true when artist is missing', () => {
    const song = createMockSong({ artist: null })
    expect(hasIncompleteMetadata(song)).toBe(true)
  })

  it('returns true when album is missing', () => {
    const song = createMockSong({ album: null })
    expect(hasIncompleteMetadata(song)).toBe(true)
  })

  it('returns false when all metadata is present', () => {
    const song = createMockSong()
    expect(hasIncompleteMetadata(song)).toBe(false)
  })
})

describe('isEligibleForAutoMatch', () => {
  it('returns true when all conditions are met', () => {
    const songWithMatch = createMockSongWithMatch({
      spotifyMatch: createMockSpotifyTrack(),
      similarity: 85,
    })
    const matchingIds = new Set<number>()
    const processedMatches = new Set<number>()

    expect(isEligibleForAutoMatch(songWithMatch, matchingIds, processedMatches)).toBe(true)
  })

  it('returns false when no Spotify match', () => {
    const songWithMatch = createMockSongWithMatch({ spotifyMatch: null })
    const matchingIds = new Set<number>()
    const processedMatches = new Set<number>()

    expect(isEligibleForAutoMatch(songWithMatch, matchingIds, processedMatches)).toBe(false)
  })

  it('returns false when similarity < 80', () => {
    const songWithMatch = createMockSongWithMatch({
      spotifyMatch: createMockSpotifyTrack(),
      similarity: 75,
    })
    const matchingIds = new Set<number>()
    const processedMatches = new Set<number>()

    expect(isEligibleForAutoMatch(songWithMatch, matchingIds, processedMatches)).toBe(false)
  })

  it('returns false when already matched', () => {
    const songWithMatch = createMockSongWithMatch({
      spotifyMatch: createMockSpotifyTrack(),
      isMatched: true,
    })
    const matchingIds = new Set<number>()
    const processedMatches = new Set<number>()

    expect(isEligibleForAutoMatch(songWithMatch, matchingIds, processedMatches)).toBe(false)
  })

  it('returns false when currently being matched', () => {
    const songWithMatch = createMockSongWithMatch({
      spotifyMatch: createMockSpotifyTrack(),
    })
    const matchingIds = new Set<number>([songWithMatch.dbSong.id])
    const processedMatches = new Set<number>()

    expect(isEligibleForAutoMatch(songWithMatch, matchingIds, processedMatches)).toBe(false)
  })

  it('returns false when already processed', () => {
    const songWithMatch = createMockSongWithMatch({
      spotifyMatch: createMockSpotifyTrack(),
    })
    const matchingIds = new Set<number>()
    const processedMatches = new Set<number>([songWithMatch.dbSong.id])

    expect(isEligibleForAutoMatch(songWithMatch, matchingIds, processedMatches)).toBe(false)
  })
})

describe('shouldAttemptAutoMatch', () => {
  it('returns true for similarity >= 80', () => {
    expect(shouldAttemptAutoMatch(80)).toBe(true)
    expect(shouldAttemptAutoMatch(85)).toBe(true)
    expect(shouldAttemptAutoMatch(100)).toBe(true)
  })

  it('returns false for similarity < 80', () => {
    expect(shouldAttemptAutoMatch(79)).toBe(false)
    expect(shouldAttemptAutoMatch(50)).toBe(false)
    expect(shouldAttemptAutoMatch(0)).toBe(false)
  })
})

describe('getMatchedCount', () => {
  it('returns 0 for empty array', () => {
    expect(getMatchedCount([])).toBe(0)
  })

  it('counts only matched songs', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({ isMatched: true }),
      createMockSongWithMatch({ isMatched: false }),
      createMockSongWithMatch({ isMatched: true }),
    ]
    expect(getMatchedCount(songs)).toBe(2)
  })
})

describe('getUnmatchedSongs', () => {
  it('returns empty array when all matched', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({ isMatched: true }),
      createMockSongWithMatch({ isMatched: true }),
    ]
    expect(getUnmatchedSongs(songs)).toEqual([])
  })

  it('returns only unmatched songs', () => {
    const unmatched1 = createMockSongWithMatch({ isMatched: false, dbSong: createMockSong({ id: 1 }) })
    const matched = createMockSongWithMatch({ isMatched: true, dbSong: createMockSong({ id: 2 }) })
    const unmatched2 = createMockSongWithMatch({ isMatched: false, dbSong: createMockSong({ id: 3 }) })

    const songs: SongWithMatch[] = [unmatched1, matched, unmatched2]
    const result = getUnmatchedSongs(songs)

    expect(result).toHaveLength(2)
    expect(result).toContain(unmatched1)
    expect(result).toContain(unmatched2)
  })
})

describe('hasMoreToReview', () => {
  it('returns true when current index < total', () => {
    expect(hasMoreToReview(0, 5)).toBe(true)
    expect(hasMoreToReview(4, 5)).toBe(true)
  })

  it('returns false when current index >= total', () => {
    expect(hasMoreToReview(5, 5)).toBe(false)
    expect(hasMoreToReview(6, 5)).toBe(false)
  })
})

describe('createInitialSongs', () => {
  it('creates SongWithMatch from database songs', () => {
    const dbSongs: Song[] = [
      createMockSong({ id: 1, spotify_id: null }),
      createMockSong({ id: 2, spotify_id: 'spotify123' }),
    ]

    const result = createInitialSongs(dbSongs)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      dbSong: dbSongs[0],
      spotifyMatch: null,
      similarity: 0,
      isMatched: false,
      searching: false,
    })
    expect(result[1]).toEqual({
      dbSong: dbSongs[1],
      spotifyMatch: null,
      similarity: 0,
      isMatched: true,
      searching: false,
    })
  })

  it('handles empty array', () => {
    expect(createInitialSongs([])).toEqual([])
  })
})

describe('getEligibleAutoMatchSongs', () => {
  it('returns only eligible songs', () => {
    const eligible = createMockSongWithMatch({
      dbSong: createMockSong({ id: 1 }),
      spotifyMatch: createMockSpotifyTrack(),
      similarity: 85,
      isMatched: false,
    })
    const lowSimilarity = createMockSongWithMatch({
      dbSong: createMockSong({ id: 2 }),
      spotifyMatch: createMockSpotifyTrack(),
      similarity: 70,
      isMatched: false,
    })
    const alreadyMatched = createMockSongWithMatch({
      dbSong: createMockSong({ id: 3 }),
      spotifyMatch: createMockSpotifyTrack(),
      similarity: 90,
      isMatched: true,
    })

    const songs: SongWithMatch[] = [eligible, lowSimilarity, alreadyMatched]
    const matchingIds = new Set<number>()
    const processedMatches = new Set<number>()

    const result = getEligibleAutoMatchSongs(songs, matchingIds, processedMatches)

    expect(result).toHaveLength(1)
    expect(result[0]).toBe(eligible)
  })

  it('excludes songs in matchingIds', () => {
    const song = createMockSongWithMatch({
      dbSong: createMockSong({ id: 1 }),
      spotifyMatch: createMockSpotifyTrack(),
      similarity: 85,
    })
    const matchingIds = new Set<number>([1])
    const processedMatches = new Set<number>()

    const result = getEligibleAutoMatchSongs([song], matchingIds, processedMatches)
    expect(result).toHaveLength(0)
  })

  it('excludes songs in processedMatches', () => {
    const song = createMockSongWithMatch({
      dbSong: createMockSong({ id: 1 }),
      spotifyMatch: createMockSpotifyTrack(),
      similarity: 85,
    })
    const matchingIds = new Set<number>()
    const processedMatches = new Set<number>([1])

    const result = getEligibleAutoMatchSongs([song], matchingIds, processedMatches)
    expect(result).toHaveLength(0)
  })
})

describe('findNextReviewableIndex', () => {
  it('returns startIndex when song at startIndex is reviewable', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 1 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: false,
      }),
    ]
    expect(findNextReviewableIndex(songs, 0)).toBe(0)
  })

  it('skips songs that are already matched', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 1 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: true, // already matched
      }),
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 2 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: false, // reviewable
      }),
    ]
    expect(findNextReviewableIndex(songs, 0)).toBe(1)
  })

  it('skips songs with no spotifyMatch (failed search)', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 1 }),
        spotifyMatch: null, // failed search
        isMatched: false,
      }),
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 2 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: false, // reviewable
      }),
    ]
    expect(findNextReviewableIndex(songs, 0)).toBe(1)
  })

  it('skips songs that are still searching', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 1 }),
        spotifyMatch: null,
        searching: true, // still searching
        isMatched: false,
      }),
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 2 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: false, // reviewable
      }),
    ]
    expect(findNextReviewableIndex(songs, 0)).toBe(1)
  })

  it('returns -1 when no reviewable songs exist', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 1 }),
        spotifyMatch: null, // failed search
        isMatched: false,
      }),
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 2 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: true, // already matched
      }),
    ]
    expect(findNextReviewableIndex(songs, 0)).toBe(-1)
  })

  it('returns -1 when startIndex is beyond array length', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 1 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: false,
      }),
    ]
    expect(findNextReviewableIndex(songs, 5)).toBe(-1)
  })

  it('finds reviewable song after multiple non-reviewable songs', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 1 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: true, // already matched
      }),
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 2 }),
        spotifyMatch: null, // failed search
        isMatched: false,
      }),
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 3 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: true, // already matched
      }),
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 4 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: false, // reviewable!
      }),
    ]
    expect(findNextReviewableIndex(songs, 0)).toBe(3)
  })

  it('respects startIndex and skips earlier songs', () => {
    const songs: SongWithMatch[] = [
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 1 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: false, // reviewable but before startIndex
      }),
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 2 }),
        spotifyMatch: null, // failed search
        isMatched: false,
      }),
      createMockSongWithMatch({
        dbSong: createMockSong({ id: 3 }),
        spotifyMatch: createMockSpotifyTrack(),
        isMatched: false, // reviewable, after startIndex
      }),
    ]
    expect(findNextReviewableIndex(songs, 1)).toBe(2)
  })

  it('returns -1 for empty array', () => {
    expect(findNextReviewableIndex([], 0)).toBe(-1)
  })
})
