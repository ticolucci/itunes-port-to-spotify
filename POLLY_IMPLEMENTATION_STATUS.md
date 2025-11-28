# Polly.js Implementation Status

**Last Updated:** November 28, 2025
**Status:** ✅ Complete - Unit and Integration Tests Fully Implemented with CI/CD (E2E Skipped)

## Overview

This document tracks the implementation of Polly.js HTTP recording/replay for testing with the Spotify API. The goal is to replace manual mocks with real API response recordings.

## ✅ What's Working

### Infrastructure Setup
- ✅ **Polly.js packages installed:**
  - `@pollyjs/core` - Core Polly functionality
  - `@pollyjs/adapter-node-http` - Intercepts Node.js HTTP/HTTPS
  - `@pollyjs/adapter-fetch` - Intercepts fetch API (Spotify SDK uses this)
  - `@pollyjs/persister-fs` - Saves recordings to filesystem

- ✅ **Configuration files created:**
  - `test/polly/setup.ts` - Core Polly configuration and helpers
  - `test/polly/helpers.ts` - Utility functions for managing recordings
  - `test/fixtures/popular-songs.ts` - Real song metadata for tests
  - `test/recordings/README.md` - Documentation for recordings

- ✅ **Vitest integration:**
  - `vitest.setup.ts` updated to register Polly adapters
  - `setupPollyContext()` function for easy test integration

### Test Fixtures
- ✅ **Created real song fixtures** (`test/fixtures/popular-songs.ts`):
  - The Beatles: "Hey Jude", "Let It Be", "Yesterday", "Come Together"
  - Queen: "Bohemian Rhapsody", "We Will Rock You"
  - Radiohead: "Karma Police", "Creep"
  - Pink Floyd: "Money", "Wish You Were Here"
  - Nirvana: "Smells Like Teen Spirit", "Come as You Are"

  These songs are:
  - Popular and unlikely to be removed from Spotify
  - Well-known with stable metadata
  - Globally available
  - Representative of diverse genres

### Test Migration
- ✅ **Migrated `lib/spotify.test.ts`:**
  - Removed manual `vi.mock()` for Spotify SDK
  - Uses `setupPollyContext()` for HTTP interception
  - Tests now use real song fixtures instead of fake data
  - Tests adjusted for real API responses (e.g., "Hey Jude - Remastered 2015")

### Recording and Replay Modes
- ✅ **Successfully records real Spotify API calls:**
  ```bash
  POLLY_MODE=record npm test -- lib/spotify.test.ts
  ```
  - Creates 80KB HAR file with real API responses
  - Captures 6 HTTP requests (1 OAuth POST + 5 search GETs)
  - Auth tokens properly sanitized to "Bearer REDACTED"
  - Recordings saved to `test/recordings/unit/spotify-client_*/recording.har`

- ✅ **Successfully replays recorded API calls:**
  ```bash
  POLLY_MODE=replay npm test -- lib/spotify.test.ts
  ```
  - All 19 tests pass using recorded responses
  - No real API calls made (70x faster: 27ms vs 1892ms)
  - Works in CI without Spotify credentials

## ✅ Fixed Issues

### Issue 1: Replay Mode Not Working (FIXED ✅)

**Original Problem:**
Tests failed in replay mode because each test created a new Polly instance, overwriting previous recordings. Only the last test's requests were saved.

**Root Cause:**
The test used `beforeEach`/`afterEach` hooks to create a Polly instance for each test. All tests used the same recording name ("spotify-client"), so:
1. Test 1 runs → Creates recording with OAuth + Search 1
2. Test 2 runs → Overwrites recording with OAuth + Search 2
3. Test N runs → Only final recording survives

**Solution:**
Changed from `beforeEach`/`afterEach` to `beforeAll`/`afterAll`:

```typescript
// Before (broken):
const pollyContext = setupPollyContext('spotify-client', beforeEach, afterEach, 'unit')

// After (fixed):
const pollyContext = setupPollyContext('spotify-client', beforeAll, afterAll, 'unit')
```

This makes all tests share a single Polly instance that records ALL requests:
- 1 POST to `https://accounts.spotify.com/api/token` (OAuth)
- 5 GET requests to `https://api.spotify.com/v1/search?...` (searches)

