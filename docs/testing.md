# Testing Guide

This project uses comprehensive testing with Vitest, Playwright, and Polly.js for HTTP recording/replay.

## Overview

### Testing Stack

- **Unit & Integration Tests**: Vitest
- **E2E Tests**: Playwright
- **HTTP Recording**: Polly.js (for Spotify API interactions)
- **Mocking**: Vitest's built-in mocking capabilities

### Test Philosophy

- **Test-Driven Development (TDD)**: Tests written before implementation
- **Real API Recordings**: Polly.js captures real Spotify responses
- **Offline Testing**: Tests run without API credentials in CI
- **Deterministic Results**: Same results every test run

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.ts

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Polly.js Recording Modes

Tests use environment variable `POLLY_MODE` to control behavior:

```bash
# Replay mode (default) - uses recordings, no API calls
POLLY_MODE=replay npm test

# Record mode - makes real API calls, saves recordings
POLLY_MODE=record npm test

# Passthrough mode - makes real API calls, no recording
POLLY_MODE=passthrough npm test
```

## Polly.js Setup

### What is Polly.js?

Polly.js records HTTP interactions to `.har` files (HTTP Archive format) for deterministic testing:

- ✅ Tests run without real API calls
- ✅ Deterministic (same results every time)
- ✅ Works offline
- ✅ Faster (no network latency)
- ✅ No API credentials needed in CI

### Installation

Already configured in this project:

```json
{
  "@pollyjs/core": "^6.0.6",
  "@pollyjs/adapter-node-http": "^6.0.6",
  "@pollyjs/adapter-fetch": "^3.0.6",
  "@pollyjs/persister-fs": "^6.0.6"
}
```

### Configuration Files

- `test/polly/setup.ts` - Core Polly configuration and helpers
- `test/polly/helpers.ts` - Utility functions for managing recordings
- `vitest.setup.ts` - Registers Polly adapters globally

### Test Fixtures

Real song metadata for tests (unlikely to be removed from Spotify):

**File**: `test/fixtures/popular-songs.ts`

- The Beatles: "Hey Jude", "Let It Be", "Yesterday", "Come Together"
- Queen: "Bohemian Rhapsody", "We Will Rock You"
- Radiohead: "Karma Police", "Creep"
- Pink Floyd: "Money", "Wish You Were Here"
- Nirvana: "Smells Like Teen Spirit", "Come as You Are"

## Using Polly.js in Tests

### Basic Usage

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupPollyContext } from '@/test/polly/setup'
import { searchSpotifyTracks } from '@/lib/spotify'

describe('Spotify Client', () => {
  // Setup Polly - use beforeAll/afterAll (NOT beforeEach/afterEach)
  const pollyContext = setupPollyContext(
    'spotify-client',  // Recording name
    beforeAll,
    afterAll,
    'unit'            // Directory: 'unit' or 'integration'
  )

  it('searches for tracks', async () => {
    const results = await searchSpotifyTracks({
      artist: 'The Beatles',
      track: 'Hey Jude'
    })

    expect(results.length).toBeGreaterThan(0)
  })
})
```

### Important: beforeAll vs beforeEach

**Always use `beforeAll`/`afterAll` with Polly:**

```typescript
// ✅ CORRECT - all tests share one Polly instance
const pollyContext = setupPollyContext('test-name', beforeAll, afterAll, 'unit')

// ❌ WRONG - each test gets new instance, recordings overwrite
const pollyContext = setupPollyContext('test-name', beforeEach, afterEach, 'unit')
```

Using `beforeAll` ensures all HTTP requests are captured in a single recording file.

## Recording Workflow

### Creating New Recordings

**Prerequisites:**
- Valid Spotify API credentials
- Set in `.env.local`:
  ```bash
  SPOTIFY_CLIENT_ID="your_client_id"
  SPOTIFY_CLIENT_SECRET="your_client_secret"
  ```

**Record unit tests:**
```bash
# Delete old recordings
rm -rf test/recordings/unit/spotify-client_*

