"use server";

import { getDatabase } from "@/lib/db";
import { songs as songsTable } from "@/lib/schema";
import { asc, count } from "drizzle-orm";
import type { Song } from "@/lib/types";

export async function fetchSongs(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ success: true; total: number; count: number; songs: Song[] } | { success: false; error: string }> {
  try {
    const db = getDatabase();

    // Get total count efficiently without fetching all rows
    // @ts-expect-error - Drizzle's select() accepts custom fields despite TypeScript thinking otherwise
    const countResult = await db.select({ value: count() }).from(songsTable);
    // @ts-expect-error - TypeScript doesn't infer the custom select shape correctly
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