**Verification:**
```bash
# Recording mode - captures all requests
POLLY_MODE=record npm test -- lib/spotify.test.ts
✓ 19 tests pass in 1892ms

# Replay mode - uses recorded responses (no API calls)
POLLY_MODE=replay npm test -- lib/spotify.test.ts
✓ 19 tests pass in 27ms (70x faster!)
```

### Issue 2: Recording File Organization (Accepted as Polly Default)

**Problem:**
Polly creates subdirectories with timestamps (e.g., `spotify-client_1621079015/recording.har`) instead of flat files.

**Impact:**
- Less obvious file structure
- Harder to manage recordings
- May contribute to replay matching issues

**Potential Solution:**
- Research Polly persister options for flat file structure
- Or accept the subdirectory structure and adjust .gitignore accordingly

## 📁 File Structure

```
test/
├── polly/
│   ├── setup.ts              # Polly configuration
│   └── helpers.ts            # Utility functions
├── fixtures/
│   └── popular-songs.ts      # Real song metadata
└── recordings/
    ├── README.md             # Recording documentation
    ├── unit/                 # Unit test recordings
    │   └── spotify-client_*/
    │       └── recording.har # 80KB HAR file
    └── integration/          # Integration test recordings
        └── spotify-client-integration_*/
            └── recording.har
```

## 🔧 Usage

### Recording Tests
```bash
# Set Spotify credentials
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"

# Run tests in record mode
POLLY_MODE=record npm test -- lib/spotify.test.ts
```

**Status:** ✅ Works - Creates recordings with real API data (6 requests captured)

### Replaying Tests
```bash
# Run tests in replay mode (default)
POLLY_MODE=replay npm test -- lib/spotify.test.ts
# or just:
npm test -- lib/spotify.test.ts
```

**Status:** ✅ Works - All 19 tests pass using recorded responses (70x faster than live API)

## 🎯 Next Steps

### ✅ Short-term (Complete Unit Tests) - COMPLETED

1. ✅ **Migrated integration tests**:
   - `lib/spotify.integration.test.ts` - migrated to use new Polly setup from `test/polly/setup.ts`
   - Uses `beforeAll`/`afterAll` to share single Polly instance across all tests
   - Recordings stored in `test/recordings/integration/`
   - Tests run 78x faster in replay mode (2664ms → 34ms)

   **Note**: Other test files (`lib/track-similarity.test.ts`, `app/spotify-matcher/*.test.tsx`) use pure functions or mocked APIs and don't need Polly integration.

2. ✅ **Updated `.gitignore`**:
   - Added clear documentation about Polly recording strategy
   - Recordings ARE committed to repository (not ignored)
   - Enables offline testing in CI without Spotify credentials

3. ✅ **Documented replay solution**:
   - Recording mode: `POLLY_MODE=record npm test -- <test-file>` (requires Spotify credentials)
   - Replay mode: `POLLY_MODE=replay npm test -- <test-file>` (default, uses recordings)
   - All requests captured in single HAR file per test suite
   - Auth tokens automatically sanitized to "Bearer REDACTED"

### ⏭️ E2E Implementation (Skipped)

**Decision:** E2E Polly integration has been deferred indefinitely.

**Rationale:**
- E2E tests currently use real Spotify API calls (acceptable for now)
- E2E test coverage is minimal (2 smoke tests)
- Unit and integration tests provide sufficient Polly coverage
- E2E Polly setup would require Next.js instrumentation hooks and additional complexity
- Focus efforts on other priorities

**Current E2E State:**
- `e2e/smoke.spec.ts` - Uses real Spotify API calls
- Tests are passing and provide adequate coverage
- No immediate need for HTTP recording/replay in E2E context

## ✅ CI/CD Integration

### Automated Testing in CI

**How it works:**
1. **Replay Mode by Default** - CI explicitly sets `POLLY_MODE=replay` to use committed recordings
2. **Recording Validation** - CI checks that recordings exist before running tests
3. **No Spotify Credentials Needed** - Unit and integration tests run offline using HAR files
4. **Fast Test Execution** - Tests run 70x faster in replay mode vs. live API

**CI Workflow** (`.github/workflows/ci-cd.yml`):
```yaml
- name: Validate Polly recordings exist
  # Checks for test/recordings/unit/ and test/recordings/integration/
  # Fails if no HAR files found

- name: Run tests (using Polly replay mode)
  env:
    POLLY_MODE: replay  # Explicit replay mode
  run: npm run test
```

