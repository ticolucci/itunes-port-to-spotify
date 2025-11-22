import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Songs table schema
 *
 * Represents songs imported from iTunes library with metadata
 * for searching on Spotify.
 *
 * Note: title, album, artist, and album_artist can be NULL in production
 * as iTunes library data may have incomplete metadata.
 */
export const songs = sqliteTable(
  "songs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    title: text("title").$type<string | null>(),
    album: text("album").$type<string | null>(),
    artist: text("artist").$type<string | null>(),
    album_artist: text("album_artist").$type<string | null>(),
    filename: text("filename"),
    spotify_id: text("spotify_id"),
  },
  (table) => ({
    albumArtistIdx: index("idx_songs_album_artist").on(
      table.artist,
      table.album,
      table.album_artist
    ),
  })
);

/**
 * TypeScript types inferred from schema
 */
export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;

/**
 * Spotify search cache table schema
 *
 * Caches Spotify API search results to reduce API calls and improve performance.
 * Uses manual TTL - created_at timestamp is checked against configured TTL on read.
 */
export const spotifySearchCache = sqliteTable("spotify_search_cache", {
  cache_key: text("cache_key").primaryKey(),
  results: text("results").notNull(), // JSON serialized SpotifyTrack[]
  created_at: integer("created_at").notNull(), // Unix timestamp in milliseconds
});

export type SpotifySearchCacheEntry = typeof spotifySearchCache.$inferSelect;
export type NewSpotifySearchCacheEntry = typeof spotifySearchCache.$inferInsert;
