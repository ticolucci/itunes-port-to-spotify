import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

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
