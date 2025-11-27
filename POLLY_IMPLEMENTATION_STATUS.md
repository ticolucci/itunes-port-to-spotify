# Polly.js Implementation Status

**Last Updated:** November 27, 2025
**Status:** Partially Implemented - Recording Works, Replay Needs Fix

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

### Recording Mode
- ✅ **Successfully records real Spotify API calls:**
  ```bash
  POLLY_MODE=record npm test -- lib/spotify.test.ts
  ```
  - Creates 80KB HAR file with real API responses
  - Auth tokens properly sanitized to "Bearer REDACTED"
  - Recordings saved to `test/recordings/unit/spotify-client_*/recording.har`

## ⚠️ Known Issues

### Issue 1: Replay Mode Not Working

**Problem:**
Tests fail in replay mode because Polly cannot match incoming requests to recorded requests.

**Error:**
```
[Polly] [adapter:fetch] Recording not found for fetch request
```

**Current Configuration:**
```typescript
matchRequestsBy: {
  headers: false,  // Ignore headers (auth tokens change)
  body: false,     // Ignore body (Spotify OAuth in body)
  url: {
    protocol: true,
    hostname: true,
    port: true,
    pathname: true,
    query: true,    // Match query parameters
    hash: false,
  },
  order: false,    // Don't care about request order
}
```

**Likely Causes:**
1. **Request URL mismatch** - Query parameters might be in different order
2. **Persister file structure** - Polly creates subdirectories with timestamps
3. **OAuth token requests** - Initial token request might not be recorded/replayed correctly
4. **Method matching** - Need to verify HTTP methods (GET/POST) are matching

**Potential Solutions:**
1. **Debug request matching:**
   - Add logging to see actual vs expected request URLs
   - Compare recorded HAR file requests to test requests

2. **Simplify URL matching:**
   ```typescript
   url: {
     pathname: true,  // Only match path, ignore query params
     query: false,
   }
   ```

3. **Use passthrough for OAuth:**
   ```typescript
   server
     .any('https://accounts.spotify.com/api/token')
     .passthrough()  // Let OAuth happen normally, only record search
   ```

4. **Flatten recording structure:**
   - Configure Polly to use flat files instead of subdirectories
   - May need custom persister configuration

### Issue 2: Recording File Organization

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

## 🔧 Usage (Current State)

### Recording Tests
```bash
# Set Spotify credentials
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"

# Run tests in record mode
POLLY_MODE=record npm test -- lib/spotify.test.ts
```

**Status:** ✅ Works - Creates recordings with real API data

### Replaying Tests
```bash
# Run tests in replay mode (default)
POLLY_MODE=replay npm test -- lib/spotify.test.ts
# or just:
npm test -- lib/spotify.test.ts
```

**Status:** ❌ Fails - Cannot match requests to recordings

## 🎯 Next Steps

### Immediate (Fix Replay)
1. **Debug request matching:**
   - Log actual request URLs during replay
   - Compare to recorded requests in HAR file
   - Identify mismatch (likely query params or OAuth)

2. **Adjust matching configuration:**
   - Try simpler URL matching
   - Consider passthrough for OAuth endpoints
   - Test with single request first

3. **Test replay:**
   ```bash
   POLLY_MODE=replay npm test -- lib/spotify.test.ts
   ```

### Short-term (Complete Unit Tests)
1. Migrate remaining test files:
   - `lib/track-similarity.test.ts`
   - `app/spotify-matcher/` tests (if needed)

2. Update `.gitignore`:
   ```gitignore
   # Keep recordings but ignore sensitive data
   test/recordings/**/*.har
   !test/recordings/README.md
   ```

3. Document replay solution in this file

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
