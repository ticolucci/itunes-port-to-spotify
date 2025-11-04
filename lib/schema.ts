import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Songs table schema
 *
 * Represents songs imported from iTunes library with metadata
 * for searching on Spotify.
 */
export const songs = sqliteTable(
  "songs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    title: text("title"),
    album: text("album"),
    artist: text("artist"),
    album_artist: text("album_artist"),
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
 * Spotify tracks table schema
 *
 * Caches Spotify search results to minimize API calls.
 * Each row represents a track returned from a specific search query.
 */
export const spotifyTracks = sqliteTable(
  "spotify_tracks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
    spotify_id: text("spotify_id").notNull(),
    name: text("name").notNull(),
    artists: text("artists").notNull(), // JSON array of artist names
    album: text("album").notNull(),
    uri: text("uri").notNull(),
    search_query: text("search_query").notNull(), // The query that found this track
    created_at: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    // Composite unique index to prevent duplicate tracks for the same search query
    searchQuerySpotifyIdx: uniqueIndex("idx_spotify_tracks_search_spotify").on(
      table.search_query,
      table.spotify_id
    ),
  })
);

/**
 * TypeScript types inferred from schema
 */
export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;

export type SpotifyTrack = typeof spotifyTracks.$inferSelect;
export type NewSpotifyTrack = typeof spotifyTracks.$inferInsert;