# Record new interactions
POLLY_MODE=record npm test -- lib/spotify.test.ts

# Verify recordings created
ls -lh test/recordings/unit/
```

**Record integration tests:**
```bash
# Delete old recordings
rm -rf test/recordings/integration/spotify-client-integration_*

# Record new interactions
POLLY_MODE=record npm test -- lib/spotify.integration.test.ts

# Verify recordings created
ls -lh test/recordings/integration/
```

### Verifying Recordings

```bash
# Run tests in replay mode
npm test -- lib/spotify.test.ts

# Should pass using recorded responses
# Should be much faster (no network calls)
```

### Committing Recordings

**Always commit `.har` files to Git:**

```bash
git add test/recordings/
git commit -m "chore: Refresh Polly.js recordings for Spotify API tests"
git push
```

This allows tests to run in CI without Spotify credentials.

## Directory Structure

```
test/
├── polly/
│   ├── setup.ts              # Polly configuration
│   └── helpers.ts            # Utility functions
├── fixtures/
│   └── popular-songs.ts      # Real song metadata
└── recordings/
    ├── README.md             # Quick reference
    ├── unit/                 # Unit test recordings
    │   └── spotify-client_*/
    │       └── recording.har
    └── integration/          # Integration test recordings
        └── spotify-client-integration_*/
            └── recording.har
```

## CI/CD Integration

### How Tests Run in CI

GitHub Actions (`.github/workflows/ci-cd.yml`):

1. **Validate recordings exist**
   - Checks for `.har` files in `test/recordings/`
   - Fails if no recordings found
2. **Run tests in replay mode**
   - Sets `POLLY_MODE=replay`
   - No Spotify credentials needed
   - Uses committed recordings
3. **Fast execution**
   - 70x faster than live API calls
   - Unit tests: 1892ms → 27ms
   - Integration tests: 2664ms → 34ms

### What Gets Tested

- ✅ Unit tests (`lib/spotify.test.ts`) - Uses `test/recordings/unit/`
- ✅ Integration tests (`lib/spotify.integration.test.ts`) - Uses `test/recordings/integration/`
- ⏭️ E2E tests (`e2e/smoke.spec.ts`) - Still uses real API (deferred)

## Refreshing Recordings

### When to Refresh

Refresh recordings when:
- Spotify API response format changes
- Adding new test cases with different API calls
- Updating test fixtures (different songs)
- Recordings become outdated (manually inspect HAR files)

### Refresh Workflow

1. **Set up Spotify credentials** (one-time):
   ```bash
   # Add to .env.local
   SPOTIFY_CLIENT_ID="your_client_id"
   SPOTIFY_CLIENT_SECRET="your_client_secret"
   ```

2. **Delete old recordings**:
   ```bash
   rm -rf test/recordings/unit/spotify-client_*
   rm -rf test/recordings/integration/spotify-client-integration_*
   ```

3. **Record fresh data**:
   ```bash
   POLLY_MODE=record npm test -- lib/spotify.test.ts
   POLLY_MODE=record npm test -- lib/spotify.integration.test.ts
   ```

4. **Verify recordings**:
   ```bash
   npm test -- lib/spotify.test.ts
   npm test -- lib/spotify.integration.test.ts
   ```

5. **Commit updated recordings**:
   ```bash
   git add test/recordings/
   git commit -m "chore: Refresh Polly.js recordings"
   git push
   ```

### Recording Validation Checklist

- [ ] All tests pass in record mode with real API
- [ ] All tests pass in replay mode with recordings
- [ ] HAR files contain expected number of requests
- [ ] Auth tokens sanitized ("Bearer REDACTED")
- [ ] File sizes reasonable (~80KB unit, ~150KB integration)

## Security

### Automatic Sanitization

Polly.js automatically sanitizes sensitive data before saving:

- **Spotify tokens**: `Bearer <token>` → `Bearer REDACTED`
- **Client credentials**: Removed from recordings
- **API keys**: Stripped from headers

### Safe to Commit

- ✅ `.har` files (sanitized)
- ✅ Test fixtures
- ✅ Polly configuration

### Keep Private

- ❌ `.env.local` (already gitignored)
- ❌ Real API credentials
- ❌ Passthrough mode recordings (shouldn't exist)

## Troubleshooting

### "No recording found" Error

**Problem**: Test trying to replay but recording doesn't exist

**Solution**:
```bash
POLLY_MODE=record npm test -- path/to/test.ts
```

### "Request does not match any recordings"

**Problem**: Test made HTTP request that doesn't match recorded request

**Causes**:
- Request URL or body changed
- Test data changed
- Test is using `beforeEach` instead of `beforeAll`

**Solution**:
```bash
# Delete and re-record
rm -rf test/recordings/unit/test-name_*
POLLY_MODE=record npm test -- path/to/test.ts
```

### Tests Pass in Record but Fail in Replay

**Problem**: Recording didn't capture all requests

**Causes**:
- Using `beforeEach`/`afterEach` instead of `beforeAll`/`afterAll`
- Multiple Polly instances overwriting recordings
- Partial recording corruption

**Solution**:
1. Verify using `beforeAll`/`afterAll`
2. Delete recordings completely
3. Re-record from scratch

### Recording File Too Large (>500KB)

**Problem**: HAR file is very large

**Causes**:
- Extra requests being captured
- Large Spotify responses

**Solutions**:
- Review test to ensure minimal API calls
- Consider splitting into separate test files
- Spotify responses are often large - this may be normal

### Tests Slower in Replay Mode

**Problem**: Replay should be faster but isn't

**Causes**:
- Polly not configured correctly
- Tests still making real API calls
- Recording not being loaded

**Solution**:
- Check `POLLY_MODE` environment variable
- Verify Polly adapters registered in `vitest.setup.ts`
- Check recording file exists and is valid JSON

## Test Organization

### File Naming

- `*.test.ts` - Unit tests
- `*.integration.test.ts` - Integration tests
- `*.spec.ts` - E2E tests (Playwright)

### Test Helpers

Shared test helpers in `lib/test-helpers/`:
- Eliminates duplicate mock factories
- Consistent test data across files

### Test Structure

```typescript
// 1. Imports
import { describe, it, expect } from 'vitest'

