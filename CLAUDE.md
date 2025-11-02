# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Ruby project that ports an iTunes music library to Spotify. It parses iTunes library metadata into a SQLite database and uses the Spotify API to search for matching tracks.

## Development Commands

### Testing
```bash
# Run all tests
bundle exec rspec

# Run specific test file
bundle exec rspec spec/song_record_spec.rb

# Run single test by line number
bundle exec rspec spec/song_record_spec.rb:16

# Run acceptance tests (requires RUN_ACCEPTANCE=1 and Spotify credentials)
RUN_ACCEPTANCE=1 bundle exec rspec spec/acceptance/project_spec.rb
```

### Dependencies
```bash
# Install dependencies
bundle install
```

## Architecture

### Core Components

**SongRecord** (`lib/song_record.rb`)
- Model representing a song from the iTunes library
- Attributes: id, title, artist, album, album_artist, filename
- Class method `process_in_db_batches` iterates through the database using an id-cursor pattern (WHERE id > ?) instead of LIMIT/OFFSET for efficient batch processing
- Relies on global `$db` variable for database access

**SpotifyClient** (`lib/spotify_client.rb`)
- Handles Spotify API authentication and search
- `SpotifyClient.setup` - Class method that fetches app-level access token using client credentials from `.secrets` file
- `#search(attrs)` - Searches Spotify using tagged query parameters (track:, artist:, album:, albumartist:)
- Reads CLIENT_ID and CLIENT_SECRET from `.secrets` via Dotenv

**Bootstrap Script** (`scripts/bootstrap_songs_table_from_itunes_lib.rb`)
- One-time import script that parses iTunes library JSON export (`ipod_library_with_files.txt`)
- Creates/drops songs table and populates it with metadata
- Expects newline-delimited JSON format where each song object is on separate lines

### Database Schema

SQLite database (`database.db`) with single `songs` table:
- id (INTEGER PRIMARY KEY)
- title, album, artist, album_artist, filename (TEXT)
- Index on (artist, album, album_artist)

The database file is encrypted with git-crypt and should not be committed unencrypted.

### Testing Patterns

- Uses RSpec with `spec_helper.rb` that auto-loads all `lib/**/*.rb` files
- Database tests use in-memory SQLite (`:memory:`) with `around(:each)` hooks to set up global `$db`
- Spotify API tests stub HTTParty responses using a `stub_api_response` helper
- Acceptance tests are opt-in via `RUN_ACCEPTANCE=1` environment variable

### Security & Secrets

- **git-crypt** is used to encrypt sensitive files (`database.db`, `.secrets`, `.env`, `*.key`, `*.pem`)
- See `README_git_crypt.md` for setup instructions
- `.secrets` file contains CLIENT_ID and CLIENT_SECRET for Spotify API
- Never commit unencrypted secrets

## Future Work

See `Stories.md` for planned features and current priorities, including:
- Spotify query escaping for special characters
- Interactive CLI for reviewing search results
- OAuth flow for user library mutations
- Rate limiting and retry logic
- Token expiration handling
