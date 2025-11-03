"use server";

import { getDatabase } from "@/lib/db";
import type { Song } from "@/lib/types";

export async function fetchSongs(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ success: true; total: number; count: number; songs: Song[] } | { success: false; error: string }> {
  try {
    const db = getDatabase();

    // Get total count of all songs
    const countStmt = db.prepare("SELECT COUNT(*) as total FROM songs");
    const countResult = countStmt.get() as { total: number };
    const total = countResult.total;

    // Build query for songs
    let query = "SELECT * FROM songs ORDER BY id";

    // Add pagination if provided
    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
      if (options?.offset) {
        query += ` OFFSET ${options.offset}`;
      }
    }

    // Execute query and fetch rows
    const stmt = db.prepare(query);
    const rows = stmt.all();

    // Map database rows to Song objects
    const songs: Song[] = rows.map((row: any) => ({
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
