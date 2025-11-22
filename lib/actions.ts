"use server";

import { getDatabase } from "@/lib/db";
import { songs as songsTable, type Song } from "@/lib/schema";
import { asc, count, isNull, isNotNull, and, sql, type SQL } from "drizzle-orm";
import { mapRowToSong } from "./mappers";

export interface SongFilters {
  title?: string;
  artist?: string;
  album?: string;
  hasSpotifyMatch?: boolean;
}

export async function fetchSongs(options?: {
  limit?: number;
  offset?: number;
  filters?: SongFilters;
}): Promise<{ success: true; total: number; count: number; songs: Song[] } | { success: false; error: string }> {
  try {
    const db = getDatabase();
    const filters = options?.filters;

    // Build filter conditions
    const conditions: SQL[] = [];

    if (filters?.title && filters.title.trim() !== '') {
      // Case-insensitive "starts with" using LOWER() and LIKE
      conditions.push(sql`LOWER(${songsTable.title}) LIKE ${filters.title.toLowerCase() + '%'}`);
    }

    if (filters?.artist && filters.artist.trim() !== '') {
      conditions.push(sql`LOWER(${songsTable.artist}) LIKE ${filters.artist.toLowerCase() + '%'}`);
    }

    if (filters?.album && filters.album.trim() !== '') {
      conditions.push(sql`LOWER(${songsTable.album}) LIKE ${filters.album.toLowerCase() + '%'}`);
    }

    if (filters?.hasSpotifyMatch === true) {
      conditions.push(isNotNull(songsTable.spotify_id));
    } else if (filters?.hasSpotifyMatch === false) {
      conditions.push(isNull(songsTable.spotify_id));
    }

    // Combine conditions with AND
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count with filters applied
    const countQuery = db.select({ value: count() }).from(songsTable);
    const countResult = await (whereClause ? countQuery.where(whereClause) : countQuery);
    const total = Number(countResult[0]?.value ?? 0);

    // Build and execute paginated query with filters
    let query = db.select().from(songsTable);
    if (whereClause) {
      query = query.where(whereClause) as typeof query;
    }
    const orderedQuery = query.orderBy(asc(songsTable.id));

    const rows = await (
      options?.limit !== undefined
        ? options?.offset !== undefined
          ? orderedQuery.limit(options.limit).offset(options.offset)
          : orderedQuery.limit(options.limit)
        : orderedQuery
    );

    const songs = rows.map(mapRowToSong);

    return {
      success: true,
      total, // Total songs matching filters
      count: songs.length, // Songs in current page
      songs,
    };
  } catch (error) {
    console.error("Database error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch songs from database",
    };
  }
}
