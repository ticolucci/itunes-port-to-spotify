# Project Stories — itunes-port-to-spotify

This file collects short, actionable user stories and technical tasks for the project. Each story includes a brief description, acceptance criteria, and a suggested priority/size so we can pick the next work in small increments.

---

## 1) Improve Spotify query escaping/quoting (What's next)
- Description: Ensure `SpotifyClient#search` escapes and quotes values so special characters (quotes, parentheses, punctuation) produce predictable Spotify queries.
- Acceptance criteria:
  - Strings containing quotes or special characters are safely quoted or escaped in the generated `q` parameter.
  - Existing specs extended to cover special-character inputs and pass.
  - No change in external behavior for simple inputs.
- Priority: High
- Size: Small

## 3) Add acceptance tests for `SpotifyClient` with mocked HTTP
- Description: Avoid live network calls in tests by stubbing `HTTParty` or using WebMock; assert request parameters and simulate responses.
- Acceptance criteria:
  - All specs run offline and deterministic.
  - Coverage added for token fetch and search query formation.
- Priority: High
- Size: Small

## 4) Spotify search improvements: more types & options
- Description: Extend `SpotifyClient#search` to accept options (type, market, limit) and allow searching for album/artist results in addition to tracks.
- Acceptance criteria:
  - API supports type override (e.g., `type: 'artist,album'`) and passes tests.
  - Interface remains backward compatible.
- Priority: Medium
- Size: Medium

## 5) CLI to review search results and "like" tracks (user idea)
- Description: Interactive terminal UI to step through candidate Spotify results for a SongRecord, and mark chosen tracks to be added to a "liked" list or exported to Spotify. Should support keyboard-driven selection and batch actions.
- Acceptance criteria:
  - A `bin/` or `cli.rb` entry that loads songs (from DB or sample), runs search, shows a paginated list of candidates, and allows selecting one or more results.
  - Selected tracks are stored locally (and optionally added to Spotify later via OAuth) or printed as Spotify URIs.
  - Tests exist for CLI logic (non-interactive parts) and a manual demo is documented.
- Priority: High (user-requested)
- Size: Medium/Large (start with minimal non-curses CLI)

## 6) Add per-user OAuth flow and library mutation
- Description: Implement OAuth flow to add tracks directly to a user's Spotify library or create playlists on their behalf.
- Acceptance criteria:
  - `SpotifyClient` supports exchanging authorization code for user token.
  - Helper method to save a track to a user library given a track URI.
  - Documentation for obtaining client credentials and redirect setup.
- Priority: Medium
- Size: Large

## 7) Map iTunes songs to best Spotify match and persist mapping
- Description: Given a SongRecord, pick the top Spotify match or a chosen match via the CLI, store Spotify URI in the DB alongside the song for future syncs.
- Acceptance criteria:
  - DB schema updated (or new table) to store `spotify_uri` for songs.
  - Batch job can re-run and fill missing mappings.
  - Tests for mapping logic (scoring/selection) exist.
- Priority: High
- Size: Medium

## 8) Create playlist from liked tracks
- Description: Build a helper to assemble selected/liked tracks into a Spotify playlist and optionally add them to a user's account via OAuth.
- Acceptance criteria:
  - Playlist creation API wrapper implemented.
  - Works with test mocks and manual run with real tokens.
- Priority: Medium
- Size: Medium

## 9) Rate-limit handling, retry, and caching
- Description: Add request retry logic for transient failures and a simple cache (in-memory or file) for repeated searches to avoid hitting rate limits while iterating the library.
- Acceptance criteria:
  - Configurable retry/backoff for HTTP calls.
  - Cache used for repeated identical queries in a run.
  - Tests cover retry/backoff logic.
- Priority: Medium
- Size: Medium

## 10) History cleanup & git-crypt hygiene
- Description: If secrets were accidentally committed, provide a documented workflow (BFG or git-filter-repo) and ensure `.secrets` is git-ignored; confirm `.gitattributes` covers sensitive files.
- Acceptance criteria:
  - `README_git_crypt.md` updated with recommended cleanup steps.
  - `.gitignore` contains `.secrets` and any private-export files.
- Priority: High (security)
- Size: Small

## 11) CI: run tests, lint, and ensure no secrets in commits
- Description: Add a minimal GitHub Actions workflow (or equivalent) to run `bundle install` and `rspec`, and to scan commits for secrets using a lightweight detector.
- Acceptance criteria:
  - CI file added with test job.
  - PRs fail when specs fail.
- Priority: High
- Size: Small/Medium

## 12) Logging, metrics, and dry-run mode
- Description: Add structured logging for batch runs and a `--dry-run` option for CLI/batch jobs so the script can be used to preview changes without calling Spotify.
- Acceptance criteria:
  - Dry-run prints actions instead of executing them.
  - Logs are written to a file when requested.
- Priority: Medium
- Size: Small

## 13) UX improvements: better search scoring and fuzzy matching
- Description: Experiment with multiple query permutations, normalize tokens, and pick the best match using heuristics (Levenshtein, normalized artist/title match).
- Acceptance criteria:
  - A plugin point to run alternate queries and score results.
  - Tests demonstrate improved scoring for ambiguous titles.
- Priority: Low/Medium
- Size: Medium

## 14) Handle auth token expiration
- Description: Transparently refresh expired Spotify access tokens (both app-level client_credentials tokens and per-user OAuth tokens). Ensure requests automatically retry with a new token when necessary.
- Acceptance criteria:
  - `SpotifyClient` detects token expiration (based on response codes or expires_at) and can refresh tokens using stored credentials or refresh tokens.
  - Requests that fail due to expired token are retried once after refresh and succeed when possible.
  - Unit tests cover token refresh flow using mocked HTTP responses and ensure no infinite retry loops.
- Priority: High (stability)
- Size: Medium

---

## Done

- ## Replace LIMIT/OFFSET with id-cursor batch scan
- Description: Improved `SongRecord.process_in_db_batches` to use an id-cursor (WHERE id > last_id LIMIT batch) instead of LIMIT/OFFSET to make large-table scans more efficient and stable.
- Acceptance criteria:
  - Method iterates all rows in ascending id order without skipping or repeating when the table grows concurrently.
  - Tests simulate large sets using in-memory DB and still pass.
- Priority: High
- Size: Small/Medium