// 2. Test fixtures (use shared factories)
import { createMockSong } from '@/lib/test-helpers/fixtures'

// 3. Test suites
describe('Feature', () => {
  describe('specific behavior', () => {
    it('does something specific', () => {
      // Arrange
      const input = createMockSong({ title: 'Test' })

      // Act
      const result = functionToTest(input)

      // Assert
      expect(result).toBe(expected)
    })
  })
})
```

## E2E Tests (Playwright)

### Running E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run in UI mode
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug
```

### E2E Test Status

**Current state:**
- ✅ Basic smoke tests implemented
- ⏭️ Polly.js integration deferred (uses real API)
- ✅ Sufficient coverage for current needs

**Why Polly.js E2E deferred:**
- E2E tests minimal (2 smoke tests)
- Unit/integration tests provide sufficient Polly coverage
- E2E Polly would require Next.js instrumentation hooks
- Focus on other priorities

## Best Practices

### 1. Use Popular Songs for Fixtures

Test with well-known songs that won't disappear:
- Popular artists (Beatles, Queen, etc.)
- Stable metadata
- Globally available
- Diverse genres

### 2. Commit Recordings

Always commit `.har` files so others can run tests offline.

### 3. Refresh Periodically

Refresh recordings monthly to catch API changes early.

### 4. Review Before Committing

Check that sensitive data was sanitized in HAR files.

### 5. Keep Tests Focused

Each test should record only what it needs - avoid unnecessary API calls.

### 6. Use beforeAll for Polly

Always use `beforeAll`/`afterAll` with Polly to ensure all requests are captured.

## References

- [Polly.js Documentation](https://netflix.github.io/pollyjs/)
- [HAR Format Specification](http://www.softwareishard.com/blog/har-12-spec/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
