import { getDatabase } from '@/lib/db';
import { songs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Test API endpoint for managing library songs in E2E tests
 *
 * Safety: All songs created have filenames prefixed with "test-"
 * and only "test-" prefixed songs can be deleted. This allows
 * safe use in production preview environments.
 */

/**
 * POST /api/test/library-song
 * Creates a test song in the database
 *
 * Request body:
 * {
 *   title: string
 *   artist: string
 *   album: string
 *   album_artist?: string
 *   filename?: string (will be prefixed with "test-" if not already)
 *   spotify_id?: string | null
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDatabase();

    // Ensure filename always has "test-" prefix for safety
    let filename = body.filename || `test_${Date.now()}.m4a`;
    if (!filename.startsWith('test-') && !filename.startsWith('test_')) {
      filename = `test-${filename}`;
    }

    const [song] = await db.insert(songs).values({
      title: body.title,
      artist: body.artist,
      album: body.album,
      album_artist: body.album_artist || body.artist,
      filename,
      spotify_id: body.spotify_id || null,
    }).returning();

    return NextResponse.json(song);
  } catch (error) {
    console.error('Error creating test song:', error);
    return NextResponse.json(
      { error: 'Failed to create test song' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/test/library-song?id=123
 * or
 * DELETE /api/test/library-song?filename=test_file.m4a
 * Deletes a test song from the database
 *
 * Safety: Only deletes songs with "test-" or "test_" prefixed filenames
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const filename = searchParams.get('filename');
    const db = getDatabase();

    if (!id && !filename) {
      return NextResponse.json(
        { error: 'Must provide either id or filename' },
        { status: 400 }
      );
    }

    // Only allow deletion of test songs (filename starts with "test-" or "test_")
    if (id) {
      // First verify the song has a test filename
      const songToDelete = await db
        .select()
        .from(songs)
        .where(eq(songs.id, parseInt(id)))
        .limit(1);

      if (songToDelete.length === 0) {
        return NextResponse.json(
          { error: 'Song not found' },
          { status: 404 }
        );
      }

      const songFilename = songToDelete[0].filename;
      if (!songFilename?.startsWith('test-') && !songFilename?.startsWith('test_')) {
        return NextResponse.json(
          { error: 'Can only delete test songs (filename must start with "test-" or "test_")' },
          { status: 403 }
        );
      }

      await db.delete(songs).where(eq(songs.id, parseInt(id)));
    } else if (filename) {
      // Verify filename has test prefix
      if (!filename.startsWith('test-') && !filename.startsWith('test_')) {
        return NextResponse.json(
          { error: 'Can only delete test songs (filename must start with "test-" or "test_")' },
          { status: 403 }
        );
      }

      await db.delete(songs).where(eq(songs.filename, filename));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting test song:', error);
    return NextResponse.json(
      { error: 'Failed to delete test song' },
      { status: 500 }
    );
  }
}
