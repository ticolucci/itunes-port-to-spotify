# Polly.js HTTP Recordings

This directory contains HTTP recordings captured by Polly.js for testing with the Spotify API. These recordings allow tests to run offline without API credentials.

## Quick Reference

### Running Tests

```bash
# Replay mode (default) - uses recordings, no API calls
npm test

# Record mode - makes real API calls, saves recordings
POLLY_MODE=record npm test
```

### Recording New Tests

```bash
# 1. Set Spotify credentials in .env.local
SPOTIFY_CLIENT_ID="your_client_id"
SPOTIFY_CLIENT_SECRET="your_client_secret"

# 2. Record interactions
POLLY_MODE=record npm test -- lib/spotify.test.ts

# 3. Commit recordings
git add test/recordings/
git commit -m "chore: Update Polly.js recordings"
```

## Security

- ✅ Auth tokens automatically sanitized ("Bearer REDACTED")
- ✅ `.har` files are safe to commit
- ❌ Never commit `.env.local` with real credentials

## Full Documentation

For complete documentation on Polly.js setup, recording workflow, and troubleshooting, see:

**[docs/testing.md](../docs/testing.md)**
