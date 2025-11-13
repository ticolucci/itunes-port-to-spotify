import { test, expect } from '@playwright/test';

/**
 * E2E smoke test for Spotify Matcher flow
 * Tests the complete user journey from home page to matching a song
 */
test.describe('Spotify Matcher Smoke Test', () => {
  let testSongId: number;
  const testSongFilename = 'test_jacob_taylor_carolina_e2e.m4a';

  test.beforeEach(async ({ request, baseURL }) => {
    // Create test song in database
    const response = await request.post(`${baseURL}/api/test/library-song`, {
      data: {
        title: 'Carolina',
        artist: 'Jacob Taylor',
        album: 'The Road',
        album_artist: 'Jacob Taylor',
        filename: testSongFilename,
      },
    });

    expect(response.ok()).toBeTruthy();
    const song = await response.json();
    testSongId = song.id;
    console.log(`Created test song with ID: ${testSongId}`);
  });

  test.afterEach(async ({ request, baseURL }) => {
    // Clean up test song
    if (testSongId) {
      const response = await request.delete(
        `${baseURL}/api/test/library-song?id=${testSongId}`
      );
      expect(response.ok()).toBeTruthy();
      console.log(`Deleted test song with ID: ${testSongId}`);
    }
  });

  test('should navigate from home to matcher and match a song', async ({ page }) => {
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

    // 9. Wait for the review card to disappear or move to next song
    // (The card should either disappear or show a different song)
    await expect(page.locator('[data-testid="review-card"]')).not.toContainText(
      'Carolina',
      { timeout: 10000 }
    );

    // 10. Success! The song was matched and we moved on
    console.log('Successfully matched song and moved to next review');
  });

  test('should display correct UI elements on matcher page', async ({ page }) => {
    // Navigate to matcher with test song
    await page.goto(`/spotify-matcher?test_song_id=${testSongId}`);

    // Verify page title
    await expect(page.locator('h1')).toContainText('Spotify Matcher');

    // Verify review card appears
    await expect(page.locator('[data-testid="review-card"]')).toBeVisible({
      timeout: 15000,
    });

    // Verify both action buttons are present
    await expect(page.locator('[data-testid="match-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="skip-button"]')).toBeVisible();
  });
});
