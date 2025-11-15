import { test, expect } from '@playwright/test';

/**
 * E2E smoke test for Spotify Matcher flow
 * Tests the complete user journey from home page to matching a song
 */
test.describe('Spotify Matcher Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept all requests to add Vercel protection bypass header
    // This ensures ALL requests (including Server Actions) have the bypass header
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      await page.route('**/*', async (route) => {
        const headers = {
          ...route.request().headers(),
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
        };
        await route.continue({ headers });
      });
    }
  });

  test('should navigate from home to matcher and match a song', async ({ page, request, baseURL }) => {
    // Prepare headers for Vercel protection bypass
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    }

    // Create test song in database
    const response = await request.post(`${baseURL}/api/test/library-song`, {
      headers,
      data: {
        title: 'Carolina',
        artist: 'Jacob Taylor',
        album: 'The Road',
        album_artist: 'Jacob Taylor',
        filename: 'test_jacob_taylor_carolina_e2e.m4a',
      },
    });

    if (!response.ok()) {
      const errorText = await response.text();
      console.error(`Failed to create test song: ${response.status()} ${response.statusText()}`);
      console.error(`Response body: ${errorText}`);
    }

    expect(response.ok()).toBeTruthy();
    const song = await response.json();
    const testSongId = song.id;
    console.log(`Created test song with ID: ${testSongId}`);

    try {
    // 1. Navigate to home page
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('iTunes to Spotify');

    // 2. Click on "Start Matching Songs" button
    await page.click('text=Start Matching Songs');
    await expect(page).toHaveURL(/\/spotify-matcher/);

    // 3. Navigate directly to the test song using query param
    await page.goto(`/spotify-matcher?test_song_id=${testSongId}`);

    // 4. Wait for the review card to appear
    await expect(page.locator('[data-testid="review-card"]')).toBeVisible({
      timeout: 15000,
    });

    // 5. Verify correct song is loaded
    await expect(page.locator('[data-testid="library-song-title"]')).toContainText(
      'Carolina'
    );
    await expect(page.locator('[data-testid="library-song-artist"]')).toContainText(
      'Jacob Taylor'
    );

    // 6. Wait for Spotify match to load (the Match button should be enabled)
    const matchButton = page.locator('[data-testid="match-button"]');
    await expect(matchButton).toBeEnabled({ timeout: 15000 });

    // 7. Click the Match button
    await matchButton.click();

    // 8. Verify the match button shows loading state
    await expect(matchButton).toBeDisabled();

    // 9. Wait for the review to complete (card disappears, completion message appears)
    await expect(page.locator('text=Review Complete!')).toBeVisible({
      timeout: 10000,
    });

      // 10. Success! The song was matched
      console.log('Successfully matched song');
    } finally {
      // Clean up test song
      await request.delete(
        `${baseURL}/api/test/library-song?id=${testSongId}`,
        { headers }
      );
      console.log(`Deleted test song with ID: ${testSongId}`);
    }
  });

  test('should display correct UI elements on matcher page', async ({ page, request, baseURL }) => {
    // Create a different test song for this test to avoid interference
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    }

    const response = await request.post(`${baseURL}/api/test/library-song`, {
      headers,
      data: {
        title: 'Yesterday',
        artist: 'The Beatles',
        album: 'Help!',
        album_artist: 'The Beatles',
        filename: 'test_yesterday_ui.m4a',
      },
    });

    expect(response.ok()).toBeTruthy();
    const song = await response.json();
    const uiTestSongId = song.id;
    console.log(`Created UI test song with ID: ${uiTestSongId}`);

    try {
      // Navigate to matcher with test song
      await page.goto(`/spotify-matcher?test_song_id=${uiTestSongId}`);

      // Verify page title
      await expect(page.locator('h1')).toContainText('Spotify Matcher');

      // Verify review card appears
      await expect(page.locator('[data-testid="review-card"]')).toBeVisible({
        timeout: 15000,
      });

      // Verify both action buttons are present
      await expect(page.locator('[data-testid="match-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="skip-button"]')).toBeVisible();
    } finally {
      // Clean up the UI test song
      await request.delete(
        `${baseURL}/api/test/library-song?id=${uiTestSongId}`,
        { headers }
      );
      console.log(`Deleted UI test song with ID: ${uiTestSongId}`);
    }
  });
});
