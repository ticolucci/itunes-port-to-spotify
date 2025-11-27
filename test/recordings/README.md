# Polly.js HTTP Recordings

This directory contains HTTP recordings captured by Polly.js for testing with the Spotify API.

## Directory Structure

```
recordings/
├── unit/          # Unit test recordings
├── e2e/           # End-to-end test recordings
├── shared/        # Shared recordings across test types
└── README.md      # This file
```

## What are these recordings?

Polly.js records HTTP interactions (requests and responses) to `.har` files (HTTP Archive format). These recordings allow tests to:

- ✅ Run without making real API calls
- ✅ Be deterministic (same results every time)
- ✅ Work offline
- ✅ Run faster (no network latency)
- ✅ Not require Spotify API credentials in CI

## Recording Modes

Polly operates in three modes controlled by the `POLLY_MODE` environment variable:

### `replay` (default)
- Uses existing recordings
- No real API calls made
- Tests fail if recording doesn't exist
- **Used in CI and normal development**

### `record`
- Makes real API calls
- Saves responses to `.har` files
- **Requires valid Spotify credentials**
- Use this mode to create or update recordings

### `passthrough`
- Makes real API calls but doesn't record
- Useful for debugging
- Requires valid Spotify credentials

## Usage

### Running tests with recordings (default)
```bash
npm test
# or explicitly:
POLLY_MODE=replay npm test
```

### Recording new test data
```bash
# Set your Spotify credentials
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"

# Run tests in record mode
POLLY_MODE=record npm test
```

### Refreshing all recordings
```bash
# Delete old recordings
rm -rf test/recordings/unit/*.har
rm -rf test/recordings/e2e/*.har

# Record fresh data
POLLY_MODE=record npm test
POLLY_MODE=record npm run test:e2e
```

## When to update recordings

Update recordings when:
- Spotify API response format changes
- New tests are added that make API calls
- Test fixtures (popular songs) are updated
- Recordings become stale (API data has changed)

## Security Notes

### What's sanitized
Polly automatically sanitizes sensitive data before saving:
- Spotify access tokens → `Bearer REDACTED`
- Client credentials → `REDACTED`

### What's safe to commit
- ✅ `.har` files (sanitized)
- ✅ This README

### What to keep private
- ❌ Your `.env.local` with real credentials (already gitignored)
- ❌ Any recordings made in passthrough mode (shouldn't exist)

## CI/CD

In GitHub Actions:
- `POLLY_MODE=replay` is set automatically
- No Spotify credentials needed (uses recordings)
- Tests fail if recordings are missing

## Troubleshooting

### "No recording found" error
**Problem:** Test is trying to replay but recording doesn't exist

**Solution:**
```bash
# Record the missing test
POLLY_MODE=record npm test -- path/to/test.ts
```

### "Request does not match any recordings"
**Problem:** Test made an HTTP request that doesn't match any recorded request

**Causes:**
- Request URL or body changed
- Test data changed
- Request headers changed (shouldn't happen - headers are ignored)

**Solution:**
```bash
# Delete and re-record the test
rm test/recordings/unit/test-name.har
POLLY_MODE=record npm test -- path/to/test.ts
```

### Recordings are too large
**Problem:** `.har` files are very large (>1MB)

**Solution:**
- Consider using shared recordings for common requests
- Spotify responses can be large; this is normal
- Git handles text files efficiently (they compress well)

## Examples

### Recording a specific test file
```bash
POLLY_MODE=record npm test -- lib/spotify.test.ts
```

### Recording E2E tests
```bash
# Start dev server
npm run dev &

# Record E2E interactions
POLLY_MODE=record POLLY_E2E_MODE=true npm run test:e2e

# Stop dev server
kill %1
```

## Best Practices

1. **Use popular songs** - Test fixtures use well-known songs that won't disappear from Spotify
2. **Commit recordings** - Always commit `.har` files so others can run tests
3. **Re-record periodically** - Refresh recordings monthly to catch API changes
4. **Review before committing** - Check that sensitive data was sanitized
5. **Keep recordings focused** - Each test should record only what it needs

## Learn More

- [Polly.js Documentation](https://netflix.github.io/pollyjs/)
- [HAR Format Specification](http://www.softwareishard.com/blog/har-12-spec/)
- [Test Fixtures Documentation](../fixtures/popular-songs.ts)