**What gets tested in CI:**
- ✅ Unit tests (`lib/spotify.test.ts`) - Uses recordings from `test/recordings/unit/`
- ✅ Integration tests (`lib/spotify.integration.test.ts`) - Uses recordings from `test/recordings/integration/`
- ⏭️ E2E tests (`e2e/smoke.spec.ts`) - Still uses real Spotify API calls

### Recording Refresh Workflow

**When to refresh recordings:**
- Spotify API response format changes
- Adding new test cases that make different API calls
- Updating test fixtures (e.g., changing searched songs)
- Recordings become outdated (manually check HAR files)

**How to refresh recordings:**

1. **Set up Spotify credentials locally** (one-time):
   ```bash
   # Create .env.local with your Spotify API credentials
   SPOTIFY_CLIENT_ID="your_client_id"
   SPOTIFY_CLIENT_SECRET="your_client_secret"
   ```

2. **Re-record unit tests:**
   ```bash
   # Delete old recordings
   rm -rf test/recordings/unit/spotify-client_*

   # Record new interactions
   POLLY_MODE=record npm test -- lib/spotify.test.ts

   # Verify new recordings were created
   ls -lh test/recordings/unit/
   ```

3. **Re-record integration tests:**
   ```bash
   # Delete old recordings
   rm -rf test/recordings/integration/spotify-client-integration_*

   # Record new interactions
   POLLY_MODE=record npm test -- lib/spotify.integration.test.ts

   # Verify new recordings were created
   ls -lh test/recordings/integration/
   ```

4. **Verify replay mode still works:**
   ```bash
   # Run tests in replay mode (default)
   npm test -- lib/spotify.test.ts
   npm test -- lib/spotify.integration.test.ts

   # Should pass using new recordings
   ```

5. **Commit updated recordings:**
   ```bash
   git add test/recordings/
   git commit -m "chore: Refresh Polly.js recordings for Spotify API tests"
   git push
   ```

**Recording validation checklist:**
- [ ] All tests pass in record mode with real API
- [ ] All tests pass in replay mode with recordings
- [ ] HAR files contain expected number of requests
- [ ] Auth tokens are sanitized ("Bearer REDACTED")
- [ ] Recording file sizes are reasonable (~80KB for unit, ~150KB for integration)
- [ ] Commit both unit and integration recordings together

**Troubleshooting refresh issues:**

**"Tests fail in record mode":**
- Check Spotify credentials are valid
- Verify song fixtures exist on Spotify (e.g., "Hey Jude" by The Beatles)
- Check internet connection
- Review Spotify API rate limits

**"Tests pass in record mode but fail in replay mode":**
- Delete recordings and re-record (Polly may have captured partial data)
- Check that `beforeAll`/`afterAll` are used (not `beforeEach`/`afterEach`)
- Verify recording file isn't corrupted (should be valid JSON)

**"Recording file is too large (>500KB)":**
- Check if extra requests are being captured
- Review test to ensure minimal API calls
- Consider splitting into separate test files

### Maintenance Best Practices

1. **Regular recording updates:**
   - Refresh recordings quarterly or when API changes
   - Test both record and replay modes before committing
   - Document any API behavior changes in commit messages

2. **Recording validation in CI:**
   - CI automatically validates recordings exist
   - Fails fast if recordings are missing
   - Prevents accidental API calls in CI environment

3. **Documentation maintenance:**
   - Update this document when changing Polly setup
   - Keep fixture songs list current (avoid removed songs)
   - Document known API quirks or edge cases

## 📚 References

- [Polly.js Documentation](https://netflix.github.io/pollyjs/)
- [HAR Format Spec](http://www.softwareishard.com/blog/har-12-spec/)
- [Test Fixtures](./test/fixtures/popular-songs.ts)
- [Recording README](./test/recordings/README.md)
- [Original Implementation Plan](./CLAUDE.md#pollyjs-implementation)

## 🤝 Getting Help

If you encounter issues:
1. Check this document for known issues
2. Review Polly.js documentation for matching configuration
3. Inspect HAR files to understand recorded requests
4. Try debugging with `POLLY_MODE=passthrough` to see real requests

## 📝 Notes

- **Why Polly?** Provides real API response testing without API credentials in CI
- **Why popular songs?** Stable, unlikely to change, globally available
- **Why both adapters?** Spotify SDK uses fetch API, not node-http
- **Security:** Auth tokens automatically sanitized before saving recordings
