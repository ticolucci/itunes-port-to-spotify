import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import type { Song } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const db = getDatabase();

    // Parse URL for optional query parameters (for future pagination/filtering)
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build query
    let query = "SELECT * FROM songs ORDER BY id";

    // Add pagination if provided
    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
      if (offset) {
        query += ` OFFSET ${parseInt(offset)}`;
      }
    }

    // Execute query and fetch all rows
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

    // Return JSON response
    return NextResponse.json({
      success: true,
      count: songs.length,
      songs,
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch songs from database",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
