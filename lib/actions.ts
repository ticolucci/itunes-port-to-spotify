"use server";

import { getDatabase } from "@/lib/db";
import { songs as songsTable, type Song } from "@/lib/schema";
import { asc, count } from "drizzle-orm";
import { mapRowToSong } from "./mappers";

export async function fetchSongs(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ success: true; total: number; count: number; songs: Song[] } | { success: false; error: string }> {
  try {
    const db = getDatabase();

    // Get total count efficiently without fetching all rows
    const countResult = await db.select({ value: count() }).from(songsTable);
    const total = Number(countResult[0]?.value ?? 0);

    // Build and execute paginated query
    const baseQuery = db.select().from(songsTable).orderBy(asc(songsTable.id));
    const rows = await (
      options?.limit !== undefined
        ? options?.offset !== undefined
          ? baseQuery.limit(options.limit).offset(options.offset)
          : baseQuery.limit(options.limit)
        : baseQuery
    );

    const songs = rows.map(mapRowToSong);

    return {
      success: true,
      total, // Total songs in database
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
