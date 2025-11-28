# Polly.js Implementation Status

**Last Updated:** November 28, 2025
**Status:** ✅ Fully Implemented - Unit and Integration Tests Complete

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
    ├── e2e/                  # E2E recordings (not yet implemented)
    └── shared/               # Shared recordings (not yet implemented)
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

### Long-term (E2E & CI/CD)
1. **E2E Implementation:**
   - Create `app/api/polly/middleware.ts` for server-side recording
   - Update `e2e/smoke.spec.ts` to use popular song fixtures
   - Record E2E Spotify API calls

2. **CI/CD Integration:**
   - Update `.github/workflows/ci-cd.yml`:
     ```yaml
     env:
       POLLY_MODE: replay
       # No Spotify credentials needed!
     ```
   - Commit recordings to repository
   - Tests run offline in CI using recordings

3. **Maintenance:**
   - Monthly recording refresh script
   - Recording validation in CI
   - Documentation updates

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
