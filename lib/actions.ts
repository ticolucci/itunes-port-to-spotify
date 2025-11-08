"use server";

import { getDatabase } from "@/lib/db";
import { songs as songsTable } from "@/lib/schema";
import { asc } from "drizzle-orm";
import type { Song } from "@/lib/types";

export async function fetchSongs(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ success: true; total: number; count: number; songs: Song[] } | { success: false; error: string }> {
  try {
    const db = getDatabase();

    // Get all rows first to get the total
    const allRows = await db.select().from(songsTable);
    const total = allRows.length;

    // Build and execute paginated query
    const rows = options?.limit !== undefined && options?.offset !== undefined
      ? await db.select().from(songsTable).orderBy(asc(songsTable.id)).limit(options.limit).offset(options.offset)
      : options?.limit !== undefined
      ? await db.select().from(songsTable).orderBy(asc(songsTable.id)).limit(options.limit)
      : await db.select().from(songsTable).orderBy(asc(songsTable.id));

    // Map database rows to Song objects
    const songs: Song[] = rows.map((row) => ({
      id: row.id,
      title: row.title || "",
      artist: row.artist || "",
      album: row.album || "",
      album_artist: row.album_artist || "",
      filename: row.filename || "",
    }));

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
