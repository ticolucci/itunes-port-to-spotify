import { getDatabase } from '@/lib/db';
import { songs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Test API endpoint for managing library songs in E2E tests
 * Only available in non-production environments
 */

// Only allow in non-production environments
const isTestEnvironment = process.env.NODE_ENV !== 'production' ||
                          process.env.ENABLE_TEST_API === 'true';

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
 *   filename?: string
 *   spotify_id?: string | null
 * }
 */
export async function POST(request: NextRequest) {
  if (!isTestEnvironment) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const db = getDatabase();

    const [song] = await db.insert(songs).values({
      title: body.title,
      artist: body.artist,
      album: body.album,
      album_artist: body.album_artist || body.artist,
      filename: body.filename || `test_${Date.now()}.m4a`,
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
 */
export async function DELETE(request: NextRequest) {
  if (!isTestEnvironment) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const filename = searchParams.get('filename');
    const db = getDatabase();

    if (id) {
      await db.delete(songs).where(eq(songs.id, parseInt(id)));
    } else if (filename) {
      await db.delete(songs).where(eq(songs.filename, filename));
    } else {
      return NextResponse.json(
        { error: 'Must provide either id or filename' },
        { status: 400 }
      );
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